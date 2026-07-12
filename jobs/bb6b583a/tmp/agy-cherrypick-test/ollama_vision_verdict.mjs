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
//
// AGY PATH RE-ENABLED (2026-07-08, fork intake 3 — supersedes the 2026-06-24 "agy --print
// returns empty stdout" death claim ABOVE for vision duty): agy print-mode vision WORKS via
// WORKSPACE FILE READ, not an image flag (probed 2026-07-07/08; operator pick seated
// Gemini 3.5 Flash as visual QC, fork commit 57f5609). Winning shape: copy the png into a
// scratch dir, then `agy --add-dir <scratch> --log-file <scratch>/cli-<ts>.log --model
// "Gemini 3.5 Flash (Low)" -p "Open the image file <uniqueName> in this workspace ..."`.
// HAZARD (paid for in the probe): a GENERIC filename resolved a SAME-NAMED file from a
// different prior workspace — the response cited another path entirely. CONTRACT enforced
// below: unique per-call filenames + FAIL (VISION_PATH_COLLISION) if the response cites any
// absolute path outside the scratch dir. ollamaVisionVerdict (mistral@nxtbeast) remains the
// failover lane via visionVerdict().

import { readFileSync, existsSync, appendFileSync, mkdirSync, copyFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGY_BIN, agyAvailable, isAgyModelLabel, AGY_ARGV_PROMPT_MAX } from './agy_dispatch.mjs';

// CENSUS VISIBILITY (2026-07-05, gap #10 follow-on): conduct-cycle.mjs's CUDA-crash census
// greps missions/_logs/dispatch-heartbeat.log for "CUDA error" — but this module never wrote
// to it, so a gemma crash on vision-verdict duty was invisible to the SAME metric gap #10's
// own mitigation is judged against. Mirrors seat_dispatch.mjs's hb() convention exactly
// (same file, same MUEZZIN_HB_FILE test-isolation override) so census tooling needs no
// special-casing for this pathway.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HB_LOG_DEFAULT = path.join(HERE, 'missions', '_logs', 'dispatch-heartbeat.log');
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
// GEMMA FAMILY DEMOTED ENTIRELY 2026-07-07 (second demotion same day): the 12b replacement
// CUDA-crashed x3 within 11 min on this same duty (heartbeat 19:44/19:48/19:55Z HTTP_500,
// fully resident with headroom) — the crash class follows the gemma family/driver, not the
// 31b's VRAM edge. mistral-small3.2:24b benched 2/2 on qc-baseline landing+map (correct
// site/heading/UI reads incl. button colors, sound verdicts, 5-28s, 15GB resident).
const LOCAL_MODEL = 'mistral-small3.2:24b';

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

// ============================== agy vision path (2026-07-08) ==============================

// Scratch workspace agy reads images FROM. Fork-local under missions/_logs so nothing
// escapes the plugin tree; each call gets unique filenames (collision hazard, header note).
const SCRATCH_DIR = path.join(HERE, 'missions', '_logs', 'vision-scratch');
const AGY_VISION_MODEL = 'Gemini 3.5 Flash (Low)';   // operator pick (fork commit 57f5609)
const AGY_VISION_TIMEOUT_MS = 5 * 60 * 1000;         // agy needs its planning window (mirrors agy_dispatch DEFAULT_TIMEOUT_MS)
const SCRATCH_MAX_AGE_MS = 60 * 60 * 1000;           // stale scratch files (>1h) get swept

// treeKillPid — LOCAL COPY of agy_dispatch.mjs's treeKill (that one is NOT exported and
// takes a spawn() child handle; execFileSync only surfaces err.pid on failure, so a
// pid-shaped variant is needed). Same receipt applies: agy spawns a language-server
// grandchild that survives a bare kill — taskkill /T /F fells the reachable tree.
// Best-effort: if the direct child already died, orphaned grandchildren have no parent
// record for /T to traverse (Windows limitation); this still catches the common case
// where the tree is intact at timeout.
function treeKillPid(pid) {
  if (!pid) return;
  try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
  catch { /* already gone or not killable — best-effort by design */ }
}

// sweepScratch — best-effort deletion of scratch files older than SCRATCH_MAX_AGE_MS
// (stale image copies AND stale cli-*.log files from prior calls). Never throws.
function sweepScratch() {
  try {
    const cutoff = Date.now() - SCRATCH_MAX_AGE_MS;
    for (const f of readdirSync(SCRATCH_DIR)) {
      const p = path.join(SCRATCH_DIR, f);
      try { if (statSync(p).mtimeMs < cutoff) unlinkSync(p); } catch { /* per-file best-effort */ }
    }
  } catch { /* scratch missing or unreadable — nothing to sweep */ }
}

// scanForeignPaths — the COLLISION CONTRACT's teeth. Extracts every absolute path the
// response cites (file:/// URLs and drive-letter paths) and returns the ones that do NOT
// resolve under scratchDir. Any foreign citation means agy read something other than our
// copies (the probed hazard: a same-named file from a different prior workspace).
// Conservative by design: a truncated match (e.g. a path with spaces cut at the space)
// that falls outside scratch still fails — FAIL-on-doubt is the contract's direction.
function scanForeignPaths(text, scratchDir = SCRATCH_DIR) {
  const re = /(?:file:\/\/\/?[^\s"'<>|)\]]+|[A-Za-z]:[\\/][^\s"'<>|)\]]*)/g;
  const scratchNorm = String(scratchDir).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const foreign = [];
  for (const m of String(text || '').matchAll(re)) {
    let p = m[0].replace(/^file:\/+/i, '');           // file:///C:/x and file://C:/x both -> C:/x
    try { p = decodeURIComponent(p); } catch { /* keep raw on malformed escapes */ }
    p = p.replace(/\\/g, '/').replace(/[.,;:]+$/, ''); // strip sentence-trailing punctuation
    if (!p.toLowerCase().startsWith(scratchNorm)) foreign.push(m[0]);
  }
  return foreign;
}

// agyVisionVerdict — visual verdict via agy print-mode WORKSPACE FILE READ.
// Same return contract as ollamaVisionVerdict: { ok, verdict, response, error?, raw?, elapsedMs }.
//
// Mechanics (receipted winning shape, header note):
//   1. copy each image into SCRATCH_DIR as qc-<sanitized stem>-<Date.now()>-<i>.png (unique per call)
//   2. execFileSync agy with: flags first, prompt LAST as the -p value — MIRRORS
//      agy_dispatch.mjs's buildAgyArgs conventions (argv trap: -p/--print is value-taking;
//      Go flag parsing drops everything after the first positional). buildAgyArgs itself is
//      NOT imported because its shape has no --log-file slot and its cwd param means
//      "mission workspace", not "scratch dir" — mirrored here with the same flag-order law.
//   3. collision contract: any cited absolute path outside SCRATCH_DIR => VISION_PATH_COLLISION
//   4. parse VERDICT: clean|concern|block (same regex as ollamaVisionVerdict)
//   5. cleanup: this call's copies deleted, >1h-old scratch swept, THIS call's cli log kept
//
// opts._exec is a selftest seam (stub the agy invocation); production callers omit it.
export async function agyVisionVerdict(promptText, imagePaths, opts = {}) {
  const t0 = Date.now();
  // SILENT-FALLBACK GUARD (receipted, agy_dispatch.mjs header): an unrecognized --model
  // value makes agy run the settings.json default SILENTLY. Never hand agy a non-label —
  // coerce anything that is not a verified display label to the seated vision default.
  const model = isAgyModelLabel(opts.model) ? opts.model : AGY_VISION_MODEL;
  if (opts.model && model !== opts.model) hb(`note provider=agy-vision role=vision-verdict coerced-model from="${String(opts.model).slice(0, 60)}" to="${model}"`);

  if (!imagePaths || imagePaths.length === 0) {
    return { ok: false, verdict: 'error', error: 'NO_IMAGES', elapsedMs: Date.now() - t0 };
  }
  if (!opts._exec && !agyAvailable()) {
    return { ok: false, verdict: 'error', error: 'AGY_BINARY_MISSING', elapsedMs: Date.now() - t0 };
  }

  try { mkdirSync(SCRATCH_DIR, { recursive: true }); } catch { /* copy below will surface it */ }
  sweepScratch();

  // 1. unique per-call copies (the collision hazard's first defense)
  const ts = Date.now();
  const copies = [];
  const cleanupCopies = () => { for (const n of copies) { try { unlinkSync(path.join(SCRATCH_DIR, n)); } catch { /* best-effort */ } } };
  try {
    imagePaths.forEach((src, i) => {
      if (!existsSync(src)) throw new Error(`image not found: ${src}`);
      const stem = path.basename(src).replace(/\.[^.]*$/, '');
      const safe = (stem.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48)) || 'img';
      const name = `qc-${safe}-${ts}-${i}.png`;
      copyFileSync(src, path.join(SCRATCH_DIR, name));
      copies.push(name);
    });
  } catch (e) {
    cleanupCopies();
    return { ok: false, verdict: 'error', error: `IMAGE_COPY_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 };
  }

  // 2. prompt names each unique filename; ends with the verdict instruction
  const logPath = path.join(SCRATCH_DIR, `cli-${ts}.log`);
  const fileLines = copies.map((n, i) => `[${i + 1}] ${n}`).join('\n');
  const prompt =
    `Open the image file${copies.length > 1 ? 's' : ''} listed below in this workspace, by these exact names:\n` +
    `${fileLines}\n\n${promptText}\n\nEnd with VERDICT: clean|concern|block`;
  if (prompt.length > AGY_ARGV_PROMPT_MAX) {
    cleanupCopies();
    return { ok: false, verdict: 'error', error: `PROMPT_TOO_LONG: ${prompt.length} chars exceeds argv cap ${AGY_ARGV_PROMPT_MAX}`, elapsedMs: Date.now() - t0 };
  }
  const args = [
    '--model', model,
    '--print-timeout', opts.printTimeout || '5m',
    '--dangerously-skip-permissions',
    '--add-dir', SCRATCH_DIR,
    '--log-file', logPath,
    '-p', prompt,   // prompt is the -p VALUE, after every flag (buildAgyArgs law)
  ];

  hb(`attempt-start provider=agy-vision model=${model} role=vision-verdict images=${copies.length}`);
  const exec = opts._exec || ((bin, a) => execFileSync(bin, a, {
    cwd: SCRATCH_DIR,
    windowsHide: true,
    encoding: 'utf8',
    timeout: opts.timeoutMs || AGY_VISION_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: 16 * 1024 * 1024,
    // stdin CLOSED: open stdin pipes hang agy (agy_dispatch.mjs receipt, research §1.11)
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }));

  let stdout = '';
  try {
    stdout = exec(AGY_BIN, args);
  } catch (e) {
    // taskkill /T fallback: execFileSync's killSignal fells only the direct child; the
    // language-server grandchild needs the tree kill (treeKillPid comment above).
    if (e && e.pid) treeKillPid(e.pid);
    cleanupCopies();
    const kind = (e && (e.signal || e.code === 'ETIMEDOUT')) ? 'TIMEOUT'
      : (e && typeof e.status === 'number' && e.status !== 0) ? `NONZERO_EXIT_${e.status}`
      : 'SPAWN_ERROR';
    hb(`attempt-fail provider=agy-vision model=${model} role=vision-verdict kind=${kind} msg="${String(e?.message || e).slice(0, 200).replace(/"/g, "'")}"`);
    return { ok: false, verdict: 'error', error: `AGY_${kind}`, raw: String(e?.stdout || '').slice(0, 400), elapsedMs: Date.now() - t0 };
  }

  const responseText = String(stdout || '').trim();
  if (!responseText) {
    cleanupCopies();
    // P0-CORPUS law (agy_dispatch header): empty content is an error, never a result.
    hb(`attempt-fail provider=agy-vision model=${model} role=vision-verdict kind=EMPTY_RESPONSE`);
    return { ok: false, verdict: 'error', error: 'EMPTY_RESPONSE', elapsedMs: Date.now() - t0 };
  }

  // 3. COLLISION CONTRACT: any cited path outside the scratch dir fails the call.
  const foreign = scanForeignPaths(responseText, SCRATCH_DIR);
  if (foreign.length > 0) {
    cleanupCopies();
    hb(`attempt-fail provider=agy-vision model=${model} role=vision-verdict kind=VISION_PATH_COLLISION paths="${foreign.slice(0, 3).join(' | ').slice(0, 200).replace(/"/g, "'")}"`);
    return { ok: false, verdict: 'error', error: 'VISION_PATH_COLLISION', foreign_paths: foreign.slice(0, 5), raw: responseText.slice(0, 800), elapsedMs: Date.now() - t0 };
  }

  // 4. same VERDICT regex as ollamaVisionVerdict
  const verdictMatch = responseText.match(/VERDICT:\s*(clean|concern|block)/i);
  const verdict = verdictMatch ? verdictMatch[1].toLowerCase() : 'concern';

  // 5. cleanup: copies go, THIS call's cli log stays (the dispatch receipt)
  cleanupCopies();
  hb(`attempt-ok provider=agy-vision model=${model} role=vision-verdict ms=${Date.now() - t0} chars=${responseText.length}`);
  return {
    ok: true,
    verdict,
    response: responseText,
    model: `${model}@agy`,
    images_sent: copies.length,
    log: logPath,
    elapsedMs: Date.now() - t0,
  };
}

// visionVerdict — the seated visual-QC entrypoint: agy (Gemini 3.5 Flash workspace-read)
// first, ollamaVisionVerdict (mistral-small3.2:24b@nxtbeast) as the failover lane on ANY
// agy failure (ok:false or throw), with the failover hb-logged. Callers get whichever
// lane's result, plus a `failover` receipt on the fallback path.
//
// Model forwarding is LANE-SCOPED to avoid cross-provider contamination: opts.model goes
// to agy only when it is a verified agy display label, and to ollama only when it is NOT
// one (an agy label means nothing to Ollama and vice versa — the silent-fallback and
// 404-at-nxtbeast traps respectively).
//
// opts._agyFn / opts._ollamaFn are selftest seams; production callers omit them.
export async function visionVerdict(promptText, imagePaths, opts = {}) {
  const agyFn = opts._agyFn || agyVisionVerdict;
  const ollamaFn = opts._ollamaFn || ollamaVisionVerdict;

  let agyResult;
  try {
    agyResult = await agyFn(promptText, imagePaths, { ...opts, model: isAgyModelLabel(opts.model) ? opts.model : undefined });
  } catch (e) {
    agyResult = { ok: false, verdict: 'error', error: `AGY_THROW: ${String(e?.message || e).slice(0, 200)}` };
  }
  if (agyResult && agyResult.ok) return agyResult;

  const reason = String(agyResult?.error || 'unknown');
  hb(`failover provider=agy-vision->ollama-local role=vision-verdict reason="${reason.slice(0, 200).replace(/"/g, "'")}"`);
  const ollamaOpts = { ...opts };
  if (isAgyModelLabel(ollamaOpts.model)) delete ollamaOpts.model;   // let the local default seat apply
  const r = await ollamaFn(promptText, imagePaths, ollamaOpts);
  return { ...r, failover: { from: 'agy-vision', reason } };
}

// argv-guarded self-test. OFFLINE stubbed checks for the agy path + failover wiring run
// always; the ORIGINAL live-ollama probe (1 baseline PNG to LOCAL nxtbeast) is kept but
// skippable via --offline (agy_dispatch.mjs convention) — needed when the session running
// the selftest is under a no-ollama-dispatch constraint.
// Guard switched to the repo convention (argv[1]?.endsWith — agy_dispatch 2026-07-07
// receipt: URL-vs-argv string comparisons silently never match on Windows; the ?. keeps
// the dynamic-import crash fix).
if (process.argv[1]?.endsWith('ollama_vision_verdict.mjs') && process.argv.includes('--selftest')) {
  (async () => {
    // ISOLATION (2026-07-05, mirrors seat_dispatch.mjs's own MUEZZIN_HB_FILE convention):
    // selftest heartbeats (stub attempts, failover lines, a possible live dispatch) must
    // not land in the production dispatch-heartbeat.log the CUDA census reads from.
    if (!process.env.MUEZZIN_HB_FILE) {
      const os = await import('node:os');
      process.env.MUEZZIN_HB_FILE = path.join(os.tmpdir(), 'muezzin-selftest-vision-hb.log');
    }
    let pass = 0, fail = 0;
    const ck = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? pass++ : fail++; };
    const sample = path.join(HERE, 'qc-baseline', 'about', 'desktop.png');
    if (!existsSync(sample)) {
      console.error('FAIL: no sample image at', sample);
      process.exit(1);
    }

    console.log('agyVisionVerdict: OFFLINE stubbed-exec checks (no agy spawned)');

    // -- polarity (a): clean verdict parses; argv shape + unique-name + cleanup contracts
    let seenArgs = null;
    const rClean = await agyVisionVerdict('Describe.', [sample], {
      _exec: (bin, a) => { seenArgs = a; return 'A landing page screenshot with a hero section. VERDICT: clean'; },
    });
    ck('(a) clean verdict parses (ok:true, verdict=clean)', rClean.ok === true && rClean.verdict === 'clean');
    ck('(a) --model carries the vision display label', !!seenArgs && seenArgs[seenArgs.indexOf('--model') + 1] === 'Gemini 3.5 Flash (Low)');
    ck('(a) --add-dir is the scratch dir', !!seenArgs && seenArgs[seenArgs.indexOf('--add-dir') + 1] === SCRATCH_DIR);
    ck('(a) --log-file lives under scratch (cli-<ts>.log)', !!seenArgs && seenArgs[seenArgs.indexOf('--log-file') + 1].startsWith(SCRATCH_DIR) && /cli-\d+\.log$/.test(seenArgs[seenArgs.indexOf('--log-file') + 1]));
    ck('(a) prompt is the FINAL token as the -p value (argv-trap law)', !!seenArgs && seenArgs[seenArgs.length - 2] === '-p' && seenArgs[seenArgs.length - 1].includes('End with VERDICT: clean|concern|block'));
    const copyName = seenArgs ? (seenArgs[seenArgs.length - 1].match(/qc-[\w-]+-\d+-0\.png/) || [])[0] : undefined;
    ck('(a) prompt names a unique qc-<stem>-<ts>-<i>.png copy', !!copyName && /^qc-desktop-\d{13}-0\.png$/.test(copyName));
    ck('(a) image copy deleted after the call (cleanup)', !!copyName && !existsSync(path.join(SCRATCH_DIR, copyName)));

    // -- positive path polarity: a citation UNDER scratch is not a collision
    const rSelf = await agyVisionVerdict('Describe.', [sample], {
      _exec: (bin, a) => `Analysis written next to ${a[a.indexOf('--log-file') + 1]} — image looks fine. VERDICT: clean`,
    });
    ck('scratch-internal path citation passes (no false collision)', rSelf.ok === true && rSelf.verdict === 'clean');

    // -- polarity (b): foreign path citations => VISION_PATH_COLLISION (the probed hazard)
    const rColl = await agyVisionVerdict('Describe.', [sample], {
      _exec: () => 'Opened C:\\Users\\marka\\.claude\\muezzin-plugin\\qc-baseline\\landing\\desktop.png as requested. VERDICT: clean',
    });
    ck('(b) foreign drive-letter path => VISION_PATH_COLLISION', rColl.ok === false && rColl.error === 'VISION_PATH_COLLISION');
    const rCollUrl = await agyVisionVerdict('Describe.', [sample], {
      _exec: () => 'See file:///C:/some/other/workspace/qc-desktop-1.png for the image. VERDICT: clean',
    });
    ck('(b) foreign file:/// path => VISION_PATH_COLLISION', rCollUrl.ok === false && rCollUrl.error === 'VISION_PATH_COLLISION');

    // -- silent-fallback guard: non-label opts.model never reaches agy raw
    let coerceArgs = null;
    await agyVisionVerdict('Describe.', [sample], { model: 'gemini-3-flash-preview', _exec: (bin, a) => { coerceArgs = a; return 'VERDICT: clean'; } });
    ck('non-label opts.model coerced to the vision label (silent-fallback trap)', !!coerceArgs && coerceArgs[coerceArgs.indexOf('--model') + 1] === 'Gemini 3.5 Flash (Low)');

    // -- exec failure maps to a structured error (timeout signal shape)
    const rBoom = await agyVisionVerdict('Describe.', [sample], {
      _exec: () => { throw Object.assign(new Error('spawnSync agy.exe ETIMEDOUT'), { signal: 'SIGKILL' }); },
    });
    ck('exec timeout => ok:false error=AGY_TIMEOUT', rBoom.ok === false && rBoom.error === 'AGY_TIMEOUT');

    // -- empty stdout is an error, never a result (P0-CORPUS law)
    const rEmpty = await agyVisionVerdict('Describe.', [sample], { _exec: () => '   ' });
    ck('empty stdout => EMPTY_RESPONSE', rEmpty.ok === false && rEmpty.error === 'EMPTY_RESPONSE');

    console.log('visionVerdict: failover wiring (both lanes stubbed)');

    // -- polarity (c): agy failure => ollama fallback invoked
    let ollamaCalls = 0;
    const rFo = await visionVerdict('Describe.', [sample], {
      _agyFn: async () => ({ ok: false, verdict: 'error', error: 'AGY_TIMEOUT' }),
      _ollamaFn: async () => { ollamaCalls++; return { ok: true, verdict: 'concern', response: 'x VERDICT: concern', model: 'stub-ollama' }; },
    });
    ck('(c) agy failure => ollama fallback invoked exactly once', ollamaCalls === 1);
    ck('(c) fallback result carries the failover receipt', rFo.ok === true && rFo.verdict === 'concern' && rFo.failover?.from === 'agy-vision' && rFo.failover?.reason === 'AGY_TIMEOUT');

    // -- agy THROW (not just ok:false) also fails over
    let throwFallbacks = 0;
    const rThrow = await visionVerdict('Describe.', [sample], {
      _agyFn: async () => { throw new Error('boom'); },
      _ollamaFn: async () => { throwFallbacks++; return { ok: true, verdict: 'clean', response: 'VERDICT: clean', model: 'stub-ollama' }; },
    });
    ck('agy throw => fallback invoked (error contained)', rThrow.ok === true && throwFallbacks === 1 && /AGY_THROW/.test(rThrow.failover?.reason || ''));

    // -- agy success => fallback NOT invoked
    let idleFallbacks = 0;
    const rAgyOk = await visionVerdict('Describe.', [sample], {
      _agyFn: async () => ({ ok: true, verdict: 'clean', response: 'VERDICT: clean', model: 'Gemini 3.5 Flash (Low)@agy' }),
      _ollamaFn: async () => { idleFallbacks++; return { ok: true, verdict: 'clean' }; },
    });
    ck('agy success => fallback NOT invoked', rAgyOk.ok === true && rAgyOk.model === 'Gemini 3.5 Flash (Low)@agy' && idleFallbacks === 0);

    // -- the ORIGINAL live-ollama probe (1 real dispatch to nxtbeast), skippable
    if (!process.argv.includes('--offline')) {
      console.log('live probe: sending sample image to', LOCAL_MODEL, '(LOCAL-ONLY) ...');
      const r = await ollamaVisionVerdict(
        'Describe this screenshot in one short sentence. End with: VERDICT: clean',
        [sample],
      );
      console.log(JSON.stringify({ ok: r.ok, verdict: r.verdict, model: r.model, elapsedMs: r.elapsedMs }, null, 2));
      ck('live ollama vision probe', r.ok === true);
    } else {
      console.log('live ollama probe SKIPPED (--offline)');
    }

    console.log(`[selftest] ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  })();
}

// argv-guarded LIVE agy probe (exactly one real agy dispatch — receipted via the kept
// cli-<ts>.log + heartbeat): `node ollama_vision_verdict.mjs --probe-agy`. Uses the fork's
// own qc-baseline landing/desktop shot. Separate flag from --selftest so stub runs never
// burn agy quota by accident.
if (process.argv[1]?.endsWith('ollama_vision_verdict.mjs') && process.argv.includes('--probe-agy')) {
  (async () => {
    const sample = path.join(HERE, 'qc-baseline', 'landing', 'desktop.png');
    if (!existsSync(sample)) {
      console.error('SKIP: no qc-baseline landing/desktop.png in this checkout — live probe not possible');
      process.exit(2);
    }
    console.log('live agy vision probe:', AGY_VISION_MODEL, 'on', sample);
    const r = await agyVisionVerdict('State the main heading text exactly.', [sample]);
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })();
}
