// Independent adversarial re-check of hunt-15 kill-shape (audit-of-audit).
// Uses the REAL conduct-cycle.mjs (isolated copy, byte-identical to live) against an
// isolated fixture base. exec stubbed — nothing real is executed or restarted.
import { recordFix, heal } from './conduct-cycle.mjs';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';

const base = path.join(process.cwd(), 'replay-base');
rmSync(base, { recursive: true, force: true });
const logs = path.join(base, 'missions', '_logs');
mkdirSync(logs, { recursive: true });
const now = Date.now();
let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const readLedger = () => JSON.parse(readFileSync(path.join(logs, 'fix-ledger.json'), 'utf8'));

// healthy daemon so heal() never wants a restart; exec throws if anything tries.
const healthyDaemon = () => {
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));
};
healthyDaemon();
const stubGit = () => ({ ok: true, out: '' });
const opts = { exec: () => { throw new Error('replay must not execute anything'); }, sightFn: () => ({ ok: true, results: 10 }), worktreeReposFn: () => [], gitFn: stubGit };

// mission files exist on disk (dead-stem guard would otherwise skip)
writeFileSync(path.join(base, 'missions', 'h15-a.mission.txt'), 'MISSION-CLASS: test\n');
writeFileSync(path.join(base, 'missions', 'h15-b.mission.txt'), 'MISSION-CLASS: test\n');

// BEAT 1: multi-stem fix entry [h15-a, h15-b]; ONLY h15-a is FAILED. Partial requeue.
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-a.mission.txt  <!-- t -->\n');
recordFix(base, { cls: 'h15-class', fix: 'h15 fix', requeue: ['h15-a', 'h15-b'] }, now);
const h1 = heal(base, now, opts);
ck(h1.performed.some((p) => p.action === 'requeue' && p.stem === 'h15-a'), 'beat1: h15-a (currently FAILED) requeued');
let L = readLedger();
let e = L.entries.find((x) => x.class === 'h15-class');
ck(e.requeued === false, 'beat1 KILL-SHAPE: entry-level requeued stays FALSE (old .some() flipped it true here, burning h15-b)');
ck(e.requeue.find((i) => i.stem === 'h15-a')?.requeued === true, 'beat1: h15-a per-stem requeued=true');
ck(e.requeue.find((i) => i.stem === 'h15-b')?.requeued === false, 'beat1: h15-b per-stem stays live (requeued=false)');

// BEAT 2 (later): h15-b now FAILS. Pre-fix it was permanently burned; post-fix it must requeue.
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-b.mission.txt  <!-- t -->\n');
const h2 = heal(base, now, opts);
ck(h2.performed.some((p) => p.action === 'requeue' && p.stem === 'h15-b'), 'beat2 KILL-SHAPE: h15-b STILL requeues in a later beat (pre-fix: permanently burned)');
L = readLedger();
e = L.entries.find((x) => x.class === 'h15-class');
ck(e.requeued === true, 'beat2: entry closes (requeued=true) only after EVERY stem requeued');

// BEAT 3: once-only — consumed entry never re-fires.
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-a.mission.txt  <!-- t -->\nFAILED missions/h15-b.mission.txt  <!-- t -->\n');
const h3 = heal(base, now, opts);
ck(!h3.performed.some((p) => p.action === 'requeue'), 'beat3: consumed entry never re-fires (once-only preserved)');

// LEGACY: production-shaped bare-string ledger, partial requeue must not burn the sibling.
writeFileSync(path.join(logs, 'fix-ledger.json'), JSON.stringify({ entries: [{ class: 'legacy', fix: 'lf', landed_ts: new Date(now).toISOString(), requeue: ['h15-a', 'h15-b'], requeued: false }] }, null, 2));
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/h15-a.mission.txt  <!-- t -->\n');
const h4 = heal(base, now, opts);
ck(h4.performed.some((p) => p.action === 'requeue' && p.stem === 'h15-a'), 'legacy: bare-string ledger migrates and h15-a requeues');
L = readLedger();
e = L.entries.find((x) => x.class === 'legacy');
ck(e.requeued === false && e.requeue.find((i) => i.stem === 'h15-b')?.requeued === false, 'legacy KILL-SHAPE: entry + h15-b stay live after partial (pre-fix: burned)');

console.log(fails === 0 ? 'H15 INDEPENDENT REPLAY: ALL PASS (10/10)' : `H15 REPLAY: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
