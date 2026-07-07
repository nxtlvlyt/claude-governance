// Adversarial re-verification of hunt-13 replay evidence (read-only w.r.t. production;
// fixture AUTORUN lives in scratch). Drives the REAL production pipeline:
//   orchestrate.mjs insertQueueLineAfter (the real re-split insert path, used by defaultSplitFn)
//   muezzin-daemon.mjs readQueue (the real daemon queue reader with the QUEUE-DUP guard)
// against the gap's receipted kill state: SPLIT parent + two FAILED .S1/.S2 children from a
// prior split attempt, then a genuine RE-SPLIT re-inserting the same .S1/.S2 numbering.
// Run with: node replay-hunt13-verify.mjs --selftest   (the --selftest argv token makes the
// daemon module route evt() to a tmpdir log instead of the live daemon-events.log)
import { insertQueueLineAfter, SPLIT_CHILD_MARKER } from 'file:///C:/Users/marka/.claude/muezzin-plugin/orchestrate.mjs';
import { readQueue } from 'file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

let fails = 0;
const ck = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) fails++; };

const tmp = mkdtempSync(path.join(os.tmpdir(), 'hunt13-replay-'));
const autorun = path.join(tmp, 'AUTORUN.md');

// The kill state: prior split attempt left a SPLIT parent and two FAILED children.
const before = [
  '# queue',
  'SPLIT missions/mt-parent.mission.txt  <!-- 2026-07-04 prior split -->',
  'FAILED missions/mt-parent.S1.mission.txt  <!-- prior attempt failed -->',
  'FAILED missions/mt-parent.S2.mission.txt  <!-- prior attempt failed -->',
  'missions/unrelated.mission.txt',
].join('\n') + '\n';

// The RE-SPLIT: real production insert path re-inserts the same .S1/.S2 numbering.
let text = insertQueueLineAfter(before, 'missions/mt-parent.mission.txt', 'missions/mt-parent.S1.mission.txt');
text = insertQueueLineAfter(text, 'missions/mt-parent.S1.mission.txt', 'missions/mt-parent.S2.mission.txt');
ck(text.includes(`missions/mt-parent.S1.mission.txt  ${SPLIT_CHILD_MARKER}`), 'insertQueueLineAfter tagged the re-inserted S1 line with the SPLIT-CHILD marker');
ck(text.includes(`missions/mt-parent.S2.mission.txt  ${SPLIT_CHILD_MARKER}`), 'insertQueueLineAfter tagged the re-inserted S2 line with the SPLIT-CHILD marker');

writeFileSync(autorun, text);
const { pending } = readQueue(autorun);
const paths = pending.map((p) => p.raw);

ck(paths.includes('missions/mt-parent.S1.mission.txt'), 'readQueue: fresh re-split S1 IS pending despite the old FAILED status line (the gap: previously silently unfireable forever)');
ck(paths.includes('missions/mt-parent.S2.mission.txt'), 'readQueue: fresh re-split S2 IS pending despite the old FAILED status line');
ck(!paths.includes('missions/mt-parent.mission.txt'), 'readQueue: SPLIT parent stays terminal (not pending)');
ck(paths.filter((p) => p === 'missions/mt-parent.S1.mission.txt').length === 1, 'readQueue: exactly one pending entry for S1');
ck(paths.filter((p) => p === 'missions/mt-parent.S2.mission.txt').length === 1, 'readQueue: exactly one pending entry for S2');
ck(paths.includes('missions/unrelated.mission.txt'), 'readQueue: unrelated pending line unaffected');

// Control: same kill state WITHOUT the re-split marker must still be skipped (guard intact).
writeFileSync(autorun, before + 'missions/mt-parent.S1.mission.txt\n');
const { pending: ctrl } = readQueue(autorun);
ck(!ctrl.map((p) => p.raw).includes('missions/mt-parent.S1.mission.txt'), 'control: an UNTAGGED bare S1 beside the old FAILED line is still skipped (exemption is marker-scoped)');

rmSync(tmp, { recursive: true, force: true });
console.log(fails === 0 ? 'REPLAY ALL PASS' : `${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
