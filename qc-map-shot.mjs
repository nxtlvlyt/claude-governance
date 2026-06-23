import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = 'https://0be38993.muddytires.pages.dev/map.html';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  await new Promise(r => setTimeout(r, 4000));

  const introspect = await page.evaluate(() => {
    const out = {
      has_map: !!window.map,
      has_fireBanLayer: !!(window.map && window.map.fireBanLayer),
      window_keys_fire: Object.keys(window).filter(k => /fire/i.test(k)),
      map_keys: window.map ? Object.keys(window.map).filter(k => /fire|ban|layer/i.test(k)) : [],
    };
    if (window.map && window.map.fireBanLayer && typeof window.map.fireBanLayer.show === 'function') {
      try { window.map.fireBanLayer.show(); out.toggled = true; } catch (e) { out.toggle_error = String(e); }
    }
    return out;
  });
  console.log('INTROSPECT:', JSON.stringify(introspect, null, 2));

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'C:/Users/marka/.claude/map-fire-bans.png', fullPage: false });
  console.log('SCREENSHOT_WRITTEN: C:/Users/marka/.claude/map-fire-bans.png');
} finally {
  await browser.close();
}
