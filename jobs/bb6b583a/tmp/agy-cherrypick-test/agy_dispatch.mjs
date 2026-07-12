// agy_dispatch.mjs — Google Antigravity CLI dispatch (agy lane)
//
// WIRING STATUS (header corrected 2026-07-07 per agy-implementation-research.md §4.2 — the
// old claim "not yet wired into seat_dispatch.mjs's PROVIDERS waterfall" was STALE): the
// wiring EXISTS. seat_dispatch.mjs imports this module, adapts it via attemptAgy, gates it
// via routePrefersAgy, and runs it as the FIRST lane in dispatchWithWaterfall. The lane is
// armed by any of: env USE_AGY_EXECUTOR=true, route file {"prefer":"agy","until":"<ISO>"},
// or a seat model that is an agy display label / frontier-gemini name (agy binary present).
//
// MODEL IDS (verified 2026-07-07, `agy models` on v1.0.16): agy accepts DISPLAY LABELS as
// the canonical --model values — the label string IS the CLI id; there is no separate
// effort flag (the parenthesized tier selects it). The valid set is fetched server-side per
// session (fetchAvailableModels) and can change without a CLI update.
//
// SILENT-FALLBACK GOTCHA (verified): an unrecognized --model value does NOT error — the CLI
// logs `Failed to resolve model flag <X>: ...` (severity W) and SILENTLY runs the
// settings.json default model. Receipted failing slugs: claude-opus-4-5 (395x),
// gemini-3.5-flash (165x), claude-opus-4-6, gpt-oss-120b. RECEIPT TRICK: after a dispatch,
// the newest ~/.gemini/antigravity-cli/log/cli-*.log carries
//   `Propagating selected model override to backend: label="<label>"`
// — grep that line (plus `promptLength=<n>`) to verify which model actually ran and that
// the prompt landed intact. Never trust the flag alone.
//
// ARGV TRAP (verified; research §2.2 + S1): -p/--print is a VALUE-TAKING string flag whose
// value IS the prompt. The old argv here put bare `--print` before other flags, so it
// consumed the literal `--print-timeout` as the prompt (promptLength=15 receipts), Go flag
// parsing stopped at the next positional ('5m'), and --dangerously-skip-permissions +
// --add-dir were DROPPED. Correct shape (buildAgyArgs below): ALL flags first, prompt LAST
// as the --print value. Stdin-prompt mode is UNVERIFIED (research E1 still open), so
// prompts exceeding the Windows argv cap FAIL CLOSED (kind=PROMPT_TOO_LONG) instead of
// riding an unreceipted stdin path.
//
// QUOTA (corrected 2026-07-07 — the old "shared 4-hour rolling window" claim is REFUTED,
// research §2.4): quota is a ~5-HOUR refresh cycle PLUS weekly per-model-family pools
// (observed reset countdowns of 1h12m-3h46m alongside 53h47m and 99h51m the same day).
// Exhaustion shape: `RESOURCE_EXHAUSTED (code 429): Individual quota reached. ... Resets
// in <duration>.` — parse the duration to tell a session wall from a weekly-class wall.
// Still SEPARATE from the operator's direct-Anthropic Claude budget.
//
// Identity caveat (operator awareness): Antigravity's Claude labels route via Vertex with a
// translation/routing layer; behavior may not be identical to direct-API Claude. Acceptable
// for executor seats (substrate = the deed, not the model's identity claim); judgment/
// governance seats stay on direct channels per the seat plan's carve-out.
//
// The --print stdout caveat: agy frequently returns exit 0 with EMPTY stdout even when the
// model ran (planner-loop swallow). This module reports the process-level outcome only;
// seat_dispatch.mjs's attemptAgy throws EMPTY_CONTENT on empty stdout (P0-CORPUS law —
// empty content is an error, never a result; the old placeholder string poisoned verdict
// seats). Executor deed-verification lives in the runner's execReceipt, on disk.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

// Exported (2026-07-08, fork intake 3): ollama_vision_verdict.mjs's agyVisionVerdict invokes
// the same binary via execFileSync — single source of truth for the path, not a duplicate.
export const AGY_BIN = 'C:/Users/marka/AppData/Local/agy/bin/agy.exe';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — agy needs the planning window
const SENTINEL_TIMEOUT_MS = 30 * 1000;    // 30s sentinel for quota-tap detection

// The 8 display labels `agy models` prints (v1.0.16, verified byte-exact 2026-07-07).
// The label IS the --model id. Server-curated: re-receipt this list when agy updates.
export const AGY_MODELS = new Set([
  'Gemini 3.5 Flash (Low)',
  'Gemini 3.5 Flash (Medium)',
  'Gemini 3.5 Flash (High)',
  'Gemini 3.1 Pro (Low)',
  'Gemini 3.1 Pro (High)',
  'Claude Sonnet 4.6 (Thinking)',
  'Claude Opus 4.6 (Thinking)',
  'GPT-OSS 120B (Medium)',
]);

const DEFAULT_MODEL = 'Claude Sonnet 4.6 (Thinking)';

// Windows CreateProcess command lines cap at 32767 chars; leave headroom for the exe path
// and flags. Prompts longer than this fail closed (see ARGV TRAP note above / research E1).
export const AGY_ARGV_PROMPT_MAX = 28000;

// Model-id mapping: when a seat (e.g. qwen3-coder-next) escalates to the agy lane, this
// maps the seat's logical model name to agy's actual --model DISPLAY LABEL. Every value
// MUST be a member of AGY_MODELS (the selftest enforces this) — slug values are how the
// old map silently ran the settings.json default while reporting provider=agy-<slug>.
const SEAT_TO_AGY_MODEL = {
  'qwen3-coder-next': 'Claude Sonnet 4.6 (Thinking)',          // executor seat → Sonnet 4.6 via agy
  'kimi-k2.7-code': 'Claude Sonnet 4.6 (Thinking)',            // alternate executor (legacy alias name, kept for compat)
  'north-mini-code-toolcall': 'Claude Sonnet 4.6 (Thinking)',  // honest name for the same blob (2026-07-03)
  'sonnet': 'Claude Sonnet 4.6 (Thinking)',                    // direct sonnet alias
  'claude-sonnet-4-6': 'Claude Sonnet 4.6 (Thinking)',         // the ONLY slug with a positive resolve receipt — normalized to the label anyway
  'claude-sonnet-5': 'Claude Sonnet 4.6 (Thinking)',           // agy has no Sonnet 5; closest family match made EXPLICIT (was a silent DEFAULT fallback — research §4.3.6)
  'opus': 'Claude Opus 4.6 (Thinking)',                        // was slug 'claude-opus-4-5': receipted 395x resolve FAILURES (silent default fallback)
  'gemini-3.5-flash': 'Gemini 3.5 Flash (Medium)',             // was the bare slug: receipted 165x resolve failures
  'gemini-3-flash-preview': 'Gemini 3.5 Flash (Medium)',       // preview alias → current Flash label
  'gemini': 'Gemini 3.5 Flash (Medium)',                       // generic Gemini alias
  'gemini-3-ultra': 'Gemini 3.1 Pro (High)',                   // 'gemini-3-ultra' is absent from the 8-label list; highest Gemini tier available
};

export function agyAvailable() {
  try { return existsSync(AGY_BIN) && statSync(AGY_BIN).isFile(); }
  catch { return false; }
}

// isAgyModelLabel — true when the name IS one of the verified display labels. Used by
// seat_dispatch.mjs's routePrefersAgy: a display-label seat is agy-only by definition
// (not an Ollama tag, not a Claude-CLI name) and MUST route via the agy lane.
export function isAgyModelLabel(name) {
  return AGY_MODELS.has(String(name || ''));
}

export function resolveAgyModel(seatOrModel) {
  if (isAgyModelLabel(seatOrModel)) return seatOrModel;   // display labels pass through verbatim — never downgraded to DEFAULT
  return SEAT_TO_AGY_MODEL[seatOrModel] || DEFAULT_MODEL;
}

// buildAgyArgs — the receipted-correct argv shape: ALL flags first, prompt LAST as the
// --print value (research §2.2: `agy --model "<label>" --print-timeout 15s -p "<prompt>"`).
// NEVER emit bare `--print` followed by another flag — --print is value-taking and would
// eat that flag as the prompt, and Go flag parsing drops everything after the first
// positional (including --dangerously-skip-permissions). Exported for the offline selftest.
export function buildAgyArgs({ model, printTimeout, cwd, prompt }) {
  const args = [
    '--model', model,
    '--print-timeout', printTimeout,
    '--dangerously-skip-permissions',
  ];
  if (cwd) args.push('--add-dir', cwd);
  args.push('--print', prompt);   // prompt is the --print VALUE, after every flag
  return args;
}

// treeKill — Windows tree-kill parity with attemptClaude (seat_dispatch.mjs taskkill timer).
// The old bare child.kill('SIGKILL') felled only the direct child; agy spawns a language-
// server grandchild that survived (receipted orphan agy.exe PID 28008, research session
// 2026-07-07). taskkill /T /F fells the whole tree. SIGKILL remains the non-Windows /
// taskkill-failure fallback. No-op once the child has already exited.
function treeKill(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  try {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } catch {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

// dispatchAgy — spawn agy with the receipted-correct argv and resolve when it exits.
//
// Returns: { ok, exitCode, stdout, stderr, elapsedMs, model, provider:'agy', error? }
//
// Does NOT trust stdout for the result. The caller (seat_dispatch attemptAgy / executor
// paths) is responsible for judging content: attemptAgy throws EMPTY_CONTENT on empty
// stdout; executor deeds are read from disk via the runner's execReceipt.
//
// Failure modes (all return ok:false with a structured error kind):
// - AGY_BIN missing                        → kind='AGY_BINARY_MISSING'
// - prompt exceeds the Windows argv cap    → kind='PROMPT_TOO_LONG' (fail closed; E1 open)
// - process spawn throws                   → kind='SPAWN_ERROR'
// - process killed by timeout              → kind='TIMEOUT' (tree-killed via taskkill /T /F)
// - non-zero exit code                     → kind='NONZERO_EXIT'

export async function dispatchAgy(prompt, opts = {}) {
  const t0 = Date.now();
  const model = opts.model || resolveAgyModel(opts.seat);
  const cwd = opts.cwd; // workspace agy is allowed to write into
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const printTimeout = opts.printTimeout || '5m';

  if (!agyAvailable()) {
    return {
      ok: false, exitCode: -1, stdout: '', stderr: '',
      elapsedMs: Date.now() - t0, model, provider: 'agy',
      error: { kind: 'AGY_BINARY_MISSING', detail: `agy.exe not found at ${AGY_BIN}` },
    };
  }

  // FAIL CLOSED on oversize prompts: the prompt rides argv (the only receipted-working
  // path); stdin-prompt mode is unverified (research E1). A loud PROMPT_TOO_LONG beats a
  // silently mis-parsed dispatch — the caller's waterfall falls through to the next lane.
  const p = String(prompt ?? '');
  if (p.length > AGY_ARGV_PROMPT_MAX) {
    return {
      ok: false, exitCode: -1, stdout: '', stderr: '',
      elapsedMs: Date.now() - t0, model, provider: 'agy',
      error: { kind: 'PROMPT_TOO_LONG', detail: `prompt ${p.length} chars exceeds argv cap ${AGY_ARGV_PROMPT_MAX} (stdin-prompt mode unreceipted — research E1)` },
    };
  }

  const args = buildAgyArgs({ model, printTimeout, cwd, prompt: p });

  return new Promise((resolve) => {
    let stdout = '', stderr = '', resolved = false, child;
    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      treeKill(child);   // no-op when the child already exited; fells the whole tree on timeout
      resolve({ ...payload, elapsedMs: Date.now() - t0, model, provider: 'agy' });
    };

    try {
      child = spawn(AGY_BIN, args, {
        cwd: cwd || process.cwd(),
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        // stdin CLOSED: the prompt rides argv, and open stdin pipes hang agy (`agy models`
        // hang class, research §1.11) — never leave an idle pipe attached.
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      return finish({ ok: false, exitCode: -1, stdout: '', stderr: '',
        error: { kind: 'SPAWN_ERROR', detail: String(e?.message || e) } });
    }

    const killer = setTimeout(() => finish({
      ok: false, exitCode: -1, stdout, stderr,
      error: { kind: 'TIMEOUT', detail: `agy timed out after ${timeoutMs}ms (tree-killed via taskkill /T /F)` },
    }), timeoutMs);

    child.stdout?.on('data', (b) => { stdout += String(b); });
    child.stderr?.on('data', (b) => { stderr += String(b); });
    child.on('error', (e) => {
      clearTimeout(killer);
      finish({ ok: false, exitCode: -1, stdout, stderr,
        error: { kind: 'SPAWN_ERROR', detail: String(e?.message || e) } });
    });
    child.on('close', (code) => {
      clearTimeout(killer);
      finish({
        ok: code === 0,
        exitCode: code ?? -1,
        stdout, stderr,
        ...(code !== 0 ? { error: { kind: 'NONZERO_EXIT', detail: `agy exited with code ${code}` } } : {}),
      });
    });
  });
}

// sentinelProbe — short-timeout call to detect quota-tap before committing a full dispatch.
// Returns true if agy responds within SENTINEL_TIMEOUT_MS, false otherwise (suggesting
// either quota exhausted or agy-side outage). The caller (waterfall) interprets a false
// return as "skip agy lane, escalate to direct-API Claude (Sonnet) this cycle".
// NOTE quota pools are per model FAMILY (research §2.4) — probe the same family you intend
// to dispatch, or the sentinel proves nothing about the target seat's pool.

export async function sentinelProbe(opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const r = await dispatchAgy('Status check. Respond with the word OK.', {
    model,
    timeoutMs: opts.timeoutMs || SENTINEL_TIMEOUT_MS,
    printTimeout: '30s',
  });
  // Sentinel passes if exit 0 in time (regardless of stdout — see emission caveat).
  return r.ok && r.elapsedMs < (opts.timeoutMs || SENTINEL_TIMEOUT_MS);
}

// argv-guarded self-test: `node agy_dispatch.mjs --selftest` runs the OFFLINE argv-shape +
// model-map checks, then (unless --offline is passed) ONE real agy probe on the cheapest
// label. Per the plugin's convention (every .mjs has an argv-guarded self-test).
//
// 2026-07-01 receipt: process.argv[1] is undefined whenever this module is loaded via a
// dynamic import() (e.g. `node -e "import('./mission_split.mjs')"`, or any transitive
// import chain reached that way) -- `.replace()` on undefined then threw
// "Cannot read properties of undefined (reading 'replace')" from top-level module code,
// which is unrecoverable and crashes the ENTIRE importing process, not just this file's
// own self-test. Root-caused after this exact crash text recurred 12 times over ~55
// minutes in a live mission (engine-hajj-template-headless-and-visual-qc), which loads
// mission_split.mjs -> deconstructor.mjs -> seat_dispatch.mjs -> this file, and ran out
// of retries before anyone traced it here. This guard was previously worked around ad
// hoc (manually setting process.argv[1] before a dynamic import) rather than fixed at
// the source -- fixed here instead, since every future importer hits the same crash.
//
// 2026-07-07 receipt: the old guard compared import.meta.url ('file:///C:/...', THREE
// slashes) against `file://${argv[1]}` ('file://C:/...', TWO slashes) — never equal on
// Windows, so this selftest silently NEVER RAN. Replaced with the repo convention
// (seat_modes.mjs / seat_dispatch.mjs): argv[1]?.endsWith — the ?. keeps the
// dynamic-import crash fix above.
if (process.argv[1]?.endsWith('agy_dispatch.mjs') && process.argv.includes('--selftest')) {
  (async () => {
    let pass = 0, fail = 0;
    const ck = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? pass++ : fail++; };

    console.log('agy_dispatch self-test: OFFLINE argv-shape + model-map checks');

    // -- ARGV SHAPE, polarity 1: WITH cwd. The receipted-correct order is every flag first,
    //    prompt LAST as the --print value (the flag-parsing trap fix, research §2.2/S1).
    const a1 = buildAgyArgs({ model: 'Gemini 3.5 Flash (Low)', printTimeout: '30s', cwd: 'C:/tmp/ws', prompt: 'Reply OK' });
    ck('argv(cwd): prompt is the FINAL token, immediately after --print', a1[a1.length - 2] === '--print' && a1[a1.length - 1] === 'Reply OK');
    ck('argv(cwd): --model carries the display label verbatim', a1[a1.indexOf('--model') + 1] === 'Gemini 3.5 Flash (Low)');
    ck('argv(cwd): --print-timeout precedes --print (never eaten as the prompt)', a1.indexOf('--print-timeout') !== -1 && a1.indexOf('--print-timeout') < a1.indexOf('--print'));
    ck('argv(cwd): --dangerously-skip-permissions precedes --print (not dropped)', a1.indexOf('--dangerously-skip-permissions') !== -1 && a1.indexOf('--dangerously-skip-permissions') < a1.indexOf('--print'));
    ck('argv(cwd): --add-dir present and precedes --print', a1.indexOf('--add-dir') !== -1 && a1[a1.indexOf('--add-dir') + 1] === 'C:/tmp/ws' && a1.indexOf('--add-dir') < a1.indexOf('--print'));
    ck('argv(cwd): the broken old shape is absent (--print value is the prompt, not a flag)', a1[a1.indexOf('--print') + 1] === 'Reply OK');

    // -- ARGV SHAPE, polarity 2: WITHOUT cwd.
    const a2 = buildAgyArgs({ model: 'Claude Sonnet 4.6 (Thinking)', printTimeout: '5m', prompt: 'Reply OK' });
    ck('argv(no cwd): no --add-dir emitted', !a2.includes('--add-dir'));
    ck('argv(no cwd): prompt still the FINAL token after --print', a2[a2.length - 2] === '--print' && a2[a2.length - 1] === 'Reply OK');
    ck('argv(no cwd): all flags precede --print', ['--model', '--print-timeout', '--dangerously-skip-permissions'].every((f) => a2.indexOf(f) < a2.indexOf('--print')));

    // -- MODEL MAP: display labels canonical, no receipted-failing slugs, no silent downgrades.
    ck('map: every SEAT_TO_AGY_MODEL value is a verified display label', Object.values(SEAT_TO_AGY_MODEL).every((v) => AGY_MODELS.has(v)));
    ck('map: no slug-style values survive (receipted silent-fallback class)', Object.values(SEAT_TO_AGY_MODEL).every((v) => !/^[a-z0-9.-]+$/.test(v)));
    ck("resolveAgyModel: display label passes through verbatim", resolveAgyModel('Gemini 3.1 Pro (High)') === 'Gemini 3.1 Pro (High)');
    ck("resolveAgyModel: 'opus' -> Claude Opus 4.6 (Thinking) [was failing slug claude-opus-4-5]", resolveAgyModel('opus') === 'Claude Opus 4.6 (Thinking)');
    ck("resolveAgyModel: 'gemini-3.5-flash' slug -> Gemini 3.5 Flash (Medium) [was 165x-failing slug]", resolveAgyModel('gemini-3.5-flash') === 'Gemini 3.5 Flash (Medium)');
    ck("resolveAgyModel: 'claude-sonnet-5' -> explicit Sonnet 4.6 label (research §4.3.6 silent-downgrade fix)", resolveAgyModel('claude-sonnet-5') === 'Claude Sonnet 4.6 (Thinking)');
    ck("resolveAgyModel: unknown seat -> DEFAULT_MODEL (a valid label)", AGY_MODELS.has(resolveAgyModel('no-such-seat')));
    ck("isAgyModelLabel: label true / slug false", isAgyModelLabel('GPT-OSS 120B (Medium)') && !isAgyModelLabel('gpt-oss-120b'));

    // -- PROMPT_TOO_LONG fail-closed guard (offline: returns before any spawn).
    const big = await dispatchAgy('x'.repeat(AGY_ARGV_PROMPT_MAX + 1), { model: 'Gemini 3.5 Flash (Low)', timeoutMs: 1000 });
    ck('dispatchAgy: oversize prompt fails CLOSED with kind=PROMPT_TOO_LONG (no spawn)', big.ok === false && big.error?.kind === 'PROMPT_TOO_LONG');

    ck('agy binary present', agyAvailable());

    if (!process.argv.includes('--offline')) {
      console.log('live probe: sentinelProbe on "Gemini 3.5 Flash (Low)" (verify via newest ~/.gemini/antigravity-cli/log/cli-*.log: promptLength=39 + Propagating label line)');
      const sentinel = await sentinelProbe({ model: 'Gemini 3.5 Flash (Low)', timeoutMs: 30000 });
      ck('live sentinel probe (exit 0 within budget)', sentinel);
    } else {
      console.log('live probe SKIPPED (--offline)');
    }

    console.log(`[selftest] ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  })();
}
