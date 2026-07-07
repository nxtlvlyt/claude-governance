// E2E replay of hunt-#15 kill-shape: "Fix-ledger requeue-once entries are consumed whole
// on partial requeue: .some() marks a multi-stem entry requeued when ANY one stem was
// requeued, permanently burning the other stems."
// Isolated base (NOT the shared _selftest-conduct dir); exec stubbed so nothing real runs.
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';

const { recordFix, heal } = await import('file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs');

const base = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/hunt15-base';
const ledgerPath = path.join(base, 'missions', '_logs', 'fix-ledger.json');
rmSync(base, { recursive: true, force: true });
mkdirSync(path.join(base, 'missions', '_logs'), { recursive: true });
writeFileSync(path.join(base, 'missions', 'h15-a.mission.txt'), 'MISSION-CLASS: test\n');
writeFileSync(path.join(base, 'missions', 'h15-b.mission.txt'), 'MISSION-CLASS: test\n');
// beat 1: ONLY h15-a is FAILED; h15-b not yet failed (the partial-requeue shape)
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-a.mission.txt  <!-- t -->\n');

const now = Date.now();
recordFix(base, { cls: 'hunt15-class', fix: 'kill-shape replay fix', requeue: ['h15-a', 'h15-b'] }, now);

const execCalls = [];
const exec = (cmd) => { execCalls.push(String(cmd)); return ''; }; // record, never run

let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

// --- beat 1: partial requeue ---
const r1 = heal(base, now, { exec });
const led1 = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const e1 = led1.entries.find((e) => e.class === 'hunt15-class');
ck(r1.performed.some((p) => p.action === 'requeue' && p.stem === 'h15-a'), 'beat1: FAILED stem h15-a is requeued');
ck(e1 && e1.requeued === false, 'beat1: ENTRY-level requeued stays false (the old .some() bug flipped it true here)');
ck(e1 && e1.requeue.find((i) => i.stem === 'h15-a')?.requeued === true, 'beat1: h15-a per-stem flag true');
ck(e1 && e1.requeue.find((i) => i.stem === 'h15-b')?.requeued === false, 'beat1: h15-b per-stem flag still false (not burned)');

// --- beat 2: h15-b fails LATER; under the pre-fix code the entry was already consumed
// whole, so this requeue could never fire (the "permanently burning" the gap named) ---
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-b.mission.txt  <!-- t -->\n');
const r2 = heal(base, now + 60000, { exec });
const led2 = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const e2 = led2.entries.find((e) => e.class === 'hunt15-class');
ck(r2.performed.some((p) => p.action === 'requeue' && p.stem === 'h15-b'), 'beat2 KILL-SHAPE: h15-b STILL requeues in a later beat (was permanently burned pre-fix)');
ck(e2 && e2.requeued === true, 'beat2: entry closes (requeued:true) only after EVERY stem requeued');

// --- beat 3: once-only still holds — a fully-consumed entry never fires again ---
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-a.mission.txt  <!-- t -->\nFAILED missions/h15-b.mission.txt  <!-- t -->\n');
const r3 = heal(base, now + 120000, { exec });
ck(!r3.performed.some((p) => p.action === 'requeue'), 'beat3: consumed entry never re-fires (once-only preserved)');

// --- legacy migration: a production ledger written PRE-FIX (bare stem strings) still
// requeues correctly and is migrated to per-stem objects on write ---
writeFileSync(ledgerPath, JSON.stringify({ entries: [{ class: 'legacy-class', fix: 'old-format', landed_ts: new Date(now).toISOString(), requeue: ['h15-a', 'h15-b'], requeued: false }] }, null, 2));
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-a.mission.txt  <!-- t -->\n');
const r4 = heal(base, now + 180000, { exec });
const led4 = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const e4 = led4.entries.find((e) => e.class === 'legacy-class');
ck(r4.performed.some((p) => p.action === 'requeue' && p.stem === 'h15-a'), 'legacy: bare-string ledger still requeues');
ck(e4 && typeof e4.requeue[0] === 'object' && e4.requeue[0].stem === 'h15-a' && e4.requeue[0].requeued === true, 'legacy: migrated to {stem,requeued} on write, h15-a marked');
ck(e4 && e4.requeued === false && e4.requeue[1]?.requeued === false, 'legacy: entry + h15-b stay live after partial (pre-fix: burned)');

console.log(`exec calls intercepted (none executed): ${execCalls.length}${execCalls.length ? ' -> ' + JSON.stringify(execCalls) : ''}`);
console.log(fails === 0 ? 'HUNT-15 REPLAY: ALL PASS' : `HUNT-15 REPLAY: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
