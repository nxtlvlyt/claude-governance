#!/usr/bin/env node
// srcsha-anchor-patch.mjs -- one-shot patcher for conduct-cycle.mjs's missionLandedState
// srcSha false-positive (gap-conduct-cycle-srcsha-anchor, 2026-07-12). Committed as a
// mission input artifact per the stitch-mission precedent. Generated programmatically
// via chr(92)-based string construction after repeated tool-transport backslash
// re-escaping broke three hand-typed attempts -- see missions/_logs/GAP-REGISTER.jsonl
// gap-deterministic-before-reasoning for the receipted lesson.
import { readFileSync, writeFileSync } from 'fs';

const path = 'conduct-cycle.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('ANCHOR REQUIREMENT (2026-07-12')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const edits = [
  { old: "  const srcSha = (mtext.match(/\\b([a-f0-9]{7,40})\\b/) || [])[1];", new: "  // ANCHOR REQUIREMENT (2026-07-12, false-positive receipt: lighthouse-ci-manifest-fix\n  // mission's Maqsad prose mentioned a PRIOR unrelated commit as narrative color; that\n  // hash happened to equal current HEAD, so the guard concluded unfinished work was\n  // already landed and the daemon PRE-SATISFIED-refused a legitimate fire). A bare\n  // hex-looking token ANYWHERE in free prose is not a declared baseline -- only an\n  // explicit BASELINE-SHA: field counts. Missing field -> srcSha stays null -> verdict\n  // caps at PARTIAL (the existing nosha discipline, now the default for every mission\n  // that never opts in - falseDeathScan still surfaces PARTIAL for conductor review;\n  // only the daemon's silent auto-FULL-mark is closed).\n  const srcSha = (mtext.match(/^BASELINE-SHA:\\s*([a-f0-9]{7,40})\\b/mi) || [])[1];" },
  { old: "      const mtexts = {\n        'missions/fd-landed.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land abc1234 feature',\n        'missions/fd-wiring.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/w.js\\n  - map.html\\nMaqsad: land abc1234 feature',\n        'missions/fd-gone.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/gone.js\\nMaqsad: land abc1234 feature',\n        'missions/fd-judged.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/a.js\\nMaqsad: land abc1234 feature',\n      };", new: "      const mtexts = {\n        'missions/fd-landed.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land the feature',\n        'missions/fd-wiring.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/w.js\\n  - map.html\\nMaqsad: land the feature',\n        'missions/fd-gone.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/gone.js\\nMaqsad: land the feature',\n        'missions/fd-judged.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/a.js\\nMaqsad: land the feature',\n      };" },
  { old: "      ck(fd2.find((c) => c.path.includes('fd-nosha'))?.verdict === 'PARTIAL', 'false-death: NO source sha -> presence-only evidence caps at PARTIAL, never FULL (first-live-pass hole, pinned)');", new: "      ck(fd2.find((c) => c.path.includes('fd-nosha'))?.verdict === 'PARTIAL', 'false-death: NO source sha -> presence-only evidence caps at PARTIAL, never FULL (first-live-pass hole, pinned)');\n\n      // ANCHOR REQUIREMENT REGRESSION (2026-07-12 live incident): a mission's PROSE\n      // mentions an unrelated commit hash as narrative color (not a declared baseline)\n      // -- must NEVER drive a FULL verdict, even when that hash happens to equal current\n      // HEAD (fdGitStub's default: diff --quiet reports identical). Only an explicit\n      // BASELINE-SHA: field may. Reproduces the exact lighthouse-ci-manifest-fix incident.\n      const fdAu4 = parseAutorun('FAILED missions/fd-prose-hex.mission.txt  <!-- t -->\\n');\n      const proseHexText = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - .github/workflows/x.yml\\nMaqsad: fix the SECOND defect, distinct from the one fixed in 666f889, already pushed.';\n      const fd4 = falseDeathScan(fdAu4, tmp, { gitFn: fdGitStub, readTextFn: () => proseHexText });\n      ck(fd4.find((c) => c.path.includes('fd-prose-hex'))?.verdict === 'PARTIAL', 'ANCHOR REQUIREMENT: a bare hex token in free prose (no BASELINE-SHA: field) never drives FULL, even when it happens to equal HEAD -- the 2026-07-12 false-PRE-SATISFIED incident');\n      const stProseHex = missionLandedState(proseHexText, fdGitStub);\n      ck(stProseHex.srcSha === null, 'ANCHOR REQUIREMENT: srcSha stays null without an explicit BASELINE-SHA: field, regardless of hex-looking tokens in prose');\n      const anchoredText = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: 666f889\\nALLOW-FILES:\\n  - .github/workflows/x.yml\\nMaqsad: fix the second defect.';\n      const stAnchored = missionLandedState(anchoredText, fdGitStub);\n      ck(stAnchored.srcSha === '666f889' && stAnchored.verdict === 'FULL', 'ANCHOR REQUIREMENT: an explicit BASELINE-SHA: field still drives FULL exactly as before (legitimate opt-in preserved)');" },
];

for (const [i, e] of edits.entries()) {
  const n = t.split(e.old).length - 1;
  if (n !== 1) {
    console.error(`EDIT-${i}-ANCHOR-NOT-UNIQUE: found ${n} occurrences, old.length=${e.old.length}`);
    const prefix30 = e.old.slice(0, 30);
    const idx = t.indexOf(prefix30);
    console.error('prefix30:', JSON.stringify(prefix30), 'found at', idx);
    if (idx >= 0) {
      const realSlice = t.slice(idx, idx + e.old.length);
      console.error('real  :', JSON.stringify(realSlice));
      console.error('wanted:', JSON.stringify(e.old));
      console.error('equal?', realSlice === e.old, 'realLen', realSlice.length, 'wantLen', e.old.length);
    }
    process.exit(1);
  }
  t = t.replace(e.old, e.new);
}

writeFileSync(path, t);
console.log('PATCHED');
