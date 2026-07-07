// Extract e2e-audit verdicts from the workflow journal: which items audited, verdicts,
// which have refutes, which are missing entirely.
import { readFileSync } from 'fs';
const journal = 'C:/Users/marka/.claude/projects/C--Users-marka/bb6b583a-5f2e-42bf-9d87-d6fd7bbb8fdf/subagents/workflows/wf_717d9a45-6b8/journal.jsonl';
const lines = readFileSync(journal, 'utf8').trim().split(/\r?\n/);
const audits = new Map(); const refutes = new Map();
for (const line of lines) {
  let j; try { j = JSON.parse(line); } catch { continue; }
  if (j.type !== 'result') continue;
  const label = j.label || '';
  const val = j.result ?? j.value ?? j.output;
  if (!val || typeof val !== 'object') continue;
  if (label.startsWith('audit:')) audits.set(label.slice(6), val);
  else if (label.startsWith('refute:')) refutes.set(label.slice(7), val);
  else if (val.audit) { audits.set(val.audit.item || label, val.audit); if (val.refute) refutes.set(val.audit.item || label, val.refute); }
  else if (val.item && val.verdict) audits.set(val.item, val);
}
let pass = 0, fail = 0, notex = 0;
for (const [k, a] of audits) {
  const r = refutes.get(k);
  const v = a.verdict || '?';
  if (v === 'E2E-PASS') pass++; else if (v === 'E2E-FAIL') fail++; else notex++;
  console.log(`${v.padEnd(16)} refute:${r ? (r.refuted ? 'REFUTED' : 'upheld') : 'MISSING'}  ${k.slice(0, 70)}`);
  if (v !== 'E2E-PASS') console.log(`   >> ${(a.reopenReason || a.evidence || '').slice(0, 220)}`);
  if (r?.refuted) console.log(`   !! refuted: ${(r.reason || '').slice(0, 220)}`);
}
console.log(`\nTOTALS: ${audits.size} audited (${pass} PASS, ${fail} FAIL, ${notex} NOT-EXERCISABLE), refutes present: ${refutes.size}`);
