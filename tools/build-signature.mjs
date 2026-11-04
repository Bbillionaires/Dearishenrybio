// Builds the decorative "De'Aris Henry" fountain-pen signature.
//
// Each pen stroke is hand-authored as a centerline (absolute M/C commands only).
// The script samples each centerline and computes ink width from the stroke
// direction relative to a broad, angled nib — thick downstrokes, hairline
// upstrokes — plus pressure tapering at the start and end of each stroke.
// Output: assets/img/signature.svg and the inline copy inside index.html
// (between the SIGNATURE markers). Decorative only, not a legal signature.
import { readFileSync, writeFileSync } from 'node:fs';

const STROKES = [
  // D — stem with a looped foot, then the bowl sweeping round and over the top
  'M86,40 C83,68 76,102 66,130 C61,143 46,146 41,137 C36,128 50,122 66,127 C108,140 160,118 163,80 C166,44 122,30 86,37 C64,41 46,52 40,63',
  // e
  'M150,121 C162,117 177,109 175,100 C173,92 160,95 155,108 C150,122 158,133 176,127 C181,125 186,121 190,117',
  // apostrophe
  "M204,60 C205,67 203,75 198,82",
  // A — up and down
  'M206,135 C222,108 240,72 258,40 C259,66 262,100 266,128 C267,133 270,135 274,131',
  // A crossbar, flowing into r, i and s
  'M222,104 C236,99 252,97 270,99 C276,98 281,93 285,86 C286,93 289,97 293,96 C297,95 300,93 303,95 C302,106 301,118 304,128 C306,118 310,105 315,98 C314,110 313,122 318,128 C322,132 328,126 333,115 C337,106 340,99 345,96 C348,107 357,117 350,127 C344,134 330,133 325,124 C337,134 357,131 375,122',
  // i dot
  'M318,83 C320,81 323,81 324,84',
  // H — left stem with a lead-in hook
  'M402,56 C406,46 418,40 424,46 C420,76 412,108 404,137',
  // H — right stem
  'M478,38 C472,72 464,106 456,138',
  // H crossbar sweeping into e-n-r-y and the closing flourish
  'M388,100 C416,90 446,90 472,93 C484,94 492,99 496,106 C505,103 515,97 513,91 C511,85 500,87 496,99 C492,113 500,127 516,123 C522,118 526,108 529,100 C529,112 527,122 525,130 C531,114 540,102 550,102 C558,102 556,116 556,125 C558,132 565,130 571,123 C575,112 578,102 582,93 C583,100 587,102 591,101 C595,100 598,98 601,100 C600,110 599,120 600,128 C598,116 604,104 611,100 C609,112 609,124 617,126 C625,126 632,114 637,100 C632,126 624,152 612,172 C602,188 585,190 580,178 C575,165 600,150 642,141 C670,135 700,131 728,130',
];

const NIB_ANGLE = (-38 * Math.PI) / 180; // broad nib held at ~38 degrees
const MAX_W = 6.2;
const MIN_W = 1.05;
const STEP = 0.75; // sampling step in px

function parse(d) {
  const nums = d.match(/-?\d*\.?\d+/g).map(Number);
  const cmds = d.match(/[MC]/g);
  const segs = [];
  let i = 0, cur;
  for (const c of cmds) {
    if (c === 'M') { cur = [nums[i++], nums[i++]]; continue; }
    // consume all following C triples until next command letter in text
    const p1 = [nums[i++], nums[i++]], p2 = [nums[i++], nums[i++]], p3 = [nums[i++], nums[i++]];
    segs.push([cur, p1, p2, p3]);
    cur = p3;
  }
  return segs;
}
function bez(s, t) {
  const m = 1 - t;
  return [0, 1].map((k) => m * m * m * s[0][k] + 3 * m * m * t * s[1][k] + 3 * m * t * t * s[2][k] + t * t * t * s[3][k]);
}

function sample(d) {
  const pts = [];
  for (const s of parse(d)) {
    const n = 400;
    let prev = bez(s, 0);
    if (!pts.length) pts.push(prev);
    let acc = 0;
    for (let j = 1; j <= n; j++) {
      const p = bez(s, j / n);
      acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      if (acc >= STEP || j === n) { pts.push(p); acc = 0; }
      prev = p;
    }
  }
  return pts;
}

const f = (n) => +n.toFixed(2);

function ribbon(d) {
  const pts = sample(d);
  const N = pts.length;
  // cumulative length for tapering
  const L = [0];
  for (let i = 1; i < N; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[N - 1];
  const widths = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(N - 1, i + 2)];
    const theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
    let w = MIN_W + (MAX_W - MIN_W) * Math.abs(Math.sin(theta - NIB_ANGLE)) ** 1.35;
    const taperIn = Math.min(1, L[i] / 14), taperOut = Math.min(1, (total - L[i]) / 26);
    w *= 0.35 + 0.65 * Math.min(taperIn, taperOut) ** 0.8;
    return Math.max(0.6, w);
  });
  // smooth widths
  const sw = widths.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -4; k <= 4; k++) { const v = widths[i + k]; if (v != null) { s += v; c++; } }
    return s / c;
  });
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });
  // consistently-oriented, slightly overlapping quads => seamless union with nonzero fill
  let out = '';
  for (let i = 0; i < N - 1; i++) {
    const j = Math.min(N - 1, i + 2); // overlap by one sample
    const q = [
      [pts[i][0] + normals[i][0] * sw[i] / 2, pts[i][1] + normals[i][1] * sw[i] / 2],
      [pts[j][0] + normals[j][0] * sw[j] / 2, pts[j][1] + normals[j][1] * sw[j] / 2],
      [pts[j][0] - normals[j][0] * sw[j] / 2, pts[j][1] - normals[j][1] * sw[j] / 2],
      [pts[i][0] - normals[i][0] * sw[i] / 2, pts[i][1] - normals[i][1] * sw[i] / 2],
    ];
    const area = q.reduce((s, p, k) => { const n = q[(k + 1) % 4]; return s + p[0] * n[1] - n[0] * p[1]; }, 0);
    if (area < 0) q.reverse();
    out += `M${f(q[0][0])} ${f(q[0][1])}L${f(q[1][0])} ${f(q[1][1])}L${f(q[2][0])} ${f(q[2][1])}L${f(q[3][0])} ${f(q[3][1])}Z`;
    i++; // quads cover two samples each
  }
  return { ink: out, length: Math.ceil(total) };
}

const strokes = STROKES.map(ribbon);
const totalLen = strokes.reduce((s, x) => s + x.length, 0);
let acc = 0;
const DRAW_SECONDS = 4.2;

const mask = STROKES.map((d, i) => {
  const { length } = strokes[i];
  const delay = (acc / totalLen) * DRAW_SECONDS;
  const dur = Math.max(0.12, (length / totalLen) * DRAW_SECONDS);
  acc += length;
  return `<path class="sig-reveal" d="${d}" pathLength="${length}" style="--len:${length};--delay:${delay.toFixed(3)}s;--dur:${dur.toFixed(3)}s"/>`;
}).join('');

const ink = strokes.map((s) => `<path d="${s.ink}"/>`).join('');

const svg = `<svg class="signature-svg" xmlns="http://www.w3.org/2000/svg" viewBox="20 22 726 180" role="img" aria-labelledby="sig-title"><title id="sig-title">De'Aris Henry — decorative handwritten signature</title><defs><linearGradient id="sig-ink" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#F1DC9A"/><stop offset="0.45" stop-color="#E6C778"/><stop offset="1" stop-color="#C9A24A"/></linearGradient><mask id="sig-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="760" height="220"><g fill="none" stroke="#fff" stroke-width="${MAX_W + 6}" stroke-linecap="round" stroke-linejoin="round">${mask}</g></mask></defs><g class="sig-ink" fill="url(#sig-ink)" mask="url(#sig-mask)">${ink}</g></svg>`;

writeFileSync(new URL('../assets/img/signature.svg', import.meta.url), svg);

const indexUrl = new URL('../index.html', import.meta.url);
try {
  const html = readFileSync(indexUrl, 'utf8');
  const re = /<!-- SIGNATURE:START -->[\s\S]*?<!-- SIGNATURE:END -->/;
  if (re.test(html)) {
    writeFileSync(indexUrl, html.replace(re, `<!-- SIGNATURE:START -->${svg}<!-- SIGNATURE:END -->`));
    console.log('signature inlined into index.html');
  }
} catch { /* index.html not created yet */ }
console.log('signature.svg', (svg.length / 1024).toFixed(1) + 'KB', 'total length', totalLen);
