// BFCL v4 leaderboard, column mapping done properly.
//
// First pass mis-read the header: the table uses a TWO-ROW header with group spans —
//   row 0:  (blank) (blank) | Web Search | Memory | Multi turn | Non-live (AST) ...
//   row 1:  Rank | Overall Acc | Model | Cost ($) | Overall Acc | Base | ...
// so a naive findIndex on the first row finds nothing and would have produced a confident
// wrong column. This version reads the header cells WITH their colspans, builds the real
// flat column list, and prints it before quoting any number.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://gorilla.cs.berkeley.edu/leaderboard.html', { waitUntil: 'networkidle', timeout: 120000 });
try { await page.waitForFunction(() => document.querySelectorAll('table tr').length > 5, { timeout: 60000 }); } catch {}

const data = await page.evaluate(() => {
  const t = document.querySelector('table');
  const rows = [...t.querySelectorAll('tr')];
  // Expand colspans so group headers line up with their columns.
  const expand = (tr) => {
    const out = [];
    for (const c of tr.querySelectorAll('th,td')) {
      const span = parseInt(c.getAttribute('colspan') || '1', 10);
      for (let i = 0; i < span; i++) out.push(c.innerText.trim());
    }
    return out;
  };
  const h0 = expand(rows[0] || document.createElement('tr'));
  const h1 = expand(rows[1] || document.createElement('tr'));
  const body = rows.slice(2).map(r => [...r.querySelectorAll('th,td')].map(c => c.innerText.trim()))
                   .filter(r => r.length > 4);
  return { h0, h1, body };
});

const cols = [];
const n = Math.max(data.h0.length, data.h1.length);
for (let i = 0; i < n; i++) {
  const g = (data.h0[i] || '').replace(/\s+/g, ' ');
  const s = (data.h1[i] || '').replace(/\s+/g, ' ');
  cols.push(g && s ? `${g} / ${s}` : (s || g || `col${i}`));
}
console.log('=== FLAT COLUMNS ===');
cols.forEach((c, i) => console.log(`  ${String(i).padStart(2)}  ${c}`));

const modelIdx = cols.findIndex(c => /model/i.test(c));
const overallIdx = cols.findIndex((c, i) => /overall acc/i.test(c) && i < modelIdx);
const wsBaseIdx = cols.findIndex(c => /web search/i.test(c) && /base/i.test(c));
const wsOverallIdx = cols.findIndex(c => /web search/i.test(c) && /overall/i.test(c));
console.log(`\nmodel=${modelIdx} overall=${overallIdx} webSearchOverall=${wsOverallIdx} webSearchBase=${wsBaseIdx}`);
console.log(`rows: ${data.body.length}`);

const pick = wsBaseIdx >= 0 ? wsBaseIdx : wsOverallIdx;
if (pick < 0) { console.log('NO web-search column found — not quoting anything.'); await browser.close(); process.exit(0); }
console.log(`\nusing column ${pick}: "${cols[pick]}"`);

const scored = data.body.map(r => ({
  model: r[modelIdx] || '?',
  overall: r[overallIdx] || '',
  ws: parseFloat((r[pick] || '').replace('%', '')),
})).filter(x => !isNaN(x.ws));

scored.sort((a, b) => b.ws - a.ws);
console.log('\n=== TOP 20 BY WEB SEARCH ===');
scored.slice(0, 20).forEach((x, i) =>
  console.log(`${String(i + 1).padStart(3)}. ${x.ws.toFixed(2).padStart(7)}  ${String(x.overall).padStart(6)}  ${x.model.slice(0, 58)}`));

const vals = scored.map(x => x.ws).sort((a, b) => a - b);
const OURS = 51.0;
const above = scored.filter(x => x.ws > OURS).length;
console.log(`\n=== WHERE 51.00 SITS ===`);
console.log(`  models with a web-search score : ${vals.length}`);
console.log(`  scoring ABOVE 51.00            : ${above}`);
console.log(`  scoring BELOW 51.00            : ${vals.length - above}`);
console.log(`  would rank                     : #${above + 1} of ${vals.length + 1}`);
console.log(`  max=${vals[vals.length-1].toFixed(2)}  median=${vals[Math.floor(vals.length/2)].toFixed(2)}  min=${vals[0].toFixed(2)}`);
console.log('\n=== NEAREST NEIGHBOURS ===');
scored.forEach((x, i) => {
  if (Math.abs(x.ws - OURS) <= 6) console.log(`  ${x.ws.toFixed(2).padStart(7)}  ${x.model.slice(0, 58)}`);
});
await browser.close();
