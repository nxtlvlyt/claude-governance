// agy_dispatch.mjs — Google Antigravity CLI dispatch (Phase-2 executor primary candidate)
//
// PENDING the operator sign-off on the MUEZZIN-SEAT-PLAN-LOCKED.md "Pending revision
// 2026-06-23" section. Not yet wired into seat_dispatch.mjs's PROVIDERS waterfall.
// This module exists as substrate-resolved capability (the dispatch path was live-tested
// 2026-06-23T15:08Z) ready to wire when the lock is updated.
//
// Why agy-Claude as primary executor:
// - Antigravity is multi-provider (Gemini + Anthropic Claude Sonnet 4.5/4.6 + Opus 4.5 +
//   OpenAI GPT-OSS), routed through Google Vertex AI. Confirmed via SearXNG search
//   + antigravity.google/blog/introducing-google-antigravity + live invocation.
// - Quota model: shared 4-hour rolling window — SEPARATE from the operator's weekly
//   direct-Anthropic-API Claude budget. Phase-2 (heaviest token phase by 10-100x)
//   shifts off the weekly budget onto the 4-hour window.
// - Identity caveat (operator awareness): Antigravity's "Claude Sonnet 4.6" routes via
//   Vertex with a translation/routing layer; the model may not be 100% behavior-identical
//   to direct-API Sonnet 4.6 (forum reports of cutoff-date mismatches + model self-id
//   inconsistencies). Acceptable for executor (substrate = the deed, not the model's
//   identity claim); the seat-plan-locked file explicitly carves out judgment/governance
//   seats from this path.
//
// Verified invocation (2026-06-23T15:08Z, exit 0, 9.2s, Vertex trace req_vrtx_011...):
//
//   agy --model "claude-sonnet-4-6"
//       --print
//       --print-timeout 5m
//       --dangerously-skip-permissions
//       --add-dir <workspace>
//       "<substantive-mission-prompt>"
//
// The --print stdout-emission caveat: agy frequently returns exit 0 with empty stdout
// even when the model successfully runs (planner-loop swallow). For executor work this
// is fine because the deliverable is FILES + COMMITS on disk, verified by the runner's
// execReceipt + integrity_guard. Trust the disk, not stdout.

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const AGY_BIN = 'C:/Users/marka/AppData/Local/agy/bin/agy.exe';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — agy needs the planning window
const SENTINEL_TIMEOUT_MS = 30 * 1000;    // 30s sentinel for quota-tap detection

// Model-id mapping: when a seat (e.g. qwen3-coder-next) escalates to the agy lane, this
// maps the seat's logical model name to agy's actual --model string. Keep in lockstep
// with seat_dispatch.mjs's CLAUDE_MODEL_MAP (mirror semantics: seat → underlying family).
const SEAT_TO_AGY_MODEL = {
  'qwen3-coder-next': 'claude-sonnet-4-6',  // executor seat → Sonnet 4.6 via agy
  'kimi-k2.7-code': 'claude-sonnet-4-6',    // alternate executor → same
  'sonnet': 'claude-sonnet-4-6',             // direct sonnet alias
  'opus': 'claude-opus-4-5',                 // when an Opus-class seat escalates
};

export function agyAvailable() {
  try { return existsSync(AGY_BIN) && statSync(AGY_BIN).isFile(); }
  catch { return false; }
}

export function resolveAgyModel(seatOrModel) {
  return SEAT_TO_AGY_MODEL[seatOrModel] || DEFAULT_MODEL;
}

// dispatchAgy — spawn agy with the substrate-verified flag set and resolve when it exits.
//
// Returns: { ok, exitCode, stdout, stderr, elapsedMs, model, provider:'agy', error? }
//
// Does NOT trust stdout for the result. The caller (executor.mjs / orchestrate.mjs) is
// responsible for reading the deed from disk via the runner's execReceipt.
//
// Failure modes (all return ok:false with a structured error kind):
// - AGY_BIN missing                       → kind='AGY_BINARY_MISSING'
// - process spawn throws                  → kind='SPAWN_ERROR'
// - process killed by timeout (> 5 min)   → kind='TIMEOUT'
// - non-zero exit code                    → kind='NONZERO_EXIT'
// - exit 0 but ALSO no file produced (the silent-emission case the caller checks)
//   is NOT detected here — the caller's execReceipt is the source of truth on whether
//   the deed actually landed. This function only reports the process-level outcome.

export async function dispatchAgy(prompt, opts = {}) {
  const t0 = Date.now();
  const model = opts.model || resolveAgyModel(opts.seat) || DEFAULT_MODEL;
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

  const args = [
    '--model', model,
    '--print',
    '--print-timeout', printTimeout,
    '--dangerously-skip-permissions',
  ];
  if (cwd) args.push('--add-dir', cwd);
  args.push(prompt);

  return new Promise((resolve) => {
    let stdout = '', stderr = '', resolved = false, child;
    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      try { if (child && !child.killed) child.kill('SIGKILL'); } catch {}
      resolve({ ...payload, elapsedMs: Date.now() - t0, model, provider: 'agy' });
    };

    try {
      child = spawn(AGY_BIN, args, {
        cwd: cwd || process.cwd(),
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    } catch (e) {
      return finish({ ok: false, exitCode: -1, stdout: '', stderr: '',
        error: { kind: 'SPAWN_ERROR', detail: String(e?.message || e) } });
    }

    const killer = setTimeout(() => finish({
      ok: false, exitCode: -1, stdout, stderr,
      error: { kind: 'TIMEOUT', detail: `agy timed out after ${timeoutMs}ms` },
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

// argv-guarded self-test: `node agy_dispatch.mjs --selftest` runs a real agy probe.
// Per the plugin's convention (every .mjs has an argv-guarded self-test). Kept dormant
// during the soak — invoke explicitly to verify.

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` && process.argv.includes('--selftest')) {
  (async () => {
    console.log('agy_dispatch self-test: probing agy binary + sentinel call');
    if (!agyAvailable()) {
      console.error('FAIL: agy.exe not found at', AGY_BIN);
      process.exit(1);
    }
    console.log('agy binary present');
    const sentinel = await sentinelProbe({ timeoutMs: 30000 });
    console.log('sentinel result:', sentinel ? 'PASS (within budget)' : 'FAIL (timeout or non-zero)');
    process.exit(sentinel ? 0 : 1);
  })();
}
