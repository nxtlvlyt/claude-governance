#!/usr/bin/env node
// mission-lint-rule15-bare-commit-patch.mjs -- gap-bare-commit-sweeps-preexisting-stage,
// 2026-07-13. Live receipt: commit 7e0a011 (engine-verdict-merge-visibility-downgrade's
// own commit step, ALLOW-FILES: verdict_merge.mjs only) silently absorbed an ALREADY-
// STAGED, unrelated conduct-cycle.mjs change from a DIFFERENT, interrupted mission,
// because the commit step ran `git add -- verdict_merge.mjs` then a BARE `git commit -m
// ...` with no pathspec -- a bare commit commits the WHOLE INDEX, not just what THIS
// mission's own `git add` staged. Every code-repo mission built this session uses the
// identical pattern (20 missions found via grep). Mechanical refusal at the miqat, same
// shape as RULE 8/14: cost zero, before the mission ever fires.
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'mission_lint.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('bare-commit-no-pathspec')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const ruleOld = [
  "  return { ok: problems.length === 0, problems };",
  "}",
].join('\n');

const ruleNew = [
  "  // RULE 15 -- BARE COMMIT WITHOUT PATHSPEC (gap-bare-commit-sweeps-preexisting-stage,",
  "  // 2026-07-13 receipt: commit 7e0a011, engine-verdict-merge-visibility-downgrade's own",
  "  // commit step ran `git add -- verdict_merge.mjs` then a BARE `git commit -m ...` with no",
  "  // pathspec -- a bare commit commits the WHOLE INDEX, silently sweeping in an unrelated,",
  "  // already-staged conduct-cycle.mjs change from a DIFFERENT, interrupted mission. 20",
  "  // sibling missions built the same session carried the identical pattern. The fix is",
  "  // mechanical and cheap: scope the commit itself with an explicit pathspec (`git commit",
  "  // -- <files> -m ...`), not just the preceding `git add`.",
  "  // Scoped to code-repo missions specifically: the risk (a bare commit sweeping in",
  "  // pre-existing staged content) is a property of the git_steps.mjs sandbox model those",
  "  // missions run in. Other classes (e.g. ops-deploy) do not carry the same ALLOW-FILES/",
  "  // containment semantics -- RULE 8's own deploy-with-commit fixture uses a bare commit",
  "  // legitimately and is a different class entirely.",
  "  const isCodeRepoClass = /MISSION-CLASS:\\s*code-repo/i.test(t);",
  "  const bareCommit = isCodeRepoClass && /\\bgit\\s+commit\\s+-m\\b/i.test(t);",
  "  const scopedCommit = /\\bgit\\s+commit\\s+--\\s+\\S/i.test(t);",
  "  if (bareCommit && !scopedCommit) {",
  "    add('bare-commit-no-pathspec', 'mission runs `git commit -m ...` with NO pathspec on the commit itself -- a bare commit commits the WHOLE INDEX, not just what this mission\\'s own `git add` staged (confirmed live: commit 7e0a011 silently absorbed an unrelated, already-staged change from a different interrupted mission this exact way). Scope the commit explicitly: `git commit -- <the mission\\'s own ALLOW-FILES> -m \"...\"` so only this mission\\'s own declared files ever land in the commit, regardless of what else happens to be staged.');",
  "  }",
  "",
  "  return { ok: problems.length === 0, problems };",
  "}",
].join('\n');

const n = t.split(ruleOld).length - 1;
if (n !== 1) {
  console.error(`NOT-UNIQUE: found ${n} occurrences of the return-statement anchor`);
  process.exit(1);
}
t = t.replace(ruleOld, ruleNew);

// selftest coverage, right before the ALL PASS summary line
const testOld = [
  "  ck(!lintMission(copyClarity).problems.some((p) => p.rule === 'content-pass-without-contract'), 'RULE 14: readability-only copy-clarity rewrite (mt-copy-clarity class) never triggers content-pass-without-contract — a readability pass is not an SEO semantics pass');",
  "",
  "  console.log(`\\n${fail ? fail + ' FAIL' : 'ALL PASS — mission miqat: flawed work orders refused at the boundary, zero cycles burned'}`);",
].join('\n');

const testNew = [
  "  ck(!lintMission(copyClarity).problems.some((p) => p.rule === 'content-pass-without-contract'), 'RULE 14: readability-only copy-clarity rewrite (mt-copy-clarity class) never triggers content-pass-without-contract — a readability pass is not an SEO semantics pass');",
  "",
  "  // RULE 15: BARE COMMIT WITHOUT PATHSPEC (gap-bare-commit-sweeps-preexisting-stage, 2026-07-13)",
  "  const bareCommitCodeRepo = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:\\\\proj\\\\x\\nALLOW-FILES:\\n  - a.mjs\\nMaqsad: fix a. Done means: node -c passes.\\n```pwsh\\ngit add -- a.mjs\\ngit commit -m \"fix a\"\\n```';",
  "  ck(!lintMission(bareCommitCodeRepo).ok && lintMission(bareCommitCodeRepo).problems.some((p) => p.rule === 'bare-commit-no-pathspec'), 'RULE 15: a code-repo mission with a BARE `git commit -m` (no pathspec) is REFUSED (the exact commit-7e0a011 failure shape)');",
  "  const scopedCommitCodeRepo = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:\\\\proj\\\\x\\nALLOW-FILES:\\n  - a.mjs\\nMaqsad: fix a. Done means: node -c passes.\\n```pwsh\\ngit add -- a.mjs\\ngit commit -- a.mjs -m \"fix a\"\\n```';",
  "  ck(lintMission(scopedCommitCodeRepo).ok, 'RULE 15: a code-repo mission with an EXPLICITLY SCOPED `git commit -- <files> -m` passes — the fix this rule asks for');",
  "  ck(lintMission(deployWithCommit).ok, 'RULE 15: an ops-deploy mission with a bare commit is UNAFFECTED — the rule is scoped to code-repo\\'s git_steps.mjs sandbox risk model, not a blanket ban on bare commits everywhere');",
  "  const noCommitCodeRepo = 'MISSION-CLASS: code-repo\\nREPO-ROOT: C:\\\\proj\\\\x\\nALLOW-FILES:\\n  - a.mjs\\nMaqsad: check a. Done means: node -c passes.\\n```pwsh\\nnode -c a.mjs\\n```';",
  "  ck(lintMission(noCommitCodeRepo).ok, 'RULE 15: a code-repo mission with NO commit step at all is unaffected — the rule only fires on a bare commit, never on the absence of one');",
  "",
  "  console.log(`\\n${fail ? fail + ' FAIL' : 'ALL PASS — mission miqat: flawed work orders refused at the boundary, zero cycles burned'}`);",
].join('\n');

const tn = t.split(testOld).length - 1;
if (tn !== 1) {
  console.error(`NOT-UNIQUE: found ${tn} occurrences of the selftest-insertion anchor`);
  process.exit(1);
}
t = t.replace(testOld, testNew);

writeFileSync(path, t);
console.log('PATCHED');
