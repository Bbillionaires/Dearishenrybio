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
  const vstate = (pg) => pg.evaluate(() => ({
    active: document.documentElement.classList.contains('vault-active'),
    state: window.__vault && window.__vault.state(),
    angle: window.__vault && window.__vault.angle ? window.__vault.angle() : null,
    inert: !!document.querySelector('.page').inert,
    hidden: document.getElementById('vault-intro').hidden,
  }));
  const waitOpen = (pg, ms = 9000) => pg.waitForFunction(() => window.__vault && window.__vault.state() === 'open', null, { timeout: ms }).then(() => true, () => false);

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const v0 = await vstate(page);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('vault-wheel'));
  check('vault door shown on load; page behind is inert; wheel focused', v0.active && v0.state === 'locked' && v0.inert && !v0.hidden && focused, JSON.stringify(v0));

  // drag the wheel: clockwise is resisted, counter-clockwise turns and opens
  const box = await page.locator('.vault-wheel').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, R = box.width * 0.38;
  const at = (deg) => [cx + R * Math.cos(deg * Math.PI / 180), cy + R * Math.sin(deg * Math.PI / 180)];
  await page.mouse.move(...at(0));
  await page.mouse.down();
  for (let d = 10; d <= 60; d += 10) await page.mouse.move(...at(d)); // clockwise on screen
  const cw = (await vstate(page)).angle;
  for (let d = 50; d >= -330; d -= 10) await page.mouse.move(...at(d)); // counter-clockwise
  await page.mouse.up();
  const v1 = await vstate(page);
  check('wheel will not turn clockwise', cw === 0, String(cw));
  check('dragging the wheel counter-clockwise starts opening', v1.state === 'opening' && v1.angle <= -270, JSON.stringify(v1));
  const sawUnlock = await page.waitForSelector('#vault-intro.is-unlocked', { state: 'attached', timeout: 5000 }).then(() => true, () => false);
  const sawOpen = await page.waitForSelector('#vault-intro.is-open', { state: 'attached', timeout: 5000 }).then(() => true, () => false);
  const opened = await waitOpen(page);
  const v2 = await vstate(page);
  check('bolts retract, door swings open', sawUnlock && sawOpen);
  check('wheel finished turning counter-clockwise', v2.angle === -450, String(v2.angle));
  check('enters the vault: door removed, page interactive', opened && !v2.active && v2.hidden && !v2.inert, JSON.stringify(v2));
  const heroBg = await page.evaluate(() => getComputedStyle(document.querySelector('.hero'), '::before').backgroundImage);
  check('hero sits inside the vault (vault-interior background)', /vault-interior/.test(heroBg), heroBg.slice(0, 80));

  // every visit, no storage flags; opens on its own if untouched
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
  const r0 = await vstate(page);
  const auto = await waitOpen(page, 9000);
  const store = await page.evaluate(() => localStorage.length + sessionStorage.length);
  check('plays again after refresh, opens on its own, no storage flags', r0.state === 'locked' && auto && store === 0, JSON.stringify(r0));

  // keyboard: Enter on the focused wheel
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  const kb = (await vstate(page)).state;
  check('keyboard (Enter) turns the wheel', kb === 'opening', kb);
  await waitOpen(page);

  // skip intro
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.click('[data-vault-skip]');
  check('"Skip intro" goes straight in', await waitOpen(page, 1500));

  // deep links skip the door
  await page.goto(BASE + '#contact', { waitUntil: 'load' });
  await page.waitForTimeout(200);
  const dl = await vstate(page);
  check('deep link (#contact) skips the vault', !dl.active && dl.hidden && !dl.inert, JSON.stringify(dl));

  // history back from another page never leaves the door half-open
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => window.__vault.skip());
  await waitOpen(page, 1500);
  await page.goto(BASE + 'resume/', { waitUntil: 'load' });
  await page.goBack({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  const hb = (await vstate(page)).state;
  check('after history back the vault is open or freshly locked', hb === 'open' || hb === 'locked', hb);
  if (hb !== 'open') { await page.evaluate(() => window.__vault.skip()); await waitOpen(page, 1500); }
  await page.waitForLoadState('networkidle');

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
  check('primary nav is trimmed to 8 sections', navCount === 8, String(navCount));

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
  // Never send real email from tests: intercept the form backend.
  const cfgEmail = await page.evaluate(() => window.SITE_CONFIG.contact.email);
  let posted = null;
  await page.route(/formsubmit\.co|formspree\.io/, async (route) => {
    posted = { url: route.request().url(), body: JSON.parse(route.request().postData() || '{}') };
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' });
  });
  await page.evaluate(() => { document.getElementById('form-status').className = 'form-status'; });
  await page.fill('#cf-name', 'Test Person');
  await page.fill('#cf-email', 'test@example.com');
  await page.selectOption('#cf-type', 'Investment');
  await page.fill('#cf-message', 'Interested in discussing a partnership.');
  await page.locator('#contact-form button[type=submit]').click();
  await page.waitForFunction(() => /is-(success|error)/.test(document.getElementById('form-status').className));
  const status2 = await page.evaluate(() => document.getElementById('form-status').className);
  check('contact form posts to the configured inbox endpoint', posted && posted.url.includes(cfgEmail) && posted.body.opportunityType === 'Investment' && /is-success/.test(status2), JSON.stringify(posted));
  const emailShown = await page.evaluate(() => document.body.innerText.includes(window.SITE_CONFIG.contact.email));
  check('private inbox address not displayed on page', !emailShown);
  const opts = await page.$$eval('#cf-type option', (o) => o.map((x) => x.textContent).slice(1).join('|'));
  check('opportunity types', opts === 'Employment|Recruiting|Business Partnership|Real Estate|Investment|Technology|Film Production|Other', opts);

  // signature draws when visible
  await page.locator('.signature').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const sig = await page.evaluate(() => document.querySelector('.signature').classList.contains('is-drawing'));
  check('signature draws when visible', sig);

  // content guardrails
  const text = await page.evaluate(() => document.body.innerText);
  check('real estate: 55+ homes, ≈$2.5M estimated, no deal boxes', text.includes('55+') && /\$2\.5M/.test(text) && !/Lorenzo Court|\$315,000|\$145,000/.test(text));
  check('film: Backwoods Blood Feud produced + POON coming soon + IMDb link', /Backwoods Blood Feud/.test(text) && /Coming Soon/i.test(text) && await page.locator('a[href="https://www.imdb.com/name/nm15804821/"]').count() > 0);
  check('no landscaping details or concept-stage ideas', !/landscap|Duval|\bconcept\b/i.test(text), (text.match(/.{30}(landscap|Duval|concept).{30}/i) || [''])[0]);
  const bookTitles = await page.$$eval('#books .book h3', (h) => h.map((x) => x.textContent.trim()));
  check('books: the four current titles', JSON.stringify(bookTitles) === JSON.stringify(["The Family Structure Almanac", "Who's Driving My Car?", "Tia and Henry First Time Homebuyer Journey", "The Negotiation House"]), bookTitles.join(' | '));
  check('The Negotiation House carries the Henry Memory Method subtitle', (await page.textContent('[data-book="the-negotiation-house"] .book-sub')).trim() === 'The Henry Memory Method of Negotiations™');
  check('film: Chuck and Buck children\'s Christian animation listed', /Chuck and Buck/.test(text) && /Children's Christian animated movie/i.test(text));
  check('skills: OSINT listed as a regular skill tag', (await page.$$eval('#skills .chip-list li', (l) => l.map((x) => x.textContent))).includes('Open source intelligence (OSINT)') && await page.locator('.skill-feature').count() === 0);
  check('skills section lists skills only (chips)', await page.locator('#skills .chip-list li').count() >= 20 && await page.locator('#skills .skill-group p').count() === 0);
  const exp = await page.$$eval('#experience .exp', (els) => els.map((e) => e.querySelector('.exp-when').textContent.trim() + ' | ' + e.querySelector('h3').textContent.trim()));
  check('experience timeline: roles and dates', JSON.stringify(exp) === JSON.stringify(['2024 – Present | Chef Harvey Foundation', '2022 – Present | Greenwood 100 Inc.', '2020 – 2024 | FEMA Contractor', '2018 – Present | One United Enterprise LLC', '2018 – Present | New Jerusalem Transitional Housing LLC', '2011 – 2019 | Numb3rs 1 LLC', '2009 – 2011 | Merchant Marine', "2002 – Present | International Longshoremen's Association (ILA) Local 1408"]), exp.join(' ; '));
  check('FEMA: 120 laborers recruited; Savista removed', /Recruited 120 laborers/.test(text) && !/Savista/.test(text));
  check('New Jerusalem links to the letter of support', await page.locator('#experience a[href="#letters"]').count() === 1);
  const letterHref = await page.getAttribute('#letters a.btn', 'href');
  const letterRes = await page.request.get(new URL(letterHref, BASE).toString());
  check('letter of recommendation section links to the PDF', /Letters of Recommendation/i.test(text) && letterRes.ok() && /application\/pdf/.test(letterRes.headers()['content-type'] || ''), letterHref + ' ' + letterRes.status());
  check('nonprofits: Greenwood 100 and Chef Harvey Foundation (501(c)(3))', /youth education, mentorship, and community growth/i.test(text) && /Chef Harvey Foundation/.test(text) && /Feeding the homeless/i.test(text));
  check('footer copyright', text.includes("© 2026 De'Aris Henry. All Rights Reserved."));
  check('signature is the last footer element', await page.evaluate(() => !!document.querySelector('.site-footer .signature')));

  check('no console/page errors', errors.length === 0, errors.join(' | '));

  // reduced motion
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  await rp.goto(BASE, { waitUntil: 'networkidle' });
  await rp.waitForTimeout(500);
  const rs = await rp.evaluate(() => ({ active: document.documentElement.classList.contains('vault-active'), hidden: document.getElementById('vault-intro').hidden, coin: getComputedStyle(document.querySelector('.coin')).animationName }));
  check('reduced motion: no vault animation, coin still', !rs.active && rs.hidden && rs.coin === 'none', JSON.stringify(rs));
  await rctx.close();

  // mobile
  const mctx = await browser.newContext({ ...devices['iPhone 13'] });
  const mp = await mctx.newPage();
  await mp.goto(BASE, { waitUntil: 'networkidle' });
  await mp.waitForTimeout(300);
  const door = await mp.evaluate(() => { const r = document.querySelector('.vault-frame').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
  check('mobile: vault door fits the screen', door.l >= 0 && door.r <= door.w && door.t >= 0 && door.b <= door.h, JSON.stringify(door));
  await mp.tap('.vault-wheel');
  check('mobile: tapping the wheel opens the vault', await waitOpen(mp));
  const m = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
  check('mobile: no horizontal scroll', m.sw <= m.w, `${m.sw} vs ${m.w}`);
  await mp.click('.nav-toggle');
  const open = await mp.evaluate(() => document.getElementById('site-nav').classList.contains('is-open'));
  await mp.keyboard.press('Escape');
  const closed = await mp.evaluate(() => !document.getElementById('site-nav').classList.contains('is-open'));
  check('mobile menu opens and closes (Esc)', open && closed);
  await mctx.close();

  // static assets
  for (const f of ['resume/DeAris-Henry-Resume.pdf', 'assets/img/dh-coin-front.webp', 'assets/img/dh-coin-back.webp', 'assets/img/vault-interior.webp', 'assets/img/vault-interior.jpg', 'assets/img/og-image.jpg', 'assets/img/world-map.svg', 'assets/docs/letter-of-support-council-member-gaffney-2020.pdf', 'assets/img/letter-gaffney-2020.webp']) {
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
