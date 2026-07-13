#!/usr/bin/env node
// reset-allowfiles-staged-fix-patch.mjs -- the real, general root cause behind BOTH the
// conduct-cycle.mjs incident (engine-srcsha-fixture-update FAILED x2) AND the
// mission_lint.mjs incident (engine-mission-lint-rule15-bare-commit FAILED) this session.
// resetAllowFiles's tracked-file branch runs ONLY `git checkout -- <file>`, which restores
// the WORKING TREE from the INDEX -- a no-op when the file is STAGED (git add'ed) but not
// yet committed, since the working tree already matches the index in that case. The file
// stays dirty ("M " in git status --porcelain) and preflightAllowlistClean keeps refusing
// every retry. Fix: `git reset -- <file>` (unstage, reset the index entry to HEAD) BEFORE
// `git checkout -- <file>` (restore the working tree) -- this handles staged, working-tree-
// modified, and both-at-once uniformly.
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'git_steps.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('STAGED-FILE FIX')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const oldStr = [
  "      if (tracked) {",
  "        execSync(`git checkout -- ${quote(rel)}`, gitOpts(repoRoot));   // restore committed version",
  "      } else {",
].join('\n');

const newStr = [
  "      if (tracked) {",
  "        // STAGED-FILE FIX (2026-07-13, recurring live receipt: engine-srcsha-fixture-update",
  "        // FAILED x2 on conduct-cycle.mjs, then engine-mission-lint-rule15-bare-commit FAILED",
  "        // on mission_lint.mjs -- same mechanism both times). `git checkout -- <file>` alone",
  "        // restores the WORKING TREE from the INDEX; if the file is STAGED (git add'ed) but",
  "        // not yet committed, the working tree already matches the index, so checkout is a",
  "        // no-op and the file stays dirty forever. `git reset -- <file>` FIRST resets the",
  "        // index entry to HEAD, so the subsequent checkout has something real to restore from",
  "        // -- this handles staged, working-tree-modified, and both-at-once uniformly.",
  "        try { execSync(`git reset -- ${quote(rel)}`, gitOpts(repoRoot)); } catch { /* not staged -- fine, checkout alone still handles working-tree dirt */ }",
  "        execSync(`git checkout -- ${quote(rel)}`, gitOpts(repoRoot));   // restore committed version",
  "      } else {",
].join('\n');

const n = t.split(oldStr).length - 1;
if (n !== 1) {
  console.error(`NOT-UNIQUE: found ${n} occurrences of the tracked-file reset anchor`);
  process.exit(1);
}
t = t.replace(oldStr, newStr);

// selftest coverage: the exact real-world shape both live incidents hit -- a tracked
// allow-file modified AND STAGED (git add'ed) by a prior interrupted attempt, never
// committed. Inserted right after the existing working-tree-modified case (2).
const testOld = [
  '      // (3) CONTAINMENT NOT REOPENED: reset touches ONLY the declared allowlist. Genuinely-',
].join('\n');

const testNew = [
  '      // (2b) a TRACKED own allow-file modified AND STAGED (git add\\\'ed) by a prior',
  '      // interrupted attempt -- never committed -- is ALSO restored (2026-07-13 recurring',
  '      // live receipt: engine-srcsha-fixture-update FAILED x2 on conduct-cycle.mjs, then',
  '      // engine-mission-lint-rule15-bare-commit FAILED on mission_lint.mjs, same mechanism',
  '      // both times -- `git checkout --` alone is a no-op on staged content since the',
  '      // working tree already matches the index).',
  '      fs.writeFileSync(path.join(rstRepo, "tracked.mjs"), "export const v = 999;\\n");',
  '      execSync(`git -C ${quote(rstRepo)} add -- tracked.mjs`);',
  '      const stagedStatusBefore = execSync(`git -C ${quote(rstRepo)} status --porcelain -- tracked.mjs`).toString().trim();',
  '      assert(stagedStatusBefore.startsWith("M"), "own-reset(staged) setup: tracked.mjs is genuinely STAGED before reset (M, not \' M\')");',
  '      const rst2b = resetAllowFiles(rstRepo, ["tracked.mjs"]);',
  '      assert(rst2b.ok === true && rst2b.reset.includes("tracked.mjs"), "own-reset(staged): a STAGED tracked own allow-file is acted on");',
  '      const stagedStatusAfter = execSync(`git -C ${quote(rstRepo)} status --porcelain -- tracked.mjs`).toString().trim();',
  '      assert(stagedStatusAfter === "", "own-reset(staged): AFTER reset the file is FULLY clean (both index and working tree) — the exact bug this fix closes");',
  '      assert(fs.readFileSync(path.join(rstRepo, "tracked.mjs"), "utf8").includes("const v = 0"), "own-reset(staged): content is restored to committed HEAD, not left at the staged v=999");',
  '',
  '      // (3) CONTAINMENT NOT REOPENED: reset touches ONLY the declared allowlist. Genuinely-',
].join('\n');

const tn = t.split(testOld).length - 1;
if (tn !== 1) {
  console.error(`NOT-UNIQUE: found ${tn} occurrences of the selftest-insertion anchor`);
  process.exit(1);
}
t = t.replace(testOld, testNew);

writeFileSync(path, t);
console.log('PATCHED');
