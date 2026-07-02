// self_witness.mjs — conductor-self-witness gate: BOTH-witness (DEFAULT ornith:9b + guardian)
// for OUT-OF-CHAIN work, made structural (M-ENGINE.CONDUCTOR-SELF-WITNESS.1, operator standing
// ruling 2026-06-16: "any work outside the chain needs to be witnessed by both Laguna AND
// guardian").
//
// DEFAULT MODEL RULING SUPERSEDED 2026-06-30 (operator's explicit word: "we change that to
// ornith and guardian"): the 2026-06-26 ruling below naming laguna-xs.2:q4_K_M as the default
// structural witness is REPLACED — ornith:9b is now the default (checkStructure's `dispatch`
// param, witnessArtifact's `structureModel` param, and --check-commit's --model default all
// changed). Reason: same-session live evidence — ornith:9b parsed its verdict tag cleanly on
// every run (laguna twice emitted a typo'd "</verduct" tag parseLagunaVerdict cannot match),
// gave the most specific/substantive verdict notes of any model tested, ran fastest end-to-end
// (6.9s vs laguna's 13.2s), and at ~6GB fits ALONGSIDE granite4.1-guardian:8b (14GB total) with
// NO GR10 serialization needed at all — removing the whole laguna unload-then-guardian dance
// for the common case. laguna-xs.2:q4_K_M, ornith:35b, and ornith9bDispatch/ornith35bDispatch
// all remain available via --model override; nothing was removed, only the default moved.
//
// THE HOLE THIS CLOSES: the daemon's SEATS are auto-witnessed (seat_dispatch). The
// conductor's OWN hand-authored artifacts — a freshly-constructed .mission.txt, a
// root-cause diagnosis that re-routes the queue — drive autonomous work with NO reasoning
// witness. MIQAT (mission_lint) catches FORMAT bugs at fire time; nothing checked the
// REASONING. This module adds the reasoning+groundedness witness ABOVE the format lint,
// the same independent-witness discipline the seats already have.
//
// THE TWO WITNESSES ARE COMPLEMENTARY, NOT REDUNDANT (spec lines 28-31):
//   - structural (DEFAULT ornith:9b, dense qwen35 base; laguna-xs.2:q4_K_M still available via
//     --model laguna): "is the REASONING sound, correctly scoped, faithful to its cited
//     receipts?" — logic flaws, gaps, overlaps.
//   - guardian (granite4.1-guardian:8b groundedness): "is every factual CLAIM supported by
//     the cited CONTEXT?" — fabricated/unsupported claims, invented receipts, mis-cites.
//
// GR10-SAFE (spec lines 40-52, ORIGINALLY written for laguna+guardian — still fully correct
// for that pair, and for ornith:35b+guardian; the NEW default ornith:9b (~6GB) + guardian
// (~7GB) = ~13GB, well under the 24GB ceiling, so the pair can in principle co-reside — the
// GR10 admission/serialize machinery below is UNCHANGED and still runs for every model
// (fail-safe: it only ever refuses an unsafe concurrent load, never assumes one is safe). So
// check /api/ps, run the structural model, STOP it + POLL /api/ps to clear, then run guardian.
// NEVER concurrent. If the GPU is already oversubscribed by another (daemon/seat) load when we
// arrive, we YIELD — emit a 'witness-queued: GPU busy' receipt and return ok:null rather than
// force a concurrent load (the historical ollama scheduler deadlock). In anthropic-heavy mode
// the daemon's seats run on Claude (cloud) so the local GPU is usually free for this pair.
//
// NON-BLOCKING FIRST (HARD RAIL, spec line 35 + 55): this gate FLAGS — it emits a receipt
// into the self-witness log + mission-events. It MUST NOT halt a mission or block the
// conductor. A false gate that blocks is worse than no gate. Blocking is a future, opt-in
// promotion (mirrors guardian_guard's documented non-blocking -> repair-trigger path).
// Any transport/parse error is swallowed -> no-signal -> never a block.
//
// Pure parsing + INJECTED dispatchers (lagunaDispatch / guardianDispatch / psProbe) =
// unit-testable without a live model. The selftests below run with fake dispatchers.

import { appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGroundedness, guardianDispatch, GUARDIAN_SYSTEM } from './guardian_guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// OPERATOR RULING 2026-06-26: the local GPU (4090) is on nxtbeast, not the laptop —
// the GR10 VRAM/concurrency witness must probe where the models actually run.
// 2026-07-01: env-overridable, NOT machine-detected -- ornith:9b + the guardian model are now
// ALSO available on the laptop's own RTX 4070 (8GB), which is a genuinely different VRAM class
// than nxtbeast's 4090 (24GB, see GPU_VRAM_BYTES below). Changing OLLAMA_BASE alone without
// ALSO correcting the VRAM ceiling for the smaller card would make GR10 think it's safe to load
// ~22GB of models on an 8GB GPU -- a real OOM/crash risk, not a cosmetic issue. Both must be set
// together (MUEZZIN_SELF_WITNESS_OLLAMA_BASE + MUEZZIN_GPU_VRAM_BYTES) when routing local.
const OLLAMA_BASE = process.env.MUEZZIN_SELF_WITNESS_OLLAMA_BASE || 'http://nxtbeast:11434';
const LAGUNA_MODEL = 'laguna-xs.2:q4_K_M';   // 33B structural reviewer (spec: structural witness)
// ORNITH (installed 2026-06-30, operator-requested): ALTERNATIVE structural-witness models —
// NOT a replacement for the operator-designated default above. Two real, distinct sizes exist
// (confirmed via /api/show: different digests, different sizes — not the same weights retagged):
//   - ornith:35b — qwen35moe (MoE) base, ~21GB resident, same VRAM class + GR10 serialization
//     requirement as laguna. Measured: cleaner verdict-tag output than laguna (laguna twice
//     emitted a typo'd "</verduct" closing tag parseLagunaVerdict cannot match; ornith:35b's
//     tag parsed clean both times).
//   - ornith:9b — qwen35 (dense) base, ~6GB resident, fits ALONGSIDE granite4.1-guardian:8b
//     (6+8=14GB) with NO serialization needed at all. Measured: fastest of every model tested
//     this session (6.9s end-to-end vs laguna's 13.2s), AND the most specific/substantive
//     verdict notes (referenced the actual reasoning content, not generic boilerplate).
// Use via ornith35bDispatch/ornith9bDispatch (or pass model:'ornith:35b'/'ornith:9b' to
// lagunaDispatch directly), and pass the matching structureModel to witnessArtifact so its
// admission-check + unload steps target the right model (see structureModel below — without
// it, witnessArtifact silently checked/unloaded LAGUNA_MODEL regardless of which model
// structureFn actually dispatched, a real bug found and fixed alongside the 35b install).
const ORNITH_35B_MODEL = 'ornith:35b';
const ORNITH_9B_MODEL = 'ornith:9b';
export const ORNITH_NEED_BYTES = 22 * 1024 * 1024 * 1024;   // ornith:35b — ~21.4GB measured resident + margin
export const ORNITH_9B_NEED_BYTES = 6 * 1024 * 1024 * 1024;   // ornith:9b — ~5.6GB measured resident + margin
const SELF_WITNESS_LOG = join(HERE, 'missions', '_logs', 'self-witness.jsonl');

// VRAM ceiling: a 24GB RTX 4090 by default (nxtbeast). laguna (33B q4) ≈ 22GB resident. We
// must not dispatch a load that would push total resident VRAM over this — that is the real
// GR10 constraint ("do not OVERSUBSCRIBE", spec line 45), not "is anything resident". Headroom
// margin keeps us off the exact edge where ollama's scheduler has historically deadlocked.
// Env-overridable (2026-07-01) for routing to a different card (e.g. the laptop's 8GB 4070) —
// see the OLLAMA_BASE note above, these two must change together.
export const GPU_VRAM_BYTES = Number(process.env.MUEZZIN_GPU_VRAM_BYTES) || 24 * 1024 * 1024 * 1024;
const VRAM_MARGIN = 1.5 * 1024 * 1024 * 1024;   // leave 1.5GB headroom

// ---- structural witness (laguna) ---------------------------------------------------------

export const LAGUNA_SYSTEM =
  'You are a structural code/spec reviewer. You are given an ARTIFACT (a mission spec or a ' +
  'diagnosis that will drive autonomous work) and its CONTEXT. Judge ONLY the REASONING: is ' +
  'it sound, correctly scoped, and faithful to its cited receipts? Look for logic flaws, ' +
  'missing steps, scope gaps, and overlaps. Reply with a verdict line ' +
  '"<verdict>APPROVE</verdict>" if the reasoning is sound, "<verdict>REVISE</verdict>" if it ' +
  'has fixable flaws, or "<verdict>REJECT</verdict>" if the reasoning is unsound — then one ' +
  'short line naming the most important concern (or "none").';

// PURE: extract laguna's structural verdict. Tag first; fall back to a leading bare word.
// Returns { verdict: 'APPROVE'|'REVISE'|'REJECT'|null, notes }. null = unparseable = no
// signal (never a block). Mirrors parseGuardianVerdict's shape so the two read alike.
export function parseLagunaVerdict(text) {
  const t = String(text ?? '');
  const tag = t.match(/<verdict>\s*(APPROVE|REVISE|REJECT|BLOCK)\s*<\/verdict>/i);
  const norm = (w) => { const u = String(w).toUpperCase(); return u === 'BLOCK' ? 'REJECT' : u; };
  if (tag) return { verdict: norm(tag[1]), notes: t.replace(/\s+/g, ' ').trim().slice(0, 400) };
  const bare = t.trim().match(/^[^A-Za-z]*(APPROVE|REVISE|REJECT|BLOCK)\b/i);
  if (bare) return { verdict: norm(bare[1]), notes: t.replace(/\s+/g, ' ').trim().slice(0, 400) };
  return { verdict: null, notes: t.replace(/\s+/g, ' ').trim().slice(0, 400) };
}

// PURE: strip JSON tool-call artifacts that local models sometimes emit instead of prose.
// Objects containing a 'tool_calls' key or both 'name' + 'arguments' keys are not verdicts;
// they are removed, and whitespace-only content is collapsed to ''. Returns { content, sanitized }.
export function sanitizeWitnessContent(raw) {
  let content = String(raw ?? '');
  let sanitized = false;
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      if ('tool_calls' in obj || ('name' in obj && 'arguments' in obj)) {
        content = '';
        sanitized = true;
      }
    }
  } catch { /* not JSON — leave content as-is */ }
  if (!content.trim()) content = '';
  return { content, sanitized };
}

// PURE: bounded laguna prompt. The verdict does not need the whole artifact, and a huge
// prompt risks the model's context (same discipline as buildGuardianPrompt).
export function buildLagunaPrompt(artifactText, contextText, { maxArt = 9000, maxCtx = 7000 } = {}) {
  const art = String(artifactText ?? '').slice(0, maxArt);
  const ctx = String(contextText ?? '').slice(0, maxCtx) || '(no context provided)';
  return `CONTEXT (cited receipts / source the artifact reasons from):\n${ctx}\n\nARTIFACT (reasoning to review):\n${art}`;
}

// real local dispatch to laguna-xs.2 (streaming-accumulate, bounded). Throws on transport
// error; the caller is fail-soft and swallows it. Same transport shape as guardianDispatch.
export async function lagunaDispatch(system, prompt, { model = LAGUNA_MODEL, num_predict = 512, timeoutMs = 600000 } = {}) {
  // num_predict raised 200 -> 512 (2026-07-02): at 200 the structural witness (ornith:9b) ran out
  // of tokens mid-reasoning and never emitted its <verdict> tag — receipt: trip-diary-backend
  // SELF-WITNESS[before] REVISE "The analysis is incomplete and cuts off mid-sentence, failing to
  // provide the required verdict" (even after the no-verdict re-ask). 512 gives room for reasoning
  // + the verdict; still bounded. Guardian (separate dispatch, num_predict 120) is unaffected.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        stream: true, think: false, options: { num_predict, temperature: 0 },
      }),
      signal: ctrl.signal,
    });
    let content = '', buf = '';
    const dec = new TextDecoder();
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let obj; try { obj = JSON.parse(line); } catch { continue; }
        content += obj?.message?.content ?? '';
        if (obj.done) return sanitizeWitnessContent(content).content;
      }
    }
    return sanitizeWitnessContent(content).content;
  } finally { clearTimeout(timer); }
}

// ornith35bDispatch / ornith9bDispatch: same transport as lagunaDispatch, defaulted to the
// matching ORNITH_*_MODEL instead of LAGUNA_MODEL. Named, reusable alternatives — pass as
// checkStructure's `dispatch` option (with witnessArtifact's `structureModel: ornith35bModel()`
// / `ornith9bModel()` so admission+unload track the right model) instead of laguna's default.
// Exported as functions, not bare constants, so callers never need to know the literal string.
export function ornith35bModel() { return ORNITH_35B_MODEL; }
export async function ornith35bDispatch(system, prompt, opts = {}) {
  return lagunaDispatch(system, prompt, { ...opts, model: ORNITH_35B_MODEL });
}
export function ornith9bModel() { return ORNITH_9B_MODEL; }
export async function ornith9bDispatch(system, prompt, opts = {}) {
  return lagunaDispatch(system, prompt, { ...opts, model: ORNITH_9B_MODEL });
}

// checkStructure(artifact, context, opts) -> { verdict, notes, ran }. dispatch injected for
// testability. Fail-soft: any throw -> { verdict: null, ran: false } (never blocks).
//
// RE-ASK ON NO-VERDICT (2026-07-01, receipt: 2 of 16 --check-commit runs tonight dispatched
// successfully, ran 5.7s/9.7s -- comparable to normal APPROVE runs -- and still came back with
// no parseable <verdict> tag; the model rambled analysis without ever concluding. That is a
// distinct failure mode from a dead dispatch (ran:false) or a GPU yield: the model DID
// respond, it just didn't follow the output format. One re-ask with a stricter, format-only
// instruction is cheap (this call is always non-blocking/background) and turns a wasted
// dispatch into a usable signal instead of silently discarding it as "(no signal)".
export async function checkStructure(artifactText, contextText, { dispatch = ornith9bDispatch, system = LAGUNA_SYSTEM } = {}) {
  try {
    const raw = await dispatch(system, buildLagunaPrompt(artifactText, contextText));
    const { content, sanitized } = sanitizeWitnessContent(raw);
    let parsed = parseLagunaVerdict(content);
    if (sanitized) parsed.notes = `[sanitized: tool-call wrapper removed] ${parsed.notes}`.trim();
    if (parsed.verdict === null) {
      try {
        const retryPrompt = `Your previous reply did not include a <verdict> tag. Reply with ONLY one of: <verdict>APPROVE</verdict>, <verdict>REVISE</verdict>, or <verdict>REJECT</verdict> -- no other text.\n\nYour previous reply was:\n${String(content).slice(0, 500)}`;
        const retryRaw = await dispatch(system, retryPrompt);
        const { content: retryContent } = sanitizeWitnessContent(retryRaw);
        const retryParsed = parseLagunaVerdict(retryContent);
        if (retryParsed.verdict !== null) {
          retryParsed.notes = `[re-asked after no-verdict first reply] ${retryParsed.notes}`.trim();
          parsed = retryParsed;
        }
      } catch { /* re-ask failed -- fall through with the original null-verdict parse */ }
    }
    return { ...parsed, ran: true };
  } catch (e) {
    return { verdict: null, notes: `laguna-unavailable: ${String(e?.message).slice(0, 120)}`, ran: false };
  }
}

// ---- GR10: VRAM-aware /api/ps probe + serialize ------------------------------------------

// real /api/ps probe -> { models: [{name, size_vram}], residentVram }. Throws on transport
// error; callers are fail-soft. Pure of the gate logic so the gate can inject a fake probe.
export async function psProbe({ base = OLLAMA_BASE, timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/ps`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return summarizePs(data);
  } finally { clearTimeout(timer); }
}

// PURE: turn an /api/ps body into { models, residentVram }. Defensive against shape drift.
export function summarizePs(data) {
  const arr = Array.isArray(data?.models) ? data.models : [];
  const models = arr.map((m) => ({ name: m?.name ?? m?.model ?? '?', size_vram: Number(m?.size_vram) || 0 }));
  const residentVram = models.reduce((s, m) => s + m.size_vram, 0);
  return { models, residentVram };
}

// PURE: GR10 admission decision. Given the current /api/ps summary and the VRAM a model
// dispatch would ADD, decide whether dispatching now would OVERSUBSCRIBE the GPU.
//   - if the model we want to run is ALREADY resident -> fine (no new load).
//   - else dispatching adds ~needBytes; if resident + need + margin > ceiling -> oversubscribe.
// needBytes default = laguna's ~22GB (the big one); a smaller witness passes a smaller need.
export function wouldOversubscribe(ps, modelName, needBytes, { ceiling = GPU_VRAM_BYTES, margin = VRAM_MARGIN } = {}) {
  const models = ps?.models || [];
  if (models.some((m) => m.name === modelName)) return false;   // already loaded — no new VRAM
  const resident = ps?.residentVram || 0;
  return resident + needBytes + margin > ceiling;
}

// poll /api/ps until a named model is NO LONGER resident (used after laguna, before
// guardian, so the 33B unloads and the 8B has room). Bounded; returns the final ps summary.
// fail-soft: a probe throw ends the poll (we proceed; never hang the gate on a flaky probe).
async function pollUntilUnloaded(modelName, { probe = psProbe, stop = lagunaStop, timeoutMs = 60000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  try { await stop(modelName); } catch { /* stop is best-effort; the poll is the real wait */ }
  let ps = { models: [], residentVram: 0 };
  while (Date.now() < deadline) {
    try { ps = await probe(); } catch { break; }
    if (!ps.models.some((m) => m.name === modelName)) return ps;   // cleared
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return ps;
}

// best-effort `ollama stop <model>` via the HTTP API (keep_alive:0 unload). Throws are
// swallowed by the caller. NOTE: a single stop after a completed (done) dispatch is the
// SAFE unload — the deadlock incidents were keep_alive:0 mid-dispatch / stacked stops.
export async function lagunaStop(modelName, { base = OLLAMA_BASE, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, keep_alive: 0 }),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
}

// ---- the receipt -------------------------------------------------------------------------

// PURE: shape the self-witness receipt. ok = the combined NON-BLOCKING signal:
//   - true  : both witnesses RAN and neither raised a concern (laguna APPROVE + guardian grounded)
//   - false : at least one witness RAN and RAISED a concern (a flag — NOT a block)
//   - null  : no usable signal (both no-signal, GPU-yielded, or errored) — never a block
// reasons[] names what fired, for the receipt reader.
export function buildReceipt({ context = {}, laguna, guardian, yielded = false }) {
  const reasons = [];
  let ok;
  if (yielded) { ok = null; reasons.push('witness-queued: GPU busy (oversubscribe) — yielded, no concurrent load'); }
  else {
    const lRan = laguna?.ran && laguna.verdict != null;
    const gRan = guardian?.ran && guardian.grounded != null;
    const lConcern = lRan && laguna.verdict !== 'APPROVE';
    const gConcern = gRan && guardian.grounded === false;
    if (lConcern) reasons.push(`laguna(structural): ${laguna.verdict} — ${String(laguna.notes || '').slice(0, 160)}`);
    if (gConcern) reasons.push(`guardian(groundedness): NOT grounded — ${String(guardian.raw || '').slice(0, 160)}`);
    if (lRan && !lConcern) reasons.push('laguna(structural): APPROVE');
    if (gRan && !gConcern) reasons.push('guardian(groundedness): grounded');
    if (!lRan) reasons.push(`laguna(structural): no-signal${laguna?.ran === false ? ' (unavailable)' : ''}`);
    if (!gRan) reasons.push(`guardian(groundedness): no-signal${guardian?.ran === false ? ' (unavailable)' : ''}`);
    if (lConcern || gConcern) ok = false;
    else if (lRan || gRan) ok = true;       // at least one ran clean, the other no-signal -> pass (non-blocking)
    else ok = null;                          // neither produced a signal -> no signal
  }
  return {
    ts: new Date().toISOString(),
    kind: 'self-witness',
    artifact: context.artifact || context.id || 'unknown',
    artifact_kind: context.artifact_kind || 'mission',
    // BEFORE/AFTER tag (M-ENGINE.CONDUCTOR-SELF-WITNESS.1, operator principle 2026-06-16
    // 06:24 "check before AND after"): 'before' = witness the artifact's DESIGN/REASONING at
    // fire; 'after' = witness the produced RESULT against its own "Done means" at completion.
    // The autosplit-spam bug lived ENTIRELY in the after-gap (before-pass approved a sound
    // design; nothing checked the real output). Defaults 'before' (the original v1 pass).
    pass: context.pass || 'before',
    ok,
    blocking: false,                         // HARD RAIL: this gate never blocks (non-blocking first)
    laguna: laguna ? { verdict: laguna.verdict ?? null, ran: !!laguna.ran } : null,
    guardian: guardian ? { grounded: guardian.grounded ?? null, ran: !!guardian.ran } : null,
    reasons,
  };
}

// emit the receipt to the self-witness jsonl log (append). Fail-silent: a logging failure
// must never break the fire path. Returns the receipt (so callers can also emit elsewhere).
export function emitReceipt(receipt, { logPath = SELF_WITNESS_LOG } = {}) {
  try { mkdirSync(dirname(logPath), { recursive: true }); appendFileSync(logPath, JSON.stringify(receipt) + '\n'); }
  catch { /* receipt logging must never break the gate */ }
  return receipt;
}

// ---- AFTER pass: did the produced RESULT satisfy the mission's own "Done means"? ---------
//
// The BEFORE pass (witnessArtifact on the mission TEXT at fire) checks the DESIGN. The AFTER
// pass checks the actual OUTPUT against REALITY: the mission's stated "Done means" vs the real
// receipts it produced (step targets, validation_command outcomes, the verdict). These helpers
// are PURE so the daemon's after-fire can build the after-context + the after-question with no
// live model, and the selftests below exercise them without one.

// PURE: extract a mission's "Done means" contract. Mirrors mission_split's parentDoneMeans
// detector (/done\s*(means|=)/i) — grab the text AFTER "Done means:" / "Done =" up to the next
// Capitalized header or EOF. Returns '' if the mission has none (MIQAT would have refused it,
// but the after pass stays fail-soft regardless). This is the BAR the result is judged against.
export function extractDoneMeans(text) {
  const m = String(text || '').match(/done\s*(?:means|=)\s*:?\s*([\s\S]*?)(?=\n[A-Z][A-Za-z -]*:|\n#|$)/i);
  return m ? m[1].trim() : '';
}

// PURE: summarize the ACTUAL receipts a completed mission produced, from the result object `r`
// (orchestrate returns { ok:true, phase:'done', steps, verdict }). Each step carries its real
// outcome: { step, ok, target/targets, sha, engineExec, reason }. This is the GROUND TRUTH the
// after-witness reads — the produced artifacts + whether each step's validation_command passed,
// NOT the mission's self-assertion. Bounded so the after prompt stays small.
export function summarizeResult(r, { maxSteps = 40 } = {}) {
  const steps = Array.isArray(r?.steps) ? r.steps : [];
  const lines = steps.slice(0, maxSteps).map((s) => {
    const tgts = []
      .concat(s.target ?? [])
      .concat(s.targets ?? [])
      .filter(Boolean)
      .join(', ') || '(no target)';
    const verb = s.engineExec ? 'engine-exec' : (s.sha ? `commit ${String(s.sha).slice(0, 8)}` : 'edit');
    return `  step ${s.step ?? '?'}: ${s.ok ? 'PASS' : 'FAIL'} (${verb}) -> ${tgts}${s.ok ? '' : ` [${s.reason || 'failed'}]`}`;
  });
  const allTargets = [...new Set(steps.flatMap((s) => [].concat(s.target ?? [], s.targets ?? []).filter(Boolean)))];
  const v = r?.verdict;
  const verdictLine = v ? `verdict consensus: ${v.consensus ?? '(none)'}` : 'verdict: (none recorded)';
  const okCount = steps.filter((s) => s.ok).length;
  return [
    `steps: ${okCount}/${steps.length} passed their validation_command receipt`,
    ...lines,
    `produced artifacts: ${allTargets.length ? allTargets.join(', ') : '(none recorded)'}`,
    verdictLine,
  ].join('\n');
}

// PURE: build the AFTER witness context — the artifact text the witnesses read (the AFTER
// QUESTION) + the contextText (the cited ground truth: the Done-means + the real receipts).
//   - laguna (structural) is asked: does the produced RESULT structurally satisfy the Done-means?
//   - guardian (groundedness) is asked: is the claim-of-DONE grounded in these REAL receipts,
//     not merely asserted? (guardian checks the artifact's claims against the contextText.)
// Returns { text, context } ready to pass straight into witnessArtifact(text, context, opts).
export function buildAfterContext(missionText, r, { artifact = 'unknown', artifact_kind = 'mission' } = {}) {
  const doneMeans = extractDoneMeans(missionText) || '(no explicit Done-means clause found in the mission text)';
  const receipts = summarizeResult(r);
  // contextText = the GROUND TRUTH the witnesses judge against (Done-means + real receipts).
  const contextText =
    `MISSION "Done means" (the contract):\n${doneMeans}\n\n` +
    `ACTUAL PRODUCED RECEIPTS (the real result — step outcomes, targets, verdict):\n${receipts}`;
  // text = the AFTER claim/question under review: the mission asserts it is DONE; the witnesses
  // judge that claim against the receipts above (this is what guardian checks for groundedness
  // and laguna checks for structural satisfaction of the Done-means).
  const text =
    `AFTER-COMPLETION REVIEW — the mission below was marked DONE. Judge whether its PRODUCED ` +
    `RESULT actually satisfies its own "Done means", using ONLY the real receipts in the ` +
    `context (not the mission's self-assertion).\n` +
    `Claim under review: "this mission's output satisfies its Done-means contract."\n\n` +
    `"Done means": ${doneMeans}`;
  return { text, context: { artifact, artifact_kind, pass: 'after', contextText } };
}

// ---- the gate: witnessArtifact -----------------------------------------------------------

// witnessArtifact(text, context, opts) — the BOTH-witness pass for out-of-chain work.
// Runs laguna (structural) THEN guardian (groundedness) SERIALLY, GR10-safe, NON-BLOCKING,
// emits a receipt. Returns { laguna:{verdict,notes,ran}, guardian:{grounded,raw,ran}, ok,
// yielded, receipt }.
//
//   text    = the artifact reasoning to witness (the mission spec body / diagnosis).
//   context = { artifact, artifact_kind, contextText } — contextText is the cited
//             receipts/source the artifact reasons from (what guardian checks claims against,
//             and what laguna judges faithfulness to). For a mission, contextText can be the
//             same mission text (self-consistency) or the source files it cites.
//
// Injection points (all default to the real local dispatch; tests inject fakes):
//   structureFn  : (artifact, context) -> { verdict, notes, ran }
//   groundFn      : (context, response) -> { grounded, raw, ran }
//   probe         : () -> ps summary  (GR10 /api/ps)
//   unload        : (modelName) -> Promise (poll-until-unloaded between the two witnesses)
//   emit          : (receipt) -> receipt
//   structureModel: the model name structureFn actually dispatches (default LAGUNA_MODEL).
//     BUG FOUND + FIXED 2026-06-30 (installing ornith surfaced it): the admission check and
//     the unload call both used to hardcode LAGUNA_MODEL regardless of which model
//     structureFn actually used. Pass a custom structureFn (e.g. ornith via ornith35bDispatch)
//     WITHOUT also passing the matching structureModel, and the unload step polls for
//     LAGUNA_MODEL's absence — which was never resident — so it returns immediately having
//     unloaded NOTHING, leaving the real model (e.g. ornith:35b, ~21GB) resident when
//     guardian's own admission check runs next. Guardian then correctly self-protects by
//     skipping (its own admission check IS correct — it computes real residentVram, not a
//     name match) — but the structural witness silently never freed the GPU it was supposed
//     to. Live receipt: ornith35bDispatch + default opts -> guardian skipped ("GPU still busy
//     after laguna unload"); same call + structureModel: ornith35bModel() -> guardian clean.
export async function witnessArtifact(text, context = {}, opts = {}) {
  const {
    structureFn = (a, c) => checkStructure(a, c),
    groundFn = (c, r) => checkGroundedness(c, r),
    probe = psProbe,
    unload = (m) => pollUntilUnloaded(m),
    emit = emitReceipt,
    structureModel = ORNITH_9B_MODEL,
    lagunaNeedBytes = ORNITH_9B_NEED_BYTES,   // default model is now ornith:9b (~6GB); laguna/ornith:35b callers must override this too
    guardianModel = 'granite4.1-guardian:8b',
    guardianNeedBytes = 7 * 1024 * 1024 * 1024,
  } = opts;
  const ctxText = String(context.contextText ?? text ?? '');

  // GR10 admission: probe /api/ps. If a structural-witness dispatch would oversubscribe the
  // GPU (another big load already resident), YIELD — never force a concurrent load.
  let ps;
  try { ps = await probe(); } catch { ps = null; }   // probe down -> treat as unknown; proceed cautiously below
  if (ps && wouldOversubscribe(ps, structureModel, lagunaNeedBytes)) {
    const receipt = emit(buildReceipt({ context, yielded: true }));
    return { laguna: null, guardian: null, ok: null, yielded: true, receipt };
  }

  // DEFENSIVE WRAP (HARD RAIL — non-blocking): this gate is wired into the daemon FIRE path.
  // It must NEVER throw into that path, no matter what a witness fn does. The default
  // structureFn/groundFn are already fail-soft (checkStructure/checkGroundedness swallow),
  // but a future caller could inject a fn that throws raw — so we belt-and-suspenders here:
  // a raw throw becomes a no-signal result, never an exception out of witnessArtifact.
  const safe = async (fn, noSignal) => { try { return await fn(); } catch (e) { return { ...noSignal, raw: `witness-threw: ${String(e?.message).slice(0, 120)}` }; } };

  // WITNESS 1: structural (laguna by default, or whatever structureFn dispatches). Serial —
  // runs to completion before guardian loads.
  const laguna = await safe(() => structureFn(text, ctxText), { verdict: null, notes: '', ran: false });

  // GR10 serialize: STOP the structural model + POLL /api/ps until IT unloads (not a
  // hardcoded name — see the BUG note above), so the 8B guardian has room. Only needed if
  // structureFn actually loaded a model (ran). Fail-soft inside unload.
  if (laguna?.ran) { try { await unload(structureModel); } catch { /* fail-soft */ } }

  // re-check admission for guardian (laguna may have failed to unload, or another load
  // arrived). If the 8B would now oversubscribe, run groundedness anyway only if it fits;
  // else skip guardian with a no-signal (still non-blocking).
  let guardian;
  let psAfter = null;
  try { psAfter = await probe(); } catch { psAfter = null; }
  if (psAfter && wouldOversubscribe(psAfter, guardianModel, guardianNeedBytes)) {
    guardian = { grounded: null, raw: 'guardian-skipped: GPU still busy after laguna unload (no concurrent load)', ran: false };
  } else {
    guardian = await safe(() => groundFn(ctxText, text), { grounded: null, ran: false });
  }

  const receipt = emit(buildReceipt({ context, laguna, guardian }));
  return { laguna, guardian, ok: receipt.ok, yielded: false, receipt };
}

// ============================================================ selftests (no live model) ====
if (process.argv[1] && process.argv[1].endsWith('self_witness.mjs') && !process.argv.includes('--check-commit')) {
  let pass = 0, fail = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };
  const GB = 1024 * 1024 * 1024;

  // ---- laguna parser (the tagged + bare formats) ----
  ck(parseLagunaVerdict('<verdict>APPROVE</verdict> reasoning sound').verdict === 'APPROVE', 'parse: <verdict>APPROVE</verdict> -> APPROVE');
  ck(parseLagunaVerdict('\n<verdict> REVISE </verdict> scope gap in step 3').verdict === 'REVISE', 'parse: prose-wrapped <verdict>REVISE</verdict> -> REVISE');
  ck(parseLagunaVerdict('REJECT. the diagnosis cites a receipt that does not exist').verdict === 'REJECT', 'parse: bare leading REJECT -> REJECT');
  ck(parseLagunaVerdict('<verdict>BLOCK</verdict>').verdict === 'REJECT', 'parse: BLOCK normalizes to REJECT');
  ck(parseLagunaVerdict('the model rambled with no verdict').verdict === null, 'parse: no verdict -> null (no signal, never a block)');
  ck(parseLagunaVerdict(null).verdict === null, 'parse: null input -> null, no throw');

  // ---- sanitizeWitnessContent -----------------------------------------------------------
  const swEmpty = sanitizeWitnessContent('');
  ck(swEmpty.content === '' && swEmpty.sanitized === false, 'sanitize: empty string -> empty, not sanitized');
  const swWs = sanitizeWitnessContent('   \n\t  ');
  ck(swWs.content === '' && swWs.sanitized === false, 'sanitize: whitespace-only -> empty, not sanitized');
  const swNormal = sanitizeWitnessContent('<verdict>APPROVE</verdict> reasoning is sound');
  ck(swNormal.content === '<verdict>APPROVE</verdict> reasoning is sound' && swNormal.sanitized === false, 'sanitize: normal verdict prose unchanged');
  const swTool1 = sanitizeWitnessContent(JSON.stringify({ name: 'witness', arguments: { text: 'foo' } }));
  ck(swTool1.content === '' && swTool1.sanitized === true, 'sanitize: strips name+arguments tool-call wrapper');
  const swTool2 = sanitizeWitnessContent(JSON.stringify({ tool_calls: [{ name: 'witness', arguments: { text: 'foo' } }] }));
  ck(swTool2.content === '' && swTool2.sanitized === true, 'sanitize: strips tool_calls wrapper');
  // verify the parser still works on sanitized normal text for every verdict class
  ck(parseLagunaVerdict(sanitizeWitnessContent('<verdict>APPROVE</verdict> ok').content).verdict === 'APPROVE', 'sanitize: parse still extracts APPROVE after sanitization');
  ck(parseLagunaVerdict(sanitizeWitnessContent('<verdict>REVISE</verdict> gap').content).verdict === 'REVISE', 'sanitize: parse still extracts REVISE after sanitization');
  ck(parseLagunaVerdict(sanitizeWitnessContent('<verdict>REJECT</verdict> bad').content).verdict === 'REJECT', 'sanitize: parse still extracts REJECT after sanitization');
  // verify the diagnostic note flag lands in checkStructure when a tool-call wrapper fires
  const csSanitized = await checkStructure('art', 'ctx', {
    dispatch: async () => JSON.stringify({ name: 'witness', arguments: { text: '<verdict>APPROVE</verdict>' } }),
  });
  ck(csSanitized.verdict === null && csSanitized.notes.includes('[sanitized: tool-call wrapper removed]'), 'checkStructure: sanitized wrapper sets diagnostic notes flag');

  // ---- prompt builder bounded ----
  const lp = buildLagunaPrompt('art body', 'ctx body');
  ck(lp.includes('ARTIFACT (reasoning to review):\nart body') && lp.includes('ctx body'), 'prompt: ARTIFACT + CONTEXT labels present');
  ck(buildLagunaPrompt('x'.repeat(20000), 'y'.repeat(20000)).length < 17000, 'prompt: bounded (no unbounded blowup)');

  // ---- checkStructure fail-soft ----
  const cs = await checkStructure('art', 'ctx', { dispatch: async () => '<verdict>APPROVE</verdict> ok' });
  ck(cs.verdict === 'APPROVE' && cs.ran === true, 'checkStructure: mock APPROVE -> {verdict:APPROVE, ran:true}');
  const csDead = await checkStructure('art', 'ctx', { dispatch: async () => { throw new Error('ECONNREFUSED'); } });
  ck(csDead.verdict === null && csDead.ran === false, 'checkStructure: dispatch throw -> {verdict:null, ran:false} (fail-soft)');

  // ---- checkStructure re-ask on no-verdict (2026-07-01 fix) ----
  {
    let calls = 0;
    const csRambleThenVerdict = await checkStructure('art', 'ctx', {
      dispatch: async () => { calls++; return calls === 1 ? 'a lot of analysis with no tag at all' : '<verdict>REVISE</verdict> found it on retry'; },
    });
    ck(calls === 2, 'checkStructure: no-verdict first reply triggers exactly one re-ask dispatch');
    ck(csRambleThenVerdict.verdict === 'REVISE' && csRambleThenVerdict.ran === true, 'checkStructure: re-ask recovers a real verdict instead of discarding the run');
    ck(csRambleThenVerdict.notes.includes('re-asked after no-verdict'), 'checkStructure: recovered verdict is tagged as re-asked in notes');
  }
  {
    let calls2 = 0;
    const csRambleTwice = await checkStructure('art', 'ctx', {
      dispatch: async () => { calls2++; return 'still no tag, rambling both times'; },
    });
    ck(calls2 === 2, 'checkStructure: re-ask that ALSO has no verdict still only dispatches twice total (no infinite loop)');
    ck(csRambleTwice.verdict === null && csRambleTwice.ran === true, 'checkStructure: both attempts no-verdict -> ran:true, verdict:null (honest no-signal, not a false block)');
  }

  // ---- summarizePs + wouldOversubscribe (GR10 VRAM logic) ----
  const psEmpty = summarizePs({ models: [] });
  ck(psEmpty.residentVram === 0 && psEmpty.models.length === 0, 'summarizePs: empty -> 0 resident');
  const psLag = summarizePs({ models: [{ name: 'laguna-xs.2:q4_K_M', size_vram: 22 * GB }] });
  ck(psLag.residentVram === 22 * GB, 'summarizePs: sums size_vram');
  // empty GPU: laguna fits (22 + 1.5 margin < 24) -> no oversubscribe
  ck(wouldOversubscribe(psEmpty, 'laguna-xs.2:q4_K_M', 22 * GB) === false, 'GR10: empty GPU, laguna fits -> no oversubscribe');
  // big model already resident (e.g. a daemon seat) -> dispatching laguna WOULD oversubscribe -> YIELD
  const psBusy = summarizePs({ models: [{ name: 'some-22b-seat', size_vram: 18 * GB }] });
  ck(wouldOversubscribe(psBusy, 'laguna-xs.2:q4_K_M', 22 * GB) === true, 'GR10: 18GB resident + 22GB laguna -> oversubscribe -> yield');
  // laguna already resident -> no new VRAM -> never oversubscribe
  ck(wouldOversubscribe(psLag, 'laguna-xs.2:q4_K_M', 22 * GB) === false, 'GR10: laguna already resident -> no new load -> ok');

  // ---- buildReceipt: all signal combinations, NON-BLOCKING ----
  const rOk = buildReceipt({ context: { artifact: 'M-X' }, laguna: { verdict: 'APPROVE', ran: true }, guardian: { grounded: true, ran: true } });
  ck(rOk.ok === true && rOk.blocking === false, 'receipt: both clean -> ok:true, blocking:false');
  const rConcern = buildReceipt({ context: {}, laguna: { verdict: 'REVISE', notes: 'scope gap', ran: true }, guardian: { grounded: true, ran: true } });
  ck(rConcern.ok === false && rConcern.blocking === false, 'receipt: laguna REVISE -> ok:false but STILL blocking:false (flag, not block)');
  const rHallu = buildReceipt({ context: {}, laguna: { verdict: 'APPROVE', ran: true }, guardian: { grounded: false, raw: 'invented receipt', ran: true } });
  ck(rHallu.ok === false && rHallu.reasons.some((x) => /NOT grounded/.test(x)), 'receipt: guardian NOT grounded -> ok:false + named reason');
  const rNoSig = buildReceipt({ context: {}, laguna: { verdict: null, ran: false }, guardian: { grounded: null, ran: false } });
  ck(rNoSig.ok === null && rNoSig.blocking === false, 'receipt: both no-signal -> ok:null (never a block)');
  const rYield = buildReceipt({ context: {}, yielded: true });
  ck(rYield.ok === null && rYield.reasons[0].includes('GPU busy'), 'receipt: GPU-yielded -> ok:null + queued reason');
  const rOnePartial = buildReceipt({ context: {}, laguna: { verdict: 'APPROVE', ran: true }, guardian: { grounded: null, ran: false } });
  ck(rOnePartial.ok === true, 'receipt: one clean + one no-signal -> ok:true (non-blocking pass)');

  // ---- witnessArtifact end-to-end with INJECTED fakes: BOTH verdicts captured + receipt ----
  const calls = [];
  const fakeProbeFree = async () => { calls.push('probe'); return summarizePs({ models: [] }); };
  const fakeStruct = async (a, c) => { calls.push('laguna'); return { verdict: 'APPROVE', notes: 'sound', ran: true }; };
  const fakeGround = async (c, r) => { calls.push('guardian'); return { grounded: true, raw: 'grounded', ran: true }; };
  const fakeUnload = async (m) => { calls.push(`unload:${m}`); };
  const emitted = [];
  const fakeEmit = (rcpt) => { emitted.push(rcpt); return rcpt; };
  const res = await witnessArtifact('mission reasoning text', { artifact: 'M-TEST', artifact_kind: 'mission' },
    { structureFn: fakeStruct, groundFn: fakeGround, probe: fakeProbeFree, unload: fakeUnload, emit: fakeEmit });
  ck(res.laguna.verdict === 'APPROVE' && res.guardian.grounded === true, 'witnessArtifact: BOTH verdicts captured (laguna APPROVE + guardian grounded)');
  ck(res.ok === true && res.yielded === false && emitted.length === 1, 'witnessArtifact: ok:true, not yielded, receipt emitted');
  // GR10 SERIALIZATION: laguna BEFORE unload BEFORE guardian — never concurrent.
  const iL = calls.indexOf('laguna'), iU = calls.findIndex((x) => x.startsWith('unload:')), iG = calls.indexOf('guardian');
  ck(iL >= 0 && iU > iL && iG > iU, 'witnessArtifact: GR10 SERIAL — laguna -> unload -> guardian (never concurrent)');
  // default structureModel -> unload targets ORNITH_9B_MODEL (new default per 2026-06-30 ruling)
  ck(calls.includes('unload:ornith:9b'), 'witnessArtifact: default structureModel -> unload targets ornith:9b (new default)');

  // ---- REGRESSION GUARD for the ornith-install bug (2026-06-30): structureModel override
  // must reach BOTH the admission check AND the unload call — not just be silently ignored
  // while the code keeps hardcoding LAGUNA_MODEL. This is the exact bug a live ornith
  // dispatch surfaced: guardian was silently skipped because unload polled for the wrong
  // model name and never actually freed the GPU.
  const calls3 = [];
  const fakeProbeOrnithFree = async () => { calls3.push('probe'); return summarizePs({ models: [] }); };
  const fakeStructOrnith = async () => { calls3.push('struct'); return { verdict: 'APPROVE', ran: true }; };
  const fakeGroundOrnith = async () => { calls3.push('guardian'); return { grounded: true, ran: true }; };
  const fakeUnloadOrnith = async (m) => { calls3.push(`unload:${m}`); };
  await witnessArtifact('text', { artifact: 'M-ORNITH' }, {
    structureFn: fakeStructOrnith, groundFn: fakeGroundOrnith, probe: fakeProbeOrnithFree,
    unload: fakeUnloadOrnith, emit: (r) => r, structureModel: 'ornith:35b',
  });
  ck(calls3.includes('unload:ornith:35b'), 'REGRESSION GUARD: structureModel:"ornith:35b" -> unload targets ornith:35b, NOT the hardcoded laguna name');
  ck(!calls3.includes('unload:laguna-xs.2:q4_K_M'), 'REGRESSION GUARD: structureModel override -> unload NEVER falls back to the hardcoded laguna name');

  // admission check also honors structureModel: a probe showing ornith ALREADY resident
  // (21GB) must read as "no NEW VRAM" for an ornith-targeted dispatch, same as the existing
  // laguna-already-resident case above.
  const psOrnith = summarizePs({ models: [{ name: 'ornith:35b', size_vram: 21 * GB }] });
  ck(wouldOversubscribe(psOrnith, 'ornith:35b', ORNITH_NEED_BYTES) === false, 'GR10: ornith already resident -> no new load -> ok (structureModel-aware admission check)');

  // ---- ornith:9b (installed 2026-06-30): dense, ~6GB — small enough to fit ALONGSIDE
  // guardian (6+8=14GB) with no serialization needed. Same regression-guard shape as 35b.
  const calls4 = [];
  const fakeProbe9bFree = async () => { calls4.push('probe'); return summarizePs({ models: [] }); };
  const fakeStruct9b = async () => { calls4.push('struct'); return { verdict: 'APPROVE', ran: true }; };
  const fakeGround9b = async () => { calls4.push('guardian'); return { grounded: true, ran: true }; };
  const fakeUnload9b = async (m) => { calls4.push(`unload:${m}`); };
  await witnessArtifact('text', { artifact: 'M-ORNITH9B' }, {
    structureFn: fakeStruct9b, groundFn: fakeGround9b, probe: fakeProbe9bFree,
    unload: fakeUnload9b, emit: (r) => r, structureModel: 'ornith:9b',
  });
  ck(calls4.includes('unload:ornith:9b'), 'REGRESSION GUARD: structureModel:"ornith:9b" -> unload targets ornith:9b');

  // ornith:9b (6GB) + guardian (8GB) already resident = 14GB, well under the 24GB ceiling —
  // must NOT yield (unlike laguna/ornith:35b which genuinely can't coexist with guardian).
  const psBothSmall = summarizePs({ models: [{ name: 'granite4.1-guardian:8b', size_vram: 8 * GB }] });
  ck(wouldOversubscribe(psBothSmall, 'ornith:9b', ORNITH_9B_NEED_BYTES) === false, 'GR10: ornith:9b (6GB) fits alongside an already-resident 8GB guardian (14GB total) — no yield needed, unlike the 21GB+8GB pair');

  // ---- witnessArtifact YIELD path: GPU oversubscribed -> queue, no dispatch ----
  const calls2 = [];
  const fakeProbeBusy = async () => { calls2.push('probe'); return summarizePs({ models: [{ name: 'big-seat', size_vram: 20 * GB }] }); };
  const neverStruct = async () => { calls2.push('laguna'); return { verdict: 'APPROVE', ran: true }; };
  const neverGround = async () => { calls2.push('guardian'); return { grounded: true, ran: true }; };
  const res2 = await witnessArtifact('text', { artifact: 'M-BUSY' },
    { structureFn: neverStruct, groundFn: neverGround, probe: fakeProbeBusy, unload: async () => {}, emit: (r) => r });
  ck(res2.yielded === true && res2.ok === null, 'witnessArtifact: GPU busy -> yielded:true, ok:null');
  ck(!calls2.includes('laguna') && !calls2.includes('guardian'), 'witnessArtifact: YIELD ran NEITHER model (no concurrent/forced load)');

  // ---- witnessArtifact HARD RAIL: a RAW-throwing witness fn must NOT escape the gate ----
  // (defensive wrap): even if a caller injects a fn that throws raw (not the fail-soft
  // default), witnessArtifact must convert it to a no-signal result, never an exception
  // into the daemon fire path. This is the belt-and-suspenders that makes the gate safe to
  // wire structurally.
  let threw3 = false;
  const res3 = await witnessArtifact('text', { artifact: 'M-ERR' }, {
    structureFn: async () => { throw new Error('boom'); },        // RAW throw, not fail-soft
    groundFn: async () => ({ grounded: null, ran: false }),
    probe: async () => summarizePs({ models: [] }), unload: async () => {}, emit: (r) => r,
  }).catch((e) => { threw3 = true; return { _threw: e.message }; });
  ck(threw3 === false, 'witnessArtifact: a RAW-throwing structureFn does NOT escape the gate (defensive wrap)');
  ck(res3.laguna?.ran === false && res3.ok === null, 'witnessArtifact: raw throw -> laguna no-signal, ok:null (non-blocking)');

  // ---- witnessArtifact with the REAL fail-soft fns (dispatch injected to throw) -> no block ----
  const res4 = await witnessArtifact('text', { artifact: 'M-DEAD' }, {
    structureFn: (a, c) => checkStructure(a, c, { dispatch: async () => { throw new Error('ECONNREFUSED'); } }),
    groundFn: (c, r) => checkGroundedness(c, r, { dispatch: async () => { throw new Error('ECONNREFUSED'); } }),
    probe: async () => summarizePs({ models: [] }), unload: async () => {}, emit: (r) => r,
  });
  ck(res4.ok === null && res4.laguna.ran === false && res4.guardian.ran === false, 'witnessArtifact: both dispatches dead -> ok:null, ran:false (FAIL-SOFT, no block)');

  // ============================== AFTER PASS (M-ENGINE.CONDUCTOR-SELF-WITNESS.1) ==========
  // The before pass witnesses the mission TEXT (design). The after pass witnesses the produced
  // RESULT against its own "Done means". These tests prove: (1) the Done-means + real receipts
  // land in the after-context, (2) the after call is tagged pass:'after', (3) the after pass is
  // non-blocking + GR10-serial like the before pass.

  // ---- extractDoneMeans: mirrors the lint/split detector ----
  ck(extractDoneMeans('Maqsad: x. Done means: file.mjs exists and node -c passes.') === 'file.mjs exists and node -c passes.', 'extractDoneMeans: pulls the Done-means clause');
  ck(extractDoneMeans('Done = the gate flags before AND after.\nNEXT: something') === 'the gate flags before AND after.', 'extractDoneMeans: "Done =" form, stops at next Capitalized header');
  ck(extractDoneMeans('a mission with no contract at all') === '', 'extractDoneMeans: no clause -> empty string (fail-soft)');

  // ---- summarizeResult: reads the REAL step receipts, not the assertion ----
  const rDone = { ok: true, phase: 'done', steps: [
    { step: 1, ok: true, target: 'self_witness.mjs', sha: 'abcdef123456' },
    { step: 2, ok: true, engineExec: true, target: 'node -c ok' },
  ], verdict: { consensus: 'APPROVE' } };
  const summ = summarizeResult(rDone);
  ck(/2\/2 passed/.test(summ) && /self_witness\.mjs/.test(summ) && /verdict consensus: APPROVE/.test(summ), 'summarizeResult: reports pass-count, real targets, verdict from the result object');
  ck(/commit abcdef12/.test(summ) && /engine-exec/.test(summ), 'summarizeResult: distinguishes commit vs engine-exec receipts');

  // ---- buildAfterContext: Done-means + receipts in context, tagged pass:after ----
  const after = buildAfterContext('Maqsad: y. Done means: self_witness.mjs has an after pass.', rDone, { artifact: 'M-AFTER', artifact_kind: 'mission' });
  ck(after.context.pass === 'after', 'buildAfterContext: context tagged pass:"after"');
  ck(after.context.contextText.includes('self_witness.mjs has an after pass') && after.context.contextText.includes('ACTUAL PRODUCED RECEIPTS'), 'buildAfterContext: contextText carries BOTH the Done-means contract AND the real receipts');
  ck(after.text.includes('AFTER-COMPLETION REVIEW') && after.text.includes('satisfies its own "Done means"'), 'buildAfterContext: the witness question is the AFTER question (result vs Done-means)');

  // ---- witnessArtifact AFTER end-to-end: receipt tagged pass:'after', non-blocking ----
  const afterEmitted = [];
  const resAfter = await witnessArtifact(after.text, after.context, {
    structureFn: async () => ({ verdict: 'APPROVE', notes: 'result satisfies done-means', ran: true }),
    groundFn: async () => ({ grounded: true, raw: 'claim grounded in receipts', ran: true }),
    probe: async () => summarizePs({ models: [] }), unload: async () => {}, emit: (r) => { afterEmitted.push(r); return r; },
  });
  ck(resAfter.receipt.pass === 'after', 'witnessArtifact AFTER: emitted receipt tagged pass:"after"');
  ck(resAfter.ok === true && resAfter.receipt.blocking === false, 'witnessArtifact AFTER: non-blocking (blocking:false), result satisfied -> ok:true');

  // ---- a FLAGGED after pass (result did NOT satisfy Done-means) is a FLAG, not a block ----
  const resAfterFlag = await witnessArtifact(after.text, after.context, {
    structureFn: async () => ({ verdict: 'REJECT', notes: 'produced output does not match Done-means', ran: true }),
    groundFn: async () => ({ grounded: false, raw: 'claim-of-done not supported by receipts', ran: true }),
    probe: async () => summarizePs({ models: [] }), unload: async () => {}, emit: (r) => r,
  });
  ck(resAfterFlag.ok === false && resAfterFlag.receipt.blocking === false, 'witnessArtifact AFTER: result MISMATCH -> ok:false FLAG but still blocking:false (never un-DONEs the mission)');

  // ---- the before pass is still tagged pass:'before' by default (minimal-change tag) ----
  const beforeRcpt = buildReceipt({ context: { artifact: 'M-BEFORE' }, laguna: { verdict: 'APPROVE', ran: true }, guardian: { grounded: true, ran: true } });
  ck(beforeRcpt.pass === 'before', 'receipt: default pass is "before" (the original v1 mission-text pass)');

  console.log(`\n${fail ? fail + ' FAIL' : 'ALL PASS — self_witness: laguna+guardian BOTH-witness, GR10-serial, non-blocking, fail-soft, BEFORE+AFTER passes'}`);
  process.exit(fail ? 1 : 0);
}

// ============================================================ --check-commit (live, real models)
// `node self_witness.mjs --check-commit [--sha <sha>] [--model laguna|ornith35b|ornith9b]`
//
// OPERATOR STANDING RULING (2026-06-16, this file's own header): "any work outside the chain
// needs to be witnessed by both Laguna AND guardian." The conductor's own hand-authored engine
// edits are exactly that category — but running the live pipeline required hand-assembling a
// node -e script each time, so it kept not happening (receipt: 2026-06-30, multiple hand-edited
// commits shipped tonight with zero live witness call, despite the standing ruling and despite
// ornith:9b/35b being installed specifically for this). Gated on an explicit flag so it never
// collides with the bare-invocation offline selftest above. Default model is laguna (the
// operator-designated default per the 2026-06-26 ruling); --model overrides for a faster/
// alternative check. Default sha is HEAD (the most recent commit) — exactly what "did I check
// my own last commit" means in practice. Always exits 0 (informational/non-blocking, matching
// this whole file's design — a flag is printed clearly, never a hard failure).
if (process.argv.includes('--check-commit')) {
  (async () => {
    const argv = process.argv;
    const argAfter = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
    const sha = argAfter('--sha', 'HEAD');
    const modelArg = argAfter('--model', 'ornith9b');
    const { execSync } = await import('node:child_process');
    let diff, subject;
    try {
      diff = execSync(`git show ${sha}`, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      subject = execSync(`git log -1 --format=%s ${sha}`, { encoding: 'utf8' }).trim();
    } catch (e) {
      console.error(`could not read commit ${sha}: ${e.message}`);
      process.exit(0);
    }
    const dispatchByModel = { laguna: lagunaDispatch, ornith35b: ornith35bDispatch, ornith9b: ornith9bDispatch };
    const modelNameByArg = { laguna: LAGUNA_MODEL, ornith35b: ORNITH_35B_MODEL, ornith9b: ORNITH_9B_MODEL };
    const dispatch = dispatchByModel[modelArg];
    if (!dispatch) { console.error(`unknown --model "${modelArg}" — use laguna | ornith35b | ornith9b`); process.exit(0); }
    console.log(`--check-commit ${sha} ("${subject}") — structural=${modelArg}, then guardian`);
    const t0 = Date.now();
    // RETRY-ON-YIELD (2026-07-01, receipt: 2 of 16 witness runs tonight were GPU-yielded and
    // NEVER re-checked -- "witness-queued" was descriptive text with no actual queue behind
    // it, so a yield was a silent, permanent skip. This process already runs detached in the
    // background via .githooks/post-commit ("& disown") -- it cannot block the commit or the
    // conductor either way, so a short bounded retry costs nothing and closes a real gap: a
    // commit whose witness got skipped for GPU-contention reasons now gets re-tried instead
    // of silently having no witness at all.
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    let r = await witnessArtifact(diff, { contextText: `Commit ${sha}: ${subject}` }, {
      structureFn: (a, c) => checkStructure(a, c, { dispatch }),
      structureModel: modelNameByArg[modelArg],
      lagunaNeedBytes: modelArg === 'ornith9b' ? ORNITH_9B_NEED_BYTES : modelArg === 'ornith35b' ? ORNITH_NEED_BYTES : 22 * 1024 * 1024 * 1024,
    });
    let retries = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 60000;
    while (r.yielded && retries < MAX_RETRIES) {
      retries++;
      console.log(`yielded (GPU busy) — retry ${retries}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s`);
      await sleep(RETRY_DELAY_MS);
      r = await witnessArtifact(diff, { contextText: `Commit ${sha}: ${subject}` }, {
        structureFn: (a, c) => checkStructure(a, c, { dispatch }),
        structureModel: modelNameByArg[modelArg],
        lagunaNeedBytes: modelArg === 'ornith9b' ? ORNITH_9B_NEED_BYTES : modelArg === 'ornith35b' ? ORNITH_NEED_BYTES : 22 * 1024 * 1024 * 1024,
      });
    }
    if (r.yielded) console.log(`still yielded after ${MAX_RETRIES} retries — giving up, no witness for this commit`);
    console.log(`elapsed ${Date.now() - t0}ms — yielded=${r.yielded} ok=${r.ok}`);
    console.log(`  laguna(structural): ${r.laguna?.verdict ?? '(no signal)'}${r.laguna?.notes ? ' — ' + r.laguna.notes.slice(0, 200) : ''}`);
    console.log(`  guardian(groundedness): ${r.guardian?.grounded === null ? '(no signal)' : r.guardian?.grounded} ${r.guardian?.raw ? '— ' + String(r.guardian.raw).slice(0, 150) : ''}`);
    if (r.ok === false) console.log('FLAG — see notes above (non-blocking; this is informational, not a gate)');
    process.exit(0);
  })();
}
