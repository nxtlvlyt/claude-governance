// E2E replay of gap #1 "tartib bare-stem REQUIRES not gating" (2026-07-03 16:36 minimal pair).
// Kill-shape: mt-e2e-reachability.S1 carries "REQUIRES: mt-mobile-qc-hardening.S1.S2 (tartib ...)"
// while that dep is queued but merely PENDING in AUTORUN. Pre-fix the daemon FIRED it;
// post-fix (7b02160, queuedDepsHold b2) it must HOLD.
import { readFileSync } from 'node:fs';

const { queuedDepsHold: newHold } = await import('file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs');
const { queuedDepsHold: oldHold } = await import('file:///C:/Users/marka/.claude/jobs/bb6b583a/tmp/old-daemon.mjs');

// The ACTUAL mission text from disk (its REQUIRES line is unchanged since the incident).
const missionText = readFileSync('C:/Users/marka/.claude/muezzin-plugin/missions/mt-e2e-reachability.S1.mission.txt', 'utf8');
const missionPath = 'missions/mt-e2e-reachability.S1.mission.txt';

// AUTORUN shape at the incident: the dep queued but PENDING (no DONE/FAILED status).
const autorunPending =
  'missions/mt-mobile-qc-hardening.S1.S2.mission.txt  <!-- queued, pending -->\n' +
  'missions/mt-e2e-reachability.S1.mission.txt  <!-- queued -->\n';

const resOk = () => false; // no PASS receipt exists for the pending dep

const oldR = oldHold(missionText, missionPath, autorunPending, resOk);
const newR = newHold(missionText, missionPath, autorunPending, resOk);
console.log('PRE-FIX  (7b02160^) hold =', oldR.hold, oldR.why ? `why: ${oldR.why}` : '(fired — the bug)');
console.log('POST-FIX (HEAD)     hold =', newR.hold, newR.why ? `why: ${newR.why}` : '');

// Release check: same shape but dep DONE with ok:true receipt -> must FIRE (no permanent stall).
const autorunDone =
  'DONE missions/mt-mobile-qc-hardening.S1.S2.mission.txt  <!-- t -->\n' +
  'missions/mt-e2e-reachability.S1.mission.txt  <!-- queued -->\n';
const resOkTrue = (dep) => dep === 'missions/mt-mobile-qc-hardening.S1.S2.mission.txt';
const relR = newHold(missionText, missionPath, autorunDone, resOkTrue);
console.log('POST-FIX dep DONE+ok hold =', relR.hold, relR.why ? `why: ${relR.why}` : '(fires — gate releases)');

const pass = oldR.hold === false && newR.hold === true && relR.hold === false;
console.log(pass ? 'REPLAY VERDICT: PASS (old fired past pending dep; new holds; releases on DONE)' : 'REPLAY VERDICT: FAIL');
process.exit(pass ? 0 : 1);
