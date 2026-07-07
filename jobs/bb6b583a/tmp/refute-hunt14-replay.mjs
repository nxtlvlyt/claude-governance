// Adversarial re-verification of hunt-14 audit claim.
// Technique: push --selftest into argv BEFORE dynamic import so the daemon module routes
// evt() to the per-pid temp events file (never the live daemon-events.log), and neuter
// process.exit so the module's own selftest (which runs on import under --selftest and
// exits) cannot kill this process before the assertions run.
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.argv.push('--selftest');
const realExit = process.exit.bind(process);
process.exit = () => {};
const { queuedDepsHold } = await import('file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs');
process.exit = realExit;

const EVENTS = path.join(os.tmpdir(), `muezzin-selftest-events-${process.pid}.log`);
const resOk = () => true;
let fails = 0;
const ck = (cond, name) => { console.log((cond ? 'RPASS  ' : 'RFAIL  ') + name); if (!cond) fails++; };

// AUTORUN state per the gap's receipted kill-shape: the REAL dependency
// mt-checkout-hardening.S1 is queued and still PENDING (no DONE line).
const ar = 'missions/mt-checkout-hardening.S1.mission.txt  <!-- pending -->\n';

// 1) Kill-shape: mission cites a DRIFTED stem (S1.S9) that resolves to no AUTORUN line
//    while the real dep is pending. Documented unchanged behavior: does NOT hold (fires).
const before = existsSync(EVENTS) ? readFileSync(EVENTS, 'utf8').length : 0;
const r1 = queuedDepsHold('REQUIRES: mt-checkout-hardening.S1.S9 (tartib — drifted stem)\n', 'missions/victim.mission.txt', ar, resOk);
ck(r1.hold === false, 'kill-shape still fires (hold=false) — the documented unchanged fail-open half');

// 2) Diagnostic event fires naming the exact token and citing mission.
const tail1 = existsSync(EVENTS) ? readFileSync(EVENTS, 'utf8').slice(before) : '';
ck(/queuedDepsHold: REQUIRES token\(s\) \[mt-checkout-hardening\.S1\.S9\] in missions\/victim\.mission\.txt .*resolve to no AUTORUN line/.test(tail1),
   'diagnostic event names the exact drifted token + citing mission');

// 3) Non-hyphenated prose REQUIRES stays silent (no false-positive noise).
const before2 = existsSync(EVENTS) ? readFileSync(EVENTS, 'utf8').length : 0;
const r2 = queuedDepsHold('REQUIRES: nothing else beyond the usual checks\n', 'missions/victim.mission.txt', ar, resOk);
const tail2 = existsSync(EVENTS) ? readFileSync(EVENTS, 'utf8').slice(before2) : '';
ck(r2.hold === false && !/queuedDepsHold: REQUIRES token/.test(tail2), 'non-hyphenated prose REQUIRES stays silent');

// 4) A correctly-cited pending dep still HOLDS (b2 gate intact).
const r3 = queuedDepsHold('REQUIRES: mt-checkout-hardening.S1 (tartib)\n', 'missions/victim.mission.txt', ar, resOk);
ck(r3.hold === true && r3.dep === 'missions/mt-checkout-hardening.S1.mission.txt', 'correctly-cited pending dep still HOLDS (b2 gate intact)');

try { if (existsSync(EVENTS)) unlinkSync(EVENTS); } catch {}
console.log(fails === 0 ? 'REPLAY: ALL PASS' : `REPLAY: ${fails} FAIL`);
realExit(fails === 0 ? 0 : 1);
