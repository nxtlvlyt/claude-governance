#!/usr/bin/env node
// srcsha-anchor-patch.mjs — one-shot patcher for conduct-cycle.mjs's missionLandedState
// srcSha false-positive (gap-conduct-cycle-srcsha-anchor, 2026-07-12). Committed as a
// mission input artifact per the stitch-mission precedent: literal scripted precision,
// never an LLM edit-step on a multi-region change (tonight's own repeated lesson).
// Idempotent: exits 0 with ALREADY-PATCHED if the anchor is already present.
import { readFileSync, writeFileSync } from 'fs';

const path = 'conduct-cycle.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('ANCHOR REQUIREMENT (2026-07-12')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const edits = [
  {
    old: `  const srcSha = (mtext.match(/\\b([a-f0-9]{7,40})\\b/) || [])[1];`,
    new: `  // ANCHOR REQUIREMENT (2026-07-12, false-positive receipt: lighthouse-ci-manifest-fix
  // mission's Maqsad prose mentioned a PRIOR unrelated commit as narrative color; that
  // hash happened to equal current HEAD, so the guard concluded unfinished work was
  // already landed and the daemon PRE-SATISFIED-refused a legitimate fire). A bare
  // hex-looking token ANYWHERE in free prose is not a declared baseline -- only an
  // explicit BASELINE-SHA: field counts. Missing field -> srcSha stays null -> verdict
  // caps at PARTIAL (the existing nosha discipline, now the default for every mission
  // that never opts in — falseDeathScan still surfaces PARTIAL for conductor review;
  // only the daemon's silent auto-FULL-mark is closed).
  const srcSha = (mtext.match(/^BASELINE-SHA:\\s*([a-f0-9]{7,40})\\b/mi) || [])[1];`,
  },
  {
    old: `      const mtexts = {
        'missions/fd-landed.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land abc1234 feature',
        'missions/fd-wiring.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/w.js\\n  - map.html\\nMaqsad: land abc1234 feature',
        'missions/fd-gone.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/gone.js\\nMaqsad: land abc1234 feature',
        'missions/fd-judged.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/a.js\\nMaqsad: land abc1234 feature',
      };`,
    new: `      const mtexts = {
        'missions/fd-landed.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land the feature',
        'missions/fd-wiring.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/w.js\\n  - map.html\\nMaqsad: land the feature',
        'missions/fd-gone.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/gone.js\\nMaqsad: land the feature',
        'missions/fd-judged.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/a.js\\nMaqsad: land the feature',
      };`,
  },
  {
    old: `      ck(fd2.find((c) => c.path.includes('fd-nosha'))?.verdict === 'PARTIAL', 'false-death: NO source sha -> presence-only evidence caps at PARTIAL, never FULL (first-live-pass hole, pinned)');`,
    new: `      ck(fd2.find((c) => c.path.includes('fd-nosha'))?.verdict === 'PARTIAL', 'false-death: NO source sha -> presence-only evidence caps at PARTIAL, never FULL (first-live-pass hole, pinned)');

      // ANCHOR REQUIREMENT REGRESSION (2026-07-12 live incident): a mission's PROSE
      // mentions an unrelated commit hash as narrative color (not a declared baseline)
      // -- must NEVER drive a FULL verdict, even when that hash happens to equal current
      // HEAD (fdGitStub's default: diff --quiet reports identical). Only an explicit
      // BASELINE-SHA: field may. Reproduces the exact lighthouse-ci-manifest-fix incident.
      const fdAu4 = parseAutorun('FAILED missions/fd-prose-hex.mission.txt  <!-- t -->\\n');
      const proseHexText = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - .github/workflows/x.yml\\nMaqsad: fix the SECOND defect, distinct from the one fixed in 666f889, already pushed.';
      const fd4 = falseDeathScan(fdAu4, tmp, { gitFn: fdGitStub, readTextFn: () => proseHexText });
      ck(fd4.find((c) => c.path.includes('fd-prose-hex'))?.verdict === 'PARTIAL', 'ANCHOR REQUIREMENT: a bare hex token in free prose (no BASELINE-SHA: field) never drives FULL, even when it happens to equal HEAD -- the 2026-07-12 false-PRE-SATISFIED incident');
      const stProseHex = missionLandedState(proseHexText, fdGitStub);
      ck(stProseHex.srcSha === null, 'ANCHOR REQUIREMENT: srcSha stays null without an explicit BASELINE-SHA: field, regardless of hex-looking tokens in prose');
      const anchoredText = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: 666f889\\nALLOW-FILES:\\n  - .github/workflows/x.yml\\nMaqsad: fix the second defect.';
      const stAnchored = missionLandedState(anchoredText, fdGitStub);
      ck(stAnchored.srcSha === '666f889' && stAnchored.verdict === 'FULL', 'ANCHOR REQUIREMENT: an explicit BASELINE-SHA: field still drives FULL exactly as before (legitimate opt-in preserved)');`,
  },
];

for (const [i, e] of edits.entries()) {
  const n = t.split(e.old).length - 1;
  if (n !== 1) { console.error(`EDIT-${i}-ANCHOR-NOT-UNIQUE: found ${n} occurrences`); process.exit(1); }
  t = t.replace(e.old, e.new);
}

writeFileSync(path, t);
console.log('PATCHED');
