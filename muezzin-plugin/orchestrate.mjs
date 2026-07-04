// orchestrate.mjs — the 3-phase mission orchestration (#21). Chains the whole spine end-to-end:
//   PLAN     : deconstruct(mission) -> validated micro_queue (#18)
//   IMPLEMENT+VERIFY (per step, interleaved; never advance past a failed step):
//     executor writes the file (#31) -> INTEGRITY-GUARD the edit (#36, so a green can't be gamed)
//     -> witness via execReceipt (the muezzin's own deed) -> repair once on fail (#32) -> commit (#19/#20)
//     or rollback + HALT.
// Deeds-not-claims, hardened: the receipt is integrity-checked, so deleting an assertion / touching a
// test file / a non-canonical command BLOCKS the step before it can manufacture a false green.

import { deconstruct, deconstructPanel, PANEL_INTEGRATOR_MODEL } from './deconstructor.mjs';
import { splitOversizedPlan, emitSubMissions } from './mission_split.mjs';
import { isCommandClassMission, buildLiteralCommandQueue } from './command_queue.mjs';
import { implementStep, isProseTarget } from './executor.mjs';
import { execReceipt, dispatchSeat, isLongRunCmd } from './seat_dispatch.mjs';
import { commitStep, rollbackStep, ensureSandboxRepo, assertRepoRoot, assertCleanOutsideAllowlist, preflightAllowlistClean, resetAllowFiles, abortInProgressGitOp, completeResolvedPickIfAny, stageFiles, commitTouchesFiles, assertNoUndeclaredShrinkage } from './git_steps.mjs';
import { makeRepairFn } from './repair.mjs';
import { parseMissionClass } from './mission_class.mjs';
import { checkReceiptIntegrity } from './integrity_guard.mjs';
import { findFabricatedCitations, collectAllowedBasenames, filterQuotedMentions, filterPreExistingContent } from './citation_guard.mjs';
import { checkGroundedness } from './guardian_guard.mjs';
import { findFabricatedAbsenceClaims, recordSeatOutcome } from './seat_record.mjs';
import { searxngPreflight } from './searxng_preflight.mjs';
import { mergeVerdicts } from './verdict_merge.mjs';
import { pickSeat, isLocalOnlySeat } from './seat_modes.mjs';
import { runtimeVerify } from './runtime_verify.mjs';
import { capturePreviews, buildPreviewPathFn } from './visual_capture.mjs';
import { witnessVisualDiff } from './visual_witness.mjs';
import { readFileSync, existsSync, appendFileSync, mkdirSync, renameSync, writeFileSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const readMaybe = (cwd, rel) => (rel && existsSync(path.join(cwd, rel))) ? readFileSync(path.join(cwd, rel), 'utf8') : '';

// ---- PHASE 3 (ACCEPTANCE criteria 1+2, wired 2026-06-10 after the operator caught it
// missing): ADVERSARIAL VERIFY by model seats — producer≠verifier. The validator and
// auditor read the ARTIFACTS the mission produced (not the executor's claims about
// them) against the mission's Maqsad/done-means, and emit verdict contracts; the
// deterministic mergeVerdicts gate (unwitnessed-APPROVE→BLOCK, absence≠APPROVE)
// decides. Only consensus APPROVE lets a mission call itself DONE. Deterministic
// per-step witnessing (phase 2) is necessary but answers "did each command pass" —
// this phase answers "is the WORK what the mission demanded" (live receipt: the
// 2boots card passed every deterministic check while missing its capability
// inventory — only this question catches that).
const ARTIFACT_CAP = 10000, ARTIFACT_TOTAL_CAP = 36000;

// ENGINE RECEIPTS FOR THE VERDICT PANEL (zero-findings-BLOCK root cause, receipted
// fb-backlog 2026-06-10 20:57 + structurally: DONE was IMPOSSIBLE). mergeVerdicts
// demands every APPROVE carry witnessed exec receipts (deeds-not-claims) — but the
// panel seats are CONTENT judges reading artifacts; they cannot run execs, so their
// honest APPROVE was always "unwitnessed" -> auto-BLOCK. The deeds DID run: every
// committed step's validation command was executed BY THE MUEZZIN, integrity-checked,
// and committed. Attaching those real receipts to the panel's contracts is truthful
// (the engine witnessed the deeds; the seat judges the content) — NOT a weakening:
// a mission with zero witnessed steps still cannot be APPROVEd.
export function engineReceiptsFromSteps(steps) {
  // A witnessed deed is one the ENGINE ran, not one a model claimed. Two shapes qualify:
  //   - edit steps: the engine validated + integrity-checked + COMMITTED -> s.sha
  //   - command/verify steps: the engine ran execReceipt and got exit 0 (s.ok && s.engineExec)
  //     -> a genuine deed with NO commit sha (it didn't write a tracked file).
  // STRUCTURAL FALSE-BLOCK FIX (2026-06-16, laguna-APPROVED): counting ONLY s.sha meant a
  // mission made of command/verify steps produced ZERO receipts, so the deeds-not-claims rule
  // (verdict_merge.mjs) force-converted any APPROVE to BLOCK — true greens killed as if hollow
  // (muddytires-d1-healthcheck-1: engine ran "VERIFIED count=4000", panel still BLOCKED). NOT a
  // weakening: hollow exit-0 is separately guarded — the panel SEES execOut and is told to flag
  // "True"/0/empty as hollow, and the plan-time false-green floor demands verify steps exit
  // NON-ZERO on absence (positive-assertion). The engine still witnessed the deed; the seat judges.
  return (steps || []).filter((s) => s && s.ok && (s.sha || s.engineExec))
    .map((s) => s.sha
      ? ({ type: 'exec', ref: `step ${s.step} witnessed by engine (validation ran, integrity-checked) -> commit ${s.sha}`, ok: true })
      : ({ type: 'exec', ref: `step ${s.step} engine-executed (validation_command ran, exit 0): ${String(s.execCmd || '').slice(0, 80)}`, ok: true }));
}

// ---- REPLAN ISOLATION (M-ENGINE.REPLAN-ISOLATION.1, 2026-06-16). A single flaky step
// must NOT destroy a mission's completed work. The catastrophe lived at the DAEMON: when
// orchestrate returned ANY step failure, the daemon's attempt-2 re-ran the WHOLE mission
// — a fresh PLAN + execute FROM STEP 1, discarding the completed steps (orchestrate.mjs:442
// comment: "the daemon's attempt-2 re-runs the WHOLE mission in a clean pass"; corpus-/card-
// NFL receipts: step 6/8 transient -> plan start #2 from zero -> non-convergent churn).
//
// The fix is to CONTAIN a step failure to the step. A failure is one of two classes:
//   TRANSIENT — the dispatch was flaky, not the plan: an EMPTY emission (the KB's exact
//     failure: "seat produced NO usable file content ... (completely empty)"), or a
//     network/timeout/connection error. The SAME step deserves a fresh dispatch.
//   DEFECT — a real content/structural fault: integrity-block, fabricated-citation, a
//     witness REJECT that survived repair, an edit-mode/containment refusal, or a
//     plan-structural refusal (SPLIT-NEEDED / EMISSION-TRUNCATED — the STEP is oversized,
//     a re-dispatch cannot help). A defect FAILS THE STEP with a receipt; it never retries.
//
// Neither class full-re-plans: orchestrate already returns a clean per-step fail (it never
// re-plans internally), so the cure is to (a) bound a TRANSIENT to K same-step retries with
// state cleanup, then fail-with-receipt, and (b) checkpoint completed steps so the daemon's
// clean-pass re-run RESUMES past them instead of re-running them from step 1.
const STEP_RETRY_MARKERS = [
  /completely empty/i,                         // executor: "...Raw seat output (0 chars): "(completely empty)""
  /produced NO usable file content/i,          // executor empty-emission (the KB failure class)
  /\bECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN\b/i,  // node network errnos
  /\b(network|timeout|timed out|connection (reset|refused|closed)|socket hang ?up|fetch failed)\b/i,
];
// DEFECT markers that LOOK emission-shaped but are NOT transient: the step is structurally
// oversized, so a fresh dispatch of the SAME step recurs. These FAIL with a receipt (and the
// daemon/conductor re-plans the STEP as part-files — a plan act, not a blind same-step retry).
const STEP_DEFECT_MARKERS = [
  /SPLIT-NEEDED/i,
  /EMISSION-TRUNCATED/i,
  /INTENT-INSTEAD-OF-ARTIFACT/i,
  /path containment violation/i,
  /edit-mode:/i,
];
// STRUCTURAL-SPLIT MARKERS (R1 escalation guard, 2026-06-17): the SUBSET of defect markers that
// mean "the STEP is oversized for ANY single seat" — a SPLIT-NEEDED / EMISSION-TRUNCATED refusal
// surfaces under reason 'emission-empty' (L755 failStep) just like a capability-shortfall empty
// emission does, but its cure is to SPLIT the step into part-files, NOT to spend Claude budget
// escalating an unbuildable monolith to sonnet+opus (which recur the same overflow). The
// escalation gate consults this to EXCLUDE such failures from the ladder; a plain
// capability-shortfall emission-empty (no structural marker) STILL escalates. Exported for selftest.
export const STRUCTURAL_SPLIT_MARKERS = [
  /SPLIT-NEEDED/i,
  /EMISSION-TRUNCATED/i,
];
export function isStructuralSplitDefect(errorText = '') {
  const txt = String(errorText || '');
  return STRUCTURAL_SPLIT_MARKERS.some((re) => re.test(txt));
}
// classifyStepFailure(reason, errorText) -> 'transient' | 'defect'. `reason` is the engine's
// own halt reason ('emission-empty' | 'witness' | 'witness-flag' | 'integrity' | ...);
// `errorText` is the diagnostic carried with it. Defect markers WIN over transient markers
// (an oversized step that also emitted nothing is still a re-plan, not a re-dispatch).
// Real-content rejections (integrity, fabricated-citation, witness REJECT after repair) are
// ALWAYS defects. Only an empty/networked emission-empty halt is transient. Exported for selftest.
export function classifyStepFailure(reason, errorText = '') {
  const txt = String(errorText || '');
  if (STEP_DEFECT_MARKERS.some((re) => re.test(txt))) return 'defect';
  // structural verdicts are never a flaky-dispatch class — they judged real content
  if (reason === 'integrity' || reason === 'fabricated-citation' || reason === 'witness-flag' || reason === 'containment-drift') return 'defect';
  if (reason === 'emission-empty' || reason === 'witness' || reason === 'engine-exec' || reason === 'step-error') {
    if (STEP_RETRY_MARKERS.some((re) => re.test(txt))) return 'transient';
  }
  return 'defect';
}

// PURE: does the text contain an unresolved git conflict opener (`<<<<<<< ` at line start)?
// The opener (7 '<' + a space + a label) is a git-specific marker with near-zero legitimate-content
// collision — unlike `=======` alone, which appears as markdown h1 underlines / dividers. Used by the
// COMMIT-CONFLICT gate to refuse committing a file left conflicted by a masked cherry-pick/merge.
// Exported for selftest.
export function hasConflictMarkers(text) {
  return /^<{7} /m.test(String(text || ''));
}

// CHECKPOINT (REPLAN ISOLATION step 1): persist the completed steps' index/sha/targets to
// <cwd>/_checkpoint.json so a re-entered run (the daemon's clean-pass attempt-2) can SKIP the
// steps already committed in the sandbox instead of re-running them from step 1. Best-effort:
// the checkpoint is an OPTIMIZATION on top of the in-run same-step retry (which is what makes a
// single run convergent); a write/read failure never breaks a mission.
function writeCheckpoint(cwd, missionId, steps) {
  try {
    const done = (steps || []).filter((s) => s && s.ok).map((s) => ({ step: s.step, sha: s.sha || null, targets: s.targets || (s.target ? [s.target] : []), engineExec: !!s.engineExec }));
    writeFileSync(path.join(cwd, '_checkpoint.json'), JSON.stringify({ ts: new Date().toISOString(), mission_id: missionId || null, completed: done }, null, 2));
  } catch { /* checkpoint is best-effort — never break a run on it */ }
}
function readCheckpoint(cwd, missionId) {
  try {
    const cp = JSON.parse(readFileSync(path.join(cwd, '_checkpoint.json'), 'utf8'));
    if (missionId && cp.mission_id && cp.mission_id !== missionId) return null;  // different mission in this cwd — ignore
    return cp && Array.isArray(cp.completed) ? cp : null;
  } catch { return null; }
}

// INCOHERENT CONTRACT (fb-backlog 13:20 receipt; design shape = laguna witness REJECT
// 2026-06-11 — "fix coherence upstream, never override at merge"): a seat voting
// BLOCK/REJECT while itemizing ONLY wajib/sunnah findings contradicts itself. The
// repair: re-ask THAT seat once with the contradiction named; the seat resolves it
// itself. A post-repair BLOCK is coherent dissent and stands.
export function isIncoherentContract(c) {
  if (!c || (c.verdict !== 'BLOCK' && c.verdict !== 'REJECT') || c._failed) return false;
  const fs = Array.isArray(c.findings) ? c.findings : [];
  return fs.length > 0 && fs.every((f) => f?.class === 'wajib' || f?.class === 'sunnah');
}

// priorVerdictsBlock (M-ENGINE-3PHASE.3) — prepended to the FINAL/CONSENSUS auditor's framing
// so it rules WITH the two boundary verdicts in hand instead of voting blind. Pure function of
// the already-collected boundary contracts. Findings are capped (top 6 per seat) to keep the
// block bounded. The final auditor's job: check each boundary ruling against the evidence and
// override a false-reject or a hollow double-approve — evidence outranks verdicts.
export function priorVerdictsBlock(contracts) {
  const lines = (contracts || []).filter(Boolean).map((c, i) => {
    const seat = c.seat || `boundary-auditor-${i + 1}`;
    const verdict = c.verdict || 'UNKNOWN';
    const findings = (Array.isArray(c.findings) ? c.findings : []).slice(0, 6)
      .map((f) => `      - [${f?.class || '?'}] ${String(f?.description || f?.id || f).slice(0, 200)}`)
      .join('\n');
    return `  ${seat} ruled ${verdict}${findings ? '\n' + findings : ' (no findings itemized)'}`;
  }).join('\n\n');
  return `THE TWO BOUNDARY AUDITORS HAVE ALREADY RULED (you are the FINAL/CONSENSUS auditor):\n\n${lines}\n\n` +
    `Your job is NOT to vote or average. CHECK each boundary ruling against the artifact evidence and the mission contract below, then issue the final verdict. A boundary auditor can be wrong either way: a REJECT/BLOCK can be factually mistaken, and an APPROVE (even a confident one) can miss an unmet contract element. Evidence outranks verdicts. Concerns OUTSIDE the mission's Done-means do not by themselves justify a REJECT.\n\n`;
}

// COMMAND-ONLY MISSIONS (card-merge 2026-06-12 08:27 receipt: both panel seats BLOCKed
// with "The ARTIFACTS PRODUCED section is empty — no content was embedded in the
// dispatch contract"): assembly-only missions produce their deliverable via engine-exec
// steps, which carry no `targets` — so the contract embedded ZERO artifacts and the
// panel rightly refused to judge absent text. Fallback: when no step carries a target,
// the sandbox's own .md files (newest first — the assembled deliverable sorts first)
// ARE the artifacts. Exported for selftest.
export function artifactFilesFor(steps, cwd) {
  const fromTargets = [...new Set(steps.filter((s) => s.ok).flatMap((s) => s.targets || []))];
  if (fromTargets.length) return fromTargets;
  try {
    return readdirSync(cwd)
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .sort((a, b) => statSync(path.join(cwd, b)).mtimeMs - statSync(path.join(cwd, a)).mtimeMs);
  } catch { return []; }
}

// PHASE 2->3 INTEGRATOR BRIDGE (SEAT-PLAN-OPERATOR-ORIGINAL.md, operator ruling 2026-06-10
// ~15:10: "carries phase-1-master into Phase 2, phase-2 synthesis into Phase 3" — the
// shipped engine only ever implemented the FIRST bridge (deconstructPanel's integrator,
// phase1->2). This closes the second one. ADDITIVE ONLY: the synthesis is prepended as
// extra context ahead of the raw artifacts in defaultVerdictPhase's framing — it NEVER
// replaces them. Validator/auditor still see and judge the full raw ground truth; the
// synthesis is an orientation aid, never a substitute (the exact regression this guards
// against: a synthesis step that silently hides or replaces ground truth would weaken
// deeds-not-claims, not strengthen it). Fails open exactly like the phase-1 integrator: any
// dispatch error, empty output, or an UMRAH-tier mission (too small to be worth the extra
// seat call) -> returns '' and the caller proceeds with the framing exactly as it was before
// this bridge existed. Extracted as its own function (not inlined in defaultVerdictPhase) so
// it is directly unit-testable via the injectable `opts.integratorFn` without needing to also
// mock defaultVerdictPhase's separate, non-injectable validator/auditor dispatchSeat calls.
export async function buildIntegratorBriefing(mission, steps, artifacts, execReceiptsBlock, opts = {}) {
  const stepCountForBridge = (steps || []).length;
  const isUmrahForBridge = stepCountForBridge <= 2 && !/TIER:\s*HAJJ/i.test(mission);
  if (opts.disableIntegrator || isUmrahForBridge || !(String(artifacts || '').trim() || execReceiptsBlock)) return '';
  try {
    const integratorModel = pickSeat('integrator', PANEL_INTEGRATOR_MODEL);
    const integSeat = { role: 'integrator', model: integratorModel, today: new Date().toISOString().slice(0, 10), max_tokens: 8192, sampling: { temperature: 0.3, top_p: 0.9 } };
    const integFraming =
      `You are the INTEGRATOR bridging Phase 2 (execution) into Phase 3 (verdict). Below is the mission contract and the RAW execution artifacts + receipts a multi-step build produced. ` +
      `Write a SHORT (under 200 words) coherent briefing: what was actually built across the steps, and how it relates to the mission's Done-means. Name any cross-step inconsistency you notice. ` +
      `Do NOT judge whether it is correct — that is Phase 3's job below. Do NOT invent content not present below. Output PLAIN PROSE only, no verdict, no json.\n\n` +
      `MISSION:\n${mission}\n\nRAW ARTIFACTS + RECEIPTS:\n${artifacts}\n\n${execReceiptsBlock}`;
    const dispatch = opts.integratorFn || ((seat, framing) => dispatchSeat(seat, framing, { wantVerdict: false }));
    const r = await dispatch(integSeat, integFraming);
    return String(r?.content ?? '').trim();
  } catch {
    return '';   // fail-open: synthesis is an aid, never a blocker — proceed without it
  }
}

// REACHABILITY WITNESS (2026-07-02, QUALITY-STANDARD bar 5 / dev-cli class: js/dev-cli.js
// shipped, verdict-passed, referenced by ZERO pages — unreachable by any user). A browser
// asset (js/ or css/ top-level) produced by a mission must be referenced by at least one
// .html page in the repo. PURE + exported for selftest; engine-observed (the panel judges
// the finding, it cannot self-certify around it).
export function unreachableBrowserAssets(cwd, files) {
  const assets = (files || []).map((f) => String(f).replace(/\\/g, '/')).filter((f) => /^(js|css)\/[^/]+\.(js|css)$/.test(f));
  if (!assets.length) return [];
  let html = '';
  try { for (const h of readdirSync(cwd).filter((n) => n.endsWith('.html'))) { try { html += readFileSync(path.join(cwd, h), 'utf8'); } catch { /* skip unreadable page */ } } } catch { return []; }  // no repo dir readable -> no claim (fail-open here; the panel still sees artifacts)
  return assets.filter((a) => !html.includes(a.split('/').pop()));
}

export async function defaultVerdictPhase(mission, cwd, steps, opts = {}) {
  // VISUAL WITNESS (advisory only — NOT a Phase-3 voting seat; see visual_witness.mjs's own
  // pending-sign-off note on MUEZZIN-SEAT-PLAN-LOCKED.md. Gated behind BOTH a VISUAL-QC-REQUIRED
  // header and a PREVIEW-BASE-URL: <url> header; injectable via opts for offline self-tests so
  // no real puppeteer/Ollama call ever fires in a selftest. Never mutates merged.consensus.
  const files = artifactFilesFor(steps, cwd);
  let total = 0, omitted = 0;
  const artifacts = files.map((f) => {
    const full = readMaybe(cwd, f);
    const body = full.slice(0, ARTIFACT_CAP);
    total += body.length;
    if (total > ARTIFACT_TOTAL_CAP) { omitted++; return `--- ARTIFACT ${f} (omitted: total cap) ---`; }
    // SLICE MARKER (card-merge 10:57 receipt: a complete 16,954-byte artifact was
    // silently sliced at the cap; the panel saw a mid-word cut and honestly flagged
    // "Content Truncation at Arafat" — the contract must own its own truncation).
    const sliceNote = full.length > body.length
      ? ` (CONTRACT SLICE: first ${body.length} of ${full.length} chars — the FILE ON DISK IS COMPLETE and passed its validation command; the cut below is the contract's, NOT the artifact's; never flag truncation at or beyond it)`
      : '';
    return `--- ARTIFACT ${f}${sliceNote} ---\n${body}\n--- END ${f} ---`;
  }).join('\n\n');
  // ENGINE-EXEC RECEIPT BODIES (ENGINE-RELIABILITY-DIAGNOSIS.md §4.2, false-green fix B):
  // surface what each engine-executed command (action_type command/verify) actually PRINTED,
  // additively alongside the artifact files. The d1-1 hollow green was provable inside these
  // greens — step-1 out "num_tables": 0, step-8 out "True" on a 0-row query — but the panel
  // only ever saw the produced files, never the command outputs. Per-output cap ~500 chars,
  // whole block bounded to a few KB, so a verbose command can never drown the artifacts.
  // HEAD+TAIL SLICING (2026-07-03, trip-cost.S2 7th-run receipts: BOTH panel attempts refused
  // on "command truncated / QC PASS cannot be cross-checked" — the head-only slice fed the
  // panel wrangler-deploy noise and cut the CONCLUSION lines at the end, where witnesses print
  // their evidence (RENDER_URL/STATUS/PAGEERRORS). Conclusions live at the TAIL; a head-only
  // cap structurally starves every long-step verdict. Head keeps the d1-1 hollow-green
  // visibility; tail carries the evidence.)
  const EXEC_OUT_CAP = 500, EXEC_BLOCK_CAP = 6000;
  const headTail = (raw, cap) => {
    const t = String(raw || '');
    if (t.length <= cap) return { text: t, truncated: false };
    const head = Math.floor(cap * 0.4), tail = cap - head;
    return { text: `${t.slice(0, head)} …[${t.length - cap} chars omitted]… ${t.slice(-tail)}`, truncated: true };
  };
  let execTotal = 0;
  const execLines = (steps || [])
    .filter((s) => s.ok && s.engineExec && (s.execCmd || s.execOut))
    .map((s) => {
      if (execTotal > EXEC_BLOCK_CAP) return null;   // block cap reached — stop adding
      const cmd = headTail(s.execCmd || '(command not recorded)', EXEC_OUT_CAP);
      const out = headTail(s.execOut || '', EXEC_OUT_CAP);
      const outNote = out.truncated ? ' (middle truncated — head+tail shown)' : '';
      const line = `- step ${s.step} command${cmd.truncated ? ' (middle truncated)' : ''}: ${cmd.text}\n  output${outNote}: ${out.text.trim() || '(no output — exited 0 with empty stdout)'}`;
      execTotal += line.length;
      return line;
    })
    .filter(Boolean);
  const execReceiptsBlock = execLines.length
    // HOLLOW-WITNESS HINT (false-green, d1-1 receipt): exit-0 is NOT proof the deed happened —
    // wrangler/curl exit 0 on a successful query that returned ZERO rows. Judge the OUTPUT
    // bodies: an output of "True"/0/empty for a step that CLAIMS a remote row/table/response is
    // a HOLLOW witness, and the artifact does NOT satisfy the mission regardless of the green.
    ? `ENGINE-EXEC RECEIPT BODIES (each command/verify step ran via the muezzin and exited 0 — but exit-0 only proves the command RAN, NOT that the real outcome occurred; wrangler/curl/psql exit 0 even on a ZERO-ROW query. JUDGE THESE OUTPUTS: a step that CLAIMS a remote table/row/response but whose output is "True"/0/empty/"num_tables": 0 is a HOLLOW witness — the deed did NOT happen and the mission is NOT satisfied, the green notwithstanding):\n${execLines.join('\n')}\n\n`
    : '';
  // REACHABILITY WITNESS block (engine-observed; QUALITY-STANDARD bar 5): unreferenced browser
  // assets are named to the panel — an unreachable deliverable is not done, whatever its quality.
  const unreachable = (opts.reachabilityFn || unreachableBrowserAssets)(cwd, files);
  const reachabilityBlock = unreachable.length
    ? `REACHABILITY WITNESS (engine-observed, dev-cli class): these BROWSER assets are referenced by ZERO .html pages in the repo — shipped but UNREACHABLE by any user. An unreachable deliverable does NOT satisfy the mission regardless of content quality; verdict must REJECT or REVISE naming the missing page wiring: ${unreachable.join(', ')}\n\n`
    : '';
  const execReceiptsBlockFinal = execReceiptsBlock + reachabilityBlock;

  const integratorBriefing = await buildIntegratorBriefing(mission, steps, artifacts, execReceiptsBlockFinal, opts);

  const framing =
    `MISSION (the contract these artifacts must satisfy — judge against its Maqsad and its "Done means" clause):\n${mission}\n\n` +
    (integratorBriefing
      ? `PHASE-2 INTEGRATOR BRIEFING (orientation only — the RAW artifacts below remain the ground truth you judge against; this is a summary aid, never a substitute):\n${integratorBriefing}\n\n`
      : '') +
    // ENGINE-WITNESSED FACTS (fb-backlog 13:20 receipt: tool-light seats BLOCKed on
    // "artifact existence not confirmable" — re-litigating what the engine had already
    // witnessed). State the settled facts so blindness stops generating findings.
    `ENGINE-WITNESSED FACTS (already proven by the muezzin's own execution — receipts are attached to your contract; do NOT spend findings re-verifying these):\n` +
    `- Every artifact below EXISTS on disk in the mission sandbox, passed its validation command, passed the integrity guard, and is committed (sha receipts attached).\n` +
    `- You are a CONTENT judge. File-existence, file-reachability, and your own tooling/faith-file provisioning are OUT OF SCOPE as findings.\n\n` +
    `ARTIFACTS PRODUCED (full content embedded below — judge THIS text):\n\n${artifacts}\n\n` +
    execReceiptsBlockFinal +
    `Judge: do the artifacts genuinely satisfy the mission's done-means? Placeholder text, missing required ` +
    `sections, uncited claims, or content that answers a DIFFERENT question than the mission asked are findings. ` +
    `APPROVE only what you would defend.\n\n` +
    // GRADUATED EXPIATION (operator-ratified 2026-06-11, Hajj-fiqh model): the merge
    // engine grades findings in CODE; unclassified findings keep full severity, so a
    // seat that skips classification changes nothing — it can only ever be more lenient
    // by being honest about which gaps are repairable.
    `CLASSIFY EVERY FINDING with a "class" field:\n` +
    `- "arkan": violates the mission's SINGLE ESSENTIAL criterion (its Arafat — identify it from the Done-means kernel; the artifact fails its core purpose). Invalidates the mission.\n` +
    `- "wajib": a REAL gap, but repairable by a scoped follow-up task. The mission stands; the gap is queued as a receipted compensating task (damm).\n` +
    `- "sunnah": an optional improvement. No penalty.\n` +
    `An unclassified finding is treated at FULL severity. Do not stretch "arkan" — it is the one criterion the mission cannot exist without.\n` +
    `RECEIPT-DISCOUNTING RULE (QUALITY-STANDARD bar 7, 2026-07-02): weigh evidence by how it was witnessed. An EXECUTED receipt (an engine-exec output above, a run test, a fetched page, a rendered artifact) outranks any ASSERTED claim — including claims inside the artifact's own prose about what it did. A finding or an approval grounded only in unexecuted assertions carries NO weight: do not raise a finding you cannot tie to an executed receipt or the artifact text itself, and do not APPROVE on the artifact's self-description when the executed receipts contradict or do not cover it.`;
  const today = new Date().toISOString().slice(0, 10);
  // PHASE 2 SEATS PER THE OPERATOR'S LOCKED SEAT PLAN (SEAT-PLAN-OPERATOR-ORIGINAL.md,
  // 2026-06-10): validator = deepseek-v4-pro (his paste; L4 cost bounded by 1-call-per-
  // mission cadence; budget alternate glm-5.1), auditor = minimax-m3 (his paste).
  // UMRAH/HAJJ TIER ROUTING (operator-ratified 2026-06-11): ceremony sized to the rite.
  // A small mission (<=2 steps, single target artifact) is an UMRAH — one witness seat,
  // light verdict. Multi-phase builds are HAJJ — the full panel. "TIER: HAJJ" anywhere
  // in the mission text forces the full panel regardless of size.
  const stepCount = (steps || []).length;
  const targetCount = new Set((steps || []).flatMap((s) => s.targets || [])).size;
  const isUmrah = stepCount <= 2 && targetCount <= 1 && !/TIER:\s*HAJJ/i.test(mission);
  // SEATING MODE (seating-modes build, 2026-06-15): the active mode picks the verdict-panel
  // seats. In anthropic-heavy these stay OPEN-weight (deepseek/minimax) ON PURPOSE — ollama
  // cloud CHECKS the Claude work (producer != verifier; diversity is the point). No mode /
  // unknown -> today's deepseek-v4-pro + minimax-m3 (safe default). Tier/cadence LOGIC below
  // is unchanged — only the model names move.
  const validatorModel = pickSeat('validator', 'deepseek-v4-pro');
  const auditorModel = pickSeat('auditor', 'minimax-m3');
  // LOCAL-ONLY (claude-local-hybrid, 2026-06-30): see seat_modes.mjs's isLocalOnlySeat for why —
  // these checking seats skip the cloud-first waterfall entirely under that mode.
  const validatorLocalOnly = isLocalOnlySeat('validator', validatorModel);
  const auditorLocalOnly = isLocalOnlySeat('auditor', auditorModel);
  // M-ENGINE-3PHASE.3 (2026-07-01): the LOCKED seat plan's Phase-3 is a THREE-auditor panel —
  // two independent boundary judges (validator + auditor, kept byte-identical to preserve their
  // behavior) plus a FINAL/CONSENSUS auditor that reads BOTH prior verdicts and rules. The
  // final seat is dispatched LAST in the serial loop below and its framing carries the two
  // boundary contracts (priorVerdictsBlock). mergeVerdicts is already N-ary, so 3 contracts
  // merge by the same any-BLOCK/REVISE-escalates rule. UMRAH (tiny missions) stays single-seat.
  const finalAuditorModel = pickSeat('final_auditor', 'nemotron-3-super');
  const finalAuditorLocalOnly = isLocalOnlySeat('final_auditor', finalAuditorModel);
  const seats = isUmrah
    ? [{ role: 'validator', model: validatorModel, today, max_tokens: 16384, sampling: { temperature: 0.3, top_p: 0.9 }, localOnly: validatorLocalOnly }]
    : [
      { role: 'validator', model: validatorModel, today, max_tokens: 16384, sampling: { temperature: 0.3, top_p: 0.9 }, localOnly: validatorLocalOnly },
      { role: 'auditor', model: auditorModel, today, max_tokens: 16384, sampling: { temperature: 0.3, top_p: 0.9 }, localOnly: auditorLocalOnly },
      { role: 'final_auditor', model: finalAuditorModel, today, max_tokens: 16384, sampling: { temperature: 0.3, top_p: 0.9 }, localOnly: finalAuditorLocalOnly },
    ];
  // SERIAL on purpose (laguna finding 1 weighed and declined): the waterfall's local
  // fallback tail means parallel seats could land on local Ollama CONCURRENTLY — GR10
  // violation + scheduler deadlock class. Cloud-parallel isn't worth that tail risk.
  const contracts = [];
  const engineReceipts = engineReceiptsFromSteps(steps);
  const seatRecordPath = path.join(path.dirname(cwd), '_logs', 'seat-record.json');
  for (const seat of seats) {
    // M-ENGINE-3PHASE.3: the final/consensus auditor reads the two boundary verdicts already
    // collected this loop (contracts[]) — it is NOT a third independent vote, it CHECKS the
    // boundary rulings against the evidence and can override a false-reject or a hollow
    // double-approve. Boundary seats (validator/auditor) get the plain framing, unchanged.
    const seatFraming = (seat.role === 'final_auditor' && contracts.length)
      ? priorVerdictsBlock(contracts) + framing
      : framing;
    let c = await dispatchSeat(seat, seatFraming, { wantVerdict: true });
    // coherence-repair: one re-ask, the seat resolves its own contradiction (see
    // isIncoherentContract). Never overridden — a repeated BLOCK stands as dissent.
    if (isIncoherentContract(c)) {
      const contradiction =
        `COHERENCE CHECK on your previous verdict contract for this same mission:\n` +
        `You voted ${c.verdict}, but EVERY finding you itemized is classified wajib (repairable gap) or sunnah (optional) — ` +
        `by your own classification, the mission stands with repairable gaps, which contradicts ${c.verdict}.\n` +
        `Also note the ENGINE-WITNESSED FACTS in the framing: artifact existence/validation/commit are already proven by receipts — ` +
        `"could not verify existence" is not a valid basis.\n` +
        `Re-issue ONE coherent contract: either (a) your findings justify the verdict — then classify the disqualifying finding 'arkan' and keep ${c.verdict}; ` +
        `or (b) the gaps are repairable — then vote REVISE or APPROVE accordingly. Your call, but the contract must agree with itself.\n\n` +
        seatFraming;
      const retry = await dispatchSeat(seat, contradiction, { wantVerdict: true });
      if (retry && !retry._failed) c = retry;       // a failed re-dispatch keeps the original (never silently better)
    }
    // attach the engine's witnessed deeds (model seats cannot run execs; the engine did).
    // Seat-claimed receipts are DISCARDED — a model's self-asserted receipt is a claim,
    // not a deed (the exact agy failure). Only engine-run receipts count.
    if (c && typeof c === 'object') c.receipts = engineReceipts;
    // BADAL TRACK RECORD (4a receipt: a validator claimed ENOENT on a file step 1 had
    // just proven exists). Fabricated absence claims are mechanically checkable against
    // the sandbox; they strike the seat's record (x3 weight in proxy eligibility). The
    // finding is NOT dropped — the merge takes it at face value; the record pays.
    try {
      const fabs = findFabricatedAbsenceClaims(c?.findings, cwd);
      recordSeatOutcome(seatRecordPath, seat.model, 'verdict', fabs.length ? 'fabrication' : 'pass');
      if (fabs.length && Array.isArray(c?.findings)) {
        // laguna witness REJECT incorporated (2026-06-11): a PROVEN-false absence claim
        // is excluded from the merge — the detector's existence test is deterministic,
        // and carrying a demonstrated falsehood into consensus would let a seat trade a
        // record-strike for verdict influence. The strike stays; the falsehood doesn't.
        const fabIds = new Set(fabs.map((x) => x.finding));
        c._fabricated_absence = fabs;
        c.findings = c.findings.filter((f) => !fabIds.has(String(f?.id || String(f?.description || f).slice(0, 60))));
      }
    } catch { /* scoring must never crash the verdict */ }
    contracts.push(c);
  }
  const merged = mergeVerdicts(contracts);
  // OMISSION FLOOR (laguna finding 2): seats cannot APPROVE artifacts they never saw —
  // an omitted artifact deterministically caps consensus at REVISE, never APPROVE.
  if (omitted > 0 && merged.consensus === 'APPROVE') {
    merged.consensus = 'REVISE';
    merged.dispositions.push({ seat: 'engine', verdict: 'REVISE', reason: `${omitted} artifact(s) over the total cap were never judged — blind APPROVE forbidden` });
  }
  // KNOWN v1 LIMIT (laguna finding 3, accepted): non-APPROVE findings persist in
  // mission-events + the result, but are NOT fed into the retry's re-plan framing yet.
  // Second verdict failure -> FAILED with findings for the conductor. Feed-forward is
  // a queued improvement, not silently absent.
  await applyVisualWitness(mission, cwd, merged, opts);
  return { ...merged, contracts };
}

// applyVisualWitness — extracted as its own pure-ish function (mutates+returns merged) so it is
// directly unit-testable without going through defaultVerdictPhase's real seat dispatch (which
// has no injection seam and would otherwise force a live Ollama/Claude call in a self-test).
// NEVER sets merged.consensus or merged.dispositions — advisory only, per visual_witness.mjs's
// own pending-sign-off note (a real voting Phase-3 seat is a separate, not-yet-locked decision).
// provisionPreview — deploy the mission's worktree to the Cloudflare Pages PREVIEW alias and
// return its URL, or null. Extracted from conduct-cycle's --deploy-preview verb (2026-07-03,
// receipt: trip-cost.S2 FAILED NO_PREVIEW_BASE_URL — the header/verb plumbing existed on both
// sides but nothing CONNECTED them, so every VISUAL-QC mission without a hand-written header
// died at the witness. Auto-provisioning makes visual missions chain-self-sufficient: no
// conductor hands on product verification — the operator's fable-tax correction, mechanized).
export async function provisionPreview(cwd) {
  let out = '';
  try {
    out = execSync('wrangler pages deploy . --project-name=muddytires --branch=preview --commit-dirty=true',
      { cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000, maxBuffer: 8 * 1024 * 1024 }).toString();
  } catch { return null; }
  const url = (out.match(/https:\/\/[a-z0-9-]+\.muddytires\.pages\.dev/i) || [])[0];
  if (!url) return null;
  // SETTLE: fresh preview aliases 404 for a few seconds while Cloudflare propagates.
  for (let i = 0; i < 10; i++) {
    try { const r = await fetch(url + '/map'); if (r.ok) return url; } catch { /* not yet */ }
    await new Promise((res) => setTimeout(res, 5000));
  }
  return null;
}

export async function applyVisualWitness(mission, cwd, merged, opts = {}) {
  if (!/VISUAL-QC-REQUIRED/i.test(mission)) return merged;
  const baseUrlMatch = mission.match(/PREVIEW-BASE-URL:\s*(\S+)/i);
  let baseUrl = baseUrlMatch ? baseUrlMatch[1] : null;
  if (!baseUrl) {
    // AUTO-PROVISION (2026-07-03): header absent -> the engine provisions its own preview.
    const provisionFn = opts.provisionPreviewFn || provisionPreview;
    baseUrl = await provisionFn(cwd);
    if (!baseUrl) {
      merged.visualWitness = { ok: false, error: { kind: 'NO_PREVIEW_BASE_URL', detail: 'VISUAL-QC-REQUIRED set, no PREVIEW-BASE-URL header, and auto-provision (wrangler preview deploy) failed or never became reachable' } };
      return merged;
    }
  }
  try {
    const capturePreviewsFn = opts.capturePreviewsFn || capturePreviews;
    const witnessVisualDiffFn = opts.witnessVisualDiffFn || witnessVisualDiff;
    const previewDir = path.join(cwd, '_visual-preview');
    // M-VISUAL-QC capture fix (2026-07-02): serve the repo statically for the screenshot so
    // /map.html renders the REAL interactive page, not wrangler-dev's SSR-fallback redirect
    // (proven root cause of zero visual-QC completions). staticRoot = the mission's own repo
    // (cwd). The PREVIEW-BASE-URL header stays the fallback for non-staticRoot / offline paths.
    await capturePreviewsFn(baseUrl, previewDir, { staticRoot: cwd });
    merged.visualWitness = await witnessVisualDiffFn(buildPreviewPathFn(previewDir));
  } catch (e) {
    merged.visualWitness = { ok: false, error: { kind: 'CAPTURE_OR_WITNESS_THREW', detail: String(e?.message || e) } };
  }
  return merged;
}

// orchestrate(mission, cwd, opts) -> { ok, phase, steps, stoppedAt? }.
// Injectable deconstructFn / implementFn / repairFn / preflightFn for offline testing; defaults are the real seats.
// per-step WITNESS (phase-2, operator ruling 2026-06-10: Opus → nemotron-3-super →
// qwen3.6 local). Smell-tests EACH step's artifact for assumptions/logical-leaps/
// fabricated-looking output — an ADDITIONAL catch on top of the integrity guard and
// the execReceipt floor, never a replacement. FLAGGED → the step's heal path. A witness
// DISPATCH error never blocks a step (the deterministic floor still gates) — only an
// explicit FLAGGED verdict does.
export async function defaultWitness(step, cwd, artifact, sources = '', dispatch = dispatchSeat) {
  // SEATING MODE (seating-modes build, 2026-06-15): the active mode picks the per-step witness
  // seat. balance/anthropic-heavy keep nemotron-3-super (Opus-first via CLAUDE_SEAT_MAP — a
  // STRONG witness, "keep witness strong"); local-heavy uses a LOCAL witness (no Opus pull). No
  // mode / unknown -> today's nemotron-3-super (safe default). The witness LOGIC is unchanged.
  const witnessModel = pickSeat('witness', 'nemotron-3-super');
  // LOCAL-ONLY (claude-local-hybrid, 2026-06-30): see seat_modes.mjs's isLocalOnlySeat.
  // max_tokens 4096 -> 12288 (2026-07-03 receipts: qwen3.6:27b IGNORES think:false on the
  // /v1 endpoint — 16K chars of unsuppressible reasoning starved the 4096 budget to
  // EMPTY_CONTENT_THINKING; the heal's success came from the DOUBLED budget, not the flag.
  // 12288 = observed reasoning (~4K tokens) + verdict content headroom, still bounded.)
  const seat = { role: 'local_witness_validator', model: witnessModel, today: new Date().toISOString().slice(0, 10), max_tokens: 12288, sampling: { temperature: 0.2, top_p: 0.9 }, localOnly: isLocalOnlySeat('witness', witnessModel) };
  // STAGED SOURCES (CLASS 1, witness-wall fix): the witness used to get ONLY the step
  // goal + artifact and never the citation sources, so it could not resolve a `[file Lnn]`
  // citation and (correctly, given its blindness) flagged every one "unverifiable" — an
  // unsourced-claim halt wall. Staging the same sources the artifact cites lets the
  // witness actually CHECK a citation instead of presuming it false.
  const stagedBlock = sources && sources.trim()
    ? `--- STAGED SOURCES (resolve every [file Lnn] citation against these) ---\n${String(sources).slice(0, 8000)}\n--- END STAGED SOURCES ---\n\n` +
      `A citation that resolves to a line in these sources is VERIFIED; only flag a citation you cannot resolve here.\n\n`
    : '';
  // ARTIFACT CAP (2026-07-04 receipt, engine-truth-of-record.S1 family): the old 48000-char
  // default cap sliced muezzin-daemon.mjs (137945 bytes) BEFORE queuedDepsHold's edit was
  // fully visible -- byte offsets confirmed directly (head -c 48000 lands at line 709;
  // queuedDepsHold spans lines 702-747, bytes 47350-50655) -- so the witness correctly
  // reported "truncated mid-function" for a view that genuinely WAS truncated, even though
  // the actual file on disk was complete and its own selftest passed. Four independent
  // dispatches (default-local, sonnet, opus x2) were false-REJECTed by this, not by any
  // defect in their output. Raised to match EDIT_FULL_FILE_MAX_BYTES (executor.mjs) — the
  // SAME threshold already used to decide a file is "small enough" not to need windowing
  // for edits; the witness should not truncate below the size the editor itself treats as
  // whole-file-safe.
  const framing =
    `Step goal: ${step.description}\n\nThe implementation written for this step:\n--- BEGIN ${step.target_files?.[0] || 'artifact'} ---\n${String(artifact).slice(0, Number(process.env.MUEZZIN_WITNESS_ARTIFACT_CAP) || 180000)}\n--- END ---\n\n` +
    stagedBlock +
    `Witness review: report ONLY logical leaps, hidden assumptions, or claims the code does not actually support. ` +
    `Reply with a verdict line "APPROVE" (clean) or "REJECT" (flagged) then findings. Do not rewrite the code.`;
  const r = await dispatch(seat, framing, { wantVerdict: true });
  return r;  // { verdict, findings, ... } — REJECT/BLOCK = flagged
}

// ---- MISSION-LEVEL SIZE CEILING + AUTO-SPLIT (Hajj architecture, MISSION_ARCHITECTURE.md
// L7/L10-11/L18/L33). The DEFAULT splitFn: given the validated micro_queue, decide whether
// the WHOLE mission exceeds the size ceiling (a max micro-action COUNT — distinct from, and
// ABOVE, the per-step single-file micro-action ceiling, which is untouched). If so, emit
// coherent tartib-ordered sub-missions as .mission.txt files + a _split-manifest.json into
// the missions dir, append them to AUTORUN in order, and report SPLIT so the parent is NOT
// executed. Under the ceiling -> { split:false } and the caller runs the queue UNCHANGED.
// Unsplittable -> { fail:true, reason } and the caller FAILS with a named receipt.
//
// ctx.missionsDir / ctx.parentMissionFile let the daemon point the children at the real
// missions dir + name them off the parent file. When absent (a bare orchestrate() call /
// offline test), they default off cwd and queue-append is skipped (files+manifest only).
// POSITION-INHERITANCE (2026-07-03, system-gap #4; receipt in STATE.md: "mission_split does
// NOT inherit queue position — gap-promoted parents' children land at the TAIL — re-promote
// manually, engine fix owed"). Insert newRel directly AFTER the line carrying anchorRel
// (whatever its status prefix: bare/RUNNING/SPLIT), so children inherit the parent's queue
// position in tartib order. PURE — returns the new text; anchor absent -> tail append
// (NEVER lose the line).
// SPLIT-CHILD marker (hunt-item #13, 2026-07-04): the daemon's QUEUE-DUP guard (landed
// 2026-07-03, muezzin-daemon.mjs readQueue()) skips any bare line whose path ALSO carries a
// status (DONE/FAILED/SPLIT/etc.) elsewhere in AUTORUN.md -- correct for the anti-pattern it
// was built for (an accidentally re-added bare line beside an already-terminal status), but
// wrong for a RE-SPLIT: when a mission is split again (or a child is split further), the
// newly-inserted child line's path is brand new, but if a PRIOR split/failed attempt at the
// same stem left a status line for that exact path (a re-split reusing the same child
// numbering), the guard silently skips the fresh line forever -- silently unfireable. Tagging
// every split-inserted line with this comment token lets the guard tell "legitimately fresh
// re-split child" apart from "stale duplicate bare line" (missionPath() already strips HTML
// comments before extracting the path, so this is purely a signal to the guard, invisible to
// every other line-parsing consumer).
export const SPLIT_CHILD_MARKER = '<!-- SPLIT-CHILD -->';

export function insertQueueLineAfter(text, anchorRel, newRel) {
  const lines = String(text).split(/\r?\n/);
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(anchorRel) && !/^\s*#/.test(lines[i])) at = i;   // LAST live line wins (history lines above)
  }
  const taggedRel = `${newRel}  ${SPLIT_CHILD_MARKER}`;
  if (at === -1) return `${String(text).replace(/\n?$/, '\n')}${taggedRel}\n`;
  lines.splice(at + 1, 0, taggedRel);
  return lines.join('\n');
}

// io.writeFile / io.appendQueue are injectable so the whole path is offline-testable.
export function defaultSplitFn(mission, queue, opts = {}, ctx = {}, io = {}) {
  const plan = splitOversizedPlan(mission, queue, opts);
  if (!plan.split) return plan;   // { split:false } (run unchanged) or { fail:true } (named receipt)
  const missionsDir = ctx.missionsDir || path.dirname(cwdOf(ctx));
  const writeFile = io.writeFile || ((p, c) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, c); });
  // appendQueue: children INSERT after the parent's queue line (position-inheritance,
  // gap #4) in tartib order — each child anchors on the previous insert; the first anchors
  // on the parent. Anchor-miss falls back to tail append. Only wired when ctx.autorunFile
  // is known; dependency-gated promotion stays M-ENGINE.QUEUE-FLOW.1's job.
  let lastAnchor = ctx.parentMissionFile ? `missions/${path.basename(ctx.parentMissionFile)}` : null;
  const appendQueue = io.appendQueue || (ctx.autorunFile
    ? (rel) => {
        try {
          const cur = readFileSync(ctx.autorunFile, 'utf8');
          writeFileSync(ctx.autorunFile, lastAnchor ? insertQueueLineAfter(cur, lastAnchor, rel) : `${cur.replace(/\n?$/, '\n')}${rel}  ${SPLIT_CHILD_MARKER}\n`);
          lastAnchor = rel;
        } catch { /* queue append best-effort; the file+manifest is the durable handoff */ }
      }
    : null);
  const out = emitSubMissions(plan, { missionsDir, parentMissionFile: ctx.parentMissionFile, parentId: plan.parentId }, { writeFile, appendQueue });
  return { ...plan, emission: out };
}
// tiny helper so missionsDir can default off the emit cwd without colliding with names.
function cwdOf(ctx) { return ctx.cwd || ctx.missionsDir || process.cwd(); }

export async function orchestrate(mission, cwd, {
  // PHASE 1 DEFAULT = the operator's locked BLIND PANEL (3 independent blind architects ->
  // Opus integrator synthesis; SEAT-PLAN-OPERATOR-ORIGINAL.md, wired 2026-06-15). It keeps
  // the single-architect deconstruct() as its built-in fallback (panel can't get >=2 plans /
  // integrator fails -> single architect) AND as its per-seat primitive. deconstructFn stays
  // INJECTABLE — every offline test that passes its own mock deconstructFn is unchanged.
  deconstructFn = deconstructPanel, implementFn = implementStep, repairFn = null, maxRepairs = 1,
  needsSearch = false, preflightFn = searxngPreflight, verdictFn = defaultVerdictPhase, witnessFn = defaultWitness,
  // MISSION-LEVEL SIZE CEILING (Hajj auto-split, MISSION_ARCHITECTURE.md). splitFn decides
  // whether the validated micro_queue is oversized and, if so, emits sub-missions + manifest.
  // Defaults to defaultSplitFn (real emit). missionsDir/parentMissionFile/autorunFile let the
  // daemon point the children at the real queue; absent -> files+manifest off cwd, no queue
  // append. sizeCeiling overrides the default ceiling (MUEZZIN_SIZE_CEILING env also works).
  splitFn = defaultSplitFn, missionsDir = null, parentMissionFile = null, autorunFile = null, sizeCeiling = undefined,
  // REPLAN ISOLATION (M-ENGINE.REPLAN-ISOLATION.1): K bounded SAME-STEP retries for a TRANSIENT
  // failure (a flaky empty emission / network blip) — a fresh dispatch of the failing step, with
  // state cleanup (rollback to the step's pre-attempt checkpoint) before each. After K, the STEP
  // fails with a receipt. A DEFECT never retries. 0 disables (every failure is terminal — the prior
  // behavior, so existing tests that assume one-shot halts are byte-unchanged). Env MUEZZIN_STEP_RETRIES.
  stepRetries = Number(process.env.MUEZZIN_STEP_RETRIES ?? 0),
} = {}) {
  // ---- MISSION CLASS (Foundation 0.4): parse ONCE. code-repo writes REAL files into a
  // declared REPO-ROOT (an EXISTING git repo), so writes/witness/commit/rollback all target
  // the REPO-ROOT — while the sandbox cwd still hosts events + diagnostics. research/sandbox
  // missions are unchanged: writeRoot === cwd, the prior behavior byte-for-byte.
  const mc = parseMissionClass(mission);
  const codeRepo = mc.class === 'code-repo';
  const repoRoot = mc.repoRoot;
  const allowFiles = mc.allowFiles || [];
  // COMMAND-CLASS VERBATIM (2026-06-18): an ops-deploy/command-class mission with a fenced shell
  // block + REPO-ROOT runs its commands VERBATIM from REPO-ROOT, bypassing the architect panel
  // (which is instructed to strip absolute paths -> corrupted mt-accounts-deploy-1 3x -> and
  // burns ~5min Opus/attempt). It uses writeRoot=repoRoot for the CWD but is NOT codeRepo, so the
  // containment/reset/commit block below stays SKIPPED (a deploy runs commands; it never
  // edits+commits tracked files). FAIL-OPEN: a parse miss leaves litCmd null and the normal
  // architect panel runs at PHASE 1 (current behavior, byte-for-byte).
  const litCmd = isCommandClassMission(mission) ? buildLiteralCommandQueue(mission) : null;
  const useLiteralCmd = !!(litCmd && litCmd.ok && repoRoot);
  const writeRoot = (codeRepo || useLiteralCmd) ? repoRoot : cwd;   // where the real code + witness/commit live

  // MISSION EVENTS SURFACE — declared HERE (before the sandbox/preflight block) so the
  // sandbox-recovery hook (abortInProgressGitOp) and any earlier phase can emit safely.
  // (Moved up 2026-07-02: it was declared below the sandbox block, so the sandbox-recovery
  // emit at PHASE -1 hit a TDZ — "Cannot access 'emit' before initialization" — the instant
  // it aborted a stale op, crashing exactly the contamination-recovery path it guards.)
  // Every phase appends one JSONL line to <cwd>/mission-events.jsonl; the daemon reads it.
  const emit = (e) => { try { appendFileSync(path.join(cwd, 'mission-events.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n'); } catch { /* events must never break the run */ } };

  // repairFn default is built HERE (not in the signature) so it can be made code-repo-aware:
  // the repair seat's write must route through the same kernel and target the REPO-ROOT.
  if (!repairFn) repairFn = makeRepairFn(writeRoot, codeRepo ? { codeRepo, repoRoot, allowFiles } : {});

  // ---- PHASE -1: SANDBOX / REPO ISOLATION.
  // sandbox/research: the mission cwd must be the root of its OWN git repo, or per-step
  // commits/rollbacks silently target a parent repo (gr10-rebuild canary, 2026-06-09).
  // code-repo: NEVER git-init the real project. Instead assertRepoRoot confirms REPO-ROOT
  // is an existing git toplevel and captures the baseline HEAD (so we can prove HEAD is
  // unchanged on a failed/rolled-back run). The sandbox cwd is STILL made a repo for the
  // events log + _prior-attempt diagnostics.
  let baselineHead = null;
  let baselineDirty = [];   // paths ALREADY dirty pre-mission (subtracted from the per-step drift guard so pre-existing off-allowlist dirt isn't charged to the mission)
  if (codeRepo) {
    const rr = assertRepoRoot(repoRoot);
    if (!rr.ok) return { ok: false, phase: 'sandbox', reason: `code-repo REPO-ROOT invalid: ${rr.error}`, steps: [] };
    baselineHead = rr.baseline;
    // RETRY OWN-OUTPUT RESET (spam-loop root fix, 2026-06-16): BEFORE the containment
    // pre-flight, clean the mission's OWN declared ALLOW-FILES back to committed truth. A
    // PRIOR attempt's per-step rollback uses `git checkout`, which restores a TRACKED
    // allow-file but CANNOT remove an UNTRACKED file the attempt CREATED (e.g. a new
    // d1/STATUS.md). That leftover made the pre-flight below refuse the mission's OWN retry
    // ("worktree not clean for declared ALLOW-FILES") -> FAILED x2 -> phone-spam loop. This
    // resets ONLY the mission's own allowlist (tracked => checkout HEAD; untracked-created =>
    // delete), so the retry starts clean. It NEVER touches foreign dirt — so genuinely-
    // foreign pre-existing dirt OUTSIDE the allowlist is still refused by the pre-flight, and
    // a mid-run off-allowlist write is still caught by the per-step drift guard. Approach (a)
    // (reset own dirt) chosen over (b) (re-classify own dirt as owned in the pre-flight)
    // because a retry must run against COMMITTED truth — an honest rewrite cannot legally
    // start from its own failed, un-witnessed draft (the same reason the sandbox archives
    // stale untracked leftovers to _prior-attempt/), and leaving the draft in place would
    // also poison the integrity guard's `prev` read.
    // SANDBOX RECOVERY (2026-07-02): clear any ABANDONED in-progress git op (cherry-pick/merge/
    // revert/rebase debris left by a dead prior attempt in the shared worktree) BEFORE the
    // per-allowlist reset — otherwise `git checkout -- <allow-file>` fails "path is unmerged"
    // and cascades a sandbox failure into every later mission (receipt: 13 mt-integrate missions
    // FAILED x2 on one abandoned cherry-pick). Safe: single-lane daemon => no legitimate
    // concurrent op at sandbox-setup time. HEAD is unchanged; only the dead op's state is dropped.
    const abrt = abortInProgressGitOp(repoRoot);
    if (abrt.ok && abrt.aborted) emit({ phase: 'sandbox', event: 'aborted-stale-git-op', op: abrt.aborted });
    const rst = resetAllowFiles(repoRoot, allowFiles);
    if (!rst.ok) return { ok: false, phase: 'sandbox', reason: `code-repo own-output reset failed: ${rst.error}`, steps: [] };

    // CONTAINMENT PRE-FLIGHT (baseline-gap fix, shape (b)): refuse at the boundary — cost-zero,
    // before the mission writes anything — if a declared ALLOW-FILES path is ALREADY dirty (the
    // mission can't cleanly own a file the worktree already modified). With the own-output reset
    // above, this now only ever fires on GENUINELY-FOREIGN dirt on an allow-file (something other
    // than the mission's own prior attempt modified it) — the correct, conservative refusal.
    // Pre-existing dirt OUTSIDE the allowlist does NOT block; it is captured as baselineDirty and
    // subtracted from the per-step drift guard so only NEW off-allowlist writes the mission
    // itself causes are flagged.
    const pf = preflightAllowlistClean(repoRoot, allowFiles);
    if (!pf.ok) return { ok: false, phase: 'sandbox', reason: `code-repo containment pre-flight: ${pf.error}`, steps: [] };
    baselineDirty = pf.baselineDirty || [];
  }
  const sandbox = ensureSandboxRepo(cwd);
  if (!sandbox.ok) return { ok: false, phase: 'sandbox', reason: `sandbox repo init failed: ${sandbox.error}`, steps: [] };

  // STALE-SANDBOX ARCHIVE (4a receipt 2026-06-11T11:07): a FAILED attempt's draft stays
  // on disk (rollback can't remove untracked files), so the NEXT attempt's integrity
  // guard reads it as `prev` and blocks any honest rewrite for "removing assertion
  // lines" (WEAKENED-VERIFICATION) — a retry can never legally rewrite its own failed
  // artifact. Each run therefore starts from COMMITTED truth: untracked leftovers move
  // to _prior-attempt/ (preserved for the operator — never deleted; a failed draft the
  // witnesses refused is still readable evidence), out of the guard's prev path.
  try {
    const porc = execSync('git status --porcelain', { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    const stale = porc.split(/\r?\n/).filter((l) => l.startsWith('?? ')).map((l) => l.slice(3).trim())
      // _checkpoint.json is the REPLAN-ISOLATION resume record — it MUST survive the sweep so a
      // re-entered run reads it and resumes past committed steps (sweeping it = re-run from step 1).
      .filter((p) => p && !p.startsWith('_prior-attempt') && p !== 'mission-events.jsonl' && p !== '_checkpoint.json');
    if (stale.length) {
      const dest = path.join(cwd, '_prior-attempt');
      mkdirSync(dest, { recursive: true });
      for (const rel of stale) { try { renameSync(path.join(cwd, rel.replace(/\/$/, '')), path.join(dest, rel.replace(/\/$/, '').replace(/[\\/]/g, '_'))); } catch { /* locked file: leave it */ } }
    }
  } catch { /* no porcelain = fresh sandbox; never block a run on hygiene */ }

  // ---- PHASE 0: SEARCH PRE-FLIGHT (daruriyyah harm gate, #25) — only for missions that declare a
  // dependence on the web (SOTA grounding, harm-research, citation). A BLIND search backend returns a
  // confident EMPTY answer the chain would read as "nothing found" rather than "couldn't look" — a harm
  // vector (Directive 1: a blind search is not truth). So a search mission REFUSES to start on a blind
  // backend. A degraded-but-usable backend (verdict OK, some engines rate-limited) passes. Skipped
  // entirely when !needsSearch — a code-only mission never pays for search it doesn't use.
  if (needsSearch) {
    let pf;
    try {
      pf = await preflightFn();
    } catch (e) {
      // A preflight that THROWS must fail SAFE: the gate enforces on its OWN call site the same never-crash
      // discipline the preflight imposes on the backend (a thrown error must not propagate and crash the run).
      return { ok: false, phase: 'preflight', reason: `preflight threw: ${e?.message || e}`, steps: [] };
    }
    // BLOCK on a non-OK verdict OR zero results regardless of verdict — defense-in-depth: a usable backend
    // can never legitimately report 0 results, so results===0 is blind even if a verdict were forged 'OK'.
    if (pf?.verdict !== 'OK' || pf?.results === 0) {
      return { ok: false, phase: 'preflight', reason: pf?.reason || 'search backend unusable', steps: [] };
    }
  }

  // (MISSION EVENTS SURFACE — `emit` moved up to before the sandbox block, ~line 563, so the
  // sandbox-recovery hook can use it without a TDZ; see the note there.)

  // RECURRING-ERROR DETECTION (2026-07-01 receipt): a live mission tonight hit the IDENTICAL
  // raw error text 12 times across ~55 minutes -- witness-halt, seat-escalate-exhausted, full
  // replan, repeat -- because the error was an INFRASTRUCTURE crash (a bug in an unrelated
  // engine file, reached via a transitive import), not a content defect any amount of
  // re-authoring could fix. The escalation ladder and replan loop both behaved correctly by
  // their own design (bounded retries, clean failure) but neither has any way to recognize
  // "this exact failure has already happened, re-authoring will not change it" -- that
  // pattern was only caught because a human happened to grep the event log by hand. This
  // reads the mission's own event history (same file `emit` writes to, persists across
  // replans within one daemon attempt) and flags when an error text repeats, so the signal
  // surfaces in the receipt itself instead of requiring someone to notice a stuck mission.
  // Counts only 'step-failed' events -- the single canonical "this step terminally
  // failed" event per logical failure. 'witness-halt'/'heal'/etc. carry the SAME error
  // text for the SAME underlying failure (multiple events, one occurrence) -- counting
  // every event type double/triple-counted a single failure as 2-3 "occurrences" before
  // any genuine repeat had even happened. Must be called BEFORE emitting this call's own
  // 'step-failed' line, or it counts itself too.
  // FALSE-NEGATIVE FIX (2026-07-01 receipt): the original version returned 0 unconditionally
  // whenever errorText was empty after trimming -- which is NOT rare, it's the MOST COMMON
  // failure shape in production. execReceipt-backed failures (engine-exec, witness-halt) pass
  // `String(receipt.out || '')` as the error, and receipt.out is legitimately empty for many
  // real command failures (e.g. `exit 1` with no stdout/stderr). Verified live: one mission
  // (b13-sitemap-prune-cf-limits) alone has 131 empty-text engine-exec failures + 169
  // empty-text witness failures, ZERO ever flagged recurring, across 16 total missions
  // hitting this exact pattern -- the detector shipped hours earlier tonight was blind to its
  // own most common case. Fixed: when text is empty, fall back to counting prior step-failed
  // events that are ALSO empty-text AND share the same `reason` (engine-exec vs witness vs
  // emission-empty, etc.) -- the only signal still available once the text itself is gone.
  // STEP-SCOPING FIX (red-team review of the early-exit design, 2026-07-01): the match was
  // MISSION-WIDE, never filtered by e.step even though every 'step-failed' event already
  // carries `step: step.step_index`. That is a real cross-step false-positive: the witness-flag
  // halt path (below, ~L1035) emits a CONSTANT literal ('witness REJECT unrepaired') for every
  // unrepaired witness REJECT regardless of the actual content defect, so two UNRELATED steps
  // that each independently hit one witness REJECT would count toward the SAME recurring streak
  // just because the literal text matches byte-for-byte. On a multi-step mission (the normal
  // case) that is not a coincidence risk, it is a structural certainty. Scoping by stepIndex
  // preserves the intended signal (the SAME step recurring across daemon replans/requeues,
  // which share this mission's cwd and therefore this same event log) while closing the
  // cross-step conflation. See the STEP-SCOPING self-test below for the exact failure this fixes.
  function countPriorOccurrences(errorText, reason, stepIndex) {
    // VOLATILE-TOKEN NORMALIZATION (2026-07-03, caught same-day by the RECURRING-ERROR
    // selftest): execReceipt's diagnostic now carries per-run values (elapsed=Nms, temp
    // .ps1 names) — identical failures stopped being byte-identical, silently killing
    // recurrence detection. Normalize BOTH sides before comparing; the full detail stays
    // in the receipt itself.
    const normalize = (t) => String(t || '')
      .replace(/elapsed=\d+ms\/\d+ms/g, 'elapsed=X')
      .replace(/muezzin-step-[\w-]+\.ps1/g, 'muezzin-step-X.ps1')
      .trim().slice(0, 160);
    const needle = normalize(errorText);
    const emptyTextFallback = !needle;
    try {
      const raw = readFileSync(path.join(cwd, 'mission-events.jsonl'), 'utf8');
      let count = 0;
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (e.event !== 'step-failed') continue;
          if (e.step !== stepIndex) continue;   // STEP-SCOPED: never conflate a different step's failure, even on identical error text
          const evText = normalize(e.error);
          if (emptyTextFallback) {
            if (!evText && e.reason === reason) count++;
          } else if (evText && evText === needle) count++;
        } catch { /* skip a malformed line, never crash the count */ }
      }
      return count;
    } catch { return 0; }
  }

  // ---- PHASE 1: PLAN (diagDir: failed plan attempts persist their raw architect output)
  emit({ phase: 'plan', event: 'start' });
  // COMMAND-CLASS: run the operator's verbatim fenced commands AS the queue — no LLM re-plan
  // (skips the abs->rel path corruption + the ~5min Opus panel). Fail-open: useLiteralCmd is false
  // unless buildLiteralCommandQueue parsed a fenced block + REPO-ROOT, so every other mission
  // falls through to deconstructFn exactly as before.
  let plan;
  if (useLiteralCmd) {
    emit({ phase: 'plan', event: 'literal-command-queue', step_count: litCmd.queue.steps.length });
    plan = { ok: true, queue: litCmd.queue, _panel: false, _literal: true, attempts: 1 };
  }
  if (!plan) plan = await deconstructFn(mission, { diagDir: path.join(path.dirname(cwd), '_logs', 'diag', path.basename(cwd)) }); // diag scratch OUT of the mission worktree (2026-06-30 containment fix); PER-MISSION subdir (2026-07-02): the shared dir was overwritten every run, so a plan-empty-emission mission's raw architect/integrator output was unrecoverable — blocking root-cause of the 5-mission plan-failure class. path.basename(cwd) = the mission stem; every diag writer already mkdir-recursives (git_steps/deconstructor 268+487), so the subdir is created safely.
  if (!plan?.ok) { emit({ phase: 'plan', event: 'failed', attempts: plan?.attempts, errors: plan?.errors }); return { ok: false, phase: 'plan', errors: plan?.errors || ['deconstruct failed'], steps: [] }; }
  // PLAN provenance (blind panel vs single-architect fallback): surface which path produced
  // the queue so the conductor's report shows whether the 3-blind panel ran or it fell back.
  emit({ phase: 'plan', event: 'ok', attempts: plan.attempts, model: plan._model, provider: plan._provider,
    panel: plan._panel === true, architects: plan._architects, grounded: plan._grounded, fallback: plan._fallback,
    step_count: plan.queue.steps.length, step_titles: plan.queue.steps.map(s => `${s.step_index}:${String(s.description).slice(0, 60)}`) });
  const queue = plan.queue;

  // ---- PHASE 1.5: MISSION-LEVEL SIZE CEILING + AUTO-SPLIT (Hajj architecture,
  // MISSION_ARCHITECTURE.md L7/L10-11/L18/L33 — DESIGNED but never wired until now). The
  // micro-action ceiling (deconstructor) already proved each STEP is single-file; this gate
  // asks the SEPARATE, higher question: is the WHOLE micro_queue too large for one mission to
  // carry without overwhelming the chain (the 16-step corpus failure)? If so, the mission is
  // SPLIT into coherent tartib sub-missions BEFORE any seat executes a step — the parent is
  // marked SPLIT (NOT run), the children flow to the queue. UNDER the ceiling this is a no-op
  // and execution proceeds BYTE-IDENTICALLY to before (the critical fallback). splitFn is
  // injectable; defaultSplitFn does the real emit. (Disable the gate via sizeCeiling:Infinity.)
  {
    const split = splitFn(mission, queue, { sizeCeiling }, { cwd, missionsDir, parentMissionFile, autorunFile });
    if (split?.fail) {
      // OVER ceiling but the decomposition could NOT be split into valid sub-missions ->
      // FAIL with a NAMED receipt. Never silently run the oversized monolith.
      emit({ phase: 'split', event: 'split-failed', step_count: queue.steps.length, reason: split.reason });
      return { ok: false, phase: 'split', reason: split.reason, steps: [] };
    }
    if (split?.split) {
      // EMISSION SELF-CHECK FAILED (2026-06-16): emitSubMissions ran each generated child
      // through the SAME lintMission the daemon fires and ABORTED because a child would be
      // MIQAT-REFUSED. That is a GENERATOR bug, not a shippable split — FAIL with a named
      // receipt (never write children the daemon will refuse-loop on, the live phone-spam bug).
      if (split.emission && split.emission.ok === false) {
        emit({ phase: 'split', event: 'split-emission-invalid', step_count: queue.steps.length, reason: split.emission.reason });
        return { ok: false, phase: 'split', reason: split.emission.reason, steps: [] };
      }
      // SPLIT: the parent is decomposed into sub-missions and is NOT executed. The children
      // are emitted as mission files + a manifest (and queued in tartib when an autorun file
      // is known). The conductor/daemon picks them up; the parent's own run ends here as SPLIT.
      const sub = (split.emission?.files || []).map((f) => ({ id: f.id, file: f.rel, requires: f.predecessorId, steps: f.steps }));
      emit({ phase: 'split', event: 'split', step_count: queue.steps.length, ceiling: split.ceiling,
        sub_missions: sub.map((s) => `${s.id} (${s.steps} steps${s.requires ? `, requires ${s.requires}` : ''})`),
        manifest: split.emission?.manifestPath || null, queued: split.emission?.queued || [] });
      return { ok: true, phase: 'split', split: true, parent: split.parentId, ceiling: split.ceiling,
        originalStepCount: queue.steps.length, subMissions: sub,
        manifest: split.emission?.manifestPath || null, queued: split.emission?.queued || [], steps: [] };
    }
    // split:false -> fall through to the UNCHANGED execution path below (byte-identical).
  }

  const steps = [];
  // CROSS-RUN PREV SCOPE (4a receipt 2026-06-11 12:10, the COMMITTED variant of the
  // stale-sandbox trap): the integrity guard's WEAKENED-VERIFICATION check exists to
  // catch a step tampering with content written EARLIER IN THIS RUN. A file committed
  // by a PREVIOUS (failed) run is not this run's baseline — comparing against it makes
  // an honest re-authoring "remove assertion lines" from a draft the witnesses already
  // refused. prev is therefore non-empty ONLY for targets this run has already written.
  const writtenThisRun = new Set();

  // CODE-REPO PATH HELPERS (Foundation 0.4): reads + git ops happen in writeRoot (the real
  // repo for code-repo, else the sandbox cwd). target_files may be absolute or repo-relative
  // for code-repo — normalize to a single on-disk read and to repo-relative paths for git.
  const onDisk = (t) => (codeRepo ? path.resolve(writeRoot, t) : path.join(writeRoot, t));
  const readTarget = (t) => { try { return existsSync(onDisk(t)) ? readFileSync(onDisk(t), 'utf8') : ''; } catch { return ''; } };
  const gitFiles = (files) => (files || []).map((t) => (codeRepo ? path.relative(writeRoot, path.resolve(writeRoot, t)) : t));

  // ---- CHECKPOINT RESUME (REPLAN ISOLATION step 1): on a re-entered run (the daemon's
  // clean-pass attempt-2), the previous run's committed steps live in the sandbox repo and
  // are recorded in _checkpoint.json. SKIP those step indices instead of re-running them —
  // the completed work is preserved, the mission resumes from where it stopped. Only steps
  // proven committed (sha present) are skipped; engine-exec (non-idempotent: append/POST) is
  // NEVER skipped (re-running it is unsafe — laguna finding 3), so it always re-executes.
  const cp = readCheckpoint(cwd, queue.mission_id);
  const resumeDone = new Map((cp?.completed || []).filter((d) => d.sha && !d.engineExec).map((d) => [d.step, d]));
  if (resumeDone.size) emit({ phase: 'resume', event: 'checkpoint', completed: [...resumeDone.keys()] });

  // ---- PHASE 2: IMPLEMENT + VERIFY, one step at a time
  for (const step of queue.steps) {
    // RESUME: a step already committed by a prior run is carried forward, NOT re-run. Its
    // artifact + commit persist in the sandbox; we re-attach its receipt so the verdict phase
    // sees a witnessed deed (the daemon-restart resume the spec demands — completed steps survive).
    // TRUST-BOUNDARY CHECK (2026-06-30 receipt): a checkpoint's sha is NEVER trusted blind — verify
    // it actually touched its claimed target(s) first. Real failure this closes: a checkpoint
    // recorded a step as committed at a sha that belonged to a completely unrelated commit (the
    // repo's HEAD at checkpoint-write time, not this step's own deed) — readCheckpoint only checked
    // mission_id, so the resume silently skipped real work for two full mission attempts while the
    // claimed target file never received its intended change. A failed check falls through to the
    // normal step-execution path below — the step actually runs instead of being skipped on faith.
    const resumed = resumeDone.get(step.step_index);
    if (resumed && commitTouchesFiles(writeRoot, resumed.sha, resumed.targets || [])) {
      emit({ phase: 'step', event: 'resumed', step: step.step_index, sha: resumed.sha });
      const rTarget = (resumed.targets || [])[0];
      if (rTarget) writtenThisRun.add(rTarget);
      steps.push({ step: step.step_index, ok: true, sha: resumed.sha, repaired: 0, targets: resumed.targets || [], resumed: true });
      continue;
    }
    if (resumed) emit({ phase: 'step', event: 'resume-rejected', step: step.step_index, sha: resumed.sha, reason: 'checkpoint sha does not touch its claimed target files — re-running for real' });

    // SAME-STEP RETRY LOOP (REPLAN ISOLATION step 2+4): a TRANSIENT failure (flaky empty
    // emission / network) re-attempts THIS step a bounded `stepRetries` times — a fresh
    // dispatch, distinct from a content repair — with state cleanup first. A DEFECT, or the
    // retries exhausted, FAILS THE STEP with a receipt (the loop's failStep() decides). The
    // loop NEVER restarts from step 1: completed steps stay committed; only the failing step
    // re-runs. stepRetries:0 -> the loop body runs exactly once (prior one-shot behavior).
    const target = step.target_files?.[0];
    let stepResult = null;   // set by failStep when the step is terminally failed
    let stepDone = false;    // set true on the success path so the outer loop advances (not retries)

    // FRONTIER-SEAT ESCALATION (HOLE 2 closure, 2026-06-17): a struggling substantial step used to
    // DIE on a local coder (badalSelect only bounces among local coders that emit broken code /
    // fabricated prose) — so substantial-authoring missions never COMPLETED. Operator ruling: Claude
    // sonnet/opus seats are ALLOWED and budget-strategic; escalation local->sonnet->opus is SANCTIONED
    // (foreign-frontier APIs OUTSIDE Ollama remain FORBIDDEN — the ladder is Claude-family only via the
    // sanctioned `claude` CLI transport, recognized by seat_dispatch's CLAUDE_MODELS set). BOUNDED +
    // ONLY-ON-FAILURE: tier 0 is the normal default (badal/prose-floor picks the seat); we step UP the
    // ladder ONLY when a tier TERMINALLY fails with a SUBSTANTIAL class (emission-empty, witness-flag,
    // runtime-verify, integrity, fabricated-citation, witness, containment-drift). A TRANSIENT never
    // escalates (it retries in place). We SKIP a ladder rung equal to the seat the floor already used
    // (no double-escalation with the prose->sonnet floor). Gated to EDIT steps (command/verify run
    // via execReceipt — no seat to escalate).
    //
    // DEFAULT = OFF (opt-in), grounded in governance + substrate:
    //   (1) Escalation to a Claude seat SPENDS budget — a deliberate cost the conductor/daemon ARMS
    //       per the two-budget ruling (substantial/input-heavy missions ride the flat Claude plan),
    //       not a silent default every mission pays.
    //   (2) Byte-for-byte preservation: OFF => the per-step loop behaves EXACTLY as before, so every
    //       existing REPLAN/dispatch-count test stays green (no committed-test mutation).
    // ARM IT: MUEZZIN_SEAT_ESCALATION=on (the daemon sets it for substantial-authoring missions).
    const ESCALATION_SUBSTANTIAL = new Set(['emission-empty', 'witness-flag', 'witness', 'runtime-verify', 'integrity', 'fabricated-citation', 'containment-drift']);
    const escalationOn = process.env.MUEZZIN_SEAT_ESCALATION === 'on' && step.action_type === 'edit';
    const SEAT_LADDER = ['sonnet', 'opus'];           // Claude-family only (sanctioned CLI transport); strictly capability-ascending
    let escTier = 0;                                  // 0 = default seat; >=1 indexes SEAT_LADDER
    let escModel = null;                              // forced executor/repair model for the current tier (null = default badal/prose-floor)
    let lastFailReason = null;                        // captured from failStep so the escalation gate can see the class
    let lastFailError = null;                          // captured from failStep so the escalation gate can read the DIAGNOSIS (R1: a structural SPLIT-NEEDED/EMISSION-TRUNCATED emission-empty must NOT escalate)
    // TIMEOUT-ESCALATION (2026-07-03): bumped ONLY when an engine-exec receipt says TIMEOUT-SUSPECTED,
    // so the retry gets a doubled cap (execTimeoutMs) instead of burning every attempt against the same
    // 120s wall (qc-hardening.S1.S1 receipt: e2e runner ETIMEDOUT x3 at 120579/120000ms). A step whose
    // authored command carries the literal `# LONG-RUN` marker STARTS at tier 2 (mission-pinned known-long
    // work, e.g. the 620s dual-viewport live e2e) instead of climbing there two burned attempts later.
    let execTimeoutTier = isLongRunCmd(step.validation_command) ? 2 : 0;
    // re-entrant: the outer escalation loop re-runs the WHOLE same-step attempt block on a higher tier.
    escalate: for (;;) {
    // build a tier-scoped repair seat so a forced escalation also lifts the repair attempts onto the
    // escalated model (the repair seat IS the badal author; on a frontier tier it must be the frontier).
    const tierRepairFn = escModel
      ? makeRepairFn(writeRoot, { model: escModel, ...(codeRepo ? { codeRepo, repoRoot, allowFiles } : {}) })
      : repairFn;
    for (let stepAttempt = 0; stepAttempt <= stepRetries; stepAttempt++) {
    // STATE CLEANUP BEFORE A RETRY (REPLAN ISOLATION step 5, laguna finding #1): a prior
    // transient attempt may have left half-written/dirty state. Roll the target back to its
    // last-good checkpoint (the sandbox HEAD) before re-attempting — never retry onto dirty state.
    if (stepAttempt > 0) {
      rollbackStep(writeRoot, gitFiles(step.target_files));
      emit({ phase: 'step', event: 'step-retry', step: step.step_index, attempt: stepAttempt, of: stepRetries });
    }
    // failStep: the SINGLE failure exit for a step. Classifies transient vs defect; a transient
    // with retries left signals { retry:true } (the for-loop re-attempts after rollback); else it
    // records the failed step + sets stepResult to the terminal orchestrate return value. It never
    // full-re-plans — orchestrate has no internal re-plan; a defect simply fails the step.
    const failStep = (reason, error, extra = {}) => {
      const cls = classifyStepFailure(reason, error);
      lastFailReason = reason;   // ESCALATION GATE reads this after the inner loop to decide local->sonnet->opus
      lastFailError = error ? String(error) : '';   // R1: the gate reads the DIAGNOSIS to skip escalation on a structural (SPLIT-NEEDED/EMISSION-TRUNCATED) emission-empty
      if (cls === 'transient' && stepAttempt < stepRetries) {
        emit({ phase: 'step', event: 'step-transient', step: step.step_index, reason, attempt: stepAttempt, error: String(error || '').slice(0, 160) });
        return { retry: true };
      }
      const priorOccurrences = countPriorOccurrences(error, reason, step.step_index);   // BEFORE this call's own step-failed emit, or it counts itself; STEP-SCOPED (see countPriorOccurrences)
      const recurring = priorOccurrences >= 2;   // this failure (3rd+ time) recurring, not a fresh content miss
      emit({ phase: 'step', event: 'step-failed', step: step.step_index, reason, class: cls, attempts: stepAttempt + 1, error: String(error || '').slice(0, 200) });
      if (recurring) {
        emit({ phase: 'step', event: 'recurring-error-suspect', step: step.step_index, priorOccurrences, error: String(error || '').slice(0, 200) });
      }
      steps.push({ step: step.step_index, ok: false, reason, error: error ? String(error).slice(0, 300) : undefined, failureClass: cls, stepAttempts: stepAttempt + 1, ...(recurring ? { recurringError: true, priorOccurrences } : {}), ...extra });
      stepResult = { ok: false, phase: 'verify', stoppedAt: step.step_index, steps };
      return { retry: false };
    };
    const prev = writtenThisRun.has(target) ? readTarget(target) : '';

    // ENGINE-EXECUTED STEPS (improvement #0, landed 2026-06-10 evening): 'command' and
    // 'verify' steps run via execReceipt — the muezzin's OWN deed — never via an executor
    // seat. Seats can only emit text; dispatching them to fetch/list/check produced empty
    // artifacts that the (correct) witness rejected — the single failure class behind all
    // 7 mission failures on 2026-06-10. Trust surface is unchanged: execReceipt already
    // runs planner-authored validation_commands for every step today.
    if (step.action_type === 'command' || step.action_type === 'verify') {
      emit({ phase: 'step', event: 'engine-exec', step: step.step_index, desc: String(step.description).slice(0, 80), cmd: String(step.validation_command).slice(0, 120), ...(execTimeoutTier ? { timeoutTier: execTimeoutTier } : {}) });
      // NO automatic retry (laguna witness finding 3, 2026-06-10): a non-idempotent
      // command (append, POST) must never silently run twice on partial success. A
      // failure fails the mission honestly; the daemon's attempt-2 re-runs the WHOLE
      // mission in a clean pass, which is the safe retry boundary.
      // code-repo: command/verify steps run in the REAL repo (writeRoot), not the sandbox.
      // NEW-FILE COMMIT-HOLLOW FIX (2026-06-17, receipt: migrate-partners-1 04:41 "Step 4 commit
      // receipt is HOLLOW ... partners.html was never staged"): a planner-authored `git commit`
      // command never stages a NEW untracked allow-file (raw `git commit`/`-a` skip untracked
      // paths), so the file renders correctly but the commit is empty -> Done-means unmet -> FAILED.
      // The edit path stages via commitStep; give the command path the same floor by staging the
      // declared allow-files first. Scoped to commit commands so a non-commit verify step's
      // working-tree assertions are untouched; stageFiles is idempotent and skips missing paths.
      if (codeRepo && allowFiles.length && /\bgit\s+commit\b/.test(String(step.validation_command || ''))) {
        // CONFLICT GATE (M-COMMIT-CONFLICT-GATE, 2026-07-02) — the TRUE root cause the session
        // chased: a `git cherry-pick`/merge that CONFLICTED leaves conflict markers in an
        // allow-file, and if the conflicting command's non-zero exit was MASKED (a ';'-chained
        // pwsh line — execReceipt trusts one process exit code, seat_dispatch.mjs:175), the
        // mission reaches THIS commit and commits the CONFLICTED file. Receipt: commit 1539e66
        // committed map.html carrying `<<<<<<< HEAD ... >>>>>>> 880c311` markers + a duplicated
        // <body>, shipping a broken production map (mission-events.jsonl:6 logged the CONFLICT as
        // exit:0). This scans each declared allow-file for a git conflict opener BEFORE staging and
        // refuses to stage/commit if any is found (fail-closed) — preventing the corruption at the
        // SOURCE, where the integrity-guard rules (4/5) only caught its output after the fact.
        const conflicted = [];
        for (const rel of gitFiles(allowFiles)) {
          try {
            const p = path.resolve(writeRoot, rel);
            if (existsSync(p) && hasConflictMarkers(readFileSync(p, 'utf8'))) conflicted.push(rel);
          } catch { /* unreadable here -> other guards handle */ }
        }
        if (conflicted.length) {
          emit({ phase: 'step', event: 'commit-conflict-block', step: step.step_index, files: conflicted });
          failStep('integrity', `COMMIT-CONFLICT: unresolved git conflict markers in ${conflicted.join(', ')} — refusing to stage/commit a conflicted file (a cherry-pick/merge conflict was left unresolved, its exit code masked). Resolve the conflict, then commit.`);
          break;
        }
        const st = stageFiles(writeRoot, gitFiles(allowFiles));
        emit({ phase: 'step', event: 'pre-commit-stage', step: step.step_index, staged: st.staged ?? 0, ok: st.ok, error: st.ok ? undefined : String(st.error || '').slice(0, 160) });
      }
      const receipt = execReceipt(step.validation_command, writeRoot, { timeoutTier: execTimeoutTier });
      if (!receipt.ok) {
        if (/TIMEOUT-SUSPECTED/.test(String(receipt.out || ''))) execTimeoutTier++;   // next attempt rides a doubled cap (900s ceiling in execTimeoutMs)
        emit({ phase: 'step', event: 'engine-exec-fail', step: step.step_index, exit: receipt.exit, error: String(receipt.out || '').slice(0, 200) });
        const d = failStep('engine-exec', String(receipt.out || ''));
        if (d.retry) continue;
        break;   // terminal: stepResult set; leave the attempt loop, the outer code returns it
      }
      // audit trail (witness finding 4): what ran and what it printed, in the mission's event log
      emit({ phase: 'step', event: 'engine-exec-ok', step: step.step_index, exit: receipt.exit, out: String(receipt.out || '').slice(0, 200) });
      // CHERRY-PICK COMPLETION (2026-07-02): a command step that ran `git cherry-pick` (often -x)
      // and let git auto-resolve leaves the worktree mid-pick with the deliverable STAGED but
      // UNCOMMITTED — no step runs --continue, so the mission's own feature never lands AND the
      // mid-pick contaminates the next mission. Finalize a RESOLVED pick that stays WITHIN the
      // declared allow-files; fail-closed (never auto-commit to a deploying repo) on
      // unmerged / conflict-markers / out-of-allowlist. Receipt: 8+ mt-integrate missions, 2026-07-02.
      if (codeRepo) {
        const fin = completeResolvedPickIfAny(writeRoot, allowFiles);
        if (fin.ok && fin.continued) {
          emit({ phase: 'step', event: 'pick-continued', step: step.step_index, op: fin.continued });
        } else if (fin.ok && fin.blocked === 'out-of-allowlist') {
          emit({ phase: 'step', event: 'pick-continue-blocked', step: step.step_index, reason: 'out-of-allowlist', files: fin.offAllow });
          failStep('integrity', `PICK-CONTAINMENT: a cherry-pick staged file(s) OUTSIDE the declared ALLOW-FILES (${(fin.offAllow || []).join(', ')}) — refusing to auto-commit a pick broader than the mission's scope. Narrow the pick or widen ALLOW-FILES.`);
          break;
        } else if (fin.ok && fin.blocked === 'markers') {
          emit({ phase: 'step', event: 'pick-continue-blocked', step: step.step_index, reason: 'markers', files: fin.offAllow });
          failStep('integrity', `PICK-CONFLICT: a staged file carries unresolved conflict markers — refusing to finalize a falsely-resolved cherry-pick. Resolve the conflict cleanly, then commit.`);
          break;
        }
        // blocked:'unmerged' or continued:null -> leave as-is; the step's own logic / later gates handle it
      }
      // RECEIPT-BODY SURFACING (ENGINE-RELIABILITY-DIAGNOSIS.md §4.2, false-green fix B): carry
      // the command + its OUTPUT onto the step so the phase-3 verdict panel SEES the body, not
      // just the produced files. The d1-1 hollow green was provable INSIDE these greens (step-1
      // out = "num_tables": 0; step-8 out = "True" on a 0-row query) but nothing surfaced them to
      // the panel. We keep a larger tail (500) than the 200-char event-log emit above so the panel
      // gets enough to judge; the verdict framing re-caps and bounds the whole block.
      steps.push({ step: step.step_index, ok: true, target, engineExec: true, execCmd: String(step.validation_command || ''), execOut: String(receipt.out || '').slice(-500) });
      stepDone = true; break;   // no executor dispatch, no integrity guard, no model witness — advance
    }

    emit({ phase: 'step', event: 'implement', step: step.step_index, desc: String(step.description).slice(0, 80), target });
    // code-repo: pass the kernel containment params so the executor writes INTO the repo,
    // resolving via resolveRepoTarget. sandbox/research: writes to cwd as before.
    // escModel (set on an escalated tier) FORCES the executor seat: a forced model skips badal/prose-floor
    // and uses exactly the escalated Claude seat. tier 0 (escModel null) is the prior default behavior.
    const implOpts = { ...(codeRepo ? { codeRepo, repoRoot, allowFiles } : {}), ...(escModel ? { model: escModel } : {}) };
    const impl = await implementFn(step, cwd, implOpts);  // executor writes the target file
    if (escModel) emit({ phase: 'step', event: 'seat-escalated-dispatch', step: step.step_index, tier: escTier, model: escModel });
    // emission track record (badal feed): the real executor returns its model; mocks don't.
    const emissionSeat = impl?.model || null;
    const seatRecPath = path.join(path.dirname(cwd), '_logs', 'seat-record.json');
    const recEmission = (outcome) => { if (emissionSeat) try { recordSeatOutcome(seatRecPath, emissionSeat, 'emission', outcome); } catch { } };
    if (impl?.escalated) emit({ phase: 'step', event: 'badal-escalation', step: step.step_index, model: emissionSeat });
    let cur = readTarget(target);   // let, NOT const: refreshed after a citation repair (const here crashed studio 15:02 + context-compression 01:12 with 'Assignment to constant variable')

    // EMISSION-EMPTY HEAL (CLASS 2): a failed/empty executor emission (impl.ok===false —
    // no usable fenced content, SPLIT-NEEDED, EMISSION-TRUNCATED, intent-header, or a
    // containment refusal) used to fall THROUGH silently: no file was written, so the
    // integrity guard / execReceipt below saw an absent target and the witness path
    // burned BOTH repair rounds learning nothing. Convert it into a retryable, diagnosed
    // heal: surface impl.error as a receipt, then drive the repair seat (the badal — its
    // absent-target path AUTHORS the missing file) up to maxRepairs, re-reading after
    // each. If a usable artifact is authored we fall through to the normal integrity ->
    // witness -> commit path (so this never double-fires with the receipt-heal loop:
    // the file EXISTS before any execReceipt runs). If still empty, HALT with a distinct
    // reason 'emission-empty' carrying the diagnostic — never a silent fall-through.
    if (!impl?.ok) {
      const diag = String(impl?.error || 'executor emitted no usable artifact').slice(0, 400);
      emit({ phase: 'step', event: 'emission-empty', step: step.step_index, error: diag });
      let healed = 0;
      while (!cur.trim() && healed < maxRepairs) {
        healed++;
        emit({ phase: 'step', event: 'emission-empty-heal', step: step.step_index, attempt: healed });
        await tierRepairFn(step, { ok: false, out: 'EXECUTOR EMITTED NO USABLE ARTIFACT — ' + diag + ' Author the COMPLETE target file now from the step description and its context dependencies.' });
        cur = readTarget(target);
      }
      if (!cur.trim()) {   // no usable artifact after repair (or no repairs allowed) → classify: transient empty-emission RETRIES the step; a structural defect (SPLIT-NEEDED etc.) fails with a receipt
        recEmission('miss');
        rollbackStep(writeRoot, gitFiles(step.target_files));
        emit({ phase: 'step', event: 'emission-empty-halt', step: step.step_index, error: diag, repaired: healed });
        const d = failStep('emission-empty', diag, { repaired: healed });
        if (d.retry) continue;   // TRANSIENT (empty emission) — fresh dispatch of THIS step (after rollback above + the loop's pre-attempt cleanup)
        break;                   // DEFECT or retries exhausted — stepResult set, the outer code returns it
      }
      // a repair authored a usable file — fall through to the normal integrity -> witness
      // -> commit path below (the file now exists, so execReceipt validates real bytes).
    }

    // integrity-guard the edit BEFORE trusting any witness (#36)
    const integ = checkReceiptIntegrity(step, prev, cur, step.validation_command);
    if (!integ.ok) {
      rollbackStep(writeRoot, gitFiles(step.target_files));
      emit({ phase: 'step', event: 'integrity-block', step: step.step_index, violations: integ.violations?.map(v => String(v).slice(0, 120)) });
      failStep('integrity', (integ.violations || []).join('; '), { violations: integ.violations });  // always a DEFECT (judged real content) — never a same-step retry
      break;
    }

    // CITATION GUARD (deterministic, #engine-batch): a backtick-quoted filename the seat
    // cites but that exists in neither the sandbox nor its declared inputs is a FABRICATED
    // source — the failure class that survived to the quality bar (4a invented
    // `1. Market & User.txt`). Code, not a prompt: route into the SAME repair path as a
    // witness flag (one scoped attempt, then halt). Edit/command artifacts only; gather
    // (command-only, no target) steps already skipped above.
    if (step.action_type === 'edit' && cur && maxRepairs >= 0) {
      const allowed = collectAllowedBasenames(writeRoot, step);
      // mt-preexisting-content-guard: filterQuotedMentions (below) deliberately excludes the
      // step's own target_files from its content scan — a step must never use its BRAND-NEW,
      // uncommitted claim as self-evidence for itself. That guard over-reached: it also blinded
      // the checker to a target file's OWN pre-existing, unrelated content that was already
      // real before this edit touched the file (receipt: a pre-existing selftest fixture a few
      // lines from an edit target, false-flagged nine times across three models because it
      // happens to look like a filename). Captured ONCE here, before any repair rewrites the
      // file, from each target's committed HEAD revision — never the working-tree content this
      // edit just produced, which would defeat the self-reference guard's real purpose. A
      // target with no HEAD revision (new/untracked) simply contributes no pre-edit text.
      const preEditTexts = (step.target_files || []).map((t) => {
        try {
          return execSync(`git show HEAD:"${String(t).replace(/\\/g, '/')}"`, { cwd: writeRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
        } catch {
          return '';
        }
      });
      // quoted-mention second pass (census class): a name present inside a file the seat
      // HAD is a reported mention, not a fabricated cite. The artifact itself is excluded
      // so it can never self-exempt.
      let fabricated = filterPreExistingContent(filterQuotedMentions(writeRoot, findFabricatedCitations(cur, allowed), { exclude: step.target_files || [] }), preEditTexts);
      let citeRep = 0;
      while (fabricated.length && citeRep < maxRepairs) {
        citeRep++;
        emit({ phase: 'step', event: 'citation-flag', step: step.step_index, attempt: citeRep, fabricated: fabricated.slice(0, 8) });
        await tierRepairFn(step, { ok: false, out: 'FABRICATED CITATIONS — you referenced files that do not exist in your sandbox or declared inputs: ' + fabricated.join(', ') + '. Cite ONLY files you actually have; remove or replace these.' });
        fabricated = filterPreExistingContent(filterQuotedMentions(writeRoot, findFabricatedCitations(readTarget(target), collectAllowedBasenames(writeRoot, step)), { exclude: step.target_files || [] }), preEditTexts);
      }
      if (fabricated.length) {
        recEmission('fabrication');                        // badal feed: invented citations strike the emission seat x3
        rollbackStep(writeRoot, gitFiles(step.target_files));
        emit({ phase: 'step', event: 'citation-halt', step: step.step_index, fabricated: fabricated.slice(0, 8), repaired: citeRep });
        failStep('fabricated-citation', fabricated.join(', '), { fabricated, repaired: citeRep });  // DEFECT — fabricated content, never a same-step retry
        break;
      }
      if (citeRep) cur = readTarget(target);   // a repair rewrote the file; downstream witness must see it
    }

    // GROUNDEDNESS GATE (Granite Guardian 4.1, NON-BLOCKING + fail-soft, 2026-06-14): the
    // semantic companion to the citation guard above. citation_guard catches fabricated
    // FILE cites; this catches fabricated CONTENT claims (invented values/versions/stats)
    // that have NO mechanical oracle (seat_record.mjs:66-72 — caught today only by the
    // probabilistic witness). Runs ONLY on content steps that staged sources to check
    // against. It SURFACES a flag into the event log; it does NOT halt — a new probabilistic
    // gate must earn the right to block (promotion to a repair-trigger is a later,
    // evidence-backed step). Disable: MUEZZIN_GUARDIAN=off.
    if (process.env.MUEZZIN_GUARDIAN !== 'off' && step.action_type === 'edit' && cur && step.context_dependencies?.length) {
      const ctxText = step.context_dependencies.map((d) => readMaybe(writeRoot, d)).filter(Boolean).join('\n\n').slice(0, 8000);
      if (ctxText.trim()) {
        const g = await checkGroundedness(ctxText, cur);
        if (g.ran && g.grounded === false)
          emit({ phase: 'step', event: 'groundedness-flag', step: step.step_index, note: String(g.raw).slice(0, 220) });
      }
    }

    // witness the deed, with one scoped repair attempt before halt (SOTA #32).
    // code-repo: the validation_command runs in the REAL repo (writeRoot).
    let receipt = execReceipt(step.validation_command, writeRoot);
    let repaired = 0;
    while (!receipt.ok && repaired < maxRepairs) {
      repaired++;
      emit({ phase: 'step', event: 'heal', step: step.step_index, attempt: repaired, error: String(receipt.out || '').slice(0, 120) });
      await tierRepairFn(step, receipt);
      receipt = execReceipt(step.validation_command, writeRoot);
    }

    // PER-STEP WITNESS (phase-2): runs only once the deterministic floor passed. A
    // REJECT routes into the SAME heal path as a failed receipt (rollback + halt if
    // unrepaired); a witness dispatch ERROR is logged and ignored (floor already held).
    let stepFailedInWitness = false;   // set when a witness REJECT fails the step inside the try (a break from inside the catch-guarded block is fragile — guard after it)
    if (receipt.ok && witnessFn) {
      try {
        // STAGE THE CITATION SOURCES (CLASS 1, witness-wall fix): build the same source
        // text the artifact cites from the step's context_dependencies (the pattern the
        // groundedness gate uses ~403), bounded to ~8000 chars, and hand it to the witness
        // so it can RESOLVE `[file Lnn]` citations instead of flagging every one blind.
        const witnessSources = (step.context_dependencies || [])
          .map((d) => readMaybe(writeRoot, d)).filter(Boolean).join('\n\n').slice(0, 8000);
        const w = await witnessFn(step, writeRoot, cur, witnessSources);
        const flagged = w && (w.verdict === 'REJECT' || w.verdict === 'BLOCK') && !w._failed;
        if (flagged) {
          emit({ phase: 'step', event: 'witness-flag', step: step.step_index, findings: (w.findings || []).map(f => String(f.description || f).slice(0, 100)) });
          let cleared = false;
          let witnessRepaired = 0;   // CLASS 1 step 6: the REAL witness-repair attempt count (distinct from the receipt-heal `repaired`)
          // re-staged sources also go INTO the repair so a flagged claim can be RE-SOURCED
          // (repair.mjs never re-staged sources before — a flagged citation could not be cured).
          const repairSources = witnessSources ? `\n\n--- STAGED SOURCES (re-source each flagged claim against these) ---\n${witnessSources}\n--- END STAGED SOURCES ---\nRe-source each flagged claim against the STAGED SOURCES below; if a claim cannot be sourced, remove it or mark it explicitly unverified — do not re-assert it.` : '';
          for (let wrep = 0; wrep < maxRepairs && !cleared; wrep++) {
            witnessRepaired++;
            await tierRepairFn(step, { ok: false, out: 'witness flagged: ' + (w.findings || []).map(f => f.description).join('; ') + repairSources });
            const recheck = await witnessFn(step, writeRoot, readTarget(target), witnessSources);
            cleared = !recheck || recheck._failed || (recheck.verdict !== 'REJECT' && recheck.verdict !== 'BLOCK');
          }
          if (!cleared) {   // unrepaired (or no repairs allowed) → DEFECT (a content REJECT that survived repair), fail the step — never a same-step retry, never a full re-plan
            recEmission('miss');                         // badal feed
            rollbackStep(writeRoot, gitFiles(step.target_files));
            // CLASS 1 step 6: emit the REAL witness-repair count, not the misleading receipt-heal `repaired`.
            emit({ phase: 'step', event: 'witness-halt', step: step.step_index, error: 'witness REJECT unrepaired', repaired, witnessRepaired });
            failStep('witness-flag', 'witness REJECT unrepaired', { repaired, witnessRepaired });
            stepFailedInWitness = true;
          }
        }
      } catch (e) { emit({ phase: 'step', event: 'witness-skip', step: step.step_index, error: String(e?.message || e).slice(0, 100) }); }
    }
    if (stepFailedInWitness) break;   // a witness REJECT failed the step (DEFECT) — stepResult is set; do NOT fall through to commit

    // RUNTIME-VERIFY GATE (HOLE 1 closure, 2026-06-17): the deterministic receipt + the model
    // witness can BOTH pass on an artifact that does not actually LOAD — `node --check` only PARSES
    // (it exits 0 on `import x from 'node:fetch'`), and a content witness judges prose, not a live
    // import. This RUNS the artifact (code: a bounded sandbox dynamic-import that executes a
    // non-exporting CLI far enough to surface a load/init throw; HTML: jsdom runScripts; JSON:
    // parse) BEFORE the step is committed/blessed. A definitive load/parse/init throw fails the
    // step CLOSED and routes through the SAME scoped repair-then-halt path as a witness REJECT; a
    // genuine inability to verify (unknown type, sandbox couldn't start, jsdom absent) fails OPEN
    // (never a false block). Kill switch: MUEZZIN_RUNTIME_VERIFY=off. Only on edit artifacts that
    // produced a target (command/verify steps already returned above and have no file to load).
    if (receipt.ok && step.action_type === 'edit' && target && cur && cur.trim()) {
      let rv = await runtimeVerify(onDisk(target), cur);
      let rtvRepaired = 0;
      while (rv && rv.ok === false && rtvRepaired < maxRepairs) {
        rtvRepaired++;
        emit({ phase: 'step', event: 'runtime-verify-fail', step: step.step_index, attempt: rtvRepaired, error: String(rv.error || '').slice(0, 80), detail: String(rv.detail || '').slice(0, 200) });
        await tierRepairFn(step, { ok: false, out: `RUNTIME-VERIFY FAILED — the artifact does not load/run: ${rv.error}: ${rv.detail}. The file passed a parse check but THROWS when actually imported/loaded. Fix the cause (unresolvable import, init-time throw, or invalid JSON/HTML) and emit the complete corrected file.` });
        cur = readTarget(target);
        rv = await runtimeVerify(onDisk(target), cur);
      }
      if (rv && rv.ok === false) {   // still broken after repair (or no repairs) → DEFECT: never commit a non-loading artifact
        recEmission('miss');
        rollbackStep(writeRoot, gitFiles(step.target_files));
        emit({ phase: 'step', event: 'runtime-verify-halt', step: step.step_index, error: String(rv.error || '').slice(0, 80), detail: String(rv.detail || '').slice(0, 200), repaired: rtvRepaired });
        failStep('runtime-verify', `${rv.error}: ${rv.detail}`, { runtimeVerify: rv.error, runtimeVerifyRepaired: rtvRepaired });   // DEFECT — never a same-step transient retry
        break;
      }
      if (rtvRepaired) emit({ phase: 'step', event: 'runtime-verify-recovered', step: step.step_index, repaired: rtvRepaired });
    }

    if (receipt.ok) {
      // CONTAINMENT-DRIFT HALT (Foundation 0.4): a code-repo step may dirty ONLY its declared
      // ALLOW-FILES. If anything else in the repo is now dirty, the step touched something
      // outside the allowlist (a generated file, a moved config) — a containment breach.
      // Roll the step's own files back and HALT before committing the drift into the real repo.
      if (codeRepo) {
        const drift = assertCleanOutsideAllowlist(writeRoot, allowFiles, baselineDirty);
        if (!drift.ok && drift.dirty?.length) {
          recEmission('miss');
          rollbackStep(writeRoot, gitFiles(step.target_files));
          emit({ phase: 'step', event: 'containment-drift', step: step.step_index, dirty: drift.dirty.slice(0, 12) });
          failStep('containment-drift', (drift.dirty || []).join(', '), { dirty: drift.dirty });  // DEFECT — touched files outside the allowlist; never a same-step retry
          break;
        }
      }
      // DOC-SHRINKAGE FLOOR (2026-07-02, judge-ruled chain fix): an executor re-emission that
      // silently DESTROYS most of an existing file (7b41014: DISASTER-RECOVERY 375->108;
      // 649edc7: EMAIL-REDACTION 305->179 — gutted, committed, DONE'd) must FAIL the step, not
      // become substrate. Plan-time guards can't see emission size; only the commit layer can.
      {
        const shrink = assertNoUndeclaredShrinkage(writeRoot, gitFiles(step.target_files), step.description);
        if (!shrink.ok) {
          recEmission('miss');
          rollbackStep(writeRoot, gitFiles(step.target_files));
          emit({ phase: 'step', event: 'undeclared-shrinkage', step: step.step_index, violations: shrink.violations.slice(0, 6) });
          failStep('undeclared-shrinkage', shrink.violations.map((v) => `${v.file} ${v.oldLines}->${v.newLines} lines`).join(', '), { violations: shrink.violations });  // DEFECT — partial re-emission destroying substrate; never a same-step retry
          break;
        }
      }
      recEmission('pass');                               // badal feed: a committed, witnessed step is the seat's own Hajj
      // code-repo: commit ONLY the explicit allowlisted (repo-relative) files — NEVER '.'.
      const c = commitStep(writeRoot, `${step.step_index}: ${String(step.description).slice(0, 60)}`, gitFiles(step.target_files));
      if (!c.ok) emit({ phase: 'step', event: 'commit-failed', step: step.step_index, error: String(c.error || '').slice(0, 150) });  // never silent (fb-backlog receipt: a sha-less step starved the verdict receipts)
      writtenThisRun.add(target);
      emit({ phase: 'step', event: 'committed', step: step.step_index, sha: c.sha, repaired });
      // store repo-relative targets for code-repo so the verdict phase reads them against
      // writeRoot correctly (an absolute target would break readMaybe's path.join).
      steps.push({ step: step.step_index, ok: true, sha: c.sha, repaired, targets: codeRepo ? gitFiles(step.target_files) : step.target_files });
      // CHECKPOINT (REPLAN ISOLATION step 1): record the now-committed steps so a re-entered
      // run RESUMES past them. Written AFTER the commit so a checkpoint never claims a step the
      // sandbox can't prove. Best-effort — a checkpoint failure never breaks the run.
      writeCheckpoint(cwd, queue.mission_id, steps);
      stepDone = true; break;   // step succeeded — leave the attempt loop, outer loop advances to the next step
    } else {
      recEmission('miss');                               // badal feed: an unrepaired witness failure is an ordinary miss
      rollbackStep(writeRoot, gitFiles(step.target_files));   // surgical rollback, never advance past a failed step
      emit({ phase: 'step', event: 'witness-halt', step: step.step_index, error: String(receipt.out || '').slice(0, 150), repaired });
      // a failed validation_command after repairs: TRANSIENT (network/timeout in the output) ->
      // retry the step; DEFECT (a real validation failure) -> fail the step with a receipt.
      const d = failStep('witness', String(receipt.out || ''), { repaired });
      if (d.retry) continue;
      break;
    }
    }  // end same-step retry loop
    // SUCCESS: the step committed on this tier — leave the escalation loop too (advance to next step).
    if (stepDone) break escalate;

    // FRONTIER-SEAT ESCALATION DECISION (HOLE 2): the inner loop terminally failed (stepResult set).
    // If escalation is on, the failure is a SUBSTANTIAL class, and a strictly-more-capable ladder rung
    // remains (skipping any rung equal to a seat the floor already used this step), step UP one rung and
    // re-run the WHOLE attempt block on that seat. Bounded by SEAT_LADDER length; never re-fires a tier.
    // Anything else (transient already exhausted, non-substantial defect, ladder exhausted, escalation
    // off) falls through to the contained failure return — the prior behavior, byte-for-byte at tier 0.
    // R1 STRUCTURAL-SPLIT GUARD (2026-06-17): an 'emission-empty' whose DIAGNOSIS carries a
    // SPLIT-NEEDED / EMISSION-TRUNCATED marker is an OVERSIZED step, not a capability shortfall —
    // escalating it to sonnet+opus wastes Claude budget on a monolith too big for ANY single seat
    // (the higher seats recur the same overflow). Such a failure routes to SPLIT (the daemon/conductor
    // re-plans it as part-files) and DIES here as a contained split-needed defect rather than climbing
    // the ladder. A plain capability-shortfall emission-empty (no structural marker) STILL escalates.
    const structuralSplit = lastFailReason === 'emission-empty' && isStructuralSplitDefect(lastFailError);
    if (structuralSplit && escalationOn && stepResult) {
      emit({ phase: 'step', event: 'seat-escalate-skip', step: step.step_index, reason: 'structural-split-needed', detail: String(lastFailError || '').slice(0, 160) });
    }
    if (escalationOn && stepResult && !structuralSplit && ESCALATION_SUBSTANTIAL.has(lastFailReason)) {
      // determine the seat the just-finished tier actually used (tier 0 = the prose-floor / default badal):
      const usedSeat = escModel || (isProseTarget(target) ? 'sonnet' : null);
      // find the next ladder rung strictly above the current tier that is NOT the seat already used.
      let next = null, nextTier = escTier;
      for (let i = escTier; i < SEAT_LADDER.length; i++) {
        if (SEAT_LADDER[i] !== usedSeat) { next = SEAT_LADDER[i]; nextTier = i + 1; break; }
        nextTier = i + 1;   // skip a rung equal to the used seat (no double-escalation), keep climbing
      }
      if (next) {
        emit({ phase: 'step', event: 'seat-escalate', step: step.step_index, from: usedSeat || 'default-local', to: next, reason: lastFailReason, tier: nextTier });
        escModel = next;
        escTier = nextTier;
        stepResult = null;            // clear the contained failure — we are re-attempting on a higher seat
        rollbackStep(writeRoot, gitFiles(step.target_files));   // clean state before the escalated re-author
        continue escalate;
      }
      emit({ phase: 'step', event: 'seat-escalate-exhausted', step: step.step_index, reason: lastFailReason, topTier: escTier });
    }

    // The attempt loop exits via: stepDone (handled above), or a terminal failStep (stepResult set —
    // return the contained failure). It NEVER restarts from step 1; only THIS step re-ran on a transient
    // or escalated tier. A defect, exhausted retries, or exhausted ladder fails JUST this step.
    if (stepResult) return stepResult;
    if (!stepDone) {
      // defensive: the loop ended without success and without a terminal stepResult (should be
      // unreachable — every path sets one or the other). Fail the step honestly, never silently pass.
      emit({ phase: 'step', event: 'step-loop-exhausted', step: step.step_index, attempts: stepRetries + 1 });
      steps.push({ step: step.step_index, ok: false, reason: 'step-retry-exhausted', stepAttempts: stepRetries + 1 });
      return { ok: false, phase: 'verify', stoppedAt: step.step_index, steps };
    }
    break escalate;   // unreachable in practice (stepDone handled above); a definite loop exit for safety
    }  // end escalation loop (label: escalate)
  }
  // ---- BUILD GATE (HOLE 1 closure, 2026-06-17): a final whole-mission runtime floor BEFORE the
  // adversarial panel can bless the work. Per-step runtime-verify (above) catches a step that does
  // not load AT THE TIME it is written; this re-verifies EVERY committed code/HTML/JSON artifact
  // still loads now — catching a cross-step breakage (a later step's edit invalidates an earlier
  // artifact) that no single per-step check sees. A definitive load throw FAILS the mission CLOSED
  // before the panel runs (deeds-not-claims: the panel must never APPROVE an artifact that does not
  // run). Fail-OPEN per artifact is silent (unknown type / unverifiable). Kill: MUEZZIN_RUNTIME_VERIFY=off.
  if (process.env.MUEZZIN_RUNTIME_VERIFY !== 'off') {
    const builtTargets = [...new Set(steps.filter((s) => s.ok && !s.engineExec).flatMap((s) => s.targets || []))]
      .filter((t) => /\.(mjs|c?js|html?|json)$/i.test(String(t)));
    for (const t of builtTargets) {
      const bytes = readTarget(t);
      if (!bytes || !bytes.trim()) continue;   // an absent/empty committed target is a separate (upstream) concern
      const rv = await runtimeVerify(onDisk(t), bytes);
      if (rv && rv.ok === false) {
        emit({ phase: 'verdict', event: 'build-gate-fail', target: t, error: String(rv.error || '').slice(0, 80), detail: String(rv.detail || '').slice(0, 200) });
        return { ok: false, phase: 'build-gate', reason: `build gate: committed artifact does not load (${t}): ${rv.error}: ${String(rv.detail || '').slice(0, 160)}`, steps };
      }
    }
    if (builtTargets.length) emit({ phase: 'verdict', event: 'build-gate-ok', artifacts: builtTargets.length });
  }

  // ---- PHASE 3: ADVERSARIAL VERIFY (model seats judge the artifacts vs the mission; see defaultVerdictPhase)
  emit({ phase: 'verdict', event: 'start' });
  let verdict;
  try {
    // code-repo: the artifacts the panel judges live in the REAL repo (writeRoot).
    verdict = await verdictFn(mission, writeRoot, steps);
  } catch (e) {
    // fail SAFE: a crashed verdict phase is not an APPROVE (absence is not agreement)
    emit({ phase: 'verdict', event: 'threw', error: String(e?.message || e).slice(0, 150) });
    return { ok: false, phase: 'verdict', reason: `verdict phase threw: ${e?.message || e}`, steps };
  }
  // OBSERVABILITY (2026-06-16): persist each disposition's REASON, not just seat:verdict — a BLOCK
  // with no recorded reason is unauditable (muddytires-d1-healthcheck-1 BLOCKED with the reason
  // computed in mergeVerdicts but dropped here, so the conductor could not tell calibration from
  // a structural false-block without reading the engine source).
  emit({ phase: 'verdict', event: 'done', consensus: verdict?.consensus, dispositions: verdict?.dispositions?.map((d) => d.reason ? `${d.seat}:${d.verdict} — ${String(d.reason).slice(0, 200)}` : `${d.seat}:${d.verdict}`) });
  // VISUAL WITNESS receipt (advisory, non-blocking — see defaultVerdictPhase): logged to
  // mission-events.jsonl regardless of whether the mission reaches DONE, since a mid-run
  // FAILED mission's visual receipt is still worth having.
  if (verdict?.visualWitness) {
    emit({ phase: 'verdict', event: 'visual-witness', ok: verdict.visualWitness.ok, verdict: verdict.visualWitness.verdict, blocking_findings: verdict.visualWitness.blocking_findings });
  }
  // GRADUATED EXPIATION: APPROVE_WITH_DAMM completes the mission AND banks its wajib
  // gaps as receipted compensating tasks in the damm queue (missions/_logs/damm-queue.json,
  // drained by conductor beats). The gap is follow-up work, not total loss.
  if (verdict?.consensus === 'APPROVE_WITH_DAMM') {
    try {
      const dq = path.join(path.dirname(cwd), '_logs', 'damm-queue.json');
      const cur = existsSync(dq) ? JSON.parse(readFileSync(dq, 'utf8')) : { entries: [] };
      for (const d of (verdict.damm || [])) cur.entries.push({ mission: path.basename(cwd), finding: d.description || d.id, from: d.from, ts: new Date().toISOString(), repaid: false });
      mkdirSync(path.dirname(dq), { recursive: true });
      writeFileSync(dq, JSON.stringify(cur, null, 2));
    } catch (e) { emit({ phase: 'verdict', event: 'damm-write-failed', error: String(e?.message || e).slice(0, 120) }); }
    emit({ phase: 'done', event: 'mission-complete', steps: steps.length, consensus: 'APPROVE_WITH_DAMM', damm: (verdict.damm || []).length });
    return { ok: true, phase: 'done', steps, verdict: { consensus: verdict.consensus, dispositions: verdict.dispositions, damm: verdict.damm, visualWitness: verdict.visualWitness } };
  }
  if (verdict?.consensus !== 'APPROVE') {
    const findings = (verdict?.contracts || []).flatMap((c) => c?.findings || []).slice(0, 10);
    return { ok: false, phase: 'verdict', reason: `verify consensus ${verdict?.consensus || 'none'}`, findings, steps };
  }

  emit({ phase: 'done', event: 'mission-complete', steps: steps.length, consensus: 'APPROVE' });
  return { ok: true, phase: 'done', steps, verdict: { consensus: verdict.consensus, dispositions: verdict.dispositions, visualWitness: verdict.visualWitness } };
}

// --------------------------------------------------------------------------- self-test (offline, real git)
if (process.argv[1]?.endsWith('orchestrate.mjs')) {
  process.env.MUEZZIN_GUARDIAN = 'off';   // offline selftest: never dispatch the live groundedness model
  const { tmpdir: _hbTmp } = await import('node:os');
  const { join: _hbJoin } = await import('node:path');
  process.env.MUEZZIN_HB_FILE = _hbJoin(_hbTmp(), 'muezzin-selftest-hb.log');   // selftest execReceipt fixtures must NEVER write the production heartbeat the STUCK-TASK decision reads (2026-07-03 receipt: gate-run exec-start lines interleaved with the live lane)
  const { execSync } = await import('node:child_process');
  const fs = await import('fs'); const os = await import('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch_test_'));
  const git = (c) => execSync(`git ${c}`, { cwd: dir, stdio: 'pipe' });
  git('init -q'); git('config user.email t@t.local'); git('config user.name t');
  // --no-verify on the sandbox seed too: the global pre-commit hook (laguna Ollama review) would
  // otherwise fire on this throwaway commit and hang the whole self-test (see git_steps.commitStep).
  fs.writeFileSync(path.join(dir, 'seed'), 'x'); git('add -A'); git('commit -q --no-verify -m init');

  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  // COMMIT-CONFLICT gate detection (M-COMMIT-CONFLICT-GATE) — the exact 1539e66 map.html shape.
  ck(hasConflictMarkers('<div>ok</div>\n<<<<<<< HEAD\n<body>a</body>\n=======\n<body>b</body>\n>>>>>>> 880c311 (feat)\n') === true, 'CONFLICT-GATE: content with a `<<<<<<< ` git conflict opener -> detected');
  ck(hasConflictMarkers('<!doctype html><html><body><div id="map"></div></body></html>') === false, 'CONFLICT-GATE: clean HTML -> not flagged');
  ck(hasConflictMarkers('# Heading\n=======\nsome body text\n') === false, 'CONFLICT-GATE: markdown `=======` underline (no `<<<<<<< ` opener) -> NOT a false positive');
  ck(hasConflictMarkers('') === false && hasConflictMarkers(null) === false, 'CONFLICT-GATE: empty/null -> false (never throws)');

  // STRUCTURAL FALSE-BLOCK REGRESSION (2026-06-16): a command/verify step that the engine ran
  // (ok + engineExec, no commit sha) MUST yield a witnessed receipt — else the deeds-not-claims
  // rule force-blocks every all-command mission's APPROVE (muddytires-d1-healthcheck-1).
  {
    const r1 = engineReceiptsFromSteps([{ step: 2, ok: true, engineExec: true, execCmd: 'wrangler d1 execute ...' }]);
    ck(r1.length === 1 && r1[0].ok === true, 'command/verify step (engineExec, no sha) yields ONE witnessed receipt');
    const r2 = engineReceiptsFromSteps([{ step: 1, ok: true, sha: 'abc123' }]);
    ck(r2.length === 1 && /commit abc123/.test(r2[0].ref), 'edit step (commit sha) still yields its receipt unchanged');
    const r3 = engineReceiptsFromSteps([{ step: 1, ok: false, engineExec: true }, { step: 2, engineExec: true }]);
    ck(r3.length === 0, 'a FAILED command step (ok:false) yields NO receipt — deeds-not-claims intact');
  }

  // mock PLAN: a 2-step mission. mock IMPLEMENT: write valid code to the target.
  const queue = { mission_id: 'M', steps: [
    { step_index: 1, description: 'write a', action_type: 'edit', target_files: ['a.mjs'], context_dependencies: [], validation_command: 'node -c a.mjs' },
    { step_index: 2, description: 'write b', action_type: 'edit', target_files: ['b.mjs'], context_dependencies: [], validation_command: 'node -c b.mjs' },
  ] };
  const mockPlan = async () => ({ ok: true, queue });
  const mockImpl = async (step) => fs.writeFileSync(path.join(dir, step.target_files[0]), `export const v = ${step.step_index};\n`);
  // offline verdict stubs (phase 3): real default dispatches model seats — never in a selftest.
  const approveVerdict = async () => ({ consensus: 'APPROVE', dispositions: [{ seat: 'validator', verdict: 'APPROVE' }, { seat: 'auditor', verdict: 'APPROVE' }], contracts: [] });
  const reviseVerdict = async () => ({ consensus: 'REVISE', dispositions: [{ seat: 'auditor', verdict: 'REVISE' }], contracts: [{ seat: 'auditor', verdict: 'REVISE', findings: [{ id: 'F1', severity: 'med', description: 'artifact misses done-means' }] }] });
  const okWitness = async () => ({ verdict: 'APPROVE', findings: [] });        // phase-2 per-step witness stub (real one dispatches a model)
  const flagWitness = async () => ({ verdict: 'REJECT', findings: [{ id: 'W1', description: 'unsupported claim' }] });

  // artifactFilesFor (card-merge 08:27 receipt: command-only missions embedded ZERO
  // artifacts → panel BLOCK on absent text). Targets win when present; otherwise the
  // sandbox's .md files are the artifacts, newest first; underscore-prefixed excluded.
  {
    const adir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
    fs.writeFileSync(path.join(adir, 'staged-half.md'), 'half');
    fs.writeFileSync(path.join(adir, '_prior.md'), 'old');
    fs.writeFileSync(path.join(adir, 'assembled-card.md'), 'card');
    fs.utimesSync(path.join(adir, 'staged-half.md'), new Date(Date.now() - 60000), new Date(Date.now() - 60000));
    ck(JSON.stringify(artifactFilesFor([{ ok: true, targets: ['x.md'] }], adir)) === '["x.md"]',
      'artifactFilesFor: explicit step targets win unchanged');
    const fb = artifactFilesFor([{ ok: true }], adir);
    ck(fb[0] === 'assembled-card.md' && fb.includes('staged-half.md') && !fb.includes('_prior.md'),
      'artifactFilesFor: command-only fallback = sandbox .md files, newest first, _-prefixed excluded (the card-merge BLOCK class)');
    fs.rmSync(adir, { recursive: true, force: true });
  }

  const happy = await orchestrate('mission text', dir, { deconstructFn: mockPlan, implementFn: mockImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: async () => ({ verdict: 'APPROVE', findings: [] }) });
  ck(happy.ok === true && happy.phase === 'done', 'happy path: PLAN -> implement+witness each step -> verdict APPROVE -> done');
  ck(happy.steps.length === 2 && happy.steps.every((s) => s.ok && s.sha), 'both steps witnessed + committed (have shas)');
  ck(fs.readFileSync(path.join(dir, 'a.mjs'), 'utf8').includes('v = 1'), 'step 1 implemented + committed');
  ck(happy.verdict?.consensus === 'APPROVE', 'verdict consensus carried in the result');

  // ENGINE-EXECUTED command step (#0): the engine runs it itself; the executor is NEVER
  // dispatched for it (a throwing implementFn proves it); its output file exists after.
  const cmdQueue = { mission_id: 'MC', steps: [
    { step_index: 1, description: 'fetch input into sandbox', action_type: 'command', target_files: ['fetched.txt'], context_dependencies: [], validation_command: "Set-Content -Path fetched.txt -Value 'engine-fetched'" },
    { step_index: 2, description: 'author from input', action_type: 'edit', target_files: ['c.mjs'], context_dependencies: ['fetched.txt'], validation_command: 'node -c c.mjs' },
  ] };
  const neverForCommands = async (step) => { if (step.action_type !== 'edit') throw new Error('EXECUTOR DISPATCHED FOR COMMAND STEP'); return mockImpl(step); };
  const cmd = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: cmdQueue }), implementFn: neverForCommands, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
  ck(cmd.ok === true && cmd.steps[0]?.engineExec === true, 'command step ENGINE-executed (no seat dispatch), mission completes');
  ck(fs.readFileSync(path.join(dir, 'fetched.txt'), 'utf8').includes('engine-fetched'), 'command step actually produced its file');
  // a FAILING command step halts the mission with the real error, never a fake artifact.
  const badCmd = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: { mission_id: 'MB', steps: [{ step_index: 1, description: 'doomed', action_type: 'command', target_files: [], context_dependencies: [], validation_command: 'Get-Item C:\\does\\not\\exist-xyz' }] } }), implementFn: neverForCommands, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
  ck(badCmd.ok === false && badCmd.steps[0]?.reason === 'engine-exec', 'failing command step halts with engine-exec reason (no fake artifact)');

  // COMMAND-CLASS VERBATIM (2026-06-18): an ops-deploy mission with a fenced shell block runs its
  // commands VERBATIM and bypasses the architect panel ENTIRELY — proven by a deconstructFn that
  // THROWS (if the panel ran, the mission would error). The command runs from REPO-ROOT, and the
  // verbatim line (absolute paths preserved) is what executes.
  const ccMission = [
    'MISSION-CLASS: ops-deploy', 'MISSION-ID: M-CC.PROOF', `REPO-ROOT: ${dir}`,
    'Steps:', '```sh', "Set-Content -Path cc-proof.txt -Value 'verbatim-ran'", '```',
  ].join('\n');
  const panelThrows = async () => { throw new Error('ARCHITECT PANEL MUST NOT RUN FOR COMMAND-CLASS'); };
  const cc = await orchestrate(ccMission, dir, { deconstructFn: panelThrows, implementFn: neverForCommands, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
  ck(cc.ok === true && cc.phase === 'done', 'command-class: VERBATIM queue runs, architect PANEL BYPASSED (throwing deconstructFn never hit)');
  ck(fs.existsSync(path.join(dir, 'cc-proof.txt')) && fs.readFileSync(path.join(dir, 'cc-proof.txt'), 'utf8').includes('verbatim-ran'), 'command-class: the verbatim fenced command actually RAN from REPO-ROOT');
  // FAIL-OPEN: a command-class mission with NO fenced block falls back to the panel (deconstructFn IS called).
  let panelWasCalled = false;
  const ccNoBlock = await orchestrate('MISSION-CLASS: ops-deploy\nMISSION-ID: M-NB\nREPO-ROOT: ' + dir + '\nno fenced block here', dir, { deconstructFn: async () => { panelWasCalled = true; return { ok: true, queue: { mission_id: 'M-NB', steps: [{ step_index: 1, description: 'w', action_type: 'edit', target_files: ['nb.mjs'], context_dependencies: [], validation_command: 'node -c nb.mjs' }] } }; }, implementFn: mockImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
  ck(panelWasCalled === true && ccNoBlock.ok === true, 'command-class FAIL-OPEN: no fenced block -> the normal panel (deconstructFn) IS used');

  // PHASE 3 gate: a REVISE consensus FAILS the mission with findings (non-APPROVE never reaches done).
  const revised = await orchestrate('mission text', dir, { deconstructFn: async () => ({ ok: true, queue: { mission_id: 'MR', steps: [{ step_index: 1, description: 'w', action_type: 'edit', target_files: ['r.mjs'], context_dependencies: [], validation_command: 'node -c r.mjs' }] } }), implementFn: mockImpl, maxRepairs: 0, verdictFn: reviseVerdict, witnessFn: okWitness });
  ck(revised.ok === false && revised.phase === 'verdict' && revised.findings?.length === 1, 'verdict REVISE -> mission FAILS at phase verdict with findings surfaced');

  // PHASE 2 per-step witness: a REJECT with no repairs left HALTS the step (rollback, never advances).
  const wflag = await orchestrate('mission text', dir, { deconstructFn: async () => ({ ok: true, queue: { mission_id: 'MW', steps: [{ step_index: 1, description: 'w', action_type: 'edit', target_files: ['w.mjs'], context_dependencies: [], validation_command: 'node -c w.mjs' }] } }), implementFn: mockImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: flagWitness });
  ck(wflag.ok === false && wflag.steps[0]?.reason === 'witness-flag', 'per-step witness REJECT (no repairs) HALTS the step before commit');
  // witness DISPATCH error must NOT block a good step (deterministic floor already held).
  const werr = await orchestrate('mission text', dir, { deconstructFn: async () => ({ ok: true, queue: { mission_id: 'ME', steps: [{ step_index: 1, description: 'w', action_type: 'edit', target_files: ['we.mjs'], context_dependencies: [], validation_command: 'node -c we.mjs' }] } }), implementFn: mockImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: async () => { throw new Error('witness model down'); } });
  ck(werr.ok === true && werr.phase === 'done', 'witness dispatch ERROR is ignored (floor holds) — good step still commits');

  // ---- CLASS 2 EMISSION-EMPTY HEAL (additive): a failed/empty executor emission
  // (impl.ok===false) no longer falls silently through to a witness halt. (a) with no
  // repairs it HALTs with the distinct reason 'emission-empty' carrying the diagnostic;
  // (b) a repairFn that AUTHORS a valid file lets the step advance to commit/done.
  {
    const eeQueue = { mission_id: 'MEE', steps: [{ step_index: 1, description: 'author card', action_type: 'edit', target_files: ['ee.mjs'], context_dependencies: [], validation_command: 'node -c ee.mjs' }] };
    const emptyImpl = async () => ({ ok: false, error: 'seat produced NO usable file content (0 fenced block(s) seen, largest 0 chars) — refusing to write an empty artifact' });
    // (a) no repairs → diagnosed halt (no file ever written, reason 'emission-empty')
    const eeHalt = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: eeQueue }), implementFn: emptyImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
    ck(eeHalt.ok === false && eeHalt.phase === 'verify' && eeHalt.steps[0]?.reason === 'emission-empty', 'CLASS 2: an empty executor emission (impl.ok=false) HALTS with reason emission-empty (no silent fall-through)');
    ck(/NO usable file content/.test(eeHalt.steps[0]?.error || ''), 'CLASS 2: the emission-empty halt carries the executor diagnostic (NO usable file content)');
    ck(!fs.existsSync(path.join(dir, 'ee.mjs')), 'CLASS 2: nothing was written for the empty emission');
    // (b) maxRepairs:1 + a repairFn that authors a valid file → the step advances to done.
    const authorRepair = async (step) => fs.writeFileSync(path.join(dir, step.target_files[0]), 'export const healed = 1;\n');
    const eeHeal = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: eeQueue }), implementFn: emptyImpl, repairFn: authorRepair, maxRepairs: 1, verdictFn: approveVerdict, witnessFn: okWitness });
    ck(eeHeal.ok === true && eeHeal.phase === 'done', 'CLASS 2: emission-empty heal — a repair that AUTHORS the file lets the step advance to done');
    ck(fs.readFileSync(path.join(dir, 'ee.mjs'), 'utf8').includes('healed = 1'), 'CLASS 2: the healed file holds the repair seat\'s authored content');
  }

  // ---- CLASS 1 WITNESS-WALL FIX (additive): the per-step witness now receives the staged
  // citation sources (4th arg, built from context_dependencies). (a) a citation RESOLVABLE
  // in the staged sources is treated as verified (witness APPROVEs, step advances);
  // (b) the witness-halt event carries a nonzero witnessRepaired when a repair runs.
  {
    // a real source file the artifact will cite; the orchestrator stages it for the witness.
    // COMMIT it first: the stale-sandbox archive (top of orchestrate) sweeps UNTRACKED
    // files into _prior-attempt/, so an uncommitted dep would vanish before the step runs
    // (in production, deps are committed command-step outputs or pre-existing tracked files).
    fs.writeFileSync(path.join(dir, 'src-notes.md'), 'L1: the metric is 42 requests/sec\nL2: confirmed in benchmark\n');
    git('add src-notes.md'); git('commit -q --no-verify -m src-notes');
    const c1Queue = { mission_id: 'MC1', steps: [{ step_index: 1, description: 'author from notes', action_type: 'edit', target_files: ['c1.md'], context_dependencies: ['src-notes.md'], validation_command: 'node -e "0"' }] };
    const c1Impl = async (s) => fs.writeFileSync(path.join(dir, s.target_files[0]), '# Card\nThroughput is 42 req/s [src-notes.md L1].\n');
    // (a) a witness that VERIFIES when the cited value is present in the staged sources.
    let sawSources = null;
    const resolvingWitness = async (_step, _cwd, _artifact, sources) => {
      sawSources = sources;
      return sources && sources.includes('42 requests/sec') ? { verdict: 'APPROVE', findings: [] } : { verdict: 'REJECT', findings: [{ id: 'W', description: 'citation unverifiable' }] };
    };
    const c1ok = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: c1Queue }), implementFn: c1Impl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: resolvingWitness });
    ck(c1ok.ok === true && c1ok.phase === 'done', 'CLASS 1: a citation resolvable in the STAGED SOURCES is treated as VERIFIED (witness APPROVEs, step advances)');
    ck(typeof sawSources === 'string' && sawSources.includes('42 requests/sec'), 'CLASS 1: the witness was handed the staged source text (context_dependencies content)');

    // (b) witnessRepaired: a REJECT with maxRepairs:1 runs ONE witness-repair attempt and
    // the witness-halt event/step carry witnessRepaired=1 (distinct from the receipt-heal count).
    const c1HaltQueue = { mission_id: 'MC1H', steps: [{ step_index: 1, description: 'author', action_type: 'edit', target_files: ['c1h.md'], context_dependencies: ['src-notes.md'], validation_command: 'node -e "0"' }] };
    const alwaysReject = async () => ({ verdict: 'REJECT', findings: [{ id: 'W', description: 'unsourced claim' }] });
    const noopRepair = async () => { /* repair authors nothing usable -> witness stays REJECT */ };
    const c1Halt = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: c1HaltQueue }), implementFn: c1Impl, repairFn: noopRepair, maxRepairs: 1, verdictFn: approveVerdict, witnessFn: alwaysReject });
    ck(c1Halt.ok === false && c1Halt.steps[0]?.reason === 'witness-flag', 'CLASS 1: an unrepaired witness REJECT still HALTS the step');
    ck(c1Halt.steps[0]?.witnessRepaired === 1, 'CLASS 1: the witness-halt step carries witnessRepaired=1 (the REAL witness-repair count, not the receipt-heal repaired:0)');
  }

  // ---- CLASS 1 defaultWitness framing (unit): with an injected capturing dispatch (no
  // network), prove that a non-empty `sources` puts the STAGED SOURCES block + the
  // resolve-citation instruction into the framing, and that a source-less call does NOT
  // (source-less steps are byte-for-byte the prior framing — additive only).
  {
    let framingWith = null, framingWithout = null;
    const capture = (sink) => async (_seat, framing) => { sink(framing); return { verdict: 'APPROVE', findings: [] }; };
    const wstep = { description: 'check the card', target_files: ['card.md'] };
    await defaultWitness(wstep, dir, '# Card\nClaim cites [src.md L1].', 'L1: the figure is 42 req/s\nL2: confirmed', capture((f) => { framingWith = f; }));
    await defaultWitness(wstep, dir, '# Card\nno citations here.', '', capture((f) => { framingWithout = f; }));
    ck(/STAGED SOURCES \(resolve every \[file Lnn\] citation/.test(framingWith) && framingWith.includes('the figure is 42 req/s'), 'CLASS 1: defaultWitness framing CONTAINS the staged source text + resolve-citation header when sources are passed');
    ck(/A citation that resolves to a line in these sources is VERIFIED/.test(framingWith), 'CLASS 1: the framing tells the witness a resolvable citation is VERIFIED (not flagged blind)');
    ck(!/STAGED SOURCES/.test(framingWithout), 'CLASS 1: a source-less witness call has NO staged block (prior framing unchanged — additive)');
  }

  // PHASE 3 fail-safe: a THROWING verdict phase is not an APPROVE.
  const vthrew = await orchestrate('mission text', dir, { deconstructFn: async () => ({ ok: true, queue: { mission_id: 'MT', steps: [{ step_index: 1, description: 'w', action_type: 'edit', target_files: ['t.mjs'], context_dependencies: [], validation_command: 'node -c t.mjs' }] } }), implementFn: mockImpl, maxRepairs: 0, verdictFn: async () => { throw new Error('seat down'); }, witnessFn: okWitness });
  ck(vthrew.ok === false && vthrew.phase === 'verdict', 'a THROWING verdict phase fails SAFE (absence is not APPROVE)');

  // integrity-guard wired: a step targeting a .test. file (non-write-test) is BLOCKED before any green.
  const evilQueue = { mission_id: 'M2', steps: [
    { step_index: 1, description: 'edit something', action_type: 'edit', target_files: ['x.test.mjs'], context_dependencies: [], validation_command: 'node -c x.test.mjs' },
  ] };
  const evil = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: evilQueue }), implementFn: async (s) => fs.writeFileSync(path.join(dir, s.target_files[0]), 'export const z=1;\n'), maxRepairs: 0 });
  ck(evil.ok === false && evil.phase === 'verify' && evil.steps[0]?.reason === 'integrity', 'integrity-guard HALTS a step that touches a test file (anti-gaming, #36 wired)');

  // CITATION GUARD wired: an edit citing a backtick filename that exists in neither the
  // sandbox nor its declared inputs HALTS the step (rollback, reason 'fabricated-citation').
  const fabQueue = { mission_id: 'MFAB', steps: [
    { step_index: 1, description: 'author a card', action_type: 'edit', target_files: ['card.md'], context_dependencies: [], validation_command: 'node -e "0"' },
  ] };
  const fabImpl = async (s) => fs.writeFileSync(path.join(dir, s.target_files[0]), '# Card\nPer `1. Market & User.txt` the finding holds.\n');
  const fab = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: fabQueue }), implementFn: fabImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
  ck(fab.ok === false && fab.phase === 'verify' && fab.steps[0]?.reason === 'fabricated-citation', 'citation-guard HALTS an edit citing a file the seat never had (anti-fabrication)');
  ck(fab.steps[0]?.ok === false && !fab.steps[0]?.sha, 'a fabricated-citation halt is never committed (no sha enters history = no false green)');

  // and it does NOT false-positive: a citation to a DECLARED context_dependency passes clean.
  const okCiteQueue = { mission_id: 'MOKC', steps: [
    { step_index: 1, description: 'fetch input', action_type: 'command', target_files: ['notes.md'], context_dependencies: [], validation_command: "Set-Content -Path notes.md -Value '# notes'" },
    { step_index: 2, description: 'author from input', action_type: 'edit', target_files: ['out.md'], context_dependencies: ['notes.md'], validation_command: 'node -e "0"' },
  ] };
  const okCiteImpl = async (s) => { if (s.action_type === 'edit') fs.writeFileSync(path.join(dir, s.target_files[0]), '# Out\nPer `notes.md` the finding holds.\n'); };
  const okCite = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: okCiteQueue }), implementFn: okCiteImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
  ck(okCite.ok === true && okCite.phase === 'done', 'citation-guard does NOT flag a citation to a declared/produced source (no false positive)');

  // STALE-SANDBOX ARCHIVE (4a regression, 2026-06-11): a prior FAILED attempt's untracked
  // draft (with assertion lines) must NOT poison the next run's integrity guard. Without
  // the archive, this exact shape died WEAKENED-VERIFICATION on both of 4a's attempts.
  fs.writeFileSync(path.join(dir, 'stale-card.md'), '# Draft\nThe platform asserts that no existing competitor treats POI data as temporal.\nVERIFY: competitive landscape claim checked against sources.\n');
  const staleQueue = { mission_id: 'MSTALE', steps: [
    { step_index: 1, description: 'rewrite the card fresh', action_type: 'edit', target_files: ['stale-card.md'], context_dependencies: [], validation_command: 'node -e "0"' },
  ] };
  const staleImpl = async (s) => fs.writeFileSync(path.join(dir, s.target_files[0]), '# Card v2\nA shorter honest rewrite that drops the old draft lines entirely.\n');
  const staleRun = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: staleQueue }), implementFn: staleImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
  ck(staleRun.ok === true && staleRun.phase === 'done', 'stale-sandbox archive: a failed attempt\'s draft no longer blocks the retry (4a WEAKENED-VERIFICATION trap)');
  ck(fs.existsSync(path.join(dir, '_prior-attempt')) && fs.readdirSync(path.join(dir, '_prior-attempt')).length > 0, 'stale leftovers are ARCHIVED to _prior-attempt (operator-readable), never deleted');

  // COHERENCE detector (laguna-shaped upstream repair): pure unit checks.
  {
    ck(isIncoherentContract({ verdict: 'BLOCK', findings: [{ id: 'F1', class: 'wajib' }] }) === true, 'coherence: BLOCK + all-wajib findings = incoherent (re-ask the seat)');
    ck(isIncoherentContract({ verdict: 'BLOCK', findings: [{ id: 'F1', class: 'arkan' }] }) === false, 'coherence: BLOCK + arkan = coherent invalidation (stands)');
    ck(isIncoherentContract({ verdict: 'BLOCK', findings: [{ id: 'F1', description: 'unclassified' }] }) === false, 'coherence: unclassified findings make no coherence claim (stands)');
    ck(isIncoherentContract({ verdict: 'REVISE', findings: [{ id: 'F1', class: 'wajib' }] }) === false, 'coherence: REVISE + wajib agrees with itself (graduation handles it)');
    ck(isIncoherentContract({ verdict: 'BLOCK', findings: [], _failed: true }) === false, 'coherence: failed/merge-level contracts never re-asked');
  }

  // ENGINE-RECEIPTS for the verdict panel (zero-findings-BLOCK root cause): a content
  // seat's APPROVE riding on the engine's witnessed step deeds passes mergeVerdicts;
  // with ZERO witnessed steps it still BLOCKs (deeds-not-claims floor intact).
  {
    const { mergeVerdicts: mv } = await import('./verdict_merge.mjs');
    const er = engineReceiptsFromSteps([{ step: 1, ok: true, sha: 'abc123' }, { step: 2, ok: false }, { step: 3, ok: true, sha: 'def456' }]);
    ck(er.length === 2 && er.every((r) => r.type === 'exec' && r.ok === true), 'engineReceiptsFromSteps: one exec receipt per witnessed+committed step only');
    ck(mv([{ seat: 'validator', verdict: 'APPROVE', findings: [], receipts: er }]).consensus === 'APPROVE', 'panel APPROVE on engine-witnessed deeds -> APPROVE (zero-findings-BLOCK bug dead)');
    ck(mv([{ seat: 'validator', verdict: 'APPROVE', findings: [], receipts: engineReceiptsFromSteps([]) }]).consensus === 'BLOCK', 'zero witnessed steps -> APPROVE still BLOCKs (deeds floor intact)');
  }

  // GRADUATED EXPIATION end-to-end: APPROVE_WITH_DAMM completes the mission AND banks
  // its wajib gaps in missions/_logs/damm-queue.json (the gap is follow-up work, not loss).
  {
    const dammVerdict = async () => ({ consensus: 'APPROVE_WITH_DAMM', dispositions: [{ seat: 'v', verdict: 'APPROVE_WITH_DAMM' }], damm: [{ id: 'W1', from: 'v', description: 'appendix missing — scoped follow-up' }], contracts: [] });
    const dammPlan = async () => ({ ok: true, queue: { mission_id: 'MD', steps: [{ step_index: 1, description: 'w', action_type: 'edit', target_files: ['damm1.mjs'], context_dependencies: [], validation_command: 'node -c damm1.mjs' }] } });
    const dres = await orchestrate('mission text', dir, { deconstructFn: dammPlan, implementFn: mockImpl, maxRepairs: 0, verdictFn: dammVerdict, witnessFn: okWitness });
    ck(dres.ok === true && dres.phase === 'done' && dres.verdict?.damm?.length === 1, 'APPROVE_WITH_DAMM -> mission DONE with damm carried in the result');
    const dq = path.join(path.dirname(dir), '_logs', 'damm-queue.json');
    const dqOk = fs.existsSync(dq) && JSON.parse(fs.readFileSync(dq, 'utf8')).entries.some((e) => /appendix missing/.test(e.finding) && e.repaid === false);
    ck(dqOk, 'damm queue banked the wajib gap as an unrepaid compensating task');
  }
  // UMRAH/HAJJ tier routing: a small mission's verdict phase uses ONE seat; TIER: HAJJ forces the panel.
  {
    // routing is interior to defaultVerdictPhase (dispatch-time); assert the deterministic rule directly:
    const small = [{ step: 1, ok: true, sha: 'x', targets: ['card.md'] }];
    const big = [{ step: 1, ok: true, sha: 'x', targets: ['a.md'] }, { step: 2, ok: true, sha: 'y', targets: ['b.md'] }, { step: 3, ok: true, sha: 'z', targets: ['c.md'] }];
    const isUmrahRule = (mission, steps) => (steps || []).length <= 2 && new Set((steps || []).flatMap((s) => s.targets || [])).size <= 1 && !/TIER:\s*HAJJ/i.test(mission);
    ck(isUmrahRule('one card', small) === true, 'tier routing: single-artifact mission = UMRAH (one witness seat)');
    ck(isUmrahRule('big build', big) === false, 'tier routing: multi-step multi-target = HAJJ (full panel)');
    ck(isUmrahRule('one card\nTIER: HAJJ', small) === false, 'tier routing: TIER: HAJJ marker forces the full panel');
  }

  // NO-OP COMMIT + CROSS-RUN PREV (fb-backlog 12:19 + 4a 12:10 receipts, 2026-06-11):
  // a SECOND run re-emitting the IDENTICAL artifact must (a) not be blocked by the
  // integrity guard comparing against the prior run's committed card, and (b) still
  // carry a sha so the verdict receipts are fed (no-op commit = success at HEAD).
  {
    const rerunQueue = { mission_id: 'MRERUN', steps: [{ step_index: 1, description: 'author card', action_type: 'edit', target_files: ['rerun-card.md'], context_dependencies: [], validation_command: 'node -e "0"' }] };
    const sameImpl = async (s) => fs.writeFileSync(path.join(dir, s.target_files[0]), '# Card\nThe platform asserts X.\nVERIFY: claim checked.\n');
    const run1 = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: rerunQueue }), implementFn: sameImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
    ck(run1.ok === true && run1.steps[0]?.sha, 'rerun fixture: first run commits with a sha');
    const run2 = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: rerunQueue }), implementFn: sameImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
    ck(run2.ok === true, 'IDENTICAL re-run passes (cross-run prev no longer poisons the integrity guard)');
    ck(!!run2.steps[0]?.sha, 'no-op commit still returns the HEAD sha (verdict receipts stay fed — the fb-backlog starvation)');
    // and a DIFFERENT honest rewrite also passes (the 4a committed-variant shape):
    const shorterImpl = async (s) => fs.writeFileSync(path.join(dir, s.target_files[0]), '# Card v3\nShorter honest rewrite, old lines dropped.\n');
    const run3 = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: true, queue: rerunQueue }), implementFn: shorterImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
    ck(run3.ok === true && !!run3.steps[0]?.sha, 'a fresh rewrite that drops prior-run lines passes (4a committed-stale variant dead)');
  }

  // PLAN failure short-circuits.
  const noplan = await orchestrate('m', dir, { deconstructFn: async () => ({ ok: false, errors: ['bad'] }) });
  ck(noplan.ok === false && noplan.phase === 'plan', 'a failed PLAN short-circuits before any implement');

  // search pre-gate (#25): a fresh single-step plan per case so each commit is a real change (no no-op commit).
  const mkPlan = (f) => async () => ({ ok: true, queue: { mission_id: 'X', steps: [
    { step_index: 1, description: 'w', action_type: 'edit', target_files: [f], context_dependencies: [], validation_command: `node -c ${f}` },
  ] } });

  // needsSearch + a BLIND backend HALTS at PHASE 0, before PLAN ever runs.
  const blindStub = async () => ({ verdict: 'BLOCK', reason: 'zero results — search is blind' });
  const blocked = await orchestrate('m', dir, { needsSearch: true, preflightFn: blindStub, deconstructFn: mkPlan('s1.mjs'), implementFn: mockImpl, maxRepairs: 0 });
  ck(blocked.ok === false && blocked.phase === 'preflight', 'search pre-gate HALTS a search mission on a BLIND backend (#25 wired)');
  ck(!fs.existsSync(path.join(dir, 's1.mjs')), 'a blind-backend halt writes NOTHING — it refuses before PLAN');

  // needsSearch + a usable (OK, possibly degraded) backend PASSES through to a normal run.
  const okStub = async () => ({ verdict: 'OK', reason: '17 results (degraded: 1 rate-limited)' });
  const okSearch = await orchestrate('m', dir, { needsSearch: true, preflightFn: okStub, deconstructFn: mkPlan('s2.mjs'), implementFn: mockImpl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: async () => ({ verdict: 'APPROVE', findings: [] }) });
  ck(okSearch.ok === true && okSearch.phase === 'done', 'search pre-gate PASSES a search mission on a usable (degraded-OK) backend');

  // default (needsSearch:false): the preflight is SKIPPED — proven by a stub that THROWS if it ever runs.
  const trap = () => { throw new Error('preflight must not run when needsSearch is false'); };
  const noGate = await orchestrate('m', dir, { deconstructFn: mkPlan('s3.mjs'), implementFn: mockImpl, maxRepairs: 0, preflightFn: trap, verdictFn: approveVerdict, witnessFn: async () => ({ verdict: 'APPROVE', findings: [] }) });
  ck(noGate.ok === true && noGate.phase === 'done', 'preflight is SKIPPED when needsSearch is false (backward-compatible, code-only missions pay nothing)');

  // fail-safe: a THROWING preflight (needsSearch true) must BLOCK at phase 'preflight', not crash the run.
  const threw = await orchestrate('m', dir, { needsSearch: true, preflightFn: async () => { throw new Error('boom'); }, deconstructFn: mkPlan('s4.mjs'), implementFn: mockImpl, maxRepairs: 0 });
  ck(threw.ok === false && threw.phase === 'preflight', 'a THROWING preflight fails SAFE (BLOCK at preflight), not unhandled');

  // defense-in-depth: a forged {verdict:OK, results:0} is treated as BLIND (results===0 => BLOCK regardless of verdict).
  const forged = await orchestrate('m', dir, { needsSearch: true, preflightFn: async () => ({ verdict: 'OK', results: 0, reason: 'forged' }), deconstructFn: mkPlan('s5.mjs'), implementFn: mockImpl, maxRepairs: 0 });
  ck(forged.ok === false && forged.phase === 'preflight', 'a forged {verdict:OK,results:0} is BLOCKED (zero results = blind, regardless of verdict)');

  // ---- CODE-REPO E2E (Foundation 0.4): three end-to-end runs against a REAL throwaway
  // repo under tmpdir (git init + baseline commit). (1) happy path writes+commits the
  // allowlisted file INTO the repo, HEAD advances; (2) containment-refusal: a non-
  // allowlisted target writes NOTHING and HEAD is unchanged; (3) rollback-on-failure:
  // a failing witness leaves HEAD unchanged and the repo clean.
  {
    const mkRepo = () => {
      const r = fs.mkdtempSync(path.join(os.tmpdir(), 'orch_coderepo_'));
      execSync('git init -q', { cwd: r, stdio: 'pipe' });
      execSync('git config user.email t@t.local', { cwd: r, stdio: 'pipe' });
      execSync('git config user.name t', { cwd: r, stdio: 'pipe' });
      fs.mkdirSync(path.join(r, 'src'), { recursive: true });
      fs.writeFileSync(path.join(r, 'README.md'), '# project\n');
      execSync('git add -A', { cwd: r, stdio: 'pipe' });
      execSync('git commit -q --no-verify -m baseline', { cwd: r, stdio: 'pipe' });
      return r;
    };
    const head = (r) => execSync('git rev-parse HEAD', { cwd: r, stdio: 'pipe' }).toString().trim();
    const sandboxFor = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orch_cr_sandbox_'));

    // (1) HAPPY PATH — writes + commits the allowlisted file into the real repo.
    {
      const repo = mkRepo(); const sbx = sandboxFor(); const before = head(repo);
      const mission = `MISSION-CLASS: code-repo\nREPO-ROOT: ${repo}\nALLOW-FILES:\n  - src/mod.mjs\nMaqsad: add a module. Done means: node -c src/mod.mjs passes.`;
      const q = { mission_id: 'CR1', steps: [{ step_index: 1, description: 'write module', action_type: 'edit', target_files: ['src/mod.mjs'], context_dependencies: [], validation_command: 'node -c src/mod.mjs' }] };
      const impl = async (step, _cwd, opts) => implementStep(step, _cwd, { ...opts, dispatch: async () => ({ content: '```js\nexport const v = 1;\nARTIFACT-COMPLETE\n```' }), model: 'test' });
      const res = await orchestrate(mission, sbx, { deconstructFn: async () => ({ ok: true, queue: q }), implementFn: impl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
      ck(res.ok === true && res.phase === 'done', 'code-repo e2e (1) HAPPY: plan->write->commit->verdict APPROVE->done');
      ck(fs.existsSync(path.join(repo, 'src/mod.mjs')) && fs.readFileSync(path.join(repo, 'src/mod.mjs'), 'utf8').includes('v = 1'), 'code-repo e2e (1): the REAL file is written INTO the repo');
      ck(head(repo) !== before, 'code-repo e2e (1): HEAD advanced (the step committed into the real repo)');
      const namesCommitted = execSync('git show --name-only --pretty=format: HEAD', { cwd: repo, stdio: 'pipe' }).toString();
      ck(namesCommitted.includes('src/mod.mjs') && !namesCommitted.includes('README'), 'code-repo e2e (1): commit holds ONLY the allowlisted file (never ".")');
      fs.rmSync(repo, { recursive: true, force: true }); fs.rmSync(sbx, { recursive: true, force: true });
    }

    // (2) CONTAINMENT REFUSAL — a non-allowlisted target writes NOTHING, HEAD unchanged.
    {
      const repo = mkRepo(); const sbx = sandboxFor(); const before = head(repo);
      const mission = `MISSION-CLASS: code-repo\nREPO-ROOT: ${repo}\nALLOW-FILES:\n  - src/mod.mjs\nMaqsad: x. Done means: y.`;
      // the plan tries to target a file NOT on the allowlist — the executor's kernel refuses.
      const q = { mission_id: 'CR2', steps: [{ step_index: 1, description: 'write evil', action_type: 'edit', target_files: ['src/evil.mjs'], context_dependencies: [], validation_command: 'node -c src/evil.mjs' }] };
      const impl = async (step, _cwd, opts) => implementStep(step, _cwd, { ...opts, dispatch: async () => ({ content: '```js\nexport const v = 1;\nARTIFACT-COMPLETE\n```' }), model: 'test' });
      const res = await orchestrate(mission, sbx, { deconstructFn: async () => ({ ok: true, queue: q }), implementFn: impl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
      ck(res.ok === false, 'code-repo e2e (2) REFUSAL: a non-allowlisted target fails the mission');
      ck(!fs.existsSync(path.join(repo, 'src/evil.mjs')), 'code-repo e2e (2): the refused target was NEVER written (zero writes)');
      ck(head(repo) === before, 'code-repo e2e (2): HEAD UNCHANGED (containment refusal commits nothing)');
      fs.rmSync(repo, { recursive: true, force: true }); fs.rmSync(sbx, { recursive: true, force: true });
    }

    // (3) ROLLBACK ON FAILURE — a failing witness leaves HEAD unchanged + repo clean.
    {
      const repo = mkRepo(); const sbx = sandboxFor(); const before = head(repo);
      const mission = `MISSION-CLASS: code-repo\nREPO-ROOT: ${repo}\nALLOW-FILES:\n  - src/mod.mjs\nMaqsad: x. Done means: y.`;
      // the executor writes a SYNTACTICALLY BROKEN file; node -c fails; no repairs -> rollback+halt.
      const q = { mission_id: 'CR3', steps: [{ step_index: 1, description: 'write broken', action_type: 'edit', target_files: ['src/mod.mjs'], context_dependencies: [], validation_command: 'node -c src/mod.mjs' }] };
      const impl = async (step, _cwd, opts) => implementStep(step, _cwd, { ...opts, dispatch: async () => ({ content: '```js\nexport const v = ;\nARTIFACT-COMPLETE\n```' }), model: 'test' });
      const res = await orchestrate(mission, sbx, { deconstructFn: async () => ({ ok: true, queue: q }), implementFn: impl, maxRepairs: 0, verdictFn: approveVerdict, witnessFn: okWitness });
      ck(res.ok === false && res.phase === 'verify', 'code-repo e2e (3) ROLLBACK: a failing witness halts at phase verify');
      ck(head(repo) === before, 'code-repo e2e (3): HEAD UNCHANGED after rollback (no broken commit lands in the real repo)');
      const porcelain = execSync('git status --porcelain', { cwd: repo, stdio: 'pipe' }).toString().trim();
      // the broken file was a NEW untracked file; rollback (git checkout) won't delete untracked,
      // but it was NEVER committed and the tracked tree is clean — HEAD integrity is the invariant.
      ck(!/^.M |^M/.test(porcelain) || porcelain === '' || porcelain.includes('?? src/mod.mjs'), 'code-repo e2e (3): no TRACKED file was modified/committed (repo HEAD tree intact)');
      fs.rmSync(repo, { recursive: true, force: true }); fs.rmSync(sbx, { recursive: true, force: true });
    }
  }

  // ---- REPLAN ISOLATION (M-ENGINE.REPLAN-ISOLATION.1, 2026-06-16): a single flaky step is
  // CONTAINED to the step. Tests the required behaviors against the REAL orchestrate loop with
  // injected fakes — no model, no daemon. The bug this kills: a transient step failure made the
  // daemon re-run the WHOLE mission from step 1, discarding completed steps (the KB churn).
  {
    // classifyStepFailure unit: an empty/network emission-empty is TRANSIENT (deserves a fresh
    // dispatch of the same step); a structural/oversized refusal or a content rejection is a DEFECT.
    ck(classifyStepFailure('emission-empty', 'seat produced NO usable file content (0 fenced block(s) seen, largest 0 chars) — refusing to write an empty artifact. Raw seat output (0 chars): "(completely empty)"') === 'transient',
      'REPLAN: an EMPTY emission (the KB failure) classifies TRANSIENT (retry the step)');
    ck(classifyStepFailure('emission-empty', 'ETIMEDOUT contacting the seat') === 'transient', 'REPLAN: a network/timeout emission classifies TRANSIENT');
    ck(classifyStepFailure('emission-empty', 'SPLIT-NEEDED (seat refused oversize single emission): too big — re-plan as part-files.') === 'defect', 'REPLAN: SPLIT-NEEDED is a DEFECT (oversized step — re-plan, never blind same-step retry)');
    ck(classifyStepFailure('emission-empty', 'EMISSION-TRUNCATED: no sentinel after 3 rounds') === 'defect', 'REPLAN: EMISSION-TRUNCATED is a DEFECT (oversized step)');
    ck(classifyStepFailure('witness-flag', 'witness REJECT unrepaired') === 'defect', 'REPLAN: a witness REJECT on content is a DEFECT (fail-the-step, never retry)');
    ck(classifyStepFailure('integrity', 'WEAKENED-VERIFICATION') === 'defect', 'REPLAN: an integrity-block is a DEFECT');
    ck(classifyStepFailure('fabricated-citation', 'invented `x.txt`') === 'defect', 'REPLAN: a fabricated-citation is a DEFECT');

    // a 3-step plan; the executor emits EMPTY on step 3 the FIRST time it sees it, then a valid
    // file on the retry — the exact transient shape. With stepRetries:1 the step re-dispatches
    // and the mission RESUMES from step 3 (steps 1-2 committed once, NOT re-run).
    // each sub-test gets its OWN fresh git sandbox — a mission cwd is isolated in production, and a
    // shared dir would let one test's _checkpoint.json resume another's steps (cross-pollution).
    const mkRiSandbox = () => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ri_'));
      fs.writeFileSync(path.join(d, 'seed'), 'x');
      execSync('git init -q', { cwd: d, stdio: 'pipe' }); execSync('git config user.email t@t.local', { cwd: d, stdio: 'pipe' }); execSync('git config user.name t', { cwd: d, stdio: 'pipe' });
      execSync('git add -A', { cwd: d, stdio: 'pipe' }); execSync('git commit -q --no-verify -m init', { cwd: d, stdio: 'pipe' });
      return d;
    };
    const ri3Steps = () => [
      { step_index: 1, description: 'write 1', action_type: 'edit', target_files: ['r1.mjs'], context_dependencies: [], validation_command: 'node -c r1.mjs' },
      { step_index: 2, description: 'write 2', action_type: 'edit', target_files: ['r2.mjs'], context_dependencies: [], validation_command: 'node -c r2.mjs' },
      { step_index: 3, description: 'write 3', action_type: 'edit', target_files: ['r3.mjs'], context_dependencies: [], validation_command: 'node -c r3.mjs' },
    ];
    {
      const riDir = mkRiSandbox();
      const ri3Q = { mission_id: 'M-RI3', steps: ri3Steps() };
      const implCalls = {};
      let step3EmptyOnce = false;
      const transientImpl = async (step) => {
        implCalls[step.step_index] = (implCalls[step.step_index] || 0) + 1;
        if (step.step_index === 3 && !step3EmptyOnce) {   // step 3 emits EMPTY exactly once (a transient)
          step3EmptyOnce = true;
          return { ok: false, error: 'seat produced NO usable file content (0 fenced block(s) seen, largest 0 chars) — refusing to write an empty artifact. Raw seat output (0 chars): "(completely empty)"', model: 'flaky' };
        }
        fs.writeFileSync(path.join(riDir, step.target_files[0]), `export const v = ${step.step_index};\n`);
        return { ok: true, model: 'flaky' };
      };
      const r = await orchestrate('M-RI3 transient on step 3', riDir, {
        deconstructFn: async () => ({ ok: true, queue: ri3Q }), implementFn: transientImpl,
        maxRepairs: 0, stepRetries: 1, verdictFn: approveVerdict, witnessFn: okWitness,
      });
      ck(r.ok === true && r.phase === 'done', 'REPLAN: a step-3 TRANSIENT retries the STEP and the mission reaches DONE (no full re-plan, no restart from step 1)');
      ck(implCalls[1] === 1 && implCalls[2] === 1, 'REPLAN: steps 1-2 each ran EXACTLY ONCE — completed steps were NOT re-run when step 3 hit a transient (the KB churn is dead)');
      ck(implCalls[3] === 2, 'REPLAN: ONLY step 3 re-ran (1 empty + 1 success = 2 dispatches) — the failure was contained to the failing step');
      ck(r.steps.length === 3 && r.steps.every((s) => s.ok && s.sha), 'REPLAN: all three steps end committed (the resumed mission converges)');
      fs.rmSync(riDir, { recursive: true, force: true });
    }

    // BOUNDED: a step that emits EMPTY on EVERY dispatch retries stepRetries times then FAILS
    // the step with a receipt (no infinite loop, completed steps preserved).
    {
      const riDir = mkRiSandbox();
      const ri3Q = { mission_id: 'M-RI3', steps: ri3Steps() };
      const implCalls = {};
      const alwaysEmptyOn3 = async (step) => {
        implCalls[step.step_index] = (implCalls[step.step_index] || 0) + 1;
        if (step.step_index === 3) return { ok: false, error: 'seat produced NO usable file content — (completely empty)', model: 'flaky' };
        fs.writeFileSync(path.join(riDir, step.target_files[0]), `export const v = ${step.step_index};\n`);
        return { ok: true, model: 'flaky' };
      };
      const r = await orchestrate('M-RI3 always-empty step 3', riDir, {
        deconstructFn: async () => ({ ok: true, queue: ri3Q }), implementFn: alwaysEmptyOn3,
        maxRepairs: 0, stepRetries: 2, verdictFn: approveVerdict, witnessFn: okWitness,
      });
      ck(r.ok === false && r.phase === 'verify' && r.stoppedAt === 3, 'REPLAN: a persistently-empty step FAILS at THAT step (never an infinite loop)');
      const failed = r.steps.find((s) => s.step === 3);
      ck(failed && failed.ok === false && failed.reason === 'emission-empty' && failed.failureClass === 'transient', 'REPLAN: the failed step carries a named receipt (reason + transient class)');
      ck(failed.stepAttempts === 3, 'REPLAN: BOUNDED — stepRetries:2 means exactly 3 attempts (1 + 2 retries), then fail-with-receipt');
      ck(implCalls[3] === 3, 'REPLAN: step 3 dispatched exactly 3 times (bound honored, no runaway)');
      ck(r.steps.filter((s) => s.ok && s.sha).length === 2, 'REPLAN: completed steps 1-2 SURVIVE the later-step failure (committed, present in the result)');
      fs.rmSync(riDir, { recursive: true, force: true });
    }

    // DEFECT path: a witness REJECT on content (a REAL defect) FAILS THE STEP with a receipt
    // and does NOT consume same-step retries (a defect is never a flaky-dispatch class).
    {
      const riDir = mkRiSandbox();
      const ri3Q = { mission_id: 'M-RI3', steps: ri3Steps() };
      const implCalls = {};
      const goodImpl = async (step) => { implCalls[step.step_index] = (implCalls[step.step_index] || 0) + 1; fs.writeFileSync(path.join(riDir, step.target_files[0]), `export const v = ${step.step_index};\n`); return { ok: true, model: 'm' }; };
      const rejectStep3 = async (step) => step.step_index === 3 ? { verdict: 'REJECT', findings: [{ id: 'W', description: 'unsupported claim' }] } : { verdict: 'APPROVE', findings: [] };
      const r = await orchestrate('M-RI3 defect step 3', riDir, {
        deconstructFn: async () => ({ ok: true, queue: ri3Q }), implementFn: goodImpl,
        maxRepairs: 0, stepRetries: 2, verdictFn: approveVerdict, witnessFn: rejectStep3,
      });
      ck(r.ok === false && r.stoppedAt === 3, 'REPLAN: a witness REJECT (DEFECT) fails at step 3');
      const failed = r.steps.find((s) => s.step === 3);
      ck(failed && failed.reason === 'witness-flag' && failed.failureClass === 'defect', 'REPLAN: the DEFECT fails-the-step-with-receipt (reason witness-flag, class defect)');
      ck(failed.stepAttempts === 1, 'REPLAN: a DEFECT does NOT consume same-step retries (1 attempt, no blind re-dispatch)');
      ck(implCalls[3] === 1, 'REPLAN: step 3 dispatched exactly once on a defect (a real fault is not retried as if flaky)');
      ck(r.steps.filter((s) => s.ok && s.sha).length === 2, 'REPLAN: a defect at step 3 still PRESERVES completed steps 1-2 (no full re-plan)');
      fs.rmSync(riDir, { recursive: true, force: true });
    }

    // RECURRING-ERROR DETECTION (2026-07-01): the SAME cwd across 3 separate orchestrate()
    // calls simulates 3 daemon-level replans hitting the identical failure -- mission-events.jsonl
    // persists across calls in the same cwd, exactly like it persists across replans within one
    // daemon attempt in production. The 3rd occurrence (2 PRIOR + this one) should flag recurring.
    {
      const riDir = mkRiSandbox();
      const ri3Q = { mission_id: 'M-RI3', steps: ri3Steps() };
      const goodImpl = async (step) => { fs.writeFileSync(path.join(riDir, step.target_files[0]), `export const v = ${step.step_index};\n`); return { ok: true, model: 'm' }; };
      const rejectStep3 = async (step) => step.step_index === 3 ? { verdict: 'REJECT', findings: [{ id: 'W', description: 'unsupported claim' }] } : { verdict: 'APPROVE', findings: [] };
      const opts = { deconstructFn: async () => ({ ok: true, queue: ri3Q }), implementFn: goodImpl, maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: rejectStep3 };
      const r1 = await orchestrate('M-RI3 recurring 1', riDir, opts);
      const r2 = await orchestrate('M-RI3 recurring 2', riDir, opts);
      const r3 = await orchestrate('M-RI3 recurring 3', riDir, opts);
      const f1 = r1.steps.find((s) => s.step === 3);
      const f2 = r2.steps.find((s) => s.step === 3);
      const f3 = r3.steps.find((s) => s.step === 3);
      ck(!f1.recurringError, 'RECURRING-ERROR: 1st occurrence -> not flagged (a single failure is just a failure)');
      ck(!f2.recurringError, 'RECURRING-ERROR: 2nd occurrence -> not flagged (2 is still within normal retry/replan variance)');
      ck(f3.recurringError === true && f3.priorOccurrences === 2, 'RECURRING-ERROR: 3rd occurrence of the IDENTICAL error -> flagged recurringError:true with priorOccurrences:2');
      const events = fs.readFileSync(path.join(riDir, 'mission-events.jsonl'), 'utf8');
      ck(events.includes('recurring-error-suspect'), 'RECURRING-ERROR: a distinct event is emitted to mission-events.jsonl, not just the return value');
      fs.rmSync(riDir, { recursive: true, force: true });
    }

    // RECURRING-ERROR on a repeated engine-exec failure. NOTE (updated for M-ENGINE-EXEC-DIAG,
    // 56a79bd): an empty-OUTPUT engine-exec failure (`exit 1`, no stdout/stderr) NO LONGER carries
    // empty error text — execReceipt now surfaces a STABLE diagnostic ("[no stdout/stderr captured]
    // msg=Command failed: ... exit 1"), identical across runs. So these failures now key on that
    // consistent TEXT (the normal recurring path), and the 3rd identical occurrence is flagged.
    // The genuinely-empty-text fallback (the 2026-07-01 live bug: empty text returned 0
    // unconditionally) is still exercised by the WITNESS-reject path in the next test block.
    {
      const riDir = mkRiSandbox();
      const emptyFailQueue = () => ({ mission_id: 'M-EMPTY', steps: [
        { step_index: 1, description: 'fail with no output', action_type: 'command', target_files: [], context_dependencies: [], validation_command: 'exit 1' },
      ] });
      const opts = { deconstructFn: async () => ({ ok: true, queue: emptyFailQueue() }), maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: okWitness };
      const r1 = await orchestrate('M-EMPTY 1', riDir, opts);
      const r2 = await orchestrate('M-EMPTY 2', riDir, opts);
      const r3 = await orchestrate('M-EMPTY 3', riDir, opts);
      const g1 = r1.steps.find((s) => s.step === 1), g2 = r2.steps.find((s) => s.step === 1), g3 = r3.steps.find((s) => s.step === 1);
      ck(g1 && typeof g1.error === 'string' && g1.error.length > 0 && g1.reason === 'engine-exec', 'RECURRING-ERROR: an empty-OUTPUT engine-exec failure now carries exec-diag diagnostic text (M-ENGINE-EXEC-DIAG), not empty');
      ck(!g1.recurringError && !g2.recurringError, 'RECURRING-ERROR: 1st and 2nd identical-diagnostic occurrences -> not flagged');
      ck(g3.recurringError === true && g3.priorOccurrences === 2, 'RECURRING-ERROR: 3rd occurrence of the same diagnostic -> flagged (priorOccurrences 2)');
      fs.rmSync(riDir, { recursive: true, force: true });
    }

    // RECURRING-ERROR, EMPTY-TEXT FALLBACK DISCRIMINATES BY REASON (no false-positive merge of
    // two genuinely different empty-text failure classes just because both happen to be empty).
    {
      const riDir = mkRiSandbox();
      const engineExecQueue = () => ({ mission_id: 'M-MIX', steps: [{ step_index: 1, description: 'engine-exec empty fail', action_type: 'command', target_files: [], context_dependencies: [], validation_command: 'exit 1' }] });
      const witnessQueue = () => ({ mission_id: 'M-MIX', steps: [{ step_index: 1, description: 'witness empty fail', action_type: 'edit', target_files: ['w1.mjs'], context_dependencies: [], validation_command: 'node -c w1.mjs' }] });
      const goodImplW = async (step) => { fs.writeFileSync(path.join(riDir, step.target_files[0]), 'export const v = 1;\n'); return { ok: true, model: 'm' }; };
      const rejectNoFindings = async () => ({ verdict: 'REJECT', findings: [] });   // empty error text on the witness path too
      await orchestrate('M-MIX exec 1', riDir, { deconstructFn: async () => ({ ok: true, queue: engineExecQueue() }), maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: okWitness });
      await orchestrate('M-MIX exec 2', riDir, { deconstructFn: async () => ({ ok: true, queue: engineExecQueue() }), maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: okWitness });
      const rWitness = await orchestrate('M-MIX witness 1', riDir, { deconstructFn: async () => ({ ok: true, queue: witnessQueue() }), implementFn: goodImplW, maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: rejectNoFindings });
      const gWitness = rWitness.steps.find((s) => s.step === 1);
      ck(!gWitness.recurringError, 'RECURRING-ERROR empty-text: a DIFFERENT reason (witness) with empty text is NOT merged with 2 prior engine-exec empty-text failures — reason discriminates correctly');
      fs.rmSync(riDir, { recursive: true, force: true });
    }

    // RECURRING-ERROR STEP-SCOPING (red-team review of the early-exit design, 2026-07-01,
    // required revision #2/#3): countPriorOccurrences must NEVER conflate failures from
    // DIFFERENT steps just because they share error text. The witness-flag halt path (~L1035)
    // emits a CONSTANT literal ('witness REJECT unrepaired') for EVERY unrepaired witness
    // REJECT regardless of the actual content defect -- so on a multi-step mission, any two
    // UNRELATED steps that each independently hit one witness REJECT produce byte-identical
    // 'step-failed' error text. Three SEPARATE missions in the SAME cwd (simulating 3 daemon
    // replans, exactly like the other RECURRING-ERROR tests above), each failing a DIFFERENT
    // step_index via witness-flag: WITHOUT step-scoping, the 3rd call's failure would be the
    // mission-wide "3rd occurrence" of the identical literal and falsely flag recurringError —
    // even though THIS step (step 3) has never failed before. WITH step-scoping, each
    // step_index's own count starts at zero regardless of what any other step emitted.
    {
      const riDir = mkRiSandbox();
      const stepQueue = (n) => ({ mission_id: 'M-STEPSCOPE', steps: [ri3Steps()[n - 1]] });
      const goodImplW = async (step) => { fs.writeFileSync(path.join(riDir, step.target_files[0]), `export const v = ${step.step_index};\n`); return { ok: true, model: 'm' }; };
      const rejectNoFindings = async () => ({ verdict: 'REJECT', findings: [] });
      const opts = (n) => ({ deconstructFn: async () => ({ ok: true, queue: stepQueue(n) }), implementFn: goodImplW, maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: rejectNoFindings });
      const rA = await orchestrate('M-STEPSCOPE step1', riDir, opts(1));
      const rB = await orchestrate('M-STEPSCOPE step2', riDir, opts(2));
      const rC = await orchestrate('M-STEPSCOPE step3', riDir, opts(3));
      const fA = rA.steps.find((s) => s.step === 1), fB = rB.steps.find((s) => s.step === 2), fC = rC.steps.find((s) => s.step === 3);
      ck(fA?.error === 'witness REJECT unrepaired' && fB?.error === 'witness REJECT unrepaired' && fC?.error === 'witness REJECT unrepaired', 'STEP-SCOPING: confirms all 3 UNRELATED steps share the IDENTICAL constant witness-flag literal — the exact precondition that produced the cross-step false positive before this fix');
      ck(!fA.recurringError && !fB.recurringError, 'STEP-SCOPING: steps 1 and 2 are each a genuine 1st occurrence of THEIR OWN step -> not flagged');
      ck(!fC.recurringError, 'STEP-SCOPING: step 3 is ALSO a genuine 1st occurrence of ITS OWN step, even though it is the 3RD occurrence of the shared literal MISSION-WIDE -> NOT flagged (would have false-flagged as recurringError:true, priorOccurrences:2 before step-scoping)');
      fs.rmSync(riDir, { recursive: true, force: true });
    }

    // CHECKPOINT RESUME: simulate the daemon's clean-pass attempt-2. Run 1 commits steps 1-2
    // then fails at 3; run 2 (a FRESH orchestrate call, the daemon's retry) reads _checkpoint.json
    // and SKIPS the committed steps — steps 1-2 are NOT re-run, the mission resumes from step 3.
    {
      const cpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ri_cp_'));
      execSync('git init -q', { cwd: cpDir, stdio: 'pipe' }); execSync('git config user.email t@t.local', { cwd: cpDir, stdio: 'pipe' }); execSync('git config user.name t', { cwd: cpDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(cpDir, 'seed'), 'x'); execSync('git add -A', { cwd: cpDir, stdio: 'pipe' }); execSync('git commit -q --no-verify -m init', { cwd: cpDir, stdio: 'pipe' });
      const initSha = execSync('git rev-parse HEAD', { cwd: cpDir, stdio: 'pipe' }).toString().trim();   // touches ONLY 'seed' — used below as a deliberately-wrong sha
      const cpQ = { mission_id: 'M-CP', steps: ri3Steps() };
      const run1Calls = {};
      const failAt3 = async (step) => { run1Calls[step.step_index] = (run1Calls[step.step_index] || 0) + 1; if (step.step_index === 3) return { ok: false, error: 'witness rejected', model: 'm' }; fs.writeFileSync(path.join(cpDir, step.target_files[0]), `export const v = ${step.step_index};\n`); return { ok: true, model: 'm' }; };
      const rejAt3 = async (step) => step.step_index === 3 ? { verdict: 'REJECT', findings: [{ description: 'x' }] } : { verdict: 'APPROVE', findings: [] };
      const r1 = await orchestrate('M-CP run1', cpDir, { deconstructFn: async () => ({ ok: true, queue: cpQ }), implementFn: failAt3, maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: rejAt3 });
      ck(r1.ok === false && r1.stoppedAt === 3, 'REPLAN/checkpoint: run 1 commits 1-2, fails at 3');
      ck(fs.existsSync(path.join(cpDir, '_checkpoint.json')), 'REPLAN/checkpoint: _checkpoint.json persists the completed steps after run 1');
      const cpData = JSON.parse(fs.readFileSync(path.join(cpDir, '_checkpoint.json'), 'utf8'));
      ck(cpData.completed.length === 2 && cpData.completed.every((c) => c.sha), 'REPLAN/checkpoint: the checkpoint records exactly the 2 committed steps (with shas)');
      // run 2: the daemon's clean-pass retry. Steps 1-2 must be SKIPPED (resumed), only step 3 re-run.
      const run2Calls = {};
      const allGood = async (step) => { run2Calls[step.step_index] = (run2Calls[step.step_index] || 0) + 1; fs.writeFileSync(path.join(cpDir, step.target_files[0]), `export const v = ${step.step_index};\n`); return { ok: true, model: 'm' }; };
      const r2 = await orchestrate('M-CP run2', cpDir, { deconstructFn: async () => ({ ok: true, queue: cpQ }), implementFn: allGood, maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: okWitness });
      ck(r2.ok === true && r2.phase === 'done', 'REPLAN/checkpoint: run 2 (daemon clean-pass) reaches DONE');
      ck(run2Calls[1] === undefined && run2Calls[2] === undefined, 'REPLAN/checkpoint: steps 1-2 were NOT re-implemented on the retry (resumed from the checkpoint — the discarded-work bug is dead)');
      ck(run2Calls[3] === 1, 'REPLAN/checkpoint: ONLY step 3 re-ran on the clean-pass retry');
      ck(r2.steps.filter((s) => s.resumed).length === 2 && r2.steps.length === 3, 'REPLAN/checkpoint: the result carries the 2 resumed steps + the 1 freshly-run step');

      // CORRUPTED CHECKPOINT (2026-06-30 receipt, the exact live failure shape): a checkpoint
      // entry's sha that does NOT touch its claimed target must NOT be trusted — the step
      // re-runs for real instead of being silently skipped. step 1 gets a deliberately-wrong
      // sha (initSha touches only 'seed', never r1.mjs); step 2 keeps its real, valid sha as
      // a control — it must STILL resume correctly, proving the fix is per-entry, not a
      // blanket distrust of the whole checkpoint.
      const corrupted = JSON.parse(fs.readFileSync(path.join(cpDir, '_checkpoint.json'), 'utf8'));
      corrupted.completed[0].sha = initSha;
      fs.writeFileSync(path.join(cpDir, '_checkpoint.json'), JSON.stringify(corrupted, null, 2));
      const run3Calls = {};
      const allGood3 = async (step) => { run3Calls[step.step_index] = (run3Calls[step.step_index] || 0) + 1; fs.writeFileSync(path.join(cpDir, step.target_files[0]), `export const v = ${step.step_index};\n`); return { ok: true, model: 'm' }; };
      const r3 = await orchestrate('M-CP run3', cpDir, { deconstructFn: async () => ({ ok: true, queue: cpQ }), implementFn: allGood3, maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: okWitness });
      ck(r3.ok === true && r3.phase === 'done', 'CORRUPTED CHECKPOINT: run 3 (with a tampered step-1 sha) still reaches DONE');
      ck(run3Calls[1] === 1, 'CORRUPTED CHECKPOINT: step 1 (wrong sha, touches only "seed") is RE-RUN for real, not silently resumed');
      ck(run3Calls[2] === undefined, 'CORRUPTED CHECKPOINT: step 2 (valid sha, the control) STILL resumes correctly — the fix is per-entry, not a blanket distrust');
      const resumedStep2 = r3.steps.find((s) => s.step === 2);
      ck(resumedStep2 && resumedStep2.resumed === true, 'CORRUPTED CHECKPOINT: step 2 is marked resumed:true in the result (legitimate resume unaffected)');
      const rerunStep1 = r3.steps.find((s) => s.step === 1);
      ck(rerunStep1 && !rerunStep1.resumed && rerunStep1.sha !== initSha, 'CORRUPTED CHECKPOINT: step 1 is NOT marked resumed and produced a FRESH sha (the tampered sha never reached the result)');

      fs.rmSync(cpDir, { recursive: true, force: true });
    }
  }

  // ---- MISSION-LEVEL SIZE CEILING + AUTO-SPLIT (Hajj architecture, MISSION_ARCHITECTURE.md
  // L7/L10-11/L18/L33 — DESIGNED but never wired until now). Three required cases, all
  // end-to-end through orchestrate() with the REAL defaultSplitFn (only plan/impl/verdict/
  // witness mocked). Uses a low ceiling (3) so a small fixture queue triggers the split, and
  // a real missionsDir + autorunFile so the emitted files + queue append are observable.
  {
    const mkStepsQ = (id, n) => ({ mission_id: id, steps: Array.from({ length: n }, (_, i) => ({
      step_index: i + 1, description: `step ${i + 1}`, action_type: 'edit', target_files: [`f${i + 1}.mjs`], context_dependencies: [], validation_command: `node -c f${i + 1}.mjs` })) });
    const splitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split_'));
    const missionsDir = path.join(splitDir, 'missions');
    fs.mkdirSync(missionsDir, { recursive: true });
    const autorun = path.join(missionsDir, 'AUTORUN.md');
    fs.writeFileSync(autorun, '# queue\n');
    const parentText = 'MISSION-ID: M-OVER.1\nMISSION-CLASS: research\nNiyyah: capture all.\nMaqsad: a complete index.';

    // (1) OVER-CEILING -> N sub-missions in tartib; parent SPLIT (NOT executed). A throwing
    // implementFn proves NO step ever runs (the split short-circuits before Phase 2).
    {
      const sbx = path.join(missionsDir, 'over-1');   // cwd basename = mission basename, mirrors the daemon
      fs.mkdirSync(sbx, { recursive: true });          // the daemon mkdirs the sandbox before orchestrate
      const neverImpl = async () => { throw new Error('IMPLEMENT RAN ON A SPLIT MISSION — parent must NOT execute'); };
      const r = await orchestrate(parentText, sbx, {
        deconstructFn: async () => ({ ok: true, queue: mkStepsQ('M-OVER.1', 7) }),
        implementFn: neverImpl, sizeCeiling: 3,
        missionsDir, parentMissionFile: 'over-1.mission.txt', autorunFile: autorun,
        verdictFn: approveVerdict, witnessFn: okWitness, maxRepairs: 0,
      });
      ck(r.ok === true && r.phase === 'split' && r.split === true, 'SPLIT (1): a 7-step queue over ceiling 3 returns phase:split (parent NOT executed)');
      ck(r.subMissions.length === 3, 'SPLIT (1): 7 steps / ceiling 3 -> 3 sub-missions [3,3,1]');
      ck(r.subMissions[0].requires === null && r.subMissions[1].requires === 'M-OVER.1.S1' && r.subMissions[2].requires === 'M-OVER.1.S2', 'SPLIT (1): sub-missions carry tartib REQUIRES (S2 requires S1, S3 requires S2)');
      ck(fs.existsSync(path.join(missionsDir, 'over-1.S1.mission.txt')) && fs.existsSync(path.join(missionsDir, 'over-1.S3.mission.txt')), 'SPLIT (1): a .mission.txt file is emitted for each sub-mission');
      ck(fs.existsSync(path.join(missionsDir, 'over-1._split-manifest.json')), 'SPLIT (1): a _split-manifest.json handoff record is written');
      const autorunBody = fs.readFileSync(autorun, 'utf8');
      ck(autorunBody.indexOf('missions/over-1.S1.mission.txt') < autorunBody.indexOf('missions/over-1.S2.mission.txt') && autorunBody.includes('missions/over-1.S3.mission.txt'), 'SPLIT (1): children appended to AUTORUN in tartib order (S1 before S2 before S3)');
      const childText = fs.readFileSync(path.join(missionsDir, 'over-1.S1.mission.txt'), 'utf8');
      ck(/Maqsad:/.test(childText) && /PARENT MAQSAD/.test(childText) && /MISSION-CLASS: research/.test(childText), 'SPLIT (1): each child carries its own Maqsad + the parent objective + inherited class');
    }

    // (2) UNDER-CEILING -> runs as ONE mission, UNCHANGED (the critical fallback). Same low
    // ceiling, a 2-step queue: must reach phase:done normally, NO split artifacts emitted.
    {
      const sbx = path.join(missionsDir, 'under-1');
      fs.mkdirSync(sbx, { recursive: true });
      const beforeFiles = new Set(fs.readdirSync(missionsDir));
      const sbxImpl = async (step) => fs.writeFileSync(path.join(sbx, step.target_files[0]), `export const v = ${step.step_index};\n`);
      const r = await orchestrate('MISSION-ID: M-UNDER.1\nMaqsad: small.', sbx, {
        deconstructFn: async () => ({ ok: true, queue: mkStepsQ('M-UNDER.1', 2) }),
        implementFn: sbxImpl, sizeCeiling: 3,
        missionsDir, parentMissionFile: 'under-1.mission.txt', autorunFile: autorun,
        verdictFn: approveVerdict, witnessFn: okWitness, maxRepairs: 0,
      });
      ck(r.ok === true && r.phase === 'done' && !r.split, 'SPLIT (2): an UNDER-ceiling mission runs to done UNCHANGED (no split — the critical fallback)');
      ck(r.steps.length === 2 && r.steps.every((s) => s.ok), 'SPLIT (2): the under-ceiling mission executed all its steps normally');
      const newFiles = [...fs.readdirSync(missionsDir)].filter((f) => !beforeFiles.has(f) && /under-1\.S\d|under-1\._split/.test(f));
      ck(newFiles.length === 0, 'SPLIT (2): an under-ceiling mission emits NO sub-mission files or manifest (no false split)');
    }

    // (3) UNSPLITTABLE OVER-CEILING -> FAIL with a NAMED receipt (never run the monolith).
    // A queue with no mission_id and a mission text with no MISSION-ID cannot mint child ids.
    {
      const sbx = path.join(missionsDir, 'unsplit-1');
      fs.mkdirSync(sbx, { recursive: true });
      const neverImpl = async () => { throw new Error('IMPLEMENT RAN ON AN UNSPLITTABLE MISSION'); };
      const r = await orchestrate('Maqsad: a thing with no id at all.', sbx, {
        deconstructFn: async () => ({ ok: true, queue: { steps: mkStepsQ('x', 9).steps /* NO mission_id */ } }),
        implementFn: neverImpl, sizeCeiling: 3,
        missionsDir, parentMissionFile: 'unsplit-1.mission.txt', autorunFile: autorun,
        verdictFn: approveVerdict, witnessFn: okWitness, maxRepairs: 0,
      });
      ck(r.ok === false && r.phase === 'split' && /no MISSION-ID/.test(r.reason || ''), 'SPLIT (3): an UNSPLITTABLE over-ceiling mission FAILS with a named receipt (never runs the monolith)');
    }

    fs.rmSync(splitDir, { recursive: true, force: true });
  }

  // ---- SEATING MODE remaps the verdict + witness seats (seating-modes build, 2026-06-15).
  // (a) defaultWitness takes an injected dispatch -> capture the seat.model it builds per mode.
  // (b) the verdict panel's model choice is the deterministic pickSeat rule -> assert it directly
  //     (the live panel dispatches real seats; the selftest stays offline).
  {
    const { pickSeat: ps } = await import('./seat_modes.mjs');
    const withMode = async (env, fn) => {
      const saved = process.env.MUEZZIN_MODE;
      if (env) process.env.MUEZZIN_MODE = env; else delete process.env.MUEZZIN_MODE;
      try { return await fn(); } finally { if (saved === undefined) delete process.env.MUEZZIN_MODE; else process.env.MUEZZIN_MODE = saved; }
    };
    const witnessModelUnder = async (env) => {
      let m = null;
      const cap = async (seat) => { m = seat.model; return { verdict: 'APPROVE', findings: [] }; };
      await withMode(env, () => defaultWitness({ description: 'w', target_files: ['x.md'] }, dir, 'art', '', cap));
      return m;
    };
    // "absent mode" = an INVALID sentinel env -> readMode null (deterministic; not polluted by
    // the machine's live route file, which legitimately carries a real mode).
    ck(await witnessModelUnder('__none__') === 'nemotron-3-super', 'SEATING MODE absent: witness = today-default nemotron-3-super (Opus-first via map — safe default)');
    ck(await witnessModelUnder('anthropic-heavy') === 'laguna-xs-2.1:q8_0', 'SEATING MODE anthropic-heavy: witness is LOCAL laguna (NO-CLOUD ruling 2026-07-02 — nemotron-3-ultra was a cloud seat)');
    ck(await witnessModelUnder('local-heavy') === 'laguna-xs-2.1:q8_0', 'SEATING MODE local-heavy: witness is LOCAL (laguna-xs-2.1:q8_0, operator 2026-06-26 — was qwen3.6:27b)');

    // verdict panel seats: anthropic-heavy keeps them OPEN-weight (ollama CHECKS the Claude work);
    // no mode -> today's deepseek/minimax. (the exact rule defaultVerdictPhase applies.)
    ck(await withMode('__none__', () => ps('validator', 'deepseek-v4-pro')) === 'deepseek-v4-pro' && await withMode('__none__', () => ps('auditor', 'minimax-m3')) === 'minimax-m3',
      'SEATING MODE absent: verdict panel = today-default deepseek-v4-pro + minimax-m3 (safe default)');
    ck(await withMode('anthropic-heavy', () => ps('validator', 'qwen3.6:27b')) === 'qwen3.6:27b' && await withMode('anthropic-heavy', () => ps('auditor', 'granite4.1:30b')) === 'granite4.1:30b',
      'SEATING MODE anthropic-heavy: verdict panel stays OPEN-weight LOCAL qwen+granite (NO-CLOUD ruling 2026-07-02: local models check the Claude work — diversity preserved, cloud banned)');

    // LOCAL-ONLY WIRING (2026-06-30): claude-local-hybrid's witness seat object must actually
    // CARRY localOnly:true (proving the wiring reaches the real seat construction site at
    // defaultWitness, not just the isLocalOnlySeat unit in seat_modes.mjs). The validator/
    // auditor sites in defaultVerdictPhase call the exact same isLocalOnlySeat('validator'/
    // 'auditor') — already proven true/false per-mode by seat_modes.mjs's own selftest;
    // checked directly here too since that is the literal call orchestrate.mjs makes.
    const witnessLocalOnlyUnder = async (env) => {
      let lo = null;
      const cap = async (seat) => { lo = seat.localOnly; return { verdict: 'APPROVE', findings: [] }; };
      await withMode(env, () => defaultWitness({ description: 'w', target_files: ['x.md'] }, dir, 'art', '', cap));
      return lo;
    };
    ck(await witnessLocalOnlyUnder('claude-local-hybrid') === true, 'LOCAL-ONLY WIRING: claude-local-hybrid witness seat carries localOnly:true');
    ck(await witnessLocalOnlyUnder('anthropic-heavy') === false, 'LOCAL-ONLY WIRING: anthropic-heavy witness seat carries localOnly:false (different mode)');
    ck(await withMode('claude-local-hybrid', async () => isLocalOnlySeat('validator', 'qwen3.6:27b')) === true
      && await withMode('claude-local-hybrid', async () => isLocalOnlySeat('auditor', 'granite4.1:30b')) === true,
      'LOCAL-ONLY WIRING: claude-local-hybrid validator+auditor resolve localOnly:true (the same call orchestrate.mjs makes at seat construction)');
    ck(await withMode('claude-local-hybrid', async () => isLocalOnlySeat('architect', 'claude-sonnet-5')) === false,
      'LOCAL-ONLY WIRING: claude-local-hybrid architect A (claude-sonnet-5) resolves localOnly:false (never 404s on nxtbeast)');
    ck(await withMode('claude-local-hybrid', async () => isLocalOnlySeat('architect', 'qwen3.6:27b')) === true,
      'LOCAL-ONLY WIRING: claude-local-hybrid architect B (qwen3.6:27b) resolves localOnly:true (operator-widened scope)');
    ck(await withMode('__none__', async () => isLocalOnlySeat('validator', 'deepseek-v4-pro')) === false,
      'LOCAL-ONLY WIRING: no mode -> validator localOnly:false');
  }

  // ---- PHASE 2->3 INTEGRATOR BRIDGE (buildIntegratorBriefing) — direct unit tests, no
  // network: proves the success path, the fail-open path (3 distinct trigger shapes), and
  // that a HAJJ-tier multi-step mission is the one case it actually dispatches for.
  {
    const hajjMission = 'TIER: HAJJ\nMaqsad: build it. Done means: it works.';
    const fakeSteps3 = [{ step: 1 }, { step: 2 }, { step: 3 }];

    // success: a real-shaped dispatch return -> its content becomes the briefing verbatim.
    const okFn = async (seat, framing) => ({ content: 'Built the cost calculator across 3 steps; all consistent with the Done-means.' });
    const briefOk = await buildIntegratorBriefing(hajjMission, fakeSteps3, 'some artifact text', '', { integratorFn: okFn });
    ck(briefOk === 'Built the cost calculator across 3 steps; all consistent with the Done-means.',
      'buildIntegratorBriefing: success path returns the dispatched content verbatim');

    // fail-open #1: dispatch throws -> '' (never propagates, never blocks the caller).
    const throwFn = async () => { throw new Error('transport down'); };
    const briefThrow = await buildIntegratorBriefing(hajjMission, fakeSteps3, 'artifact', '', { integratorFn: throwFn });
    ck(briefThrow === '', 'buildIntegratorBriefing: a throwing dispatch fails open to "" (never propagates)');

    // fail-open #2: dispatch returns empty content -> '' (not "undefined" or a crash).
    const emptyFn = async () => ({ content: '' });
    const briefEmpty = await buildIntegratorBriefing(hajjMission, fakeSteps3, 'artifact', '', { integratorFn: emptyFn });
    ck(briefEmpty === '', 'buildIntegratorBriefing: empty dispatch content fails open to ""');

    // fail-open #3: disableIntegrator:true -> '' without even attempting the dispatch.
    let dispatchAttempted = false;
    const neverCalled = async () => { dispatchAttempted = true; return { content: 'should never be seen' }; };
    const briefDisabled = await buildIntegratorBriefing(hajjMission, fakeSteps3, 'artifact', '', { integratorFn: neverCalled, disableIntegrator: true });
    ck(briefDisabled === '' && !dispatchAttempted, 'buildIntegratorBriefing: disableIntegrator:true skips the dispatch entirely');

    // UMRAH-tier skip: a <=2-step mission with no TIER:HAJJ marker never dispatches either —
    // mirrors defaultVerdictPhase's own isUmrah rule so the bridge never fires for trivial work.
    let umrahDispatchAttempted = false;
    const umrahNeverCalled = async () => { umrahDispatchAttempted = true; return { content: 'should never be seen' }; };
    const briefUmrah = await buildIntegratorBriefing('Maqsad: x. Done means: y.', [{ step: 1 }], 'artifact', '', { integratorFn: umrahNeverCalled });
    ck(briefUmrah === '' && !umrahDispatchAttempted, 'buildIntegratorBriefing: UMRAH-tier (<=2 steps, no TIER:HAJJ) skips the dispatch — too small to be worth it');

    // no artifacts AND no exec receipts -> nothing to synthesize, skip without dispatching.
    let noContentDispatchAttempted = false;
    const noContentNeverCalled = async () => { noContentDispatchAttempted = true; return { content: 'should never be seen' }; };
    const briefNoContent = await buildIntegratorBriefing(hajjMission, fakeSteps3, '', '', { integratorFn: noContentNeverCalled });
    ck(briefNoContent === '' && !noContentDispatchAttempted, 'buildIntegratorBriefing: no artifacts + no exec receipts -> skip, nothing to synthesize');
  }

  // VISUAL WITNESS (advisory, non-blocking) — tested directly against applyVisualWitness,
  // never through defaultVerdictPhase (no real seat dispatch, no puppeteer/Ollama call).
  {
    const mockCapture = async () => ({ ok: true });
    const mockWitnessBlock = async () => ({ ok: true, verdict: 'block', blocking_findings: ['home/desktop: layout broken'] });

    const m1 = { consensus: 'APPROVE', dispositions: [{ seat: 'validator', verdict: 'APPROVE' }] };
    await applyVisualWitness('VISUAL-QC-REQUIRED\nPREVIEW-BASE-URL: http://localhost:9999\nMaqsad: x. Done means: y.', dir, m1, { capturePreviewsFn: mockCapture, witnessVisualDiffFn: mockWitnessBlock });
    ck(m1.visualWitness?.verdict === 'block', 'VISUAL WITNESS: a block verdict from the mocked vision path is captured in merged.visualWitness');
    ck(m1.consensus === 'APPROVE', 'VISUAL WITNESS: a block verdict NEVER mutates merged.consensus — advisory only, not a voting seat');

    const m2 = { consensus: 'APPROVE', dispositions: [] };
    await applyVisualWitness('VISUAL-QC-REQUIRED\nMaqsad: x. Done means: y.', dir, m2, { capturePreviewsFn: mockCapture, witnessVisualDiffFn: mockWitnessBlock, provisionPreviewFn: async () => null });
    ck(m2.visualWitness?.ok === false && m2.visualWitness?.error?.kind === 'NO_PREVIEW_BASE_URL', 'VISUAL WITNESS: no header AND auto-provision fails -> NO_PREVIEW_BASE_URL (fail-closed preserved)');
    ck(m2.consensus === 'APPROVE', 'VISUAL WITNESS: the missing-header case also never touches consensus');

    // AUTO-PROVISION (2026-07-03, trip-cost.S2 NO_PREVIEW_BASE_URL receipt): header absent but
    // provision succeeds -> the witness runs against the provisioned URL, no conductor hands.
    const m2b = { consensus: 'APPROVE', dispositions: [] };
    let capturedUrl = null;
    await applyVisualWitness('VISUAL-QC-REQUIRED\nMaqsad: x. Done means: y.', dir, m2b, {
      capturePreviewsFn: async (u) => { capturedUrl = u; return { ok: true }; },
      witnessVisualDiffFn: async () => ({ ok: true, verdict: 'pass', blocking_findings: [] }),
      provisionPreviewFn: async () => 'https://auto-prov.muddytires.pages.dev',
    });
    ck(capturedUrl === 'https://auto-prov.muddytires.pages.dev' && m2b.visualWitness?.verdict === 'pass', 'VISUAL WITNESS: AUTO-PROVISION supplies the preview URL and the witness runs against it (visual missions chain-self-sufficient)');

    const m3 = { consensus: 'APPROVE', dispositions: [] };
    await applyVisualWitness('Maqsad: an ordinary mission with no visual QC opt-in. Done means: y.', dir, m3, { capturePreviewsFn: mockCapture, witnessVisualDiffFn: mockWitnessBlock });
    ck(m3.visualWitness === undefined, 'VISUAL WITNESS: a mission with no VISUAL-QC-REQUIRED header never sets visualWitness at all — zero behavior change for every ordinary mission');
  }

  // ---- REACHABILITY WITNESS (QUALITY-STANDARD bar 5 / dev-cli class) ----
  {
    const rdir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-'));
    fs.mkdirSync(path.join(rdir, 'js'), { recursive: true });
    fs.writeFileSync(path.join(rdir, 'js', 'wired.js'), 'x');
    fs.writeFileSync(path.join(rdir, 'js', 'orphan.js'), 'x');
    fs.writeFileSync(path.join(rdir, 'index.html'), '<script src="js/wired.js"></script>');
    const un = unreachableBrowserAssets(rdir, ['js/wired.js', 'js/orphan.js', 'functions/api/x.js', 'docs/y.md']);
    ck(un.length === 1 && un[0] === 'js/orphan.js', 'REACHABILITY: orphan browser asset flagged; wired asset + non-browser paths (functions/, docs/) exempt');
    ck(unreachableBrowserAssets(rdir, ['docs/a.md']).length === 0, 'REACHABILITY: no browser assets -> no findings (zero behavior change for ordinary missions)');
    fs.rmSync(rdir, { recursive: true, force: true });
  }

  // POSITION-INHERITANCE (gap #4): split children insert after the parent's queue line
  // Lines now carry a SPLIT-CHILD marker (hunt-item #13, 2026-07-04) -- assertions find the
  // inserted line by its PATH SUBSTRING rather than exact-equality, since the marker is
  // appended text, not a position change.
  {
    const q = '# q\nmissions/top.mission.txt\nRUNNING missions/parent.mission.txt  <!-- t -->\nmissions/later.mission.txt\n';
    const one = insertQueueLineAfter(q, 'missions/parent.mission.txt', 'missions/parent.S1.mission.txt');
    const findIdx = (lines, needle) => lines.findIndex((l) => l.includes(needle));
    ck(findIdx(one.split('\n'), 'missions/parent.S1.mission.txt') === findIdx(one.split('\n'), 'RUNNING missions/parent.mission.txt  <!-- t -->') + 1, 'split-position: child inserts DIRECTLY after the parent line (status prefix tolerated)');
    ck(one.includes(`missions/parent.S1.mission.txt  ${SPLIT_CHILD_MARKER}`), 'split-position: inserted child line carries the SPLIT-CHILD marker (hunt-item #13 QUEUE-DUP exemption)');
    const two = insertQueueLineAfter(one, 'missions/parent.S1.mission.txt', 'missions/parent.S2.mission.txt');
    const L = two.split('\n');
    ck(findIdx(L, 'missions/parent.S2.mission.txt') === findIdx(L, 'missions/parent.S1.mission.txt') + 1 && findIdx(L, 'missions/later.mission.txt') > findIdx(L, 'missions/parent.S2.mission.txt'), 'split-position: second child chains after the first; later queue lines stay behind (tartib preserved, position inherited)');
    ck(insertQueueLineAfter('# q\nmissions/other.mission.txt\n', 'missions/ghost.mission.txt', 'missions/ghost.S1.mission.txt').includes('missions/ghost.S1.mission.txt'), 'split-position: absent anchor falls back to tail append (line never lost)');
    const hist = '# RESOLVED old: missions/parent.mission.txt\nSPLIT missions/parent.mission.txt  <!-- t -->\n';
    ck(insertQueueLineAfter(hist, 'missions/parent.mission.txt', 'missions/parent.S1.mission.txt').split('\n')[2].includes('missions/parent.S1.mission.txt'), 'split-position: comment/history lines skipped — the LAST live line is the anchor');
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${fails === 0 ? 'ALL PASS — orchestration: plan -> implement -> integrity-guard -> witness -> commit/rollback (end to end) + code-repo' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
