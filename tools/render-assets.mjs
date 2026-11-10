// Renders raster assets and the PDF resume with the pre-installed Playwright Chromium:
//   assets/img/dh-coin-{front,back}.{png,webp}  (512px, transparent)
//   assets/img/dh-coin-64.png, favicon-32.png, favicon-192.png, apple-touch-icon.png
//   assets/img/og-image.jpg                       (1200x630 social preview)
//   resume/DeAris-Henry-Resume.pdf                (ATS-friendly)
// WebP conversion uses Python Pillow when available.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const img = (f) => path.join(root, 'assets/img', f);
const url = (f) => 'file://' + path.join(root, f);

const browser = await chromium.launch();
try {
  // --- coin faces at 1024 (master), downscaled by Pillow ---
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const face of ['front', 'back']) {
    await page.goto(url('tools/coin.html') + '?face=' + face);
    await page.waitForSelector('body[data-ready]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: img(`dh-coin-${face}-1024.png`), omitBackground: true });
  }
  await page.close();

  const py = `
import sys
from PIL import Image
d = sys.argv[1]
for face in ('front', 'back'):
    m = Image.open(f'{d}/dh-coin-{face}-1024.png').convert('RGBA')
    s = m.resize((512, 512), Image.LANCZOS)
    s.save(f'{d}/dh-coin-{face}.png', optimize=True)
    s.save(f'{d}/dh-coin-{face}.webp', quality=88, method=6)
    if face == 'front':
        for size, name in ((64, 'dh-coin-64.png'), (32, 'favicon-32.png'), (192, 'favicon-192.png'), (180, 'apple-touch-icon.png'), (512, 'icon-512.png')):
            m.resize((size, size), Image.LANCZOS).save(f'{d}/{name}', optimize=True)
`;
  execFileSync('python3', ['-I', '-c', py, path.join(root, 'assets/img')], { stdio: 'inherit' });

  // --- vault interior (hero background) ---
  const vp = await browser.newPage({ viewport: { width: 2400, height: 1350 } });
  await vp.goto(url('tools/vault.html'));
  await vp.waitForSelector('body[data-ready]');
  await vp.screenshot({ path: img('vault-interior-master.png') });
  await vp.close();
  execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
d = sys.argv[1]
m = Image.open(f'{d}/vault-interior-master.png').convert('RGB')
m.resize((1920, 1080), Image.LANCZOS).save(f'{d}/vault-interior.webp', quality=80, method=6)
m.resize((1920, 1080), Image.LANCZOS).save(f'{d}/vault-interior.jpg', quality=82, optimize=True, progressive=True)
m.resize((960, 540), Image.LANCZOS).save(f'{d}/vault-interior-960.webp', quality=80, method=6)
`, path.join(root, 'assets/img')], { stdio: 'inherit' });
  rmSync(img('vault-interior-master.png'), { force: true });

  // --- OG image ---
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.goto(url('tools/og.html'));
  await og.waitForSelector('body[data-ready]');
  await og.waitForTimeout(300);
  await og.screenshot({ path: img('og-image.jpg'), type: 'jpeg', quality: 88 });
  await og.close();

  // --- PDF resume ---
  const r = await browser.newPage();
  await r.goto(url('resume/index.html'));
  await r.waitForLoadState('load');
  await r.pdf({ path: path.join(root, 'resume/DeAris-Henry-Resume.pdf'), format: 'Letter', printBackground: false, preferCSSPageSize: true, tagged: true, outline: true });
  await r.close();
} finally {
  await browser.close();
}
// remove masters
for (const f of ['front', 'back']) rmSync(img(`dh-coin-${f}-1024.png`), { force: true });
console.log('assets rendered');
