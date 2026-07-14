// Witness for QUEUE ITEM 23 (camping-pass client wiring) against a preview deploy.
// Usage: node pluz-wire-witness.mjs <preview-base-url>
// Asserts: page loads without fatal/console errors naming land-tenure|camping|pluz;
// mtInPassArea exists; a point far outside (Toronto) is false; at least one
// Eastern-Slopes corridor probe (Abraham Lake / Bighorn) turns true once the
// boundary loads. Exit 0 = witnessed, 1 = fail.
import { chromium } from 'playwright';

const base = process.argv[2];
if (!base) { console.error('need preview url'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage();
let fatal = [];
page.on('pageerror', (e) => fatal.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /land-tenure|camping|pluz/i.test(m.text())) fatal.push('console: ' + m.text());
});

await page.goto(base + '/map.html', { waitUntil: 'networkidle', timeout: 45000 });

const hasFn = await page.evaluate(() => typeof window.mtInPassArea === 'function');
if (!hasFn) { console.log('FAIL: mtInPassArea not defined'); await browser.close(); process.exit(1); }

// First call kicks off the lazy fetch (returns false pre-load by design).
await page.evaluate(() => window.mtInPassArea(52.25, -116.40));

// Poll up to 30s for the boundary to load and a corridor probe to flip true.
const probes = [[52.25, -116.40], [52.13, -116.43], [52.35, -116.30]];
let inside = false, outside = null;
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(2000);
  const r = await page.evaluate((pts) => ({
    ins: pts.map(p => window.mtInPassArea(p[0], p[1])),
    out: window.mtInPassArea(43.65, -79.38)
  }), probes);
  outside = r.out;
  if (r.ins.some(Boolean)) { inside = true; break; }
}

console.log('corridor probe inside:', inside, '| toronto outside-check (must be false):', outside, '| errors:', fatal.length);
fatal.forEach(f => console.log('  ', f));
await browser.close();

if (fatal.length) process.exit(1);
if (outside !== false) { console.log('FAIL: outside point did not return false'); process.exit(1); }
if (!inside) { console.log('FAIL: no corridor probe returned true within 30s — investigate boundary data or coords before shipping'); process.exit(1); }
console.log('WITNESSED: pass-area wiring live on preview');
