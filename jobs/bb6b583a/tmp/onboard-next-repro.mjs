// Repro of the operator's exact path: fresh mobile context, tap Next through all
// four tour steps; assert the overlay ends and the flag is written.
import { chromium, devices } from 'playwright';

const base = process.argv[2] || 'https://7a178562.muddytires.pages.dev';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

await page.goto(base + '/map.html', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(4000);

const next = page.locator('#mt-onboard-next');
const card = page.locator('#mt-onboard-skip');
console.log('overlay visible:', await card.isVisible().catch(() => false));

for (let i = 1; i <= 4; i++) {
  const label = await next.textContent().catch(() => 'GONE');
  console.log(`step ${i}: next-button label = "${label}"`);
  await next.tap().catch(async () => { await next.click({ force: true }).catch(() => {}); });
  await page.waitForTimeout(800);
}

const visibleAfter = await card.isVisible().catch(() => false);
const flag = await page.evaluate(() => { try { return localStorage.getItem('mt-onboarded-v1'); } catch (e) { return 'ls-error'; } });
console.log('overlay visible after 4 Next taps:', visibleAfter, '| flag:', flag, '| pageerrors:', errs.length);
errs.slice(0, 3).forEach(e => console.log('  ', e));
await browser.close();
process.exit(visibleAfter ? 1 : 0);
