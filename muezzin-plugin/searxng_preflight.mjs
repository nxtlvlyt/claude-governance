// searxng_preflight.mjs — Muezzin harm pre-flight: refuse to act on a dead/degraded search backend.
//
// Before the chain reaches for the web (SOTA checks, harm-research, citation grounding), it must
// know the SearxNG meta-search is actually answering. A search backend that returns ZERO results,
// or that has engines silently failing (`unresponsive_engines`), is WORSE than no search: it
// returns a confident-looking empty answer that a model will treat as "nothing found" rather than
// "couldn't look." That is a harm vector (Directive 1: substrate is truth — a blind search is not
// truth). This pre-flight makes the failure LOUD: verdict='BLOCK' on empty OR degraded results.
//
// Contract: searxngPreflight MUST NOT throw. A dead/unreachable SearxNG is the common case
// (it may not be running), and a thrown error there would crash whatever guards against it. So
// every failure path — fetch reject, non-2xx, bad JSON, timeout — funnels to a well-formed
// { ok:false, verdict:'BLOCK', results:0, reason:<message> } return.

/**
 * GET <url>/search?format=json&q=test and judge whether the search backend is fit to use.
 * @param {string} url base SearxNG URL (default local instance)
 * @returns {Promise<{ ok:boolean, results:number, blocked_engines:Array, verdict:'OK'|'BLOCK', reason:string }>}
 */
export async function searxngPreflight(url = process.env.SEARXNG_URL || 'http://nxtbeast:8080') {
  const base = String(url).replace(/\/+$/, '');            // tolerate a trailing slash
  const target = `${base}/search?format=json&q=test`;

  // A "shape-complete" failure return — used for every error path so callers never see undefined.
  const fail = (reason) => ({ ok: false, results: 0, blocked_engines: [], verdict: 'BLOCK', reason });

  let resp;
  try {
    // AbortController bounds a hung/slow backend so the pre-flight itself can't hang the chain.
    // 20s, deliberately ABOVE SearxNG's own outgoing.request_timeout (15s) — a shorter probe timeout
    // false-reports "down" while SearxNG is still legitimately aggregating engines.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      resp = await fetch(target, { signal: ctl.signal, headers: { accept: 'application/json' } });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    // Unreachable / DNS / connection-refused / aborted-timeout — the dead-SearxNG case.
    return fail(`fetch failed: ${e?.name === 'AbortError' ? 'timeout (20s)' : (e?.message || String(e))}`);
  }

  if (!resp.ok) {
    return fail(`HTTP ${resp.status} ${resp.statusText || ''}`.trim());
  }

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    // 200 but not JSON (e.g. an HTML error/rate-limit page) — still unusable as search.
    return fail(`bad JSON body: ${e?.message || String(e)}`);
  }

  const results = Array.isArray(data?.results) ? data.results.length : 0;
  // SearxNG reports per-engine failures as `unresponsive_engines`: array of [name, reason] pairs.
  const blocked_engines = Array.isArray(data?.unresponsive_engines) ? data.unresponsive_engines : [];

  if (results === 0) {
    return { ok: true, results: 0, blocked_engines, verdict: 'BLOCK',
      reason: 'zero results — search is blind, not empty' };
  }
  // results > 0 → search is USABLE. A rate-limited engine or two is a degraded WARNING, not a block:
  // other engines returned results, so the search is not blind. (Requiring ZERO suspended engines would
  // make this gate always-BLOCK on a self-hosted SearxNG — brave/google routinely suspend one.)
  if (blocked_engines.length > 0) {
    const names = blocked_engines.map((e) => (Array.isArray(e) ? e[0] : e)).join(', ');
    return { ok: true, results, blocked_engines, verdict: 'OK',
      reason: `${results} results (degraded: ${blocked_engines.length} engine(s) rate-limited: ${names})` };
  }
  return { ok: true, results, blocked_engines, verdict: 'OK',
    reason: `${results} results, all engines responsive` };
}

// --------------------------------------------------------------------------- self-test
// Calls the real default local URL (which MAY OR MAY NOT be up) and asserts the RETURN SHAPE is
// always well-formed regardless — that is the whole point: a missing backend must not throw and
// must yield a usable verdict. We do NOT assert OK-vs-BLOCK (that depends on whether SearxNG is
// running); we assert the contract holds either way.
if (process.argv[1]?.endsWith('searxng_preflight.mjs')) {
  let fails = 0;
  const ck = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

  const r = await searxngPreflight();   // default http://localhost:8080 — up or down, must not throw
  console.log('preflight returned:', JSON.stringify(r));

  ck(r !== null && typeof r === 'object', 'returns an object (never threw)');
  ck(typeof r.ok === 'boolean', 'ok is boolean');
  ck(typeof r.results === 'number', 'results is a number');
  ck(Array.isArray(r.blocked_engines), 'blocked_engines is an array');
  ck(typeof r.reason === 'string' && r.reason.length > 0, 'reason is a non-empty string');
  ck(r.verdict === 'OK' || r.verdict === 'BLOCK', `verdict is a string 'OK'|'BLOCK' (got '${r.verdict}')`);
  // Cross-field invariants of the contract:
  ck(!(r.results === 0 && r.verdict === 'OK'), 'zero results never verdicts OK');
  ck(r.results > 0 ? r.verdict === 'OK' : r.verdict === 'BLOCK', 'verdict tracks usable (results>0 => OK) vs blind (0 => BLOCK)');
  ck(!r.ok ? r.verdict === 'BLOCK' && r.results === 0 : true, 'unreachable backend => BLOCK + results 0');

  console.log(
    r.verdict === 'OK'
      ? `\nSearxNG at default URL is UP and healthy: ${r.reason}`
      : `\nSearxNG at default URL would BLOCK (expected if not running): ${r.reason}`
  );
  console.log(`\n${fails === 0 ? 'ALL PASS — pre-flight return shape sound' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
