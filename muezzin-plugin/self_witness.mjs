// self_witness.mjs — conductor-self-witness gate: BOTH-witness (laguna + guardian) for
// OUT-OF-CHAIN work, made structural (M-ENGINE.CONDUCTOR-SELF-WITNESS.1, operator standing
// ruling 2026-06-16: "any work outside the chain needs to be witnessed by both Laguna AND
// guardian").
//
// THE HOLE THIS CLOSES: the daemon's SEATS are auto-witnessed (seat_dispatch). The
// conductor's OWN hand-authored artifacts — a freshly-constructed .mission.txt, a
// root-cause diagnosis that re-routes the queue — drive autonomous work with NO reasoning
// witness. MIQAT (mission_lint) catches FORMAT bugs at fire time; nothing checked the
// REASONING. This module adds the reasoning+groundedness witness ABOVE the format lint,
// the same independent-witness discipline the seats already have.
//
// THE TWO WITNESSES ARE COMPLEMENTARY, NOT REDUNDANT (spec lines 28-31):
//   - laguna (granite-class structural, laguna-xs.2:q4_K_M): "is the REASONING sound,
//     correctly scoped, faithful to its cited receipts?" — logic flaws, gaps, overlaps.
//   - guardian (granite4.1-guardian:8b groundedness): "is every factual CLAIM supported by
//     the cited CONTEXT?" — fabricated/unsupported claims, invented receipts, mis-cites.
//
// GR10-SAFE (spec lines 40-52): laguna (33B, ~22GB VRAM) + guardian (8B, ~7GB) do NOT
// co-reside on a 24GB GPU. So the pair runs STRICTLY SERIALLY: check /api/ps, run laguna,
// STOP laguna + POLL /api/ps to clear, then run guardian. NEVER concurrent. If the GPU is
// already oversubscribed by another (daemon/seat) load when we arrive, we YIELD — emit a
// 'witness-queued: GPU busy' receipt and return ok:null rather than force a concurrent
// load (the historical ollama scheduler deadlock). In anthropic-heavy mode the daemon's
// seats run on Claude (cloud) so the local GPU is usually free for this pair.
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
const OLLAMA_BASE = 'http://localhost:11434';
const LAGUNA_MODEL = 'laguna-xs.2:q4_K_M';   // 33B structural reviewer (spec: structural witness)
const SELF_WITNESS_LOG = join(HERE, 'missions', '_logs', 'self-witness.jsonl');

// VRAM ceiling: a 24GB RTX 4090. laguna (33B q4) ≈ 22GB resident. We must not dispatch a
// load that would push total resident VRAM over this — that is the real GR10 constraint
// ("do not OVERSUBSCRIBE", spec line 45), not "is anything resident". Headroom margin keeps
// us off the exact edge where ollama's scheduler has historically deadlocked.
export const GPU_VRAM_BYTES = 24 * 1024 * 1024 * 1024;
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

// PURE: bounded laguna prompt. The verdict does not need the whole artifact, and a huge
// prompt risks the model's context (same discipline as buildGuardianPrompt).
export function buildLagunaPrompt(artifactText, contextText, { maxArt = 9000, maxCtx = 7000 } = {}) {
  const art = String(artifactText ?? '').slice(0, maxArt);
  const ctx = String(contextText ?? '').slice(0, maxCtx) || '(no context provided)';
  return `CONTEXT (cited receipts / source the artifact reasons from):\n${ctx}\n\nARTIFACT (reasoning to review):\n${art}`;
}

// real local dispatch to laguna-xs.2 (streaming-accumulate, bounded). Throws on transport
// error; the caller is fail-soft and swallows it. Same transport shape as guardianDispatch.
export async function lagunaDispatch(system, prompt, { model = LAGUNA_MODEL, num_predict = 200, timeoutMs = 600000 } = {}) {
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
        if (obj.done) return content;
      }
    }
    return content;
  } finally { clearTimeout(timer); }
}

// checkStructure(artifact, context, opts) -> { verdict, notes, ran }. dispatch injected for
// testability. Fail-soft: any throw -> { verdict: null, ran: false } (never blocks).
export async function checkStructure(artifactText, contextText, { dispatch = lagunaDispatch, system = LAGUNA_SYSTEM } = {}) {
  try {
    const raw = await dispatch(system, buildLagunaPrompt(artifactText, contextText));
    return { ...parseLagunaVerdict(raw), ran: true };
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
export async function witnessArtifact(text, context = {}, opts = {}) {
  const {
    structureFn = (a, c) => checkStructure(a, c),
    groundFn = (c, r) => checkGroundedness(c, r),
    probe = psProbe,
    unload = (m) => pollUntilUnloaded(m),
    emit = emitReceipt,
    lagunaNeedBytes = 22 * 1024 * 1024 * 1024,   // ~laguna 33B q4 resident
    guardianModel = 'granite4.1-guardian:8b',
    guardianNeedBytes = 7 * 1024 * 1024 * 1024,
  } = opts;
  const ctxText = String(context.contextText ?? text ?? '');

  // GR10 admission: probe /api/ps. If a laguna dispatch would oversubscribe the GPU
  // (another big load already resident), YIELD — never force a concurrent load.
  let ps;
  try { ps = await probe(); } catch { ps = null; }   // probe down -> treat as unknown; proceed cautiously below
  if (ps && wouldOversubscribe(ps, LAGUNA_MODEL, lagunaNeedBytes)) {
    const receipt = emit(buildReceipt({ context, yielded: true }));
    return { laguna: null, guardian: null, ok: null, yielded: true, receipt };
  }

  // DEFENSIVE WRAP (HARD RAIL — non-blocking): this gate is wired into the daemon FIRE path.
  // It must NEVER throw into that path, no matter what a witness fn does. The default
  // structureFn/groundFn are already fail-soft (checkStructure/checkGroundedness swallow),
  // but a future caller could inject a fn that throws raw — so we belt-and-suspenders here:
  // a raw throw becomes a no-signal result, never an exception out of witnessArtifact.
  const safe = async (fn, noSignal) => { try { return await fn(); } catch (e) { return { ...noSignal, raw: `witness-threw: ${String(e?.message).slice(0, 120)}` }; } };

  // WITNESS 1: laguna (structural). Serial — runs to completion before guardian loads.
  const laguna = await safe(() => structureFn(text, ctxText), { verdict: null, notes: '', ran: false });

  // GR10 serialize: STOP laguna + POLL /api/ps until it unloads, so the 8B guardian has
  // room. Only needed if laguna actually loaded a model (ran). Fail-soft inside unload.
  if (laguna?.ran) { try { await unload(LAGUNA_MODEL); } catch { /* fail-soft */ } }

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
if (process.argv[1] && process.argv[1].endsWith('self_witness.mjs')) {
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

  // ---- prompt builder bounded ----
  const lp = buildLagunaPrompt('art body', 'ctx body');
  ck(lp.includes('ARTIFACT (reasoning to review):\nart body') && lp.includes('ctx body'), 'prompt: ARTIFACT + CONTEXT labels present');
  ck(buildLagunaPrompt('x'.repeat(20000), 'y'.repeat(20000)).length < 17000, 'prompt: bounded (no unbounded blowup)');

  // ---- checkStructure fail-soft ----
  const cs = await checkStructure('art', 'ctx', { dispatch: async () => '<verdict>APPROVE</verdict> ok' });
  ck(cs.verdict === 'APPROVE' && cs.ran === true, 'checkStructure: mock APPROVE -> {verdict:APPROVE, ran:true}');
  const csDead = await checkStructure('art', 'ctx', { dispatch: async () => { throw new Error('ECONNREFUSED'); } });
  ck(csDead.verdict === null && csDead.ran === false, 'checkStructure: dispatch throw -> {verdict:null, ran:false} (fail-soft)');

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
