import * as m from './self_witness.mjs';
import fs from 'fs';
const wlog = './test-witness.jsonl';
const alog = './test-ack.jsonl';
try { fs.unlinkSync(wlog); } catch {}
try { fs.unlinkSync(alog); } catch {}

let g = m.witnessRefireHold('mystem', 0, { logPath: wlog, ackLogPath: alog });
console.log('1 first-attempt:', g.action, '(want fire)');

g = m.witnessRefireHold('mystem', 1, { logPath: wlog, ackLogPath: alog });
console.log('2 refire-no-receipt:', g.action, '(want fire)');

fs.appendFileSync(wlog, JSON.stringify({ ts: '2026-07-13T10:00:00.000Z', kind: 'self-witness', pass: 'before', artifact: 'mystem', ok: true, laguna: { verdict: 'APPROVE' }, reasons: [] }) + '\n');
g = m.witnessRefireHold('mystem', 1, { logPath: wlog, ackLogPath: alog });
console.log('3 refire-clean-witness:', g.action, '(want fire)', '-', g.reason);

fs.appendFileSync(wlog, JSON.stringify({ ts: '2026-07-13T11:00:00.000Z', kind: 'self-witness', pass: 'before', artifact: 'mystem', ok: false, laguna: { verdict: 'REVISE' }, reasons: ['ornith:9b(structural): REVISE — scope gap in step 3'] }) + '\n');
g = m.witnessRefireHold('mystem', 1, { logPath: wlog, ackLogPath: alog });
console.log('4 refire-flagged-no-ack:', g.action, '(want hold) -', g.reason.slice(0, 100));

fs.appendFileSync(alog, JSON.stringify({ ts: '2026-07-13T10:30:00.000Z', stem: 'mystem', note: 'stale' }) + '\n');
g = m.witnessRefireHold('mystem', 1, { logPath: wlog, ackLogPath: alog });
console.log('5 refire-stale-ack:', g.action, '(want hold)');

const entry = m.ackPlanRead('mystem', 'read the plan, scope gap is intentional', { logPath: alog });
console.log('ack written:', entry.ts);
g = m.witnessRefireHold('mystem', 1, { logPath: wlog, ackLogPath: alog });
console.log('6 refire-fresh-ack:', g.action, '(want fire)');

g = m.witnessRefireHold('otherstem', 1, { logPath: wlog, ackLogPath: alog });
console.log('7 different-stem:', g.action, '(want fire)');

fs.unlinkSync(wlog); fs.unlinkSync(alog);
