// Adversarial re-verification of the HANG-RETRY e2e audit (gap #5, af03247).
// Drives the REAL exported dispatchWithWaterfall from seat_dispatch.mjs; mocks ONLY the
// process boundary (child_process.execFile) + clamps the 480s kill-timer + intercepts fetch.
// NO real claude.exe launch, NO taskkill of real pids, NO network.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cp = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');

process.env.MUEZZIN_HB_FILE = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/reverify-hb.log';
delete process.env.MUEZZIN_CLAUDE_TIER;
delete process.env.USE_AGY_EXECUTOR;

let state = null;
const realExecFile = cp.execFile;
cp.execFile = function (file, args, opts, cb) {
  if (typeof args === 'function') { cb = args; args = []; opts = {}; }
  else if (typeof opts === 'function') { cb = opts; opts = {}; }
  const f = String(file);
  if (/claude\.exe$/i.test(f)) {
    state.spawns++;
    const behavior = state.plan[state.spawns - 1];
    const child = { pid: 40000 + state.spawns, stdin: { on() {}, write() {}, end() {} } };
    if (behavior === 'hang') {
      state.pending = cb;             // zero output; only the engine's taskkill ends it
    } else if (behavior === 'ok') {
      setImmediate(() => cb(null, 'RECOVERED-CONTENT-OK', ''));
    } else if (behavior === 'launchfail') {
      setImmediate(() => cb(Object.assign(new Error('Command failed: claude.exe launch'), { killed: false, code: 1 }), '', 'launch rejected'));
    }
    return child;
  }
  if (/^taskkill$/i.test(f)) {
    state.kills++;
    const pending = state.pending; state.pending = null;
    setImmediate(() => {
      // the killed child's exec callback fires: err set, zero stdout, empty stderr —
      // the receipt 15:35:37 kill-shape (killed, code=1, stdout_len=0, stderr="")
      if (pending) pending(Object.assign(new Error('killed'), { killed: true, code: 1 }), '', '');
      if (cb) cb(null, '', '');
    });
    return { pid: 99999 };
  }
  return realExecFile.apply(this, [file, args, opts, cb]);
};
syncBuiltinESMExports();

// clamp the (min(480s, remaining)) kill-timer to 200ms; remaining() stays ~12min so the
// retry gate remaining()>60000 is untouched
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = function (fn, ms, ...rest) {
  return realSetTimeout(fn, (typeof ms === 'number' && ms > 1000) ? 200 : ms, ...rest);
};

let fetches = 0;
globalThis.fetch = async (...a) => { fetches++; throw new Error('REPLAY-GUARD fetch: ' + String(a[0])); };

const { dispatchWithWaterfall } = await import('file:///C:/Users/marka/.claude/muezzin-plugin/seat_dispatch.mjs');

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} :: ${detail}`); }
};
const body = { model: 'sonnet', messages: [{ role: 'user', content: 'replay ping' }] };

// --- Scenario A: first window hangs (killed at cap), retry recovers ---
state = { plan: ['hang', 'ok'], spawns: 0, kills: 0, pending: null };
console.log('[A] hang -> retry recovers');
try {
  const out = await dispatchWithWaterfall(body, {});
  check('A resolves (pre-fix: terminal FAIL)', true);
  check('A provider=claude-sonnet', out.provider === 'claude-sonnet', out.provider);
  check('A heals=1 (hang-retry credited)', out.heals === 1, String(out.heals));
  check('A recovered content returned', out.content === 'RECOVERED-CONTENT-OK', out.content);
} catch (e) { check('A resolves (pre-fix: terminal FAIL)', false, `${e.kind || e.name}: ${e.message}`); }
check('A exactly 2 claude spawns', state.spawns === 2, String(state.spawns));
check('A exactly 1 engine taskkill', state.kills === 1, String(state.kills));
check('A zero provider fetches', fetches === 0, String(fetches));

// --- Scenario B: double hang — bounded at 2 windows, throws TIMEOUT ---
state = { plan: ['hang', 'hang'], spawns: 0, kills: 0, pending: null };
console.log('[B] double hang -> bounded terminal');
try {
  await dispatchWithWaterfall(body, {});
  check('B throws after second hang', false, 'resolved unexpectedly');
} catch (e) {
  check('B throws after second hang', true);
  check('B kind=TIMEOUT', (e.kind || '') === 'TIMEOUT', String(e.kind));
  check('B provider=claude', e.provider === 'claude', String(e.provider));
}
check('B exactly 2 spawns (never a third)', state.spawns === 2, String(state.spawns));
check('B zero fetches (no ollama re-dispatch of a claude name)', fetches === 0, String(fetches));

// --- Scenario C: non-TIMEOUT launch failure — NO retry ---
state = { plan: ['launchfail'], spawns: 0, kills: 0, pending: null };
console.log('[C] non-TIMEOUT failure -> no retry');
try {
  await dispatchWithWaterfall(body, {});
  check('C throws', false, 'resolved unexpectedly');
} catch (e) {
  check('C throws', true);
  check('C kind=CLAUDE_FAILED (not TIMEOUT)', (e.kind || '') === 'CLAUDE_FAILED', String(e.kind));
}
check('C exactly 1 spawn (retry strictly TIMEOUT-gated)', state.spawns === 1, String(state.spawns));
check('C zero taskkills', state.kills === 0, String(state.kills));

console.log(`[reverify] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
