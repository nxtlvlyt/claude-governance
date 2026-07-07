// E2E replay of gap #5 (claude-exe-480s-hang -> HANG-RETRY, commit af03247).
// Fires the RECEIPTED kill-shape at the exported dispatchWithWaterfall:
//   claude.exe spawn hangs to the kill timer with stdout_len=0, stderr="", code=1
//   (dispatch-heartbeat receipts: sonnet 10:16->10:24 483237ms; recovery 10:28 210972ms;
//   terminal-fail receipt 15:35:37 = the pre-fix behavior this fix closes).
// Mocks ONLY the process boundary (child_process.execFile via the CJS builtin facade +
// syncBuiltinESMExports) and compresses the 480s kill timer to 200ms so the replay is
// bounded. The engine module itself is untouched (read-only audit).
//
// SAFETY RAILS: MUEZZIN_HB_FILE redirected to scratch (never the production heartbeat the
// STUCK-TASK decision reads); globalThis.fetch intercepted to PROVE zero ollama/provider
// dispatches; no daemon, no mission, no real model anywhere.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require_ = createRequire(import.meta.url);
const cp = require_('child_process');
const mod = require_('module');
const realExecFile = cp.execFile;

// ---- rails BEFORE importing the engine module ----
const HB = join('C:/Users/marka/.claude/jobs/bb6b583a/tmp', 'replay-hb.log');
process.env.MUEZZIN_HB_FILE = HB;
delete process.env.MUEZZIN_CLAUDE_TIER;   // named-claude branch must be live
delete process.env.USE_AGY_EXECUTOR;

const fetchUrls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  fetchUrls.push(String(url));
  return { ok: false, status: 404, async text() { return 'no network in replay'; } };
};

// Compress ONLY long timers (the 480s claude kill timer). Short engine timers untouched.
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = function (fn, ms, ...args) {
  return realSetTimeout(fn, ms >= 60000 ? 200 : ms, ...args);
};

// ---- controllable execFile mock ----
// state.plan is an array of behaviors for successive claude.exe spawns:
//   'hang'    -> never call back; wait for the engine's own killTimer -> taskkill
//   'ok'      -> succeed fast (the receipted 210s recovery, compressed)
//   'launchfail' -> immediate non-timeout error (code 1, NOT killed) = non-hang class
const state = { plan: [], claudeSpawns: [], taskkills: 0, pendingCb: null };
let pidSeq = 42000;
// attemptClaude writes the prompt to child.stdin (seat_dispatch.mjs:480-481) — stub it.
const fakeChild = (pid) => ({ pid, stdin: { on() {}, write() {}, end() {} } });
cp.execFile = function (file, args, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  const f = String(file);
  if (f.includes('claude.exe')) {
    const n = state.claudeSpawns.length;
    state.claudeSpawns.push({ args: Array.isArray(args) ? args.slice(0, 4) : args, t: Date.now() });
    const behavior = state.plan[n] ?? 'launchfail';
    const pid = ++pidSeq;
    if (behavior === 'hang') {
      state.pendingCb = cb;              // zero output, no exit — the receipted hang
      return fakeChild(pid);
    }
    if (behavior === 'ok') {
      realSetTimeout(() => cb(null, 'HANG-RETRY-RECOVERED: replay content (210s-recovery class, compressed)', ''), 30);
      return fakeChild(pid);
    }
    // launchfail: immediate error, killed=false -> WaterfallError kind CLAUDE_FAILED
    realSetTimeout(() => {
      const err = new Error('simulated launch failure (non-hang class)');
      err.code = 1; err.killed = false;
      cb(err, '', 'simulated stderr: launch failure');
    }, 10);
    return fakeChild(pid);
  }
  if (f === 'taskkill') {
    // The engine's killTimer fired (timedOut=true already set) and is felling the tree.
    // Complete the kill: fire the hung claude callback with the EXACT receipted signature —
    // err present, killed, code=1, stdout_len=0, stderr="".
    state.taskkills++;
    const hungCb = state.pendingCb; state.pendingCb = null;
    realSetTimeout(() => {
      if (cb) cb(null, '', '');
      if (hungCb) {
        const err = new Error('Command was killed with SIGTERM');
        err.killed = true; err.code = 1;
        hungCb(err, '', '');            // stdout_len=0, stderr="" — the receipt shape
      }
    }, 10);
    return { pid: 1 };
  }
  return realExecFile.apply(this, arguments);
};
mod.syncBuiltinESMExports();   // propagate the mock into the ESM `import { execFile }` binding

// ---- import the REAL engine module (untouched) ----
const { dispatchWithWaterfall } = await import('file:///C:/Users/marka/.claude/muezzin-plugin/seat_dispatch.mjs');

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (got=${JSON.stringify(got)} want=${JSON.stringify(want)})`);
  ok ? pass++ : fail++;
};
const reset = (plan) => { state.plan = plan; state.claudeSpawns = []; state.taskkills = 0; state.pendingCb = null; fetchUrls.length = 0; };
const body = { model: 'sonnet', messages: [{ role: 'user', content: 'replay of the 480s-hang receipt' }] };

// SCENARIO A — THE GAP'S NAMED FAILURE: first attempt hangs to the cap (zero output),
// pre-fix behavior was dispatch-FAILED terminal (receipt 15:35:37). Post-fix: ONE
// same-model retry; retry recovers (the receipted 210s-recovery class).
console.log('[A] hang -> recover (the 15:35:37 receipt shape, now with HANG-RETRY)');
reset(['hang', 'ok']);
{
  let out, threw = null;
  try { out = await dispatchWithWaterfall(body); } catch (e) { threw = e; }
  check('A: dispatch RESOLVES (pre-fix: terminal dispatch-FAILED)', threw === null, true);
  check('A: exactly 2 claude.exe spawns (one hang + ONE retry)', state.claudeSpawns.length, 2);
  check('A: engine killed the hung attempt (taskkill fired once)', state.taskkills, 1);
  check('A: provider is claude-sonnet (same-model retry, no seat swap)', out?.provider, 'claude-sonnet');
  check('A: heals=1 records the hang-retry', out?.heals, 1);
  check('A: recovered content returned', out?.content?.startsWith('HANG-RETRY-RECOVERED'), true);
  check('A: ZERO ollama/provider fetches (no 404-burn fall-through)', fetchUrls.length, 0);
}

// SCENARIO B — BOUNDEDNESS: both attempts hang. Must throw after exactly 2 attempts
// (one extra window on genuine outage — never a third).
console.log('[B] hang -> hang (genuine outage: bounded to ONE extra window)');
reset(['hang', 'hang']);
{
  let threw = null;
  try { await dispatchWithWaterfall(body); } catch (e) { threw = e; }
  check('B: dispatch THROWS after second hang', threw !== null, true);
  check('B: thrown kind is TIMEOUT (original signature surfaced)', threw?.kind, 'TIMEOUT');
  check('B: thrown provider is claude (surfaced to dispatchSeat BLOCK, not ollama)', threw?.provider, 'claude');
  check('B: exactly 2 claude.exe spawns (bounded — never a third)', state.claudeSpawns.length, 2);
  check('B: ZERO ollama/provider fetches', fetchUrls.length, 0);
}

// SCENARIO C — GATING: a non-TIMEOUT failure (launch failure, killed=false) must throw
// IMMEDIATELY with NO retry ("all other failure kinds throw the original WaterfallError
// immediately" — the retry is gated strictly on the TIMEOUT signature).
console.log('[C] non-hang failure (kind gating: no retry for non-TIMEOUT)');
reset(['launchfail', 'ok']);
{
  let threw = null;
  try { await dispatchWithWaterfall(body); } catch (e) { threw = e; }
  check('C: dispatch THROWS', threw !== null, true);
  check('C: thrown kind is CLAUDE_FAILED (not retried as a hang)', threw?.kind, 'CLAUDE_FAILED');
  check('C: exactly 1 claude.exe spawn (no retry for non-TIMEOUT kinds)', state.claudeSpawns.length, 1);
  check('C: ZERO ollama/provider fetches', fetchUrls.length, 0);
}

globalThis.setTimeout = realSetTimeout;
globalThis.fetch = realFetch;
cp.execFile = realExecFile;
mod.syncBuiltinESMExports();

// quote the heartbeat lines that prove the mechanism (scratch HB, not production)
console.log('--- scratch heartbeat receipts (HANG-RETRY lines) ---');
try {
  const lines = readFileSync(HB, 'utf8').split(/\r?\n/).filter(l => /HANG-RETRY|hang class|hang-retry|post-hang-retry/i.test(l));
  for (const l of lines) console.log('  HB| ' + l);
} catch (e) { console.log('  (no hb file: ' + e.message + ')'); }

console.log(`[replay] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
