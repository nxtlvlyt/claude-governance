// Extract the gap7 board-truth workflow's final return (upheld + disputed) into a
// compact stamping plan. Reads the workflow journal, takes the LAST result-bearing
// structure that has upheld/disputed keys (the workflow return), else reassembles
// from per-agent results.
import { readFileSync, writeFileSync } from 'fs';

const journalPath = 'C:/Users/marka/.claude/projects/C--Users-marka/bb6b583a-5f2e-42bf-9d87-d6fd7bbb8fdf/subagents/workflows/wf_d4afc199-73a/journal.jsonl';
const lines = readFileSync(journalPath, 'utf8').trim().split(/\r?\n/);

const surveys = [];
const refutes = new Map(); // stem -> refute
for (const line of lines) {
  let j; try { j = JSON.parse(line); } catch { continue; }
  if (j.type !== 'result') continue;
  const label = j.label || j.agentLabel || '';
  const val = j.result ?? j.value ?? j.output;
  if (!val || typeof val !== 'object') continue;
  if (label.startsWith('survey:') || (val.stem && val.verdict)) surveys.push(val);
  else if (label.startsWith('refute:')) refutes.set(label.slice('refute:'.length), val);
}

// Pair refutes by stem when labels carried them; the pipeline stage-2 return shape
// ({survey, refute}) may also appear directly.
const rows = [];
const seen = new Set();
for (const s of surveys) {
  const stem = s.stem || s.survey?.stem;
  if (!stem || seen.has(stem)) continue;
  seen.add(stem);
  const survey = s.survey || s;
  const refute = s.refute || refutes.get(stem) || null;
  rows.push({
    stem,
    verdict: survey.verdict,
    upheld: refute ? !refute.refuted : null,
    refuteReason: refute?.refuted ? refute.reason?.slice(0, 300) : undefined,
    fixDisposition: survey.fixDisposition?.slice(0, 400),
    annotationLine: survey.annotationLine,
    performable: survey.performableNow ? `${survey.performableNow.kind}: ${survey.performableNow.detail?.slice(0, 300)}` : 'none',
    keyReceipt: survey.receipts?.[0] ? `${survey.receipts[0].source} :: ${survey.receipts[0].quote?.slice(0, 200)}` : '',
  });
}

writeFileSync('C:/Users/marka/.claude/jobs/bb6b583a/tmp/stamps-plan.json', JSON.stringify(rows, null, 1));
console.log(`rows: ${rows.length}`);
for (const r of rows) console.log(`${r.upheld === false ? 'DISPUTED' : 'UPHELD  '} ${r.verdict?.padEnd(20)} ${r.stem}  [${(r.performable || '').split(':')[0]}]`);
