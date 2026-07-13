#!/usr/bin/env node
// witness-refire-hold-patch.mjs -- gap-witness-revise-on-refire (priority-elevated
// 2026-07-13): a witness REVISE/REJECT on a mission's BEFORE pass is currently pure
// advisory (self_witness.mjs's own header: "NEVER gates, delays, or halts") -- receipted
// live 2026-07-13T15:37:43.796Z, engine-verdict-merge-visibility-downgrade got a REJECT
// from ornith:9b before it ran, was logged, and the daemon proceeded unaffected. The
// fourth law says a REVISE is not noise to dismiss -- mechanizing it: a SAME-STEM REFIRE
// (attempt 2+) is HELD until the conductor has explicitly acknowledged reading the flagged
// plan. This patch adds the read/write helpers + the gate function + a CLI ack verb;
// wiring the gate into the daemon's own fire loop is a separate, smaller follow-up patch
// (keeps blast radius on the live daemon process minimal per mission).
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'self_witness.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('WITNESS_ACK_LOG')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

// 0. readFileSync/unlinkSync are not currently imported in this file (only
// appendFileSync/mkdirSync) -- the new read helpers + their selftests need both.
const importOld = `import { appendFileSync, mkdirSync } from 'fs';`;
const importNewLine = `import { appendFileSync, mkdirSync, readFileSync, unlinkSync } from 'fs';`;
const impN = t.split(importOld).length - 1;
if (impN !== 1) { console.error(`NOT-UNIQUE: found ${impN} occurrences of the fs import line`); process.exit(1); }
t = t.replace(importOld, importNewLine);

// 1. constant, right next to SELF_WITNESS_LOG
const constOld = `const SELF_WITNESS_LOG = join(HERE, 'missions', '_logs', 'self-witness.jsonl');`;
const constNew = `const SELF_WITNESS_LOG = join(HERE, 'missions', '_logs', 'self-witness.jsonl');
// gap-witness-revise-on-refire (priority-elevated 2026-07-13): the conductor's explicit
// "I read the flagged plan" acknowledgment log -- the ONLY thing that lifts a refire hold.
const WITNESS_ACK_LOG = join(HERE, 'missions', '_logs', 'witness-plan-read-ack.jsonl');`;
const cn = t.split(constOld).length - 1;
if (cn !== 1) { console.error(`NOT-UNIQUE: found ${cn} occurrences of the SELF_WITNESS_LOG const line`); process.exit(1); }
t = t.replace(constOld, constNew);

// 2. the read/write/gate helpers, right after emitReceipt (before the AFTER-pass section)
const anchorOld = `export function emitReceipt(receipt, { logPath = SELF_WITNESS_LOG } = {}) {
  try { mkdirSync(dirname(logPath), { recursive: true }); appendFileSync(logPath, JSON.stringify(receipt) + '\\n'); }
  catch { /* receipt logging must never break the gate */ }
  return receipt;
}`;
const anchorNew = `export function emitReceipt(receipt, { logPath = SELF_WITNESS_LOG } = {}) {
  try { mkdirSync(dirname(logPath), { recursive: true }); appendFileSync(logPath, JSON.stringify(receipt) + '\\n'); }
  catch { /* receipt logging must never break the gate */ }
  return receipt;
}

// ---- REFIRE HOLD on witness REVISE (gap-witness-revise-on-refire, priority-elevated
// 2026-07-13) -----------------------------------------------------------------------------
//
// PURE reader: the most recent 'before'-pass self-witness receipt for a given artifact stem,
// or null if none exists / the log is unreadable (fail-open -- a missing log never holds).
export function latestBeforeWitness(stem, { logPath = SELF_WITNESS_LOG } = {}) {
  let lines;
  try { lines = readFileSync(logPath, 'utf8').split(/\\r?\\n/).filter(Boolean); }
  catch { return null; }
  let latest = null;
  for (const line of lines) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e?.kind === 'self-witness' && e?.pass === 'before' && e?.artifact === stem) latest = e;
  }
  return latest;
}

// writer: the conductor's deliberate "I read the flagged plan" acknowledgment. Unlike
// emitReceipt this is NOT fail-silent -- an ack the conductor believes landed but didn't
// would silently leave a mission held forever, which is worse than a loud failure here.
export function ackPlanRead(stem, note = '', { logPath = WITNESS_ACK_LOG } = {}) {
  const entry = { ts: new Date().toISOString(), stem, note: String(note || '').slice(0, 500) };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(entry) + '\\n');
  return entry;
}

// PURE reader: the most recent ack for a given stem, or null.
export function latestAck(stem, { logPath = WITNESS_ACK_LOG } = {}) {
  let lines;
  try { lines = readFileSync(logPath, 'utf8').split(/\\r?\\n/).filter(Boolean); }
  catch { return null; }
  let latest = null;
  for (const line of lines) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e?.stem === stem) latest = e;
  }
  return latest;
}

// THE GATE. Mirrors searchReadinessGate's { action: 'fire'|'hold', reason } shape so the
// daemon's fire loop can handle both the same way. priorAttempts = the attempt count
// BEFORE this fire would increment it (0 on a mission's very first fire) -- only a REFIRE
// (priorAttempts >= 1) can be held; a first attempt always fires (nothing to have read yet).
// Fail-open throughout: any read error, missing log, or unrecognized shape resolves to fire
// -- this hold exists to make a real flag actionable, never to become a new failure mode of
// its own that blocks missions no witness ever actually flagged.
export function witnessRefireHold(stem, priorAttempts, { logPath = SELF_WITNESS_LOG, ackLogPath = WITNESS_ACK_LOG } = {}) {
  try {
    if (!(priorAttempts >= 1)) return { action: 'fire', reason: 'first attempt — nothing to have read yet' };
    const w = latestBeforeWitness(stem, { logPath });
    if (!w) return { action: 'fire', reason: 'no before-witness receipt on record' };
    if (w.ok !== false) return { action: 'fire', reason: 'before-witness raised no concern' };
    const ack = latestAck(stem, { logPath: ackLogPath });
    if (ack && Date.parse(ack.ts) >= Date.parse(w.ts)) return { action: 'fire', reason: \`conductor acknowledged the flag at \${ack.ts}\` };
    const concern = (w.reasons || []).join(' | ').slice(0, 240);
    return { action: 'hold', reason: \`witness flagged this plan before a prior attempt (\${w.laguna?.verdict ?? 'REVISE'} at \${w.ts}) and no conductor plan-read ack exists since — \${concern}\` };
  } catch (e) {
    return { action: 'fire', reason: \`witness-refire-hold internal error (fail-open to fire): \${e.message}\` };
  }
}`;
const an = t.split(anchorOld).length - 1;
if (an !== 1) { console.error(`NOT-UNIQUE: found ${an} occurrences of the emitReceipt anchor`); process.exit(1); }
t = t.replace(anchorOld, anchorNew);

// 3. CLI verb --ack-plan-read <stem> [note...]
const cliOld = `if (process.argv.includes('--check-commit')) {`;
const cliNew = `if (process.argv.includes('--ack-plan-read')) {
  const argv = process.argv;
  const i = argv.indexOf('--ack-plan-read');
  const stem = argv[i + 1];
  const note = argv.slice(i + 2).join(' ');
  if (!stem) { console.error('usage: node self_witness.mjs --ack-plan-read <mission-stem> [note...]'); process.exit(1); }
  const entry = ackPlanRead(stem, note);
  console.log(\`ACK-RECORDED \${entry.stem} at \${entry.ts}\${note ? \` — \${note}\` : ''}\`);
  process.exit(0);
}

if (process.argv.includes('--check-commit')) {`;
const cliN = t.split(cliOld).length - 1;
if (cliN !== 1) { console.error(`NOT-UNIQUE: found ${cliN} occurrences of the --check-commit CLI anchor`); process.exit(1); }
t = t.replace(cliOld, cliNew);

// 4. the bare-selftest trigger only excludes --check-commit; --ack-plan-read must ALSO be
// excluded or the offline selftest runs (and exits) before the ack verb is ever reached.
const triggerOld = `if (process.argv[1] && process.argv[1].endsWith('self_witness.mjs') && !process.argv.includes('--check-commit')) {`;
const triggerNew = `if (process.argv[1] && process.argv[1].endsWith('self_witness.mjs') && !process.argv.includes('--check-commit') && !process.argv.includes('--ack-plan-read')) {`;
const trN = t.split(triggerOld).length - 1;
if (trN !== 1) { console.error(`NOT-UNIQUE: found ${trN} occurrences of the bare-selftest trigger line`); process.exit(1); }
t = t.replace(triggerOld, triggerNew);

// 5. selftest coverage for the new gate + read/write helpers, right before the ALL PASS
// summary line, using isolated tmp-file paths (os.tmpdir()) so it never touches the real logs.
const testOld = `  ck(beforeRcpt.pass === 'before', 'receipt: default pass is "before" (the original v1 mission-text pass)');`;
const testNew = `  ck(beforeRcpt.pass === 'before', 'receipt: default pass is "before" (the original v1 mission-text pass)');

  // ---- witnessRefireHold / ackPlanRead / latestBeforeWitness / latestAck
  // (gap-witness-revise-on-refire, priority-elevated 2026-07-13) ----
  {
    const wlog = join('.', \`_selftest-witness-\${process.pid}.jsonl\`);
    const alog = join('.', \`_selftest-ack-\${process.pid}.jsonl\`);
    try { unlinkSync(wlog); } catch {}
    try { unlinkSync(alog); } catch {}
    const opts = { logPath: wlog, ackLogPath: alog };

    ck(witnessRefireHold('s', 0, opts).action === 'fire', 'witnessRefireHold: first attempt (priorAttempts=0) always fires, nothing to have read yet');
    ck(witnessRefireHold('s', 1, opts).action === 'fire', 'witnessRefireHold: refire with no witness receipt on record fires (nothing flagged)');

    emitReceipt({ ts: '2026-07-13T10:00:00.000Z', kind: 'self-witness', pass: 'before', artifact: 's', ok: true, laguna: { verdict: 'APPROVE' }, reasons: [] }, { logPath: wlog });
    ck(witnessRefireHold('s', 1, opts).action === 'fire', 'witnessRefireHold: refire with a CLEAN (ok:true) before-witness fires');

    emitReceipt({ ts: '2026-07-13T11:00:00.000Z', kind: 'self-witness', pass: 'before', artifact: 's', ok: false, laguna: { verdict: 'REVISE' }, reasons: ['ornith:9b(structural): REVISE — scope gap'] }, { logPath: wlog });
    const held = witnessRefireHold('s', 1, opts);
    ck(held.action === 'hold', 'witnessRefireHold: refire with a FLAGGED (ok:false) before-witness and no ack HOLDS (the mechanism this gap exists for)');
    ck(/scope gap/.test(held.reason), 'witnessRefireHold: the hold reason names the actual flagged concern, not a generic message');

    appendFileSync(alog, JSON.stringify({ ts: '2026-07-13T10:30:00.000Z', stem: 's', note: 'stale — before the flag' }) + '\\n');
    ck(witnessRefireHold('s', 1, opts).action === 'hold', 'witnessRefireHold: an ack that PRE-DATES the flagged receipt does NOT lift the hold (stale ack)');

    ackPlanRead('s', 'read the plan, scope gap is intentional', { logPath: alog });
    ck(witnessRefireHold('s', 1, opts).action === 'fire', 'witnessRefireHold: a FRESH ack (after the flag) lifts the hold');

    ck(witnessRefireHold('other-stem', 1, opts).action === 'fire', 'witnessRefireHold: a DIFFERENT stem is entirely unaffected by another stem\\'s flag');

    try { unlinkSync(wlog); } catch {}
    try { unlinkSync(alog); } catch {}
  }`;
const tn2 = t.split(testOld).length - 1;
if (tn2 !== 1) { console.error(`NOT-UNIQUE: found ${tn2} occurrences of the receipt-default-pass selftest line`); process.exit(1); }
t = t.replace(testOld, testNew);

writeFileSync(path, t);
console.log('PATCHED');
