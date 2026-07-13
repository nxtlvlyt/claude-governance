#!/usr/bin/env node
// srcsha-anchor-selftest-coverage-patch.mjs -- gap-conduct-cycle-srcsha-anchor's own
// closes_when demands a selftest proving "a mission whose prose cites an unrelated commit
// hash equal to current HEAD" does NOT verdict FULL. The anchor fix (BASELINE-SHA: label
// requirement) landed as CODE weeks... same session, earlier tonight (commit 7e0a011,
// accidental side effect of a bare-commit sweep, itself now its own filed gap) -- but no
// selftest exercises the exact regression class the gap was filed for (the lighthouse-ci-
// manifest-fix false PRE-SATISFIED: a bare hex mention equal to current HEAD, verdicting
// FULL on genuinely unstarted work). This closes that gap for real.
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'conduct-cycle.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('BARE-HEX-EQUALS-HEAD REGRESSION')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const oldStr = [
  "      ck(!('The' in stFd3.files) && !('`git' in stFd3.files) && !('No' in stFd3.files), 'prose bullet fragments (The/`git/No) are never treated as pseudo-files');",
  "    }",
].join('\r\n');

const newStr = [
  "      ck(!('The' in stFd3.files) && !('`git' in stFd3.files) && !('No' in stFd3.files), 'prose bullet fragments (The/`git/No) are never treated as pseudo-files');",
  "",
  "      // BARE-HEX-EQUALS-HEAD REGRESSION (gap-conduct-cycle-srcsha-anchor's own closes_when,",
  "      // 2026-07-13 -- the exact lighthouse-ci-manifest-fix false PRE-SATISFIED: a mission's",
  "      // Maqsad cites a prior commit hash as narrative color, that hash happens to equal",
  "      // current HEAD, and the OLD bare-token regex read it as a declared baseline -> every",
  "      // ALLOW-FILE trivially diffs identical against itself -> false verdict:'FULL' on work",
  "      // that was never actually done. The fix requires an explicit BASELINE-SHA: label; a",
  "      // bare mention must fall back to the nosha path and cap at PARTIAL, never FULL.",
  "      const bareHexText = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land abc1234 feature';",
  "      const stBareHex = missionLandedState(bareHexText, fdGitStub);",
  "      ck(stBareHex.verdict !== 'FULL', 'srcSha anchor: a BARE hex mention (no BASELINE-SHA: label) equal to current HEAD must NEVER verdict FULL (the exact lighthouse-ci-manifest-fix false PRE-SATISFIED)');",
  "      ck(stBareHex.verdict === 'PARTIAL', 'srcSha anchor: bare hex mention falls back to the nosha path -> PARTIAL (presence-only evidence)');",
  "      ck(stBareHex.srcSha === null, 'srcSha anchor: bare hex mention extracts NO srcSha at all -- the anchor requires an explicit BASELINE-SHA: label');",
  "      const labeledText = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:/r\\nBASELINE-SHA: abc1234\\nALLOW-FILES:\\n  - js/a.js\\n  - css/b.css\\nMaqsad: land the feature';",
  "      const stLabeled = missionLandedState(labeledText, fdGitStub);",
  "      ck(stLabeled.verdict === 'FULL', 'srcSha anchor: a genuinely LABELED BASELINE-SHA: still verdicts FULL when files are byte-identical -- the fix narrows the trigger, it does not break the legitimate case');",
  "    }",
].join('\r\n');

const n = t.split(oldStr).length - 1;
if (n !== 1) {
  console.error(`NOT-UNIQUE: found ${n} occurrences of the target block`);
  process.exit(1);
}
t = t.replace(oldStr, newStr);

writeFileSync(path, t);
console.log('PATCHED');
