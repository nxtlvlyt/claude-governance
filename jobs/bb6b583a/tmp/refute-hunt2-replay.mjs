// Independent adversarial replay for gap hunt-2 (local-lane TIMEOUT/NETWORK heal asymmetry).
// Imports the REAL exported dispatchWithWaterfall from seat_dispatch.mjs at HEAD, mocks
// globalThis.fetch (zero real dispatches), and fires the gap's receipted kill-shapes.
import { dispatchWithWaterfall } from 'file:///C:/Users/marka/.claude/muezzin-plugin/seat_dispatch.mjs';

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (got=${JSON.stringify(got)} want=${JSON.stringify(want)})`);
}
const body = () => ({ model: 'qwen3.6:27b', messages: [{ role: 'user', content: 'x' }] });
const healthy = () => ({ ok: true, status: 200, async json() { return { choices: [{ message: { content: 'ok healed' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }; }, async text() { return 'ok'; } });
const realFetch = globalThis.fetch;

// A. HTTP_500 on attempt 1, healthy on attempt 2 — pre-fix: one-shot terminal throw.
{
  let calls = 0;
  globalThis.fetch = async () => { calls++; if (calls === 1) return { ok: false, status: 500, async text() { return 'internal error'; } }; return healthy(); };
  let outcome; try { const r = await dispatchWithWaterfall(body(), { localOnly: true }); outcome = { kind: 'resolved', provider: r.provider }; } catch (e) { outcome = { kind: 'threw', msg: e.message }; }
  check('A1: HTTP_500-then-healthy RESOLVES', outcome.kind, 'resolved');
  check('A2: exactly 2 fetch calls (1 fail + 1 heal retry)', calls, 2);
}

// B. TIMEOUT (AbortError) on attempt 1, healthy on attempt 2 — pre-fix: one-shot terminal throw.
{
  let calls = 0;
  globalThis.fetch = async () => { calls++; if (calls === 1) { const err = new Error('simulated timeout'); err.name = 'AbortError'; throw err; } return healthy(); };
  let outcome; try { const r = await dispatchWithWaterfall(body(), { localOnly: true }); outcome = { kind: 'resolved' }; } catch (e) { outcome = { kind: 'threw', msg: e.message }; }
  check('B1: TIMEOUT-then-healthy RESOLVES', outcome.kind, 'resolved');
  check('B2: exactly 2 fetch calls', calls, 2);
}

// N. TRUE NETWORK kind (plain fetch rejection, non-Abort) on attempt 1, healthy on 2 —
//    the audit's replay only exercised HTTP_500 + TIMEOUT; the gap names NETWORK explicitly.
{
  let calls = 0;
  globalThis.fetch = async () => { calls++; if (calls === 1) throw new TypeError('fetch failed: ECONNREFUSED'); return healthy(); };
  let outcome; try { const r = await dispatchWithWaterfall(body(), { localOnly: true }); outcome = { kind: 'resolved' }; } catch (e) { outcome = { kind: 'threw', msg: e.message }; }
  check('N1: NETWORK-kind-then-healthy RESOLVES', outcome.kind, 'resolved');
  check('N2: exactly 2 fetch calls', calls, 2);
}

// C. Two consecutive 500s — heal is once-only, terminal error text preserved.
{
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 500, async text() { return 'internal error'; } }; };
  let outcome; try { await dispatchWithWaterfall(body(), { localOnly: true }); outcome = { kind: 'resolved' }; } catch (e) { outcome = { kind: 'threw', msg: e.message, ekind: e.kind }; }
  check('C1: second consecutive 500 still throws (heal is once)', outcome.kind, 'threw');
  check('C2: exactly 2 fetch calls (no infinite loop)', calls, 2);
  check('C3: terminal message shape preserved', outcome.kind === 'threw' && outcome.msg.startsWith('local-only seat failed (no fallback lane by design): '), true);
}

// D. Two consecutive TIMEOUTs — throws with kind TIMEOUT after exactly one extend-retry.
{
  let calls = 0;
  globalThis.fetch = async () => { calls++; const err = new Error('simulated timeout'); err.name = 'AbortError'; throw err; };
  let outcome; try { await dispatchWithWaterfall(body(), { localOnly: true }); outcome = { kind: 'resolved' }; } catch (e) { outcome = { kind: 'threw', ekind: e.kind }; }
  check('D1: second consecutive TIMEOUT throws', outcome.kind, 'threw');
  check('D2: exactly 2 fetch calls', calls, 2);
  check('D3: thrown kind is TIMEOUT', outcome.ekind, 'TIMEOUT');
}

// E. Unhealed kind (HTTP_404) — single attempt, immediate throw (regression guard).
{
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 404, async text() { return 'model not found'; } }; };
  let outcome; try { await dispatchWithWaterfall(body(), { localOnly: true }); outcome = { kind: 'resolved' }; } catch (e) { outcome = { kind: 'threw' }; }
  check('E1: HTTP_404 throws immediately', outcome.kind, 'threw');
  check('E2: exactly 1 fetch call (no retry for unhealed kind)', calls, 1);
}

globalThis.fetch = realFetch;
console.log(`[refute-hunt2-replay] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
