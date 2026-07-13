import { lintMission } from './mission_lint.mjs';

const bareCommitCodeRepo = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: fix a. Done means: node -c passes.\n```pwsh\ngit add -- a.mjs\ngit commit -m "fix a"\n```';
const r1 = lintMission(bareCommitCodeRepo);
console.log('1 bare commit, code-repo:', r1.ok, r1.problems.map(p => p.rule));

const scopedCommitCodeRepo = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: fix a. Done means: node -c passes.\n```pwsh\ngit add -- a.mjs\ngit commit -- a.mjs -m "fix a"\n```';
const r2 = lintMission(scopedCommitCodeRepo);
console.log('2 scoped commit, code-repo:', r2.ok, r2.problems.map(p => p.rule));

const bareCommitOpsDeploy = 'MISSION-CLASS: ops-deploy\nMISSION-ID: X\nREPO-ROOT: C:\\proj\\x\nMaqsad: ship it. Done means: live.\n```pwsh\ngit add .\ngit commit -m "ship the fix"\nwrangler pages deploy . --project-name=x\n```';
const r3 = lintMission(bareCommitOpsDeploy);
console.log('3 bare commit, ops-deploy (should NOT trigger RULE 15):', r3.ok, r3.problems.map(p => p.rule));

const noCommitCodeRepo = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: fix a. Done means: node -c passes.\n```pwsh\nnode -c a.mjs\n```';
const r4 = lintMission(noCommitCodeRepo);
console.log('4 no commit at all, code-repo (should NOT trigger RULE 15):', r4.ok, r4.problems.map(p => p.rule));
