// repair.mjs — the REPAIR SEAT / autoheal (task #32). The optional repairFn the runner (runner.mjs) calls
// when a step's witnessed receipt FAILS: the muezzin captured the real error (receipt.out — a deed, not a
// claim), and this seat is dispatched ONE corrective attempt at the broken file. The runner then RE-witnesses
// the same step (deeds-not-claims): the repair is only kept if the re-run receipt now passes. A repair that
// does not fix the witness rolls back and HALTS — autoheal never papers over a still-failing step.
//
// Contract with the runner (runMicroQueue): repairFn(step, receipt) is async, has NO return value the runner
// reads — its only effect is to overwrite step.target_files[0] in place. maxRepairsPerStep bounds the attempts.
//
// Design choices, derived from the seat_dispatch contract:
//   - role 'executor': the seat that WRITES code (not a judging seat) — so wantVerdict:false (we want a file, not a verdict).
//   - dispatch is INJECTED (default dispatchSeat) so the self-test can run fully offline with a mock.
//   - the error fed to the seat is receipt.out (what the muezzin OBSERVED), never a paraphrase.
//   - we extract the FIRST fenced code block as the corrected file; if none, we fall back to the largest block.
//   - we never throw out of repairFn: a failed repair becomes a no-op edit, and the runner's RE-witness
//     will catch that the step still fails (rollback + HALT). Autoheal must not crash the runner.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, isAbsolute, sep } from 'path';
import { dispatchSeat } from './seat_dispatch.mjs';
import { resolveRepoTarget } from './mission_class.mjs';

// Pull the corrected file out of the seat's reply. The repair prompt asks for ONE code block holding the WHOLE
// file. We take the first fenced block; if the model emitted several, we prefer the LARGEST (most likely the
// full file rather than an inline snippet). Returns null when no block is present (we then leave the file as-is).
export function extractCodeBlock(text) {
  if (!text) return null;
  const blocks = [];
  const re = /```[^\n]*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) blocks.push(m[1]);
  if (blocks.length === 0) return null;
  if (blocks.length === 1) return blocks[0].replace(/\n$/, '');
  // multiple blocks: choose the largest (the full file), trim a single trailing newline the fence adds.
  return blocks.reduce((a, b) => (b.length > a.length ? b : a)).replace(/\n$/, '');
}

// makeRepairFn(cwd, opts) -> async repairFn(step, receipt)
//   cwd      : the working dir the runner operates in (step.target_files are relative to it, mirroring execReceipt's cwd).
//   dispatch : injected seat dispatcher (default dispatchSeat) — { content } when wantVerdict:false.
//   model    : the executor model for the repair seat (default qwen3-coder-next — a strong open-weight coder).
//   today    : injected date for the seat's systemAnchor (no Date.now() so the self-test is deterministic).
export function makeRepairFn(cwd, { dispatch = dispatchSeat, model = 'qwen3-coder-next', today = '2026-06-09', codeRepo = false, repoRoot = null, allowFiles = [] } = {}) {
  return async function repairFn(step, receipt) {
    const rel = step?.target_files?.[0];
    if (!rel) return;                                          // nothing to repair — leave for the runner's re-witness to HALT

    // CONTAINMENT FOR THE REPAIR WRITE (Foundation 0.4 — MANDATORY HOLE CLOSURE). Before
    // 0.4 this seat wrote `isAbsolute(rel) ? rel : resolve(cwd, rel)` with NO containment:
    // an absolute target_files[0] (or a '..' one) let the repair seat overwrite ANY file on
    // disk, bypassing the same gate the executor enforces. Now every repair write resolves
    // through the SAME never-weaken kernel for code-repo, and the sandbox-prefix guard
    // otherwise. A target the gate refuses is a NO-OP (the runner's re-witness then HALTs).
    let abs;
    if (codeRepo) {
      const r = resolveRepoTarget(repoRoot, allowFiles, rel);
      if (!r.ok) return;                                       // refused by kernel — never write outside the allowlist
      abs = r.absPath;
    } else {
      abs = isAbsolute(rel) ? rel : resolve(cwd, rel);
      const sandboxRoot = resolve(cwd) + sep;
      // CASE-INSENSITIVE prefix compare (FIX 2): on Windows a legitimate target that differs
      // from cwd only in drive/path casing (e.g. 'c:\sandbox\...' vs cwd 'C:\sandbox') folds
      // to the same path on disk and must NOT be refused. Lowercasing both sides only ever
      // ADMITS more in-sandbox matches and never admits an out-of-sandbox path, so containment
      // is not weakened; it stays correct on case-sensitive filesystems too.
      if (!abs.toLowerCase().startsWith(sandboxRoot.toLowerCase())) return; // sandbox-escape — never write outside cwd (hole closed)
    }

    // ABSENT-TARGET = AUTHOR, not no-op (retro-audit receipt 2026-06-11 17:12: hollow
    // executor emission → engine refused the write → repair no-op'd on the missing file
    // → attempt burned. The repair seat IS the badal: a different model gets one shot at
    // authoring the artifact the primary seat failed to emit.)
    let current, missing = false;
    try { current = readFileSync(abs, 'utf8'); }
    catch { current = ''; missing = true; }

    const error = String(receipt?.out ?? '').slice(0, 4000);  // the WITNESSED error (deed), bounded
    const framing = [
      `A code step failed its validation witness. You are the executor — repair the file.`,
      ``,
      `STEP: ${step.description || '(no description)'}`,
      `VALIDATION COMMAND (the witness that FAILED): ${step.validation_command || '(none)'}`,
      `TARGET FILE: ${rel}`,
      ``,
      `THE OBSERVED ERROR (captured by the runner — this is the real failure, not a guess):`,
      '```',
      error || '(no output captured)',
      '```',
      ``,
      ...(missing
        ? [`THE TARGET FILE DOES NOT EXIST — the primary executor emitted no artifact. ` +
           `AUTHOR THE COMPLETE FILE from the STEP description above; this is an authoring ` +
           `repair, not an edit.` +
           (step.context_dependencies?.length
             ? ` Context files in your working directory you should READ first: ${step.context_dependencies.join(', ')}.`
             : '')]
        : [`CURRENT CONTENT OF ${rel}:`, '```', current, '```']),
      ``,
      `Return the CORRECTED, COMPLETE file in ONE code block. Output the WHOLE file (not a diff, not a snippet),`,
      `so it can replace the file verbatim. Fix the cause of the error above and change nothing unrelated.`,
      ``,
      // EXECUTOR HARDENING PORTED (half-b receipt 2026-06-11: the repair seat emitted
      // "only the repair-intention header, not the document body" — the intent-instead-
      // of-artifact class the primary executor's framing already kills):
      `YOUR OUTPUT IS THE LITERAL FILE BYTES. Automatic failures: (1) a niyyah/intent ` +
      `declaration or repair-plan header instead of the file's content; (2) a snippet or ` +
      `summary in place of the whole file; (3) an empty or near-empty body.`,
      `COMPLETION SENTINEL: the LAST line inside your code block must be exactly:`,
      `ARTIFACT-COMPLETE`,
      `(stripped before write; it proves the emission finished rather than being cut off).`,
    ].join('\n');

    const seat = { role: 'executor', model, today, cwd: (codeRepo && repoRoot) ? repoRoot : cwd };  // Read-grant parity with the primary executor (repo root for code-repo)
    let reply;
    try { reply = await dispatch(seat, framing, { wantVerdict: false }); }
    catch { return; }                                          // dispatch failed — no-op; runner re-witness HALTs

    let fixed = extractCodeBlock(reply?.content || '');
    if (fixed == null) return;                                 // no code block — leave file unchanged for the HALT
    // SENTINEL + ANTI-INTENT GUARDS (half-b class): no sentinel = truncated emission;
    // a body that is empty/near-empty or smells like an intent-header instead of file
    // content NEVER overwrites the target — the unchanged file goes to re-witness,
    // which HALTs honestly instead of laundering a hollow repair into a fresh artifact.
    const m = fixed.match(/(?:^|\n)[ \t]*ARTIFACT-COMPLETE[ \t]*\s*$/);
    if (!m) return;                                            // truncated/unfinished — keep the original
    fixed = fixed.slice(0, m.index) + (m.index > 0 ? '\n' : '');
    if (!fixed.trim()) return;                                 // hollow body — keep the original (legit files can be tiny; sentinel+smell guards carry the class)
    if (/^(#+ )?(repair|fix|niyyah|plan|intent)\b/i.test(fixed.trim()) && fixed.trim().length < 200) return; // intent-header smell (short form)
    // INTENT-HEADER SHAPE AT ANY LENGTH (4b receipt 2026-06-11 17:26: a >200-char
    // niyyah-shaped emission — source:/failure_mode:/work: fields — sailed past the
    // length-bounded smell guard and reached the witness. The SHAPE is the tell, not
    // the size: a real artifact does not open with the seat's own intention fields.)
    const head = fixed.trim().slice(0, 400);
    if (/^\s*(#+ )?(niyyah|repair[- ]inten\w*)\b/i.test(head) || (/^\s*source\s*:/im.test(head) && /^\s*failure[_ ]?mode\s*:/im.test(head) && /^\s*work\s*:/im.test(head))) return;
    try { writeFileSync(abs, fixed.endsWith('\n') ? fixed : fixed + '\n'); }
    catch { /* write failed — runner re-witness will catch the still-failing step */ }
  };
}

// --------------------------------------------------------------------------- self-test (offline, mocked dispatch)
if (process.argv[1]?.endsWith('repair.mjs')) {
  const fs = await import('fs'); const os = await import('os'); const path = await import('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair_test_'));
  let fails = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  // 1) a BROKEN file with a syntax error (mirrors what runner.mjs's own self-test breaks).
  const target = 'b.mjs';
  const abs = path.join(dir, target);
  fs.writeFileSync(abs, 'export const b = ;\n');               // SYNTAX ERROR

  // 2) the receipt the runner would hand us: the WITNESSED error from `node -c b.mjs`.
  const receipt = { type: 'exec', ref: `node -c ${target}`, ok: false, exit: 1, out: 'SyntaxError: Unexpected token \';\'' };
  const step = { step_index: 2, description: 'edit b', target_files: [target], validation_command: `node -c ${target}` };

  // 3) MOCK dispatch — asserts what the repair seat is sent, returns a FIXED file in one code block.
  const FIXED = 'export const b = 1;';
  let sawSeat = null, sawFraming = null, sawOpts = null;
  const mockDispatch = async (seat, framing, opts) => {
    sawSeat = seat; sawFraming = framing; sawOpts = opts;
    return { content: `Here is the corrected file:\n\n\`\`\`javascript\n${FIXED}\nARTIFACT-COMPLETE\n\`\`\`\nDone.` };
  };

  const repairFn = makeRepairFn(dir, { dispatch: mockDispatch, today: '2026-06-09' });
  await repairFn(step, receipt);

  const after = fs.readFileSync(abs, 'utf8');
  ck(after.includes('b = 1'), 'file now holds the FIXED content (b = 1)');
  ck(!after.includes('b = ;'), 'the broken content (b = ;) is gone');
  ck(after.endsWith('\n'), 'file ends with a trailing newline');
  ck(sawSeat?.role === 'executor', "repair seat role is 'executor' (the writer seat)");
  ck(sawSeat?.model === 'qwen3-coder-next', 'default model is qwen3-coder-next');
  ck(sawSeat?.today === '2026-06-09', 'injected today is passed to the seat');
  ck(sawOpts?.wantVerdict === false, 'dispatched with wantVerdict:false (wants a file, not a verdict)');
  ck(sawFraming?.includes('SyntaxError'), 'the WITNESSED error (receipt.out) was put in the framing');
  ck(sawFraming?.includes('export const b = ;'), 'the current (broken) file content was put in the framing');
  ck(sawFraming?.includes(target), 'the target file name was put in the framing');

  // 4) the repaired file actually passes its real witness now (node -c) — the deed, end-to-end.
  const { execReceipt } = await import('./seat_dispatch.mjs');
  const reWitness = execReceipt(`node -c ${target}`, dir);
  ck(reWitness.ok === true, 'RE-WITNESS: `node -c b.mjs` now PASSES on the repaired file (deeds, not claims)');

  // 5) robustness: no code block in the reply -> file left UNCHANGED, no throw (runner re-witness will HALT).
  fs.writeFileSync(abs, 'still broken = ;\n');
  const noBlock = makeRepairFn(dir, { dispatch: async () => ({ content: 'I cannot help with that.' }), today: '2026-06-09' });
  let threw = false;
  try { await noBlock(step, receipt); } catch { threw = true; }
  ck(!threw, 'no-code-block reply does not throw (autoheal never crashes the runner)');
  ck(fs.readFileSync(abs, 'utf8').includes('still broken'), 'no-code-block reply leaves the file UNCHANGED (left for the HALT)');

  // 6) ABSENT-TARGET AUTHORING (retro-audit class): missing target file -> the repair
  // seat is dispatched as the badal author; framing says AUTHOR, names context deps;
  // the emitted block is WRITTEN (creating the file). No throw either way.
  let threw2 = false, sawFraming2 = null;
  const authorDispatch = async (_seat, framing) => { sawFraming2 = framing; return { content: `\`\`\`\nexport const authored = true;\nARTIFACT-COMPLETE\n\`\`\`` }; };
  const authorFn = makeRepairFn(dir, { dispatch: authorDispatch, today: '2026-06-09' });
  try { await authorFn({ ...step, target_files: ['does_not_exist.mjs'], context_dependencies: ['MASTER-PLAN.md'] }, receipt); } catch { threw2 = true; }
  ck(!threw2, 'missing target file does not crash');
  ck(fs.existsSync(path.join(dir, 'does_not_exist.mjs')), 'ABSENT TARGET: the repair seat AUTHORED the file (badal — no longer a no-op)');
  ck(fs.readFileSync(path.join(dir, 'does_not_exist.mjs'), 'utf8').includes('authored = true'), 'authored content is the seat\'s emission');
  ck(sawFraming2?.includes('DOES NOT EXIST') && sawFraming2?.includes('MASTER-PLAN.md'), 'authoring framing names the absent-target case and the context dependencies');

  // 6b) INTENT-SHAPE AT LENGTH (4b 17:26 class): a LONG niyyah-shaped reply (>200 chars,
  // source:/failure_mode:/work: fields) must NEVER overwrite the target.
  fs.writeFileSync(abs, 'real content survives\n');
  const longIntent = 'niyyah:\n  source: the failing step and its receipt, which I have studied carefully and at length to understand the root.\n  failure_mode: the repair could regress the file further if applied without care and attention to every detail.\n  work: I will now repair the file by addressing the witnessed error comprehensively.\nARTIFACT-COMPLETE';
  const intentFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\n' + longIntent + '\n```' }), today: '2026-06-09' });
  await intentFn(step, receipt);
  ck(fs.readFileSync(abs, 'utf8').includes('real content survives'), 'LONG intent-header (>200 chars, niyyah shape) never overwrites the target');
  const fieldsOnly = 'source: receipt\nfailure_mode: regression\nwork: repair the module now\npadding '.padEnd(300, 'x') + '\nARTIFACT-COMPLETE';
  const fieldsFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\n' + fieldsOnly + '\n```' }), today: '2026-06-09' });
  await fieldsFn(step, receipt);
  ck(fs.readFileSync(abs, 'utf8').includes('real content survives'), 'field-triple shape (source/failure_mode/work) blocked at any length');

  // 7) extractCodeBlock unit: picks the LARGEST block when several are present.
  const picked = extractCodeBlock('```\nsmall\n```\nblah\n```js\nthis is the much larger full file block\n```');
  ck(picked === 'this is the much larger full file block', 'extractCodeBlock prefers the largest block (the full file)');

  // 8) CONTAINMENT HOLE CLOSURE (Foundation 0.4 — MANDATORY). Before 0.4 an absolute or
  // '..' target_files[0] let the repair seat overwrite ANY file with no containment.
  // (a) sandbox class: an ABSOLUTE target outside cwd is a NO-OP (the canary file survives).
  const canary = path.join(os.tmpdir(), `repair_canary_${Date.now()}.txt`);
  fs.writeFileSync(canary, 'DO NOT OVERWRITE\n');
  const escapeFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\nHACKED\nARTIFACT-COMPLETE\n```' }), today: '2026-06-09' });
  await escapeFn({ step_index: 1, description: 'evil', target_files: [canary], validation_command: 'x' }, receipt);
  ck(fs.readFileSync(canary, 'utf8').includes('DO NOT OVERWRITE'), 'HOLE CLOSED: sandbox repair REFUSES an absolute target outside cwd (no overwrite)');
  const travFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\nHACKED\nARTIFACT-COMPLETE\n```' }), today: '2026-06-09' });
  await travFn({ step_index: 1, description: 'evil', target_files: ['../escape.txt'], validation_command: 'x' }, receipt);
  ck(!fs.existsSync(path.join(dir, '..', 'escape.txt')), "HOLE CLOSED: sandbox repair REFUSES a '..' traversal target");
  fs.rmSync(canary, { force: true });
  // (a2) FIX 2 — a lowercase-drive in-sandbox absolute target (differs from cwd only in
  // drive/path casing) is ACCEPTED on Windows; on case-sensitive fs the exact path still works.
  {
    const dirAbs = path.resolve(dir);
    const lcDir = /^[a-zA-Z]:/.test(dirAbs) ? dirAbs.charAt(0).toLowerCase() + dirAbs.slice(1) : dirAbs;
    const lcTarget = path.join(lcDir, 'sandbox_case.txt');
    const caseFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\nWROTE\nARTIFACT-COMPLETE\n```' }), today: '2026-06-09' });
    await caseFn({ step_index: 1, description: 'case', target_files: [lcTarget], validation_command: 'x' }, receipt);
    ck(fs.existsSync(path.join(dir, 'sandbox_case.txt')), 'FIX 2: lowercase-drive in-sandbox target ACCEPTED (case-insensitive prefix guard)');
  }

  // (b) code-repo class: an allowlisted target IS repaired into the repo; a non-allowlisted
  // / escaping target is a NO-OP (routed through the never-weaken kernel).
  {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repair_coderepo_'));
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'mod.mjs'), 'export const b = ;\n');  // broken
    const repoFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\nexport const b = 1;\nARTIFACT-COMPLETE\n```' }), today: '2026-06-09', codeRepo: true, repoRoot: repo, allowFiles: ['src/mod.mjs'] });
    await repoFn({ step_index: 1, description: 'fix mod', target_files: ['src/mod.mjs'], validation_command: 'node -c src/mod.mjs' }, receipt);
    ck(fs.readFileSync(path.join(repo, 'src', 'mod.mjs'), 'utf8').includes('b = 1'), 'code-repo repair: allowlisted target REPAIRED into the repo');
    // non-allowlisted target -> no-op (kernel refuses)
    const repoBadFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\nHACKED\nARTIFACT-COMPLETE\n```' }), today: '2026-06-09', codeRepo: true, repoRoot: repo, allowFiles: ['src/mod.mjs'] });
    await repoBadFn({ step_index: 1, description: 'evil', target_files: ['src/other.mjs'], validation_command: 'x' }, receipt);
    ck(!fs.existsSync(path.join(repo, 'src', 'other.mjs')), 'code-repo repair: NON-ALLOWLISTED target is a NO-OP (kernel refuses)');
    // escape via code-repo branch -> no-op, canary outside repo untouched
    const repoEscFn = makeRepairFn(dir, { dispatch: async () => ({ content: '```\nHACKED\nARTIFACT-COMPLETE\n```' }), today: '2026-06-09', codeRepo: true, repoRoot: repo, allowFiles: ['src/mod.mjs'] });
    await repoEscFn({ step_index: 1, description: 'evil', target_files: [path.join(repo, '..', 'escape.mjs')], validation_command: 'x' }, receipt);
    ck(!fs.existsSync(path.join(repo, '..', 'escape.mjs')), 'code-repo repair: escaping target is a NO-OP');
    fs.rmSync(repo, { recursive: true, force: true });
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${fails === 0 ? 'ALL PASS — repair seat: reads target, dispatches executor with the witnessed error, overwrites with the corrected file (re-witness passes)' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
