// runner.mjs — the micro-queue runner (task #19). Executes a validated micro_queue ONE step at a time:
// run the step's validation_command via execReceipt (the MUEZZIN's OWN witnessed deed, not the seat's word),
// commit on a passing receipt, roll back + HALT on a failing one (never advance past a failed step — the agy fix).
// Capacity (one step) + tartib (gate before advancing) + deeds-not-claims (receipt) + git (surgical rollback).
//
// NOTE (2026-06-25): this module is NOT on the daemon's hot path. The daemon imports
// `orchestrate.mjs` (muezzin-daemon.mjs:608), which has its own per-step execReceipt loop
// with mission-class-aware writeRoot routing (orchestrate.mjs:438). runMicroQueue here is
// retained for its selftest contract (and for any future caller that wants a thin runner
// without the full orchestrate machinery). The `writeRoot` opt below mirrors orchestrate's
// behavior so a code-repo-aware caller of this function can route execReceipt into the
// declared REPO-ROOT instead of the sandbox cwd — keeping the contract uniform across the
// two runners. Default writeRoot=cwd preserves byte-for-byte behavior with every existing caller.

import { execReceipt } from './seat_dispatch.mjs';
import { commitStep, rollbackStep } from './git_steps.mjs';
import { validateMicroQueue } from './deconstructor.mjs';
import { parseMissionClass } from './mission_class.mjs';

// runMicroQueue(queue, { cwd, writeRoot, maxRepairsPerStep, repairFn, missionText }) -> { ok, steps, stoppedAt? }
//   cwd:       the sandbox dir (events / diagnostics live here).
//   writeRoot: the dir execReceipt runs in + commits target. Default = cwd (research/sandbox
//              behavior, byte-for-byte). For a code-repo run, set writeRoot to the declared
//              REPO-ROOT — mirroring orchestrate.mjs:438. If omitted but `missionText` is
//              passed, the runner derives writeRoot from parseMissionClass (code-repo ->
//              repoRoot, else cwd) so a caller can hand the mission text alone and stay
//              correct.
//   repairFn(step, receipt) is an optional async hook (e.g. dispatch a repair seat with the captured error);
//   if absent or exhausted, a failed step rolls back and the run HALTS. Queue is re-validated defensively.
export async function runMicroQueue(queue, { cwd, writeRoot, maxRepairsPerStep = 0, repairFn = null, missionText = '' } = {}) {
  const v = validateMicroQueue(queue);
  if (!v.ok) return { ok: false, error: 'invalid micro_queue: ' + v.errors.join('; '), steps: [] };

  // CODE-REPO-AWARENESS (2026-06-25): when missionText is supplied and declares code-repo,
  // route writes/witness/commit into the declared REPO-ROOT — mirroring orchestrate.mjs:438.
  // An explicit writeRoot opt wins over the derived value (operator/caller override).
  let effectiveWriteRoot = writeRoot;
  if (!effectiveWriteRoot && missionText) {
    try {
      const mc = parseMissionClass(missionText);
      if (mc.class === 'code-repo' && mc.repoRoot) effectiveWriteRoot = mc.repoRoot;
    } catch { /* parse failure -> fall through to cwd default (research behavior) */ }
  }
  if (!effectiveWriteRoot) effectiveWriteRoot = cwd;

  const steps = [];
  for (const step of queue.steps) {
    let receipt = execReceipt(step.validation_command, effectiveWriteRoot);   // the muezzin runs the witness ITSELF (in REPO-ROOT for code-repo, else cwd)
    let repaired = 0;
    while (!receipt.ok && repairFn && repaired < maxRepairsPerStep) {
      repaired++;
      await repairFn(step, receipt);                           // repair, then RE-witness the same step
      receipt = execReceipt(step.validation_command, effectiveWriteRoot);
    }
    if (receipt.ok) {
      const c = commitStep(effectiveWriteRoot, `${step.step_index}: ${String(step.description).slice(0, 60)}`, step.target_files);
      steps.push({ step: step.step_index, ok: true, witness: step.validation_command, sha: c.sha, repaired });
    } else {
      rollbackStep(effectiveWriteRoot, step.target_files);     // surgical single-step rollback — not whole-phase
      steps.push({ step: step.step_index, ok: false, witness: step.validation_command, error: String(receipt.out || '').slice(0, 200), repaired });
      return { ok: false, stoppedAt: step.step_index, steps };  // HALT — never advance past a failed step
    }
  }
  return { ok: true, steps };
}

// --------------------------------------------------------------------------- self-test (offline, real git)
if (process.argv[1]?.endsWith('runner.mjs')) {
  const { execSync } = await import('node:child_process');
  const fs = await import('fs'); const os = await import('os'); const path = await import('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner_test_'));
  const git = (c) => execSync(`git ${c}`, { cwd: dir, stdio: 'pipe' });
  const W = (f, s) => fs.writeFileSync(path.join(dir, f), s);
  const R = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

  git('init -q'); git('config user.email t@t.local'); git('config user.name t');
  W('a.mjs', 'export const a = 1;\n'); W('b.mjs', 'export const b = 1;\n');
  // --no-verify: skip the inherited global laguna pre-commit hook (per-commit Ollama review) — it would
  // hang this sandbox seed. The per-step commits already go through git_steps.commitStep, which is hook-proof.
  git('add -A'); git('commit -q --no-verify -m init');

  // simulate the executor's edits for each step (the runner validates + commits/rolls back; it does not edit).
  W('a.mjs', 'export const a = 2;\n');     // step 1's work — valid syntax
  W('b.mjs', 'export const b = ;\n');      // step 2's work — SYNTAX ERROR (fails node -c)

  const queue = { mission_id: 'T', steps: [
    { step_index: 1, description: 'edit a', action_type: 'edit', target_files: ['a.mjs'], context_dependencies: [], validation_command: 'node -c a.mjs' },
    { step_index: 2, description: 'edit b', action_type: 'edit', target_files: ['b.mjs'], context_dependencies: [], validation_command: 'node -c b.mjs' },
  ] };

  const res = await runMicroQueue(queue, { cwd: dir });
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
  ck(res.ok === false, 'run HALTS on the failing step (does not advance past it)');
  ck(res.stoppedAt === 2, 'stoppedAt the failing step (#2)');
  ck(res.steps[0]?.ok === true && !!res.steps[0]?.sha, 'step 1 (valid) was witnessed + committed (has a sha)');
  ck(res.steps[1]?.ok === false, 'step 2 (syntax error) failed its receipt');
  ck(R('a.mjs').includes('a = 2'), 'step 1 edit preserved (committed)');
  ck(R('b.mjs').includes('b = 1'), 'step 2 edit ROLLED BACK to v1 (surgical, not whole-phase)');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${fails === 0 ? 'ALL PASS — runner: receipt-gated, commit-on-pass, rollback+halt-on-fail (the agy fix)' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
