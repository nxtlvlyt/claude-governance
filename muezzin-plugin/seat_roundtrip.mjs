// seat_roundtrip.mjs -- per-seat REAL round-trip probes for the LOCAL Ollama seats
// (gap-seat-health-is-roundtrip, remaining scope -- stitch_dispatch.mjs closed the Stitch leg;
// this module closes the local-ollama leg. Claude/agy legs remain a named follow-on: probing
// Claude burns weekly-quota tokens per call and agy already carries sentinelProbe() in
// agy_dispatch.mjs -- their cadence/wiring is a conductor decision, deliberately not smuggled
// in here).
//
// WHY (GAP-REGISTER receipt class): doctor.mjs's checkOllamaLocal() only hits /api/tags -- it
// proves the HTTP server answers and yields the catalog, NOT that any seat model can produce a
// token. That is the exact "sat Connected for a month while every real call failed" class the
// gap names. A round-trip here = one REAL /api/generate producing >= 1 token.
//
// GR10 / TWO-LANE CONSTRAINTS (operator ruling 2026-07-02, implemented in self_witness.mjs)
// -- the probe is a guest on the card, never an occupant:
//   1. NEVER force a load. /api/ps first; a seat model that is not resident YIELDS
//      (ok=null, yielded=true, yieldKind=NOT_RESIDENT) -- it is unproven, not unhealthy.
//   2. NEVER evict. No keep_alive on the probe request AT ALL (a mid-dispatch keep_alive:0 is
//      the receipted deadlock class, self_witness.mjs ~352; omitting the field leaves the
//      server default untouched).
//   3. BUSY IS NOT DEAD. HTTP 503 (queue saturation, the receipted "maximum pending requests"
//      class) and a probe timeout against a RESIDENT model (queued behind live chain
//      inference) both YIELD (yieldKind=SATURATED / BUSY_TIMEOUT), never report unhealthy --
//      otherwise the census cries wolf every time the chain works.
//   4. The probe generates exactly 1 token (options.num_predict: 1) against an
//      already-resident model: full inference path (scheduler -> runner -> token out), zero
//      new VRAM.
//
// RETURN CONTRACT (stitch_dispatch.mjs's shape, extended to tri-state):
//   { ok: true|false|null, healthy: <same as ok>, yielded?: true, yieldKind?: string,
//     model, latencyMs, detail, checkedAt, error?: { kind, detail } }
//   ok=true   -> REAL round trip produced a token.
//   ok=false  -> PROVEN failure (server dead, HTTP error, malformed body). error.kind set.
//   ok=null   -> YIELDED: nothing proven either way (not resident / busy / saturated).
//                A yielded probe is NEVER false -- fail-open by design; the WARN/FAIL policy
//                lives in doctor.mjs, not here (the stitch precedent).
//   `healthy` mirrors `ok` verbatim (set in the same finish() closure -- cannot drift): the
//   gap spec names the tri-state field "healthy"; doctor's board renderer reads "ok".
//   error.kind closed enum: PS_UNREACHABLE, GENERATE_THREW, GENERATE_HTTP_ERROR,
//   BAD_RESPONSE. yieldKind closed enum: NOT_RESIDENT, SATURATED, BUSY_TIMEOUT.
//
// The probe itself NEVER throws -- every throw is caught and converted to the return shape.
//
// Dependency-injection for the offline --selftest (the stitch_dispatch.mjs convention): every
// I/O boundary (psFn, fetchFn, base, timeoutMs, seat enumeration) is an opts key with a real
// default. Production callers (doctor.mjs's checkSeatRoundTrips()) pass no opts and get the
// real network path. Importing this module runs NO side effects (selftest argv-guarded, using
// the endsWith convention -- NOT agy_dispatch.mjs's import.meta.url pattern, receipted broken
// on this Windows/Node setup in stitch_dispatch.mjs's selftest header).

import { psProbe } from './self_witness.mjs';
import { activeSeats, resolveMode, MODES } from './seat_modes.mjs';

// Mirrors self_witness.mjs:66 exactly -- the two must resolve the same card (its OLLAMA_BASE
// is not exported, so the resolution is replicated verbatim, env var and default both).
export const OLLAMA_BASE = process.env.MUEZZIN_SELF_WITNESS_OLLAMA_BASE || 'http://nxtbeast:11434';
// Above legitimate resident-model 1-token latency (searxng_preflight's timeout-above-backend
// lesson); a resident model queued behind long chain inference blows past this and correctly
// YIELDS as BUSY_TIMEOUT rather than waiting out the chain.
const DEFAULT_TIMEOUT_MS = 20 * 1000;
// Mirrors doctor.mjs resolveModelProvider's claude-name test: those seats are NOT ollama
// transport and are out of this module's scope.
const CLAUDE_NAME_RE = /^(opus|sonnet|haiku|claude-)/i;

// abortableFetch -- AbortController-bounded fetch, clearTimeout-in-finally, the exact idiom of
// stitch_dispatch.mjs / doctor.mjs fetchJson / seat_dispatch executeSearxngSearch.
async function abortableFetch(fetchFn, url, opts, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ollamaSeatRoundTrip -- ONE seat model's real round-trip probe. See the header contract.
export async function ollamaSeatRoundTrip(model, opts = {}) {
  const t0 = Date.now();
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const base = opts.base || OLLAMA_BASE;
  const fetchFn = opts.fetchFn || globalThis.fetch;
  const psFn = opts.psFn || (() => psProbe({ base }));
  const checkedAt = new Date().toISOString();
  const finish = (ok, detail, extra = {}) =>
    ({ ok, healthy: ok, model, latencyMs: Date.now() - t0, detail, checkedAt, ...extra });

  // Step 1: /api/ps -- resident check BEFORE anything else. GR10: the probe never loads.
  let ps;
  try {
    ps = await psFn();
  } catch (e) {
    // The server itself is unreachable -- that IS a proven failure (same signal class as
    // doctor's checkOllamaLocal FAIL), not a yield.
    return finish(false, `/api/ps unreachable at ${base}: ${String(e.message || e)}`,
      { error: { kind: 'PS_UNREACHABLE', detail: String(e.message || e) } });
  }

  const resident = (ps?.models || []).some((m) => m.name === model);
  if (!resident) {
    return finish(null, `${model} not resident -- probing would force a load (GR10: probe never loads); deferred`,
      { yielded: true, yieldKind: 'NOT_RESIDENT' });
  }

  // Step 2: the REAL round trip -- 1 token from the already-resident model. NO keep_alive
  // field on this body, ever (mid-dispatch keep_alive:0 = receipted deadlock class).
  let res;
  try {
    res = await abortableFetch(fetchFn, `${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'OK', stream: false, options: { num_predict: 1 } }),
    }, timeoutMs);
  } catch (e) {
    if (e.name === 'AbortError') {
      // Resident but did not answer in time: queued behind live chain inference is the
      // overwhelmingly likely cause (two-lane ruling: probes never preempt the chain).
      // Busy is not dead -- YIELD, never false.
      return finish(null, `generate timed out after ${timeoutMs}ms -- resident model busy/queued, NOT proven dead`,
        { yielded: true, yieldKind: 'BUSY_TIMEOUT' });
    }
    return finish(false, `generate threw: ${String(e.message || e)}`,
      { error: { kind: 'GENERATE_THREW', detail: String(e.message || e) } });
  }

  // CORRECTION 1 (adversarial verify pass, wf_ce2523fe-1e9): body read was outside any
  // try/catch -- a connection drop between headers and body (or an abort racing
  // clearTimeout) would reject res.text(), throw out of this never-throws function, and
  // crash doctor's top-level await with no board rendered. Caught and converted.
  let text;
  try {
    text = await (res.text ? res.text() : Promise.resolve(''));
  } catch (e) {
    if (e.name === 'AbortError') {
      return finish(null, `generate body read aborted at ${timeoutMs}ms -- resident model busy/queued, NOT proven dead`,
        { yielded: true, yieldKind: 'BUSY_TIMEOUT' });
    }
    return finish(false, `generate body read failed: ${String(e.message || e)}`,
      { error: { kind: 'BAD_RESPONSE', detail: String(e.message || e) } });
  }
  if (res.status === 503) {
    // The receipted "maximum pending requests" saturation class -- busy, not dead.
    return finish(null, `HTTP 503 (queue saturated) -- busy, NOT proven dead: ${text.slice(0, 120)}`,
      { yielded: true, yieldKind: 'SATURATED' });
  }
  if (!res.ok) {
    return finish(false, `generate HTTP ${res.status}: ${text.slice(0, 200)}`,
      { error: { kind: 'GENERATE_HTTP_ERROR', detail: `HTTP ${res.status}: ${text.slice(0, 200)}` } });
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return finish(false, `generate 200 but body unparseable: ${String(e.message || e)}`,
      { error: { kind: 'BAD_RESPONSE', detail: String(e.message || e) } });
  }
  if (data.done !== true || typeof data.response !== 'string') {
    // A 200 whose body does not carry a COMPLETED generation is not health (the stitch
    // precedent: a 200-with-error-body is never read as healthy).
    return finish(false, 'generate 200 but body lacks done:true + response string -- not a completed generation',
      { error: { kind: 'BAD_RESPONSE', detail: `done=${data.done} responseType=${typeof data.response}` } });
  }

  return finish(true, `1-token generate round-trip OK (${Date.now() - t0}ms, resident)`);
}

// gatherOllamaSeatModels -- the census's default seat list: doctor.mjs gatherSeatModels'
// logic (active mode's seats, else defensive union of every mode), filtered to ollama-class
// names (claude-named seats excluded -- different transport, out of scope), deduped by model
// with roles collected. Stale ':cloud'-suffixed names are left as-is: they will simply never
// be resident and yield NOT_RESIDENT (the waterfall heals those names at dispatch time, not
// here). Injectable for the selftest.
export function gatherOllamaSeatModels(opts = {}) {
  const activeSeatsFn = opts.activeSeatsFn || activeSeats;
  const resolveModeFn = opts.resolveModeFn || resolveMode;
  const modes = opts.modes || MODES;
  const byModel = new Map();
  const push = (role, v) => {
    for (const m of (Array.isArray(v) ? v : [v])) {
      if (typeof m !== 'string' || CLAUDE_NAME_RE.test(m)) continue;
      if (!byModel.has(m)) byModel.set(m, []);
      byModel.get(m).push(role);
    }
  };
  let seats = null;
  try { seats = activeSeatsFn(); } catch { seats = null; }
  if (seats) {
    for (const [role, v] of Object.entries(seats)) push(role, v);
  } else {
    for (const mname of modes) {
      let t = null;
      try { t = resolveModeFn(mname); } catch { t = null; }
      if (!t) continue;
      for (const [role, v] of Object.entries(t)) push(`${mname}.${role}`, v);
    }
  }
  return [...byModel.entries()].map(([model, roles]) => ({ model, roles }));
}

// seatCensus -- one row per local-ollama seat model. SEQUENTIAL probes sharing ONE /api/ps
// snapshot: the census never issues N ps calls nor N parallel generations (small-serial
// discipline; each probe is <= 1 token against an already-resident model, so one snapshot
// stays representative for the census's few seconds). Never throws.
// Returns { checkedAt, latencyMs, base, rows, summary: { seats, healthy, unhealthy, yielded } }.
export async function seatCensus(opts = {}) {
  const t0 = Date.now();
  const checkedAt = new Date().toISOString();
  const base = opts.base || OLLAMA_BASE;
  const seats = opts.seats || gatherOllamaSeatModels(opts);
  const probeFn = opts.probeFn || ollamaSeatRoundTrip;
  const psFn = opts.psFn || (() => psProbe({ base }));

  let sharedPs = null, psError = null;
  try { sharedPs = await psFn(); } catch (e) { psError = e; }
  const sharedPsFn = () => { if (psError) throw psError; return sharedPs; };

  const rows = [];
  for (const s of seats) {
    // CORRECTION 2 (adversarial verify pass, wf_ce2523fe-1e9): belt-and-suspenders for the
    // never-throws contract -- if a probe throws despite its own catches, convert it to a
    // proven-failure row instead of letting one seat's exception kill the whole census.
    let r;
    try {
      r = await probeFn(s.model, { ...opts, base, psFn: sharedPsFn });
    } catch (e) {
      r = { ok: false, healthy: false, model: s.model, latencyMs: 0, checkedAt,
        detail: `probe threw unexpectedly: ${String(e.message || e)}`,
        error: { kind: 'GENERATE_THREW', detail: String(e.message || e) } };
    }
    rows.push({ ...r, roles: s.roles });
  }
  const summary = {
    seats: rows.length,
    healthy: rows.filter((r) => r.ok === true).length,
    unhealthy: rows.filter((r) => r.ok === false).length,
    yielded: rows.filter((r) => r.ok === null).length,
  };
  return { checkedAt, latencyMs: Date.now() - t0, base, rows, summary };
}

// ------------------------------------------------------------- OFFLINE selftest (no network)
// `node seat_roundtrip.mjs --selftest` -- injected fake psFn/fetchFn only; NO real network
// call ever happens here (any unmatched fetch THROWS). Guard uses the endsWith convention
// (stitch_dispatch.mjs's receipt: the import.meta.url pattern is dead on this Windows/Node
// setup -- silent never-runs, exit 0).
if (process.argv[1]?.endsWith('seat_roundtrip.mjs') && process.argv.includes('--selftest')) {
  (async () => {
    let pass = 0, fail = 0;
    const checkTrue = (name, cond) => {
      console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`);
      cond ? pass++ : fail++;
    };
    console.log('[selftest] seat_roundtrip.mjs -- offline, no network calls\n');

    const GB = 1024 * 1024 * 1024;
    const psResident = { models: [{ name: 'ornith:9b', size_vram: 6 * GB, size: 6 * GB }], residentVram: 6 * GB };
    const psFnResident = async () => psResident;

    function makeFetchStub(handlers) {
      const calls = [];
      const fn = async (url, opts) => {
        calls.push({ url: String(url), opts });
        for (const [match, handler] of handlers) {
          if (String(url).includes(match)) return handler(opts, calls);
        }
        throw new Error(`UNEXPECTED FETCH in selftest: ${url} -- a real network call must never happen here`);
      };
      fn.calls = calls;
      return fn;
    }
    const jsonResponse = (bodyObj, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(bodyObj),
    });

    // ---- 1. HEALTHY PATH: resident model, 1-token generate 200 done:true ----
    {
      const fetchStub = makeFetchStub([
        ['/api/generate', async () => jsonResponse({ model: 'ornith:9b', response: 'OK', done: true, eval_count: 1 })],
      ]);
      const r = await ollamaSeatRoundTrip('ornith:9b', { psFn: psFnResident, fetchFn: fetchStub });
      checkTrue('healthy path: ok===true and healthy mirrors ok', r.ok === true && r.healthy === true);
      checkTrue('healthy path: no error, no yielded flag', r.error === undefined && r.yielded === undefined);
      checkTrue('healthy path: latencyMs non-negative number, checkedAt parseable ISO',
        typeof r.latencyMs === 'number' && r.latencyMs >= 0 && !Number.isNaN(Date.parse(r.checkedAt)));
      checkTrue('healthy path: exactly 1 fetch call (the generate) -- ps came from injected psFn', fetchStub.calls.length === 1);
      // THE REQUEST-BODY REGRESSION GUARD: 1 token, non-streaming, NO keep_alive key ever
      // (mid-dispatch keep_alive:0 = the receipted deadlock class).
      const body = JSON.parse(fetchStub.calls[0].opts.body);
      checkTrue('generate body: model + stream:false + options.num_predict===1',
        body.model === 'ornith:9b' && body.stream === false && body.options?.num_predict === 1);
      checkTrue('generate body: NO keep_alive key (never evicts, never touches server default)', !('keep_alive' in body));
      checkTrue('generate body: prompt is the cheap 2-char probe prompt', body.prompt === 'OK');
    }

    // ---- 2. YIELD: not resident -> never loads, never fetches ----
    {
      const fetchStub = makeFetchStub([]);   // ANY fetch throws
      const r = await ollamaSeatRoundTrip('qwen3.6:27b', { psFn: psFnResident, fetchFn: fetchStub });
      checkTrue('not resident: ok===null (NEVER false) + yielded + yieldKind=NOT_RESIDENT',
        r.ok === null && r.healthy === null && r.yielded === true && r.yieldKind === 'NOT_RESIDENT');
      checkTrue('not resident: ZERO fetch calls -- the probe never forces a load (GR10)', fetchStub.calls.length === 0);
    }

    // ---- 3. PROVEN FAIL: /api/ps unreachable (server dead) ----
    {
      const fetchStub = makeFetchStub([]);
      const r = await ollamaSeatRoundTrip('ornith:9b', { psFn: async () => { throw new Error('fetch failed'); }, fetchFn: fetchStub });
      checkTrue('ps unreachable: ok===false, kind=PS_UNREACHABLE (server dead is PROVEN, not a yield)',
        r.ok === false && r.error?.kind === 'PS_UNREACHABLE');
      checkTrue('ps unreachable: zero generate calls', fetchStub.calls.length === 0);
    }

    // ---- 4. YIELD: 503 queue saturation -- busy is not dead ----
    {
      const fetchStub = makeFetchStub([
        ['/api/generate', async () => ({ ok: false, status: 503, text: async () => 'maximum pending requests exceeded' })],
      ]);
      const r = await ollamaSeatRoundTrip('ornith:9b', { psFn: psFnResident, fetchFn: fetchStub });
      checkTrue('HTTP 503: ok===null (NEVER false) + yieldKind=SATURATED (the receipted saturation class)',
        r.ok === null && r.yielded === true && r.yieldKind === 'SATURATED');
    }

    // ---- 5. YIELD: timeout against a resident model -- queued behind the chain, not dead ----
    {
      const hangingFetch = (url, o) => new Promise((_, rej) => {
        o.signal.addEventListener('abort', () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; rej(e); });
      });
      const r = await ollamaSeatRoundTrip('ornith:9b', { psFn: psFnResident, fetchFn: hangingFetch, timeoutMs: 25 });
      checkTrue('generate timeout: ok===null (NEVER false) + yieldKind=BUSY_TIMEOUT (busy is not dead)',
        r.ok === null && r.yielded === true && r.yieldKind === 'BUSY_TIMEOUT');
    }

    // ---- 6. PROVEN FAIL: generate HTTP 500 ----
    {
      const fetchStub = makeFetchStub([
        ['/api/generate', async () => ({ ok: false, status: 500, text: async () => 'runner crashed' })],
      ]);
      const r = await ollamaSeatRoundTrip('ornith:9b', { psFn: psFnResident, fetchFn: fetchStub });
      checkTrue('HTTP 500: ok===false, kind=GENERATE_HTTP_ERROR, detail carries the status',
        r.ok === false && r.error?.kind === 'GENERATE_HTTP_ERROR' && /500/.test(r.detail));
    }

    // ---- 7. PROVEN FAIL: 200 with unparseable body ----
    {
      const fetchStub = makeFetchStub([
        ['/api/generate', async () => ({ ok: true, status: 200, text: async () => 'not json {{{' })],
      ]);
      const r = await ollamaSeatRoundTrip('ornith:9b', { psFn: psFnResident, fetchFn: fetchStub });
      checkTrue('200 malformed body: ok===false, kind=BAD_RESPONSE (never a false PASS)',
        r.ok === false && r.error?.kind === 'BAD_RESPONSE');
    }

    // ---- 8. PROVEN FAIL: 200 but done!==true (incomplete generation is not health) ----
    {
      const fetchStub = makeFetchStub([
        ['/api/generate', async () => jsonResponse({ model: 'ornith:9b', response: '', done: false })],
      ]);
      const r = await ollamaSeatRoundTrip('ornith:9b', { psFn: psFnResident, fetchFn: fetchStub });
      checkTrue('200 with done:false: ok===false, kind=BAD_RESPONSE (a 200-without-completed-generation is NOT healthy)',
        r.ok === false && r.error?.kind === 'BAD_RESPONSE');
    }

    // ---- 9. NEVER THROWS: non-abort fetch throw is converted, not propagated ----
    {
      const r = await ollamaSeatRoundTrip('ornith:9b', {
        psFn: psFnResident,
        fetchFn: async () => { throw new Error('ECONNRESET'); },
      });
      checkTrue('fetch threw (non-abort): ok===false, kind=GENERATE_THREW, probe did not throw',
        r.ok === false && r.error?.kind === 'GENERATE_THREW');
    }

    // ---- 10. gatherOllamaSeatModels: claude-name filter + dedupe + role collection ----
    {
      const seats = gatherOllamaSeatModels({
        activeSeatsFn: () => ({
          architect: ['claude-sonnet-5', 'qwen3.6:27b', 'granite4.1:30b'],
          validator: 'qwen3.6:27b',
          executor: 'sonnet',
          final_auditor: 'north-mini-code-1.0:q4_K_M',
        }),
      });
      const byName = Object.fromEntries(seats.map((s) => [s.model, s.roles]));
      checkTrue('gather: claude-named seats excluded (claude-sonnet-5, sonnet)',
        !byName['claude-sonnet-5'] && !byName['sonnet']);
      checkTrue('gather: dedupes qwen3.6:27b across roles and collects both roles',
        byName['qwen3.6:27b']?.length === 2);
      checkTrue('gather: 3 unique ollama models survive', seats.length === 3);
    }

    // ---- 11. CENSUS: aggregation + single ps snapshot + fail-open yields ----
    {
      let psCalls = 0;
      const psMixed = {
        models: [
          { name: 'ornith:9b', size_vram: 6 * GB, size: 6 * GB },
          { name: 'granite4.1:30b', size_vram: 18 * GB, size: 18 * GB },
        ],
        residentVram: 24 * GB,
      };
      const fetchStub = makeFetchStub([
        ['/api/generate', async (opts) => {
          const b = JSON.parse(opts.body);
          if (b.model === 'ornith:9b') return jsonResponse({ response: 'OK', done: true });
          if (b.model === 'granite4.1:30b') return { ok: false, status: 500, text: async () => 'runner crashed' };
          throw new Error(`unexpected model in census selftest: ${b.model}`);
        }],
      ]);
      const c = await seatCensus({
        seats: [
          { model: 'ornith:9b', roles: ['witness'] },
          { model: 'qwen3.6:27b', roles: ['validator'] },
          { model: 'granite4.1:30b', roles: ['auditor'] },
        ],
        psFn: async () => { psCalls++; return psMixed; },
        fetchFn: fetchStub,
      });
      checkTrue('census: summary counts healthy=1 unhealthy=1 yielded=1 of 3',
        c.summary.seats === 3 && c.summary.healthy === 1 && c.summary.unhealthy === 1 && c.summary.yielded === 1);
      checkTrue('census: ONE shared ps snapshot for the whole census (never N ps calls)', psCalls === 1);
      checkTrue('census: exactly 2 generate calls (the 2 resident models; the non-resident one never fetched)',
        fetchStub.calls.length === 2);
      checkTrue('census: rows carry roles + model', c.rows.every((r) => Array.isArray(r.roles) && typeof r.model === 'string'));
      checkTrue('census: FAIL-OPEN -- every yielded row is ok===null, never ok===false',
        c.rows.filter((r) => r.yielded).every((r) => r.ok === null));
      checkTrue('census: checkedAt parseable + latencyMs number', !Number.isNaN(Date.parse(c.checkedAt)) && typeof c.latencyMs === 'number');
    }

    // ---- 12. CENSUS: ps down -> every row PS_UNREACHABLE, census itself never throws ----
    {
      const fetchStub = makeFetchStub([]);
      const c = await seatCensus({
        seats: [{ model: 'ornith:9b', roles: ['witness'] }, { model: 'qwen3.6:27b', roles: ['validator'] }],
        psFn: async () => { throw new Error('connect ECONNREFUSED'); },
        fetchFn: fetchStub,
      });
      checkTrue('census with ps down: all rows ok===false kind=PS_UNREACHABLE, zero generate calls',
        c.summary.unhealthy === 2 && c.rows.every((r) => r.error?.kind === 'PS_UNREACHABLE') && fetchStub.calls.length === 0);
    }

    console.log(`\n[selftest] ${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  })();
}
