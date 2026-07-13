#!/usr/bin/env node
// srcsha-fixture-update-patch.mjs -- updates the false-death-scan selftest fixtures in
// conduct-cycle.mjs to use the new BASELINE-SHA: labeled field (gap-conduct-cycle-srcsha-
// anchor's fix, missions/_logs/srcsha-anchor-patch-v2.mjs) instead of a bare hex mention in
// prose ("land abc1234 feature"), which the new anchor requirement no longer recognizes.
// The fixture's INTENT (byte-identical content at a real baseline -> FULL verdict) is
// unchanged; only its syntax needs to match the new requirement.
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'conduct-cycle.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('BASELINE-SHA: abc1234')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

// CRLF FIX (2026-07-13, receipted live failure: "NOT-UNIQUE: found 0 occurrences" on the
// real file every time this patcher actually ran, despite passing every scratch-copy
// dry-run) -- conduct-cycle.mjs on disk uses \r\n; every dry-run copied it via
// `git show HEAD:file > scratch`, which emits git's internally-stored LF content,
// masking the mismatch. Build both strings with explicit \r\n between structural lines;
// the \n WITHIN the fixture string VALUES (e.g. 'MISSION-CLASS: code-repo\nREPO-ROOT...')
// is unrelated content -- those stay bare \n, they are string literals, not file lines.
const oldStr = [
  "      const mtexts = {",
  "        'missions/fd-landed.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land abc1234 feature',",
  "        'missions/fd-wiring.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/w.js\\n  - map.html\\nMaqsad: land abc1234 feature',",
  "        'missions/fd-gone.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/gone.js\\nMaqsad: land abc1234 feature',",
  "        'missions/fd-judged.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/a.js\\nMaqsad: land abc1234 feature',",
  "      };",
].join('\r\n');

const newStr = [
  "      const mtexts = {",
  "        // BASELINE-SHA: labeled field (gap-conduct-cycle-srcsha-anchor, 2026-07-13) -- a bare",
  "        // \"land abc1234 feature\" mention is no longer sufficient for srcSha extraction.",
  "        'missions/fd-landed.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land the feature',",
  "        'missions/fd-wiring.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/w.js\\n  - map.html\\nMaqsad: land the feature',",
  "        'missions/fd-gone.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/gone.js\\nMaqsad: land the feature',",
  "        'missions/fd-judged.mission.txt': 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/a.js\\nMaqsad: land the feature',",
  "      };",
].join('\r\n');

const n = t.split(oldStr).length - 1;
if (n !== 1) {
  console.error(`NOT-UNIQUE: found ${n} occurrences of the target block`);
  process.exit(1);
}
t = t.replace(oldStr, newStr);

writeFileSync(path, t);
console.log('PATCHED');
