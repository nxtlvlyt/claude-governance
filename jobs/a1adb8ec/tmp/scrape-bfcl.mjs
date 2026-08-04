// Scrape the BFCL v4 leaderboard with a real browser, because the table is rendered by JS.
//
// WHY THIS AND NOT WebFetch: three raw fetches returned only the page shell. The tool said so
// plainly — "the actual leaderboard table with model scores is not included in the content
// excerpt". Raw HTML cannot answer this; a JS-executing browser can. The operator suggested
// headless directly, which is also the cheaper path than fighting the Chrome extension's host
// permissions.
//
// WHAT IS BEING ASKED: where does 51.00% on web_search_base sit? This project has already
// withdrawn one leaderboard claim (CLEAN-SCORECARD.md) after a contaminated comparison, so the
// numbers get read off the real board or not quoted at all.

import { chromium } from 'playwright';

const URL = 'https://gorilla.cs.berkeley.edu/leaderboard.html';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });

// The table is populated asynchronously; wait for real rows rather than a fixed sleep.
try {
  await page.waitForFunction(() => document.querySelectorAll('table tr').length > 5, { timeout: 60000 });
} catch { /* fall through and report what is actually there */ }

const out = await page.evaluate(() => {
  const tables = [...document.querySelectorAll('table')];
  return tables.map(t => {
    const rows = [...t.querySelectorAll('tr')].map(r =>
      [...r.querySelectorAll('th,td')].map(c => c.innerText.trim())
    );
    return rows;
  });
});

console.log('tables found:', out.length);
for (const rows of out) {
  if (rows.length < 3) continue;
  const header = rows[0] || [];
  console.log('\n=== HEADER ===');
  console.log(header.join(' | '));

  // Which column holds web search?
  const wsIdx = header.findIndex(h => /web\s*search/i.test(h));
  const nameIdx = header.findIndex(h => /model/i.test(h));
  const overallIdx = header.findIndex(h => /overall/i.test(h));
  console.log(`col indexes -> model=${nameIdx} overall=${overallIdx} webSearch=${wsIdx}`);

  const body = rows.slice(1).filter(r => r.length > 2);
  console.log(`data rows: ${body.length}`);

  if (wsIdx >= 0) {
    const scored = body
      .map(r => ({
        model: r[nameIdx >= 0 ? nameIdx : 1] || r[0],
        overall: overallIdx >= 0 ? r[overallIdx] : '',
        ws: r[wsIdx],
      }))
      .filter(x => x.ws && /\d/.test(x.ws));
    scored.sort((a, b) => parseFloat(b.ws) - parseFloat(a.ws));
    console.log('\n=== RANKED BY WEB SEARCH ===');
    scored.slice(0, 25).forEach((x, i) =>
      console.log(`${String(i + 1).padStart(3)}. ${x.ws.padStart(8)}  ${x.overall.padStart(8)}  ${x.model.slice(0, 62)}`));
    console.log(`\ntotal models with a web-search score: ${scored.length}`);
    const vals = scored.map(x => parseFloat(x.ws)).filter(v => !isNaN(v));
    if (vals.length) {
      const better = vals.filter(v => v > 51.0).length;
      console.log(`models scoring ABOVE 51.00: ${better} of ${vals.length}`);
      console.log(`max=${Math.max(...vals).toFixed(2)}  median=${vals.sort((a,b)=>a-b)[Math.floor(vals.length/2)].toFixed(2)}  min=${Math.min(...vals).toFixed(2)}`);
    }
  } else {
    console.log('\n(no web-search column in this table) first 8 rows:');
    body.slice(0, 8).forEach(r => console.log('  ' + r.slice(0, 6).join(' | ').slice(0, 150)));
  }
}

await browser.close();
