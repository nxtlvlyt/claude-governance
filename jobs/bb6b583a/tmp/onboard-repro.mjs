// Repro: fresh mobile context (no localStorage) -> preview map.html -> does the
// onboarding overlay appear, and does tapping "Skip tutorial" dismiss it?
import { chromium, devices } from 'playwright';

const base = process.argv[2] || 'https://7a178562.muddytires.pages.dev';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });

await page.goto(base + '/map.html', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(4000);

const skip = page.locator('#mt-onboard-skip');
const visibleBefore = await skip.isVisible().catch(() => false);
console.log('overlay visible on fresh visit:', visibleBefore);

if (visibleBefore) {
  await skip.tap().catch(async (e) => { console.log('tap failed:', e.message.slice(0, 120)); await skip.click({ force: true }).catch(ee => console.log('click failed too:', ee.message.slice(0, 120))); });
  await page.waitForTimeout(1500);
  const visibleAfter = await skip.isVisible().catch(() => false);
  const flag = await page.evaluate(() => { try { return localStorage.getItem('mt-onboarded-v1'); } catch (e) { return 'ls-error'; } });
  console.log('overlay visible after skip tap:', visibleAfter, '| localStorage flag:', flag);
}
console.log('js errors:', errs.length); errs.slice(0, 5).forEach(e => console.log('  ', e));
await browser.close();
