// Pull the authoritative totals from the resumed audit workflow's final return object.
import { readFileSync } from 'fs';
const f = 'C:/Users/marka/AppData/Local/Temp/claude/C--Users-marka/8942b7ff-94d8-4ae0-a252-9ac5b7f90a81/tasks/w148xmcjk.output';
const raw = readFileSync(f, 'utf8');
const start = raw.indexOf('{"upheld"');
if (start === -1) { console.log('no return object found'); process.exit(1); }
// The return object may be followed by non-JSON; find balanced braces.
let depth = 0, end = -1;
for (let i = start; i < raw.length; i++) {
  const c = raw[i];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const obj = JSON.parse(raw.slice(start, end));
const up = obj.upheld || [];
const dis = obj.disputed || [];
const byV = {};
for (const a of up) byV[a.verdict] = (byV[a.verdict] || 0) + 1;
console.log('UPHELD:', up.length, JSON.stringify(byV));
console.log('DISPUTED:', dis.length);
for (const d of dis) console.log('  DISPUTED:', (d.item || '').slice(0, 60), '::', (d.refuteReason || '').slice(0, 180));
console.log('failCount:', obj.failCount);
const fails = up.filter((a) => a.verdict === 'E2E-FAIL');
for (const fl of fails) console.log('\nFAIL (upheld):', (fl.item || '').slice(0, 70), '\n  reopen:', (fl.reopenReason || fl.evidence || '').slice(0, 400));
