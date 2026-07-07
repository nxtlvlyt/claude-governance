// E2E replay of gap #2 (plan-level scratch lint, SCRATCH-RESIDUE) — read-only audit scratch.
// Kill-shape from the S1.S1 attempt-3 receipt (QUEUE.md 2026-07-03 ENGINE ITEM): the planner's
// generated step-1 command wrote scratch-baseline-runner.mjs via Out-File, declared it as the
// step target, never deleted it; containment-drift burned 3 step-retries on the residue.
// What should happen NOW: validateMicroQueue rejects this plan at plan-accept time.
import { validateMicroQueue, parseAllowFiles } from 'file:///C:/Users/marka/.claude/muezzin-plugin/deconstructor.mjs';

const missionText = `MISSION-CLASS: code-repo
ALLOW-FILES:
  - scripts/e2e-runner.mjs
STEPS: 2
`;
const allowFiles = parseAllowFiles(missionText);
console.log('parseAllowFiles ->', JSON.stringify(allowFiles));

// 1. The exact receipt shape: Out-File a scratch file, no delete -> must be REJECTED
const killShape = {
  mission_id: 'S1.S1-replay',
  steps: [{
    step_index: 1,
    description: 'baseline: materialize the old runner for comparison',
    action_type: 'command',
    target_files: ['scratch-baseline-runner.mjs'],
    context_dependencies: [],
    validation_command: 'git show e31469f:scripts/e2e-runner.mjs | Out-File -Encoding utf8 scratch-baseline-runner.mjs; Test-Path scratch-baseline-runner.mjs',
  }],
};
const v1 = validateMicroQueue(killShape, { codeRepo: true, allowFiles });
console.log('KILL-SHAPE ok =', v1.ok, '| errors =', JSON.stringify(v1.errors));

// 2. Create-use-delete in one command -> must PASS
const cud = { ...killShape, steps: [{ ...killShape.steps[0], validation_command: 'git show e31469f:scripts/e2e-runner.mjs | Out-File tmp-run.mjs; node tmp-run.mjs; Remove-Item tmp-run.mjs' }] };
const v2 = validateMicroQueue(cud, { codeRepo: true, allowFiles });
console.log('CREATE-USE-DELETE ok =', v2.ok);

// 3. Writing the declared ALLOW-FILE deliverable -> must PASS
const deliv = { ...killShape, steps: [{ ...killShape.steps[0], target_files: ['scripts/e2e-runner.mjs'], validation_command: 'Set-Content scripts/e2e-runner.mjs -Value $x' }] };
const v3 = validateMicroQueue(deliv, { codeRepo: true, allowFiles });
console.log('ALLOW-FILE WRITE ok =', v3.ok);

const pass = !v1.ok && v1.errors.some((e) => /scratch-residue/.test(e)) && v2.ok && v3.ok;
console.log(pass ? 'REPLAY-VERDICT: PASS (kill-shape rejected, legal shapes accepted)' : 'REPLAY-VERDICT: FAIL');
process.exit(pass ? 0 : 1);
