// Decisive check for the NO_FCP CI failures: does production muddytires.ca
// actually paint content in a real headless browser?
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));

const t0 = Date.now();
await page.goto('https://muddytires.ca', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(3000);

const paint = await page.evaluate(() => {
  const fcp = performance.getEntriesByName('first-contentful-paint');
  const bodyText = (document.body.innerText || '').trim().length;
  const visible = document.body && getComputedStyle(document.body).visibility !== 'hidden';
  return { fcp: fcp.length ? Math.round(fcp[0].startTime) : null, bodyTextChars: bodyText, bodyVisible: visible, title: document.title.slice(0, 60) };
});
console.log('loadMs:', Date.now() - t0, '| FCP:', paint.fcp, 'ms | bodyText chars:', paint.bodyTextChars, '| visible:', paint.bodyVisible, '| title:', paint.title);
console.log('pageerrors:', errs.length); errs.slice(0, 3).forEach(e => console.log('  ', e));
await browser.close();
process.exit(paint.fcp === null || paint.bodyTextChars < 50 ? 1 : 0);
