// BFCL v4 leaderboard — third attempt, header depth measured rather than assumed.
//
// Attempt 1 read one header row and found no columns.
// Attempt 2 read two and still found none, because the table has THREE header rows:
//     row0: (group)     Agentic | Multi Turn | Single Turn | Hallucination | Format Sensitivity
//     row1: (subgroup)  Web Search | Memory | Multi turn | Non-live (AST) ...
//     row2: (columns)   Rank | Overall Acc | Model | Cost ($) | Overall Acc | Base | ...
// Both attempts would have quoted a confidently wrong column had they matched anything — which
// is the failure mode this whole session has been about. So this version DETECTS how many
// leading rows are header (first row whose cell 0 parses as an integer rank starts the data)
// and prints one full data row beside the column names for eyeball verification.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://gorilla.cs.berkeley.edu/leaderboard.html', { waitUntil: 'networkidle', timeout: 120000 });
try { await page.waitForFunction(() => document.querySelectorAll('table tr').length > 5, { timeout: 60000 }); } catch {}

const data = await page.evaluate(() => {
  const t = document.querySelector('table');
  const rows = [...t.querySelectorAll('tr')];
  const expand = (tr) => {
    const out = [];
    for (const c of tr.querySelectorAll('th,td')) {
      const span = parseInt(c.getAttribute('colspan') || '1', 10);
      for (let i = 0; i < span; i++) out.push(c.innerText.trim());
    }
    return out;
  };
  const all = rows.map(expand);
  // Data begins at the first row whose first cell is a bare integer (the rank).
  let start = all.findIndex(r => /^\d+$/.test((r[0] || '').trim()));
  if (start < 0) start = 3;
  return { headers: all.slice(0, start), body: all.slice(start), start };
});

console.log(`header rows detected: ${data.start}`);
const n = Math.max(...data.headers.map(h => h.length), data.body[0]?.length || 0);
const cols = [];
for (let i = 0; i < n; i++) {
  const parts = data.headers.map(h => (h[i] || '').replace(/\s+/g, ' ').replace(/[🔼🔽]/g, '').trim())
                            .filter(Boolean);
  cols.push([...new Set(parts)].join(' / ') || `col${i}`);
}
console.log('\n=== COLUMNS (with the top row as a sanity check) ===');
const sample = data.body[0] || [];
cols.forEach((c, i) => console.log(`  ${String(i).padStart(2)}  ${c.padEnd(42)} | ${(sample[i] || '').slice(0, 34)}`));

const modelIdx = cols.findIndex(c => /model/i.test(c));
const wsIdx = cols.findIndex(c => /web search/i.test(c) && /base/i.test(c));
const wsOverall = cols.findIndex(c => /web search/i.test(c) && /overall/i.test(c));
const overallIdx = cols.findIndex((c, i) => /overall acc/i.test(c) && i < modelIdx);
console.log(`\nmodel=${modelIdx}  overall=${overallIdx}  ws_overall=${wsOverall}  ws_base=${wsIdx}`);

const pick = wsIdx >= 0 ? wsIdx : wsOverall;
if (pick < 0 || modelIdx < 0) { console.log('column mapping failed — quoting nothing.'); await browser.close(); process.exit(0); }
console.log(`using column ${pick}: "${cols[pick]}"`);

const scored = data.body.map(r => ({
  model: r[modelIdx] || '?',
  overall: r[overallIdx] || '',
  ws: parseFloat((r[pick] || '').replace('%', '')),
})).filter(x => !isNaN(x.ws) && x.model !== '?');
scored.sort((a, b) => b.ws - a.ws);

console.log(`\n=== TOP 15 BY ${cols[pick]} ===`);
scored.slice(0, 15).forEach((x, i) =>
  console.log(`${String(i + 1).padStart(3)}. ${x.ws.toFixed(2).padStart(7)}   ${x.model.slice(0, 56)}`));

const OURS = 51.0;
const vals = scored.map(x => x.ws).sort((a, b) => a - b);
const above = scored.filter(x => x.ws > OURS).length;
console.log(`\n=== WHERE OUR 51.00 SITS ===`);
console.log(`  models scored : ${vals.length}`);
console.log(`  above 51.00   : ${above}`);
console.log(`  below 51.00   : ${vals.length - above}`);
console.log(`  our rank      : #${above + 1} of ${vals.length + 1}`);
console.log(`  max ${vals[vals.length-1].toFixed(2)} · median ${vals[Math.floor(vals.length/2)].toFixed(2)} · min ${vals[0].toFixed(2)}`);
console.log(`\n=== MODELS WITHIN 8 POINTS OF US ===`);
scored.filter(x => Math.abs(x.ws - OURS) <= 8)
      .forEach(x => console.log(`  ${x.ws.toFixed(2).padStart(7)}   ${x.model.slice(0, 56)}`));
await browser.close();
