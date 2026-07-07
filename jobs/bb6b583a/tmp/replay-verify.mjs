// Adversarial re-verification of the tartib bare-stem kill-shape replay.
// Read-only: no daemon start (argv[1] guard), no evt() path reachable with these fixtures.
import { readFileSync } from 'node:fs';
import { queuedDepsHold as headGate } from 'C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs';
import { queuedDepsHold as prefixGate } from './prefix-queuedDepsHold-verify.mjs';

const missionPath = 'missions/mt-e2e-reachability.S1.mission.txt';
const missionText = readFileSync('C:/Users/marka/.claude/muezzin-plugin/' + missionPath, 'utf8');

// Kill-shape: dep queued but merely PENDING (no DONE prefix, no RESOLVED comment)
const autorunPending = [
  'missions/mt-mobile-qc-hardening.S1.S2.mission.txt',
  missionPath,
].join('\n') + '\n';

// Release-shape: dep DONE with ok:true receipt
const autorunDone = [
  'DONE missions/mt-mobile-qc-hardening.S1.S2.mission.txt',
  missionPath,
].join('\n') + '\n';

const resOkTrue = () => true;

const pre = prefixGate(missionText, missionPath, autorunPending, resOkTrue);
const post = headGate(missionText, missionPath, autorunPending, resOkTrue);
const rel = headGate(missionText, missionPath, autorunDone, resOkTrue);

console.log('PRE-FIX (7b02160^) hold =', pre.hold, pre.why || '');
console.log('POST-FIX (HEAD)    hold =', post.hold, post.why || '');
console.log('POST-FIX dep DONE  hold =', rel.hold, rel.why || '');

const pass = pre.hold === false && post.hold === true && rel.hold === false;
console.log('REPLAY VERDICT:', pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
