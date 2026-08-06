// Conductor dry-run of mt-ui-rest-state.S1 step 6 (ninth law) — evidence lines are the receipt.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://f007e741.muddytires.pages.dev';
const URL = BASE + '/map';

function isVisible(el) {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector('.leaflet-container', { timeout: 30000 });
await page.waitForTimeout(2500);

const bodyClass = await page.evaluate(() => document.body.classList.contains('mt-rest'));

const restCount = await page.evaluate(`(${isVisible.toString()}, (() => {
  const vis = ${isVisible.toString()};
  const els = [...document.querySelectorAll('button, a, input, select, [role="button"], .leaflet-control a')];
  const counted = [];
  for (const el of els) {
    if (el.closest('.leaflet-control-attribution')) continue;
    if (el.closest('.leaflet-marker-pane, .leaflet-popup-pane')) continue;
    if (el.disabled) continue;
    if (!vis(el)) continue;
    // collapse to top-level control containers so a bar with inner buttons counts once
    const owner = el.closest('#bar, #mt-search-icon, .mt-locate, #planbtn, #mt-hamburger') || el;
    if (!counted.includes(owner)) counted.push(owner);
  }
  return counted.map((e) => e.id || e.className.toString().slice(0, 40));
})())`);

// menu proxy rows: tap hamburger, count visible rows
let menuRows = 0;
try {
  await page.tap('#mt-hamburger', { timeout: 5000 });
  await page.waitForTimeout(800);
  menuRows = await page.evaluate(`(() => {
    const vis = ${isVisible.toString()};
    const menu = document.querySelector('#mt-menu-oracle, .mt-menu, [id*="mt-menu"]');
    if (!menu) return 0;
    return [...menu.querySelectorAll('a, button, [role="menuitem"], .mt-menu-row, li')].filter(vis).length;
  })()`);
} catch (e) {
  menuRows = -1;
}

console.log('REST_COUNT=' + restCount.length);
console.log('REST_ITEMS=' + JSON.stringify(restCount));
console.log('BODY_CLASS=' + (bodyClass ? 'present' : 'absent'));
console.log('MENU_ROWS=' + menuRows);
console.log('PAGEERRORS=' + pageErrors.length);
if (pageErrors.length) console.log('PAGEERROR_SAMPLE=' + pageErrors[0]);

// fail-safe pass: block the module, expect legacy UI visible & no errors
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await ctx2.newPage();
const errs2 = [];
p2.on('pageerror', (e) => errs2.push(String(e).slice(0, 100)));
await p2.route('**/ui-rest-state.js', (r) => r.abort());
await p2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await p2.waitForSelector('.leaflet-container', { timeout: 30000 });
await p2.waitForTimeout(2000);
const legacy = await p2.evaluate(`(() => {
  const vis = ${isVisible.toString()};
  const rest = document.body.classList.contains('mt-rest');
  const controls = [...document.querySelectorAll('button, a')].filter(vis).length;
  return { rest, controls };
})()`);
console.log('FAILSAFE=' + (!legacy.rest && legacy.controls > 5 ? 'legacy-visible' : 'broken'));
console.log('FAILSAFE_DETAIL=rest:' + legacy.rest + ' visibleControls:' + legacy.controls + ' errors:' + errs2.length);

const pass = restCount.length === 5 && bodyClass && menuRows >= 9 && pageErrors.length === 0 && !legacy.rest && legacy.controls > 5;
console.log(pass ? 'RESTSTATE_QC_PASS' : 'RESTSTATE_QC_FAIL');
await browser.close();
