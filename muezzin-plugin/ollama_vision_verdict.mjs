// ollama_vision_verdict.mjs — multimodal visual verdict via LOCAL Ollama (nxtbeast),
// gemma4:31b. Replaces the broken agy --print path for e2e visual QC.
//
// Why this exists: agy CLI --print mode returns empty stdout even for trivial
// prompts (substrate-verified 2026-06-24); the agy visual-witness path is therefore
// non-functional on this install. gemma4:31b is multimodal and accessible via the
// standard /v1/chat/completions endpoint using OpenAI-style image_url content
// blocks with base64 inline data.
//
// LOCAL-ONLY (NO-CLOUD ruling 2026-07-02, operator-rulings.md; enforced here 2026-07-03):
// this module previously defaulted to Ollama Cloud's gemini-3-flash-preview with three
// separate ollama.com fallback paths — the last hardcoded cloud dispatch in the plugin
// after seat_dispatch's lane removal. All ollama.com paths are GONE; on local failure the
// verdict fails CLOSED with a named error instead of reaching for a forbidden provider.
// Seat choice is receipted, not arbitrary: gemma4:31b live-benchmarked 12/12 on real
// qc-baseline screenshot pairs (2026-07-01), beating both qwen3.6:27b (failed outright)
// and the old cloud gemini path (EMPTY_CONTENT_THINKING bug).
//
// DEMOTED 2026-07-07 (gap #10 escalation, GAP-CLOSURE-PLAYBOOK.md:40 "3rd crash -> demote"):
// gemma4:31b kept CUDA-crashing past every mitigation — 6 crashes 2026-07-04 night, then
// another 2026-07-07T12:43:53Z on THIS pathway with ARM 1 fully active (native endpoint +
// num_gpu offload live since 5826653/2fbe8dc). Replacement gemma4:12b-it-q8_0 benched live
// 2026-07-07 on qc-baseline landing + map desktop shots: correct site/heading/UI-element
// reads, sound PASS verdicts, 15-21s per call (vs the 31b's ~95-108s), 13GB fully
// VRAM-resident with headroom instead of riding the 31b's off-the-edge configuration.
// Same census bar applies to the 12b: a CUDA crash from this seat is a new receipt, not
// history repeating.

import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CENSUS VISIBILITY (2026-07-05, gap #10 follow-on): conduct-cycle.mjs's CUDA-crash census
// greps missions/_logs/dispatch-heartbeat.log for "CUDA error" — but this module never wrote
// to it, so a gemma crash on vision-verdict duty was invisible to the SAME metric gap #10's
// own mitigation is judged against. Mirrors seat_dispatch.mjs's hb() convention exactly
// (same file, same MUEZZIN_HB_FILE test-isolation override) so census tooling needs no
// special-casing for this pathway.
const HB_LOG_DEFAULT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'missions', '_logs', 'dispatch-heartbeat.log');
function hb(line) {
  const target = process.env.MUEZZIN_HB_FILE || HB_LOG_DEFAULT;
  try { mkdirSync(path.dirname(target), { recursive: true }); appendFileSync(target, `${new Date().toISOString()} ${line}\n`); } catch { /* heartbeat must never break the verdict */ }
}

// NATIVE ENDPOINT (2026-07-05, gap #10 ARM 1 parity fix): switched from
// /v1/chat/completions (OpenAI-compat) to /api/chat (native) — verified live that the
// compat shim SILENTLY IGNORES an `options` field (two consecutive /api/ps checks after
// calls with and without options.num_gpu:56 both showed gemma4:31b fully VRAM-resident,
// size_vram === size, zero offload). The native endpoint's options object is the ONLY
// place num_gpu/num_ctx actually take effect for this model. Response shape differs
// (message.content, not choices[0].message.content) — parsing updated accordingly.
const LOCAL_URL = 'http://nxtbeast:11434/api/chat';
const LOCAL_MODEL = 'gemma4:12b-it-q8_0'; // demoted from gemma4:31b 2026-07-07 — see header receipt

// Convert a PNG path to a bare base64 string — the native /api/chat endpoint takes raw
// base64 in the message's `images` array, NOT a data: URL (that was the compat-endpoint shape).
function pngToBase64(filePath) {
  if (!existsSync(filePath)) throw new Error(`image not found: ${filePath}`);
  return readFileSync(filePath).toString('base64');
}

// Send a vision request: text prompt + N image paths.
// Returns { ok, verdict, response, error?, raw? }
export async function ollamaVisionVerdict(promptText, imagePaths, opts = {}) {
  const t0 = Date.now();
  const model = opts.model || LOCAL_MODEL;
  if (!imagePaths || imagePaths.length === 0) {
    return { ok: false, verdict: 'error', error: 'NO_IMAGES', elapsedMs: Date.now() - t0 };
  }

  let images;
  try {
    images = imagePaths.map(pngToBase64);
  } catch (e) {
    return { ok: false, verdict: 'error', error: `IMAGE_ENCODE_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 };
  }

  // PARTIAL-OFFLOAD ARM 1 PARITY (gap #10, 2026-07-05 live catch): this module dispatches
  // gemma4:31b via its OWN direct fetch, entirely separate from seat_dispatch.mjs's
  // dispatchSeat/applyModelOptions pipeline — so ARM 1's num_gpu:56 overlay (seat_dispatch.mjs
  // MODEL_OPTIONS, commit 5612819) was NEVER applied here. Verified live: a baseline call
  // through THIS module left gemma4:31b fully VRAM-resident (size_vram === size, 19.86GB,
  // /api/ps checked immediately after) — the exact off-the-VRAM-edge configuration ARM 1 was
  // built to avoid, on the ONE duty gemma still serves (architect was reseated off it; vision-
  // verdict has no local alternative, per seat_modes.mjs). The confirmed CUDA-crash class
  // (5 occurrences, QUEUE.md) happened via the seat_dispatch pathway WITH num_gpu:56 already
  // active there — this pathway had never even received that mitigation, so its own crash
  // risk was never actually tested under ARM 1. Same value, same rationale; opts.numGpu
  // overrides for the ARM-2/ARM-3 experiments still to come (num_ctx / smaller quant).
  const body = {
    model,
    messages: [{ role: 'user', content: promptText, images }],
    stream: false,
    options: { temperature: opts.temperature ?? 0.2, num_predict: opts.maxTokens ?? 2000, num_gpu: opts.numGpu ?? 56 },
  };

  hb(`attempt-start provider=ollama-local model=${model} role=vision-verdict`);
  let resp;
  try {
    resp = await fetch(LOCAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs || 120000),
    });
  } catch (e) {
    // FAIL CLOSED: no non-local fallback exists by design (NO-CLOUD ruling 2026-07-02).
    hb(`attempt-fail provider=ollama-local model=${model} role=vision-verdict kind=FETCH_FAIL msg="${String(e.message || e).slice(0, 200)}"`);
    return { ok: false, verdict: 'error', error: `LOCAL_FETCH_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 };
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    // the census greps this file for "CUDA error" (conduct-cycle.mjs) — carry the raw body
    // text through so a gemma crash here is counted the same as a seat_dispatch one.
    hb(`attempt-fail provider=ollama-local model=${model} role=vision-verdict kind=HTTP_${resp.status} msg="${t.slice(0, 300).replace(/"/g, "'")}"`);
    return { ok: false, verdict: 'error', error: `HTTP_${resp.status}`, raw: t.slice(0, 400), elapsedMs: Date.now() - t0 };
  }

  let json;
  try { json = await resp.json(); }
  catch (e) { return { ok: false, verdict: 'error', error: `JSON_PARSE_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 }; }

  // Some thinking-style models land the answer in message.reasoning with empty content —
  // fall back to reasoning when content is empty so the verdict path keeps working.
  // NATIVE SHAPE (2026-07-05): /api/chat returns { message: {...} } directly, not the
  // OpenAI-compat { choices: [{ message }] } wrapper.
  const msg = json?.message || {};
  const responseText = (msg.content || '').trim() || (msg.reasoning || '').trim();
  if (!responseText) {
    return { ok: false, verdict: 'error', error: 'EMPTY_RESPONSE', raw: JSON.stringify(json).slice(0, 400), elapsedMs: Date.now() - t0 };
  }

  // Parse VERDICT line from the response
  const verdictMatch = responseText.match(/VERDICT:\s*(clean|concern|block)/i);
  const verdict = verdictMatch ? verdictMatch[1].toLowerCase() : 'concern';

  hb(`attempt-ok provider=ollama-local model=${model} role=vision-verdict ms=${Date.now() - t0} chars=${responseText.length}`);
  return {
    ok: true,
    verdict,
    response: responseText,
    model: `${model}@nxtbeast`,
    images_sent: imagePaths.length,
    elapsedMs: Date.now() - t0,
  };
}

// argv-guarded self-test: encode 1 baseline PNG + send a trivial "describe this image"
// prompt to verify the pipeline works end-to-end against LOCAL nxtbeast (no auth needed).
const _scriptPath = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
const _selfMatches = _scriptPath && (import.meta.url.endsWith(_scriptPath) || import.meta.url.endsWith('/' + _scriptPath));
if (_selfMatches && process.argv.includes('--selftest')) {
  (async () => {
    // ISOLATION (2026-07-05, mirrors seat_dispatch.mjs's own MUEZZIN_HB_FILE convention):
    // this selftest makes a REAL live dispatch — its heartbeat must not land in the
    // production dispatch-heartbeat.log the CUDA census / STUCK-TASK decision reads from.
    if (!process.env.MUEZZIN_HB_FILE) {
      const os = await import('node:os');
      process.env.MUEZZIN_HB_FILE = path.join(os.tmpdir(), 'muezzin-selftest-vision-hb.log');
    }
    const here = path.dirname(import.meta.url.replace(/^file:\/+/, '')).replace(/\\/g, '/');
    const sample = path.join(here, 'qc-baseline', 'about', 'desktop.png');
    if (!existsSync(sample)) {
      console.error('FAIL: no sample image at', sample);
      process.exit(1);
    }
    console.log('sending sample image to', LOCAL_MODEL, '(LOCAL-ONLY — no cloud path exists in this module)', '...');
    const r = await ollamaVisionVerdict(
      'Describe this screenshot in one short sentence. End with: VERDICT: clean',
      [sample],
    );
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })();
}
