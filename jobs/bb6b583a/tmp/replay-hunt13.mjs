// E2E replay of hunt-item #13's kill-shape (read-only audit scratch, deleted after use).
// GAP: a RE-SPLIT (mission split, children FAILED, split AGAIN reusing .S1/.S2 numbering)
// produced fresh bare child lines whose paths matched OLD status lines from the prior
// attempt -> the 2026-07-03 QUEUE-DUP guard skipped them silently, forever unfireable.
// FIX (2ca0526): insertQueueLineAfter tags inserted lines with <!-- SPLIT-CHILD -->;
// readQueue exempts ONLY marker-tagged lines from the status-elsewhere check.
// This replay drives the REAL production pipeline end-to-end: orchestrate.mjs's
// insertQueueLineAfter builds the re-split queue text exactly as a live re-split would,
// then muezzin-daemon.mjs's readQueue (the daemon's actual queue reader) reads it.
// NOTE: only non-evt paths are exercised here (the exemption path emits no event);
// the untagged-skip + same-batch-dedup controls live in muezzin-daemon.mjs --selftest,
// which redirects events to tmp. Verified passing separately.
import { insertQueueLineAfter, SPLIT_CHILD_MARKER } from 'file:///C:/Users/marka/.claude/muezzin-plugin/orchestrate.mjs';
import { readQueue } from 'file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs';
import { writeFileSync, rmSync } from 'fs';

const scratch = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/REPLAY-AUTORUN.md';
let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

// --- The original kill-shape: STATE.md 2026-07-01/07-04 named two real parents left
// SPLIT (terminal) with two dead FAILED children each. Reproduce that exact state:
let autorun = [
  '# AUTORUN queue (replay fixture)',
  'SPLIT missions/mt-parent.mission.txt',
  'FAILED missions/mt-parent.S1.mission.txt  <!-- first split attempt, dead -->',
  'FAILED missions/mt-parent.S2.mission.txt  <!-- first split attempt, dead -->',
  'missions/unrelated-other.mission.txt',
  '',
].join('\n');

// --- Now the RE-SPLIT fires through the real production insertion path, reusing the
// SAME .S1/.S2 numbering (the gap's exact trigger), anchored on the parent as
// defaultSplitFn's appendQueue does:
autorun = insertQueueLineAfter(autorun, 'missions/mt-parent.mission.txt', 'missions/mt-parent.S1.mission.txt');
autorun = insertQueueLineAfter(autorun, 'missions/mt-parent.S1.mission.txt', 'missions/mt-parent.S2.mission.txt');
writeFileSync(scratch, autorun);

ck(autorun.includes(`missions/mt-parent.S1.mission.txt  ${SPLIT_CHILD_MARKER}`),
  'insertQueueLineAfter tagged the fresh S1 child with the SPLIT-CHILD marker');
ck(autorun.includes(`missions/mt-parent.S2.mission.txt  ${SPLIT_CHILD_MARKER}`),
  'insertQueueLineAfter tagged the fresh S2 child with the SPLIT-CHILD marker');

// --- The daemon's real queue reader against the re-split file:
const { pending } = readQueue(scratch);
const raws = pending.map((p) => p.raw);
ck(raws.includes('missions/mt-parent.S1.mission.txt'),
  'readQueue: fresh re-split S1 IS pending despite the old FAILED status line (the gap: previously silently unfireable forever)');
ck(raws.includes('missions/mt-parent.S2.mission.txt'),
  'readQueue: fresh re-split S2 IS pending despite the old FAILED status line');
ck(!raws.includes('missions/mt-parent.mission.txt'),
  'readQueue: the SPLIT parent itself stays terminal (never re-fired)');
ck(raws.includes('missions/unrelated-other.mission.txt'),
  'readQueue: unrelated pending line unaffected');
ck(pending.filter((p) => p.raw === 'missions/mt-parent.S1.mission.txt').length === 1,
  'readQueue: exactly ONE pending entry per re-split child (no double-queue)');

rmSync(scratch, { force: true });
console.log(fails === 0 ? '\nREPLAY ALL PASS' : `\n${fails} REPLAY FAIL`);
process.exit(fails === 0 ? 0 : 1);
