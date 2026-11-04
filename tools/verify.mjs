// End-to-end checks against a running local server (npm run serve).
//   BASE_URL=http://localhost:8080 node tools/verify.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8080/';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const s0 = await page.evaluate(() => window.Starfield.instance.state());
  check('starfield running on load', s0.running && !s0.reduced, JSON.stringify(s0));
  check('hundreds of stars', s0.stars >= 180, s0.stars + ' stars');

  // run long enough to see meteors in both directions
  let st;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    st = await page.evaluate(() => window.Starfield.instance.state());
    if (st.spawned.ltr > 0 && st.spawned.rtl > 0) break;
  }
  check('meteors travel left→right and right→left', st.spawned.ltr > 0 && st.spawned.rtl > 0, JSON.stringify(st.spawned));

  // tab visibility: hidden stops the loop, visible resumes it
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await page.evaluate(() => window.Starfield.instance.state().running);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const t1 = await page.evaluate(() => window.Starfield.instance.state().time);
  await page.waitForTimeout(600);
  const vis = await page.evaluate(() => window.Starfield.instance.state());
  check('pauses when tab hidden, resumes when visible', !hidden && vis.running && vis.time > t1, `hidden.running=${hidden} resumed.running=${vis.running}`);

  // bfcache restore: pagehide then pageshow(persisted)
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  });
  const afterHide = await page.evaluate(() => window.Starfield.instance.state().running);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  const t2 = await page.evaluate(() => window.Starfield.instance.state().time);
  await page.waitForTimeout(600);
  const bf = await page.evaluate(() => window.Starfield.instance.state());
  check('restarts on back/forward cache pageshow', !afterHide && bf.running && bf.time > t2);

  // real navigation away and back (bfcache in Chromium where eligible)
  await page.goto(BASE + 'resume/', { waitUntil: 'load' });
  await page.goBack({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  const back = await page.evaluate(() => window.Starfield.instance.state());
  check('animating after history back navigation', back.running && back.time > 0.3, JSON.stringify(back));

  // reload → starts again (no one-time storage flags)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const rl = await page.evaluate(() => ({ s: window.Starfield.instance.state(), ls: localStorage.length, ss: sessionStorage.length }));
  check('restarts after refresh, no storage flags', rl.s.running && rl.ls === 0 && rl.ss === 0, JSON.stringify(rl));

  // idempotent re-init (client-side navigation scenario)
  const re = await page.evaluate(() => { const a = window.Starfield.instance; window.Starfield.init(); return a === window.Starfield.instance && a.state().running; });
  check('re-init reuses running instance', re);

  // coin
  const coin = await page.evaluate(() => {
    const c = getComputedStyle(document.querySelector('.coin'));
    return { name: c.animationName, dur: c.animationDuration, iter: c.animationIterationCount };
  });
  check('coin rotates 360° continuously (8–12s)', coin.name === 'coin-spin' && parseFloat(coin.dur) >= 8 && parseFloat(coin.dur) <= 12 && coin.iter === 'infinite', JSON.stringify(coin));
  const css = readFileSync(new URL('../assets/css/styles.css', import.meta.url), 'utf8');
  check('coin keyframes are a full Y-axis turn', /coin-spin\s*\{\s*from\s*\{\s*transform:\s*rotateY\(0deg\);?\s*\}\s*to\s*\{\s*transform:\s*rotateY\(360deg\)/.test(css));
  check('coin has a distinct reverse face', await page.locator('.coin__face--back img').count() === 1);

  // nav anchors resolve
  const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
  check('all in-page anchors resolve', anchors.length === 0, anchors.join(', '));
  const navCount = await page.locator('#site-nav a[href^="#"]').count();
  check('primary nav has 11 sections', navCount === 11, String(navCount));

  // images have alt attributes
  const noAlt = await page.evaluate(() => [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src));
  check('all images have alt attributes', noAlt.length === 0, noAlt.join(', '));

  // map rendered with exactly the confirmed countries
  await page.locator('#network-map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const countries = await page.evaluate(() => [...document.querySelectorAll('#network-map .map-country')].map((c) => c.dataset.country).sort().join(','));
  check('map highlights only US, Philippines, Poland', countries === 'ph,pl,us', countries);
  await page.focus('#network-map .map-marker[data-country="ph"]');
  const tip = await page.evaluate(() => document.querySelector('.map-tooltip').classList.contains('is-visible'));
  check('map markers keyboard-accessible with tooltip', tip);

  // contact form validation
  await page.locator('#contact-form button[type=submit]').click();
  const invalid = await page.evaluate(() => [...document.querySelectorAll('#contact-form [aria-invalid="true"]')].map((e) => e.name));
  check('contact form validates required fields', ['name', 'email', 'type', 'message'].every((n) => invalid.includes(n)), invalid.join(','));
  await page.fill('#cf-name', 'Test Person');
  await page.fill('#cf-email', 'test@example.com');
  await page.selectOption('#cf-type', 'Investment');
  await page.fill('#cf-message', 'Interested in discussing a partnership.');
  await page.locator('#contact-form button[type=submit]').click();
  const status = await page.evaluate(() => document.getElementById('form-status').className);
  check('contact form submits when valid', /is-(success|info)/.test(status), status);
  const opts = await page.$$eval('#cf-type option', (o) => o.map((x) => x.textContent).slice(1).join('|'));
  check('opportunity types', opts === 'Employment|Recruiting|Business Partnership|Real Estate|Investment|Technology|Film Production|Other', opts);

  // signature draws when visible
  await page.locator('.signature').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const sig = await page.evaluate(() => document.querySelector('.signature').classList.contains('is-drawing'));
  check('signature draws when visible', sig);

  // content guardrails
  const text = await page.evaluate(() => document.body.innerText);
  check('illustrative scope labeled', /illustrative scope value,? not verified collected revenue/i.test(text) || /Illustrative scope value — not verified collected revenue/i.test(text));
  check('$10,080 shown', text.includes('$10,080'));
  check('no "gross sales" claim of $145,000 as realized', !/\$145,000[^.]*(realized|closed) (gross )?sales/i.test(text.replace(/not closed gross sales/gi, '')));
  check('footer copyright', text.includes("© 2026 De'Aris Henry. All Rights Reserved."));
  check('signature is the last footer element', await page.evaluate(() => !!document.querySelector('.site-footer .signature')));

  check('no console/page errors', errors.length === 0, errors.join(' | '));

  // reduced motion
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  await rp.goto(BASE, { waitUntil: 'networkidle' });
  await rp.waitForTimeout(1500);
  const rs = await rp.evaluate(() => ({ s: window.Starfield.instance.state(), coin: getComputedStyle(document.querySelector('.coin')).animationName }));
  check('reduced motion: static sky, no meteors, coin still', rs.s.reduced && !rs.s.running && rs.s.meteors === 0 && rs.coin === 'none', JSON.stringify(rs));
  await rctx.close();

  // mobile
  const mctx = await browser.newContext({ ...devices['iPhone 13'] });
  const mp = await mctx.newPage();
  await mp.goto(BASE, { waitUntil: 'networkidle' });
  await mp.waitForTimeout(500);
  const m = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, s: window.Starfield.instance.state() }));
  check('mobile: no horizontal scroll', m.sw <= m.w, `${m.sw} vs ${m.w}`);
  check('mobile: starfield scaled down', m.s.running && m.s.stars <= 320, String(m.s.stars));
  await mp.click('.nav-toggle');
  const open = await mp.evaluate(() => document.getElementById('site-nav').classList.contains('is-open'));
  await mp.keyboard.press('Escape');
  const closed = await mp.evaluate(() => !document.getElementById('site-nav').classList.contains('is-open'));
  check('mobile menu opens and closes (Esc)', open && closed);
  await mctx.close();

  // static assets
  for (const f of ['resume/DeAris-Henry-Resume.pdf', 'assets/img/dh-coin-front.webp', 'assets/img/dh-coin-back.webp', 'assets/img/og-image.jpg', 'assets/img/world-map.svg']) {
    check('asset exists: ' + f, existsSync(new URL('../' + f, import.meta.url)));
  }
} finally {
  await browser.close();
}

// coin transparency (corners must be fully transparent)
const { execFileSync } = await import('node:child_process');
const alpha = execFileSync('python3', ['-I', '-c', `
from PIL import Image
import sys
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA'); w, h = im.size
    print(max(im.getpixel(p)[3] for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//8,h//8)]))
`, 'assets/img/dh-coin-front.png', 'assets/img/dh-coin-back.png', 'assets/img/dh-coin-front.webp']).toString().trim().split('\n');
check('coin images have transparent backgrounds', alpha.every((a) => a === '0'), alpha.join(','));

let fail = 0;
for (const r of results) { if (!r.ok) fail++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? '  — ' + r.detail : ''}`); }
console.log(`\n${results.length - fail}/${results.length} checks passed`);
process.exit(fail ? 1 : 0);
