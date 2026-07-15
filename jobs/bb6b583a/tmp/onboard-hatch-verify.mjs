// Verify both escape hatches on the new preview:
// (1) ?tour=0 -> tour never appears, flag written
// (2) fresh visit without param -> tour appears, backdrop tap dismisses it
import { chromium, devices } from 'playwright';

const base = process.argv[2];
const browser = await chromium.launch();

// Path 1: tour=0
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await page.goto(base + '/map.html?tour=0', { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(4000);
  const visible = await page.locator('#mt-onboard-card').isVisible().catch(() => false);
  const flag = await page.evaluate(() => { try { return localStorage.getItem('mt-onboarded-v1'); } catch (e) { return 'ls-error'; } });
  console.log('tour=0: overlay visible =', visible, '(want false) | flag =', flag, '(want 1)');
  await ctx.close();
  if (visible || flag !== '1') { await browser.close(); process.exit(1); }
}

// Path 2: backdrop tap
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await page.goto(base + '/map.html', { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(4000);
  const card = page.locator('#mt-onboard-card');
  const before = await card.isVisible().catch(() => false);
  // Tap the dimmed backdrop well away from the card (top of screen).
  await page.locator('#mt-onboard-backdrop').tap({ position: { x: 50, y: 80 } }).catch(async () => {
    await page.mouse.click(50, 80);
  });
  await page.waitForTimeout(1000);
  const after = await card.isVisible().catch(() => false);
  const flag = await page.evaluate(() => { try { return localStorage.getItem('mt-onboarded-v1'); } catch (e) { return 'ls-error'; } });
  console.log('backdrop-tap: before =', before, '(want true) | after =', after, '(want false) | flag =', flag, '(want 1)');
  await ctx.close();
  if (!before || after || flag !== '1') { await browser.close(); process.exit(1); }
}

await browser.close();
console.log('BOTH-HATCHES-VERIFIED');
