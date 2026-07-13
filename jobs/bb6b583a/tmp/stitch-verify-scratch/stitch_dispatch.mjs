// stitch_dispatch.mjs -- Stitch MCP round-trip health probe (gap-seat-health-is-roundtrip).
//
// GAP-REGISTER.jsonl (2026-07-12): "heartbeat census includes a real per-seat round-trip;
// Stitch seat gets a cheap list_projects probe" -- receipt: the Stitch seat sat "Connected"
// for a MONTH while stitch.googleapis.com 403d on every real call. No probe anywhere in this
// engine ever exercised the actual API path; connection/tool-enumeration alone is not health.
//
// This module is Stitch's half of that fix ONLY (Ollama/Claude/agy round-trip probes are a
// separate follow-on gap, explicitly out of scope here). Modeled directly on
// agy_dispatch.mjs's sentinelProbe(): a short-timeout REAL call that proves the seat can
// actually do work, not just that a process/port answers. Returns real ok/fail based on the
// ACTUAL round trip, never on stdout/connection-status claims.
//
// Transport + auth are copied verbatim from the proven-live mechanism documented in
// C:\Users\marka\projects\website-pipeline\apps\post-intake\stitch\STITCH-KNOWLEDGE.md and its
// working receipt scripts (stitch_tools_full.mjs / stitch_gen2.mjs / stitch_edit.mjs,
// 2026-06-12 live receipts) -- nothing here was guessed:
//   - Endpoint: POST https://stitch.googleapis.com/mcp (MCP-over-HTTP, JSON-RPC 2.0).
//   - Auth: mint an access token from gcloud ADC
//     (%APPDATA%/gcloud/application_default_credentials.json), refresh_token grant against
//     oauth2.googleapis.com/token. No gcloud binary invocation -- pure fetch + fs read, exactly
//     as the three live receipt scripts do it.
//   - The `x-goog-user-project: <quota_project_id>` header is REQUIRED -- its historical
//     absence is the documented cause of the 403-on-quota failure a third-party stdio proxy
//     produced (STITCH-KNOWLEDGE.md "Transport" section). This is the exact regression this
//     probe exists to catch if the header is ever dropped again.
//   - Responses arrive as SSE: parse the LAST `data:` line of the body.
//   - `initialize` first (protocolVersion 2025-06-18), then the real probe call.
//
// Probe target: list_projects (schema at C:\Users\marka\.gemini\antigravity-cli\mcp\stitch\
// list_projects.json) -- the cheapest real, read-only, no-required-params tool call, invoked
// the same way stitch_gen2.mjs/stitch_edit.mjs invoke any tool: JSON-RPC method "tools/call",
// params { name, arguments }.
//
// Dependency-injection for the offline --selftest (mirrors seat_dispatch.mjs's selftest
// pattern of overriding globalThis.fetch / injecting stub functions rather than hitting the
// network): every I/O boundary (credentials file read, fetch) is a parameter with a real
// default, so the selftest exercises request-building + response-parsing + the header-presence
// regression check with ZERO network calls and ZERO real credential file reads.

import { readFileSync as nodeReadFileSync } from 'node:fs';
import path from 'node:path';

export const STITCH_MCP_ENDPOINT = 'https://stitch.googleapis.com/mcp';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DEFAULT_TIMEOUT_MS = 30 * 1000; // mirrors agy_dispatch.mjs SENTINEL_TIMEOUT_MS -- a health probe must be cheap and bounded

export function resolveAdcPath(env = process.env) {
  return path.join(env.APPDATA, 'gcloud', 'application_default_credentials.json');
}

// parseStitchBody -- STITCH-KNOWLEDGE.md: "Responses arrive as SSE: parse the LAST `data:`
// line of the body." Mirrors stitch_tools_full.mjs's `call()` helper exactly (content-type
// sniff -> SSE split -> last data: line -> JSON.parse; else parse the body as plain JSON).
export function parseStitchBody(text, contentType) {
  const isSse = (contentType || '').includes('event-stream');
  if (isSse) {
    const lines = text.split(/\r?\n/).filter((l) => l.startsWith('data:'));
    if (lines.length === 0) throw new Error('SSE body carried no data: line');
    return JSON.parse(lines[lines.length - 1].slice(5));
  }
  return JSON.parse(text);
}

// abortableFetch -- AbortController-bounded fetch, same idiom as seat_dispatch.mjs's
// executeSearxngSearch and agy_dispatch.mjs's timeout handling. fetchFn is injectable so the
// selftest never touches the real network.
async function abortableFetch(fetchFn, url, opts, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// mintAccessToken -- refresh_token grant against oauth2.googleapis.com/token, using the ADC
// file's client_id/client_secret/refresh_token. Exact grant shape as the live receipt scripts.
async function mintAccessToken(adc, { fetchFn, timeoutMs }) {
  const res = await abortableFetch(fetchFn, TOKEN_ENDPOINT, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
      grant_type: 'refresh_token',
    }),
  }, timeoutMs);
  if (!res.ok) {
    const bodyText = await (res.text ? res.text() : Promise.resolve(''));
    return { ok: false, error: { kind: 'TOKEN_MINT_FAILED', detail: `oauth2 token endpoint HTTP ${res.status}: ${bodyText.slice(0, 200)}` } };
  }
  const data = await res.json();
  if (!data.access_token) return { ok: false, error: { kind: 'TOKEN_MISSING_ACCESS', detail: 'oauth2 response carried no access_token' } };
  return { ok: true, accessToken: data.access_token };
}

// callStitchRpc -- one JSON-RPC 2.0 call against the Stitch MCP endpoint, with the required
// x-goog-user-project header (STITCH-KNOWLEDGE.md: its absence is the receipted 403 cause --
// the exact regression this function's header set guards against).
async function callStitchRpc(body, { accessToken, quotaProjectId, fetchFn, timeoutMs }) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${accessToken}`,
    'x-goog-user-project': quotaProjectId,
  };
  const res = await abortableFetch(fetchFn, STITCH_MCP_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, timeoutMs);
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: { kind: 'ROUNDTRIP_HTTP_ERROR', detail: `Stitch MCP HTTP ${res.status} on ${body.method}: ${text.slice(0, 200)}` } };
  }
  let parsed;
  try {
    parsed = parseStitchBody(text, res.headers?.get?.('content-type'));
  } catch (e) {
    return { ok: false, error: { kind: 'BAD_RESPONSE', detail: `${body.method} response unparseable: ${String(e.message || e)}` } };
  }
  if (parsed.error) {
    return { ok: false, error: { kind: 'JSONRPC_ERROR', detail: `${body.method} JSON-RPC error: ${JSON.stringify(parsed.error).slice(0, 200)}` } };
  }
  return { ok: true, result: parsed.result };
}

// stitchRoundTripHealthy -- the health probe itself. Mints a token, calls initialize then
// list_projects (the cheapest real, read-only, no-required-params tool -- STITCH-KNOWLEDGE.md's
// "learn more" ladder item 3 and the GAP-REGISTER's named probe target), and reports the REAL
// outcome. Every I/O dependency is injectable for the offline selftest; production callers
// (doctor.mjs's checkStitch()) call this with no opts and get the real network path.
//
// Returns: { ok, latencyMs, detail, checkedAt, error? } -- mirrors dispatchAgy/sentinelProbe's
// idiom (ok / elapsed-time / structured-error-kind), shaped to what doctor.mjs's board
// renderer needs (ok + detail string), plus checkedAt for a heartbeat-census timestamp.
export async function stitchRoundTripHealthy(opts = {}) {
  const t0 = Date.now();
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const readFileFn = opts.readFileFn || ((p) => nodeReadFileSync(p, 'utf8'));
  const fetchFn = opts.fetchFn || globalThis.fetch;
  const adcPath = opts.adcPath || resolveAdcPath(opts.env || process.env);
  const checkedAt = new Date().toISOString();
  const finish = (ok, detail, error) => ({ ok, latencyMs: Date.now() - t0, detail, checkedAt, ...(error ? { error } : {}) });

  let adcRaw;
  try {
    adcRaw = readFileFn(adcPath);
  } catch (e) {
    return finish(false, `ADC credentials file unreadable at ${adcPath}: ${String(e.message || e)}`, { kind: 'ADC_MISSING', detail: String(e.message || e) });
  }

  let adc;
  try {
    adc = JSON.parse(adcRaw);
  } catch (e) {
    return finish(false, `ADC credentials file at ${adcPath} is not valid JSON: ${String(e.message || e)}`, { kind: 'ADC_PARSE_ERROR', detail: String(e.message || e) });
  }

  if (!adc.client_id || !adc.client_secret || !adc.refresh_token) {
    return finish(false, 'ADC credentials file missing client_id/client_secret/refresh_token', { kind: 'ADC_INCOMPLETE', detail: 'one or more of client_id/client_secret/refresh_token absent' });
  }
  if (!adc.quota_project_id) {
    // STITCH-KNOWLEDGE.md: x-goog-user-project is REQUIRED -- its absence is the receipted 403 cause.
    return finish(false, 'ADC credentials file missing quota_project_id (required for x-goog-user-project header)', { kind: 'QUOTA_PROJECT_MISSING', detail: 'adc.quota_project_id absent' });
  }

  let tokenResult;
  try {
    tokenResult = await mintAccessToken(adc, { fetchFn, timeoutMs });
  } catch (e) {
    return finish(false, `token mint threw: ${String(e.message || e)}`, { kind: e.name === 'AbortError' ? 'TIMEOUT' : 'TOKEN_MINT_THREW', detail: String(e.message || e) });
  }
  if (!tokenResult.ok) return finish(false, tokenResult.error.detail, tokenResult.error);

  const rpcOpts = { accessToken: tokenResult.accessToken, quotaProjectId: adc.quota_project_id, fetchFn, timeoutMs };

  let initResult;
  try {
    initResult = await callStitchRpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'muezzin-doctor', version: '1' } } },
      rpcOpts,
    );
  } catch (e) {
    return finish(false, `initialize threw: ${String(e.message || e)}`, { kind: e.name === 'AbortError' ? 'TIMEOUT' : 'INITIALIZE_THREW', detail: String(e.message || e) });
  }
  if (!initResult.ok) return finish(false, initResult.error.detail, initResult.error);

  let probeResult;
  try {
    probeResult = await callStitchRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_projects', arguments: {} } },
      rpcOpts,
    );
  } catch (e) {
    return finish(false, `list_projects threw: ${String(e.message || e)}`, { kind: e.name === 'AbortError' ? 'TIMEOUT' : 'ROUNDTRIP_THREW', detail: String(e.message || e) });
  }
  if (!probeResult.ok) return finish(false, probeResult.error.detail, probeResult.error);

  return finish(true, `list_projects round-trip OK (${Date.now() - t0}ms)`);
}

// ------------------------------------------------------------- OFFLINE selftest (no network)
// `node stitch_dispatch.mjs --selftest` exercises request-building, response-parsing, the
// x-goog-user-project header-presence regression guard, and every failure-kind branch -- all
// with injected fake readFileFn/fetchFn. NO real network call and NO real credentials file
// read happens in this block, ever (per agy_dispatch.mjs's own selftest convention: dormant
// during normal use, invoked explicitly to verify).
//
// Guard uses seat_dispatch.mjs's simpler convention (endsWith the basename), NOT
// agy_dispatch.mjs's `file://${process.argv[1].replace(...)}` === import.meta.url pattern --
// that pattern was tried here first and PROVEN BROKEN on this Windows/Node setup (receipt:
// import.meta.url renders as `file:///C:/...` (three slashes) but the computed comparison
// string renders as `file://C:/...` (two slashes), so the strict equality never matches and
// the selftest block silently never runs, exit 0, zero output -- the exact silent-false-PASS
// class this module's own selftest exists to prevent in the Stitch probe itself). Optional
// chaining (`?.endsWith`) already closes agy_dispatch.mjs's motivating dynamic-import crash
// (process.argv[1] undefined -> `?.` short-circuits instead of throwing), with no URL-scheme
// fragility. NOTE for the conductor: agy_dispatch.mjs:199's own guard likely carries this same
// dead-on-Windows defect -- out of scope to fix here (Stitch-only pass) but worth a receipt.
if (process.argv[1]?.endsWith('stitch_dispatch.mjs') && process.argv.includes('--selftest')) {
  (async () => {
    let pass = 0, fail = 0;
    const check = (name, got, want) => {
      const ok = got === want;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (got=${JSON.stringify(got)} want=${JSON.stringify(want)})`);
      ok ? pass++ : fail++;
    };
    const checkTrue = (name, cond) => {
      console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`);
      cond ? pass++ : fail++;
    };

    console.log('[selftest] stitch_dispatch.mjs -- offline, no network calls, no real ADC read\n');

    // ---- 1. resolveAdcPath ----
    check('resolveAdcPath builds %APPDATA%/gcloud/application_default_credentials.json',
      resolveAdcPath({ APPDATA: 'C:/Users/fake' }),
      path.join('C:/Users/fake', 'gcloud', 'application_default_credentials.json'));

    // ---- 2. parseStitchBody ----
    check('parseStitchBody: plain JSON (no event-stream content-type)',
      JSON.stringify(parseStitchBody('{"result":{"ok":true}}', 'application/json')),
      JSON.stringify({ result: { ok: true } }));
    check('parseStitchBody: SSE, single data: line',
      JSON.stringify(parseStitchBody('event: message\ndata: {"result":{"a":1}}\n\n', 'text/event-stream')),
      JSON.stringify({ result: { a: 1 } }));
    check('parseStitchBody: SSE, multiple data: lines -> takes the LAST one (per STITCH-KNOWLEDGE.md)',
      JSON.stringify(parseStitchBody('data: {"partial":1}\ndata: {"result":{"final":true}}\n', 'text/event-stream')),
      JSON.stringify({ result: { final: true } }));
    let threw = false;
    try { parseStitchBody('event: ping\n\n', 'text/event-stream'); } catch { threw = true; }
    checkTrue('parseStitchBody: SSE body with NO data: line throws (never silently returns undefined)', threw);

    // ---- fake ADC fixture ----
    const fakeAdc = { client_id: 'cid', client_secret: 'csecret', refresh_token: 'rtok', quota_project_id: 'my-quota-project' };
    const fakeReadFileFn = () => JSON.stringify(fakeAdc);

    // helper: build a fetch stub keyed by URL substring, recording every call it sees.
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

    const sseResponse = (bodyObj, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
      text: async () => `data: ${JSON.stringify(bodyObj)}\n`,
    });

    // ---- 3. FULL SUCCESS PATH: token mint -> initialize -> list_projects, all mocked ----
    {
      const fetchStub = makeFetchStub([
        ['oauth2.googleapis.com/token', async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'fake-access-token' }) })],
        [STITCH_MCP_ENDPOINT, async (opts) => {
          const body = JSON.parse(opts.body);
          if (body.method === 'initialize') return sseResponse({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } });
          if (body.method === 'tools/call' && body.params.name === 'list_projects') {
            return sseResponse({ jsonrpc: '2.0', id: 2, result: { projects: [{ projectId: '18052995375163688094', name: 'NXTLVL Post Library' }] } });
          }
          throw new Error(`unexpected stitch method in selftest: ${body.method}`);
        }],
      ]);
      const r = await stitchRoundTripHealthy({ readFileFn: fakeReadFileFn, fetchFn: fetchStub, env: { APPDATA: 'C:/fake' } });
      checkTrue('full success path: ok=true', r.ok === true);
      checkTrue('full success path: latencyMs is a non-negative number', typeof r.latencyMs === 'number' && r.latencyMs >= 0);
      checkTrue('full success path: detail mentions list_projects round-trip', /list_projects round-trip OK/.test(r.detail));
      checkTrue('full success path: checkedAt is a parseable ISO timestamp', !Number.isNaN(Date.parse(r.checkedAt)));
      checkTrue('full success path: no error field on success', r.error === undefined);
      checkTrue('full success path: exactly 3 fetch calls (token, initialize, list_projects) -- no extras, no real network reached',
        fetchStub.calls.length === 3);

      // THE REGRESSION GUARD: the required header from STITCH-KNOWLEDGE.md's receipted 403
      // root cause must actually be on the outgoing Stitch requests, not just documented.
      const stitchCalls = fetchStub.calls.filter((c) => c.url === STITCH_MCP_ENDPOINT);
      checkTrue('x-goog-user-project header present on EVERY Stitch MCP call (the receipted 403 root cause)',
        stitchCalls.length === 2 && stitchCalls.every((c) => c.opts.headers['x-goog-user-project'] === 'my-quota-project'));
      checkTrue('Authorization header carries the minted access token',
        stitchCalls.every((c) => c.opts.headers.Authorization === 'Bearer fake-access-token'));
      checkTrue('Accept header requests both JSON and event-stream (matches the proven live scripts)',
        stitchCalls.every((c) => c.opts.headers.Accept === 'application/json, text/event-stream'));
      checkTrue('list_projects call uses JSON-RPC method tools/call with name=list_projects, arguments={} (no required params)', (() => {
        const call = fetchStub.calls[2];
        const body = JSON.parse(call.opts.body);
        return body.method === 'tools/call' && body.params.name === 'list_projects' && JSON.stringify(body.params.arguments) === '{}';
      })());
    }

    // ---- 4. FAILURE PATHS (each isolated, each proves a real defect surfaces, not a swallow) ----
    {
      const r = await stitchRoundTripHealthy({
        readFileFn: () => { throw new Error('ENOENT: no such file'); },
        fetchFn: async () => { throw new Error('must never fetch -- ADC read should fail first'); },
        env: { APPDATA: 'C:/fake' },
      });
      checkTrue('ADC file missing -> ok=false, kind=ADC_MISSING', r.ok === false && r.error?.kind === 'ADC_MISSING');
    }
    {
      const r = await stitchRoundTripHealthy({
        readFileFn: () => 'not valid json {{{',
        fetchFn: async () => { throw new Error('must never fetch -- ADC parse should fail first'); },
        env: { APPDATA: 'C:/fake' },
      });
      checkTrue('ADC file malformed JSON -> ok=false, kind=ADC_PARSE_ERROR', r.ok === false && r.error?.kind === 'ADC_PARSE_ERROR');
    }
    {
      const noQuotaAdc = { client_id: 'cid', client_secret: 'csecret', refresh_token: 'rtok' }; // quota_project_id deliberately absent
      const r = await stitchRoundTripHealthy({
        readFileFn: () => JSON.stringify(noQuotaAdc),
        fetchFn: async () => { throw new Error('must never fetch -- missing quota_project_id should fail before any network call'); },
        env: { APPDATA: 'C:/fake' },
      });
      checkTrue('ADC missing quota_project_id -> ok=false, kind=QUOTA_PROJECT_MISSING (fails BEFORE any network call, never a silent 403 later)',
        r.ok === false && r.error?.kind === 'QUOTA_PROJECT_MISSING');
    }
    {
      const fetchStub = makeFetchStub([
        ['oauth2.googleapis.com/token', async () => ({ ok: false, status: 401, text: async () => 'invalid_grant' })],
      ]);
      const r = await stitchRoundTripHealthy({ readFileFn: fakeReadFileFn, fetchFn: fetchStub, env: { APPDATA: 'C:/fake' } });
      checkTrue('token mint HTTP 401 -> ok=false, kind=TOKEN_MINT_FAILED, detail carries the HTTP status',
        r.ok === false && r.error?.kind === 'TOKEN_MINT_FAILED' && /401/.test(r.detail));
    }
    {
      const fetchStub = makeFetchStub([
        ['oauth2.googleapis.com/token', async () => ({ ok: true, status: 200, json: async () => ({ /* no access_token */ }) })],
      ]);
      const r = await stitchRoundTripHealthy({ readFileFn: fakeReadFileFn, fetchFn: fetchStub, env: { APPDATA: 'C:/fake' } });
      checkTrue('token response missing access_token -> ok=false, kind=TOKEN_MISSING_ACCESS',
        r.ok === false && r.error?.kind === 'TOKEN_MISSING_ACCESS');
    }
    {
      // THE DOCUMENTED REGRESSION ITSELF: a 403 on the Stitch call (STITCH-KNOWLEDGE.md's
      // exact receipted failure mode when the required header is dropped or quota misbehaves).
      const fetchStub = makeFetchStub([
        ['oauth2.googleapis.com/token', async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })],
        [STITCH_MCP_ENDPOINT, async () => ({ ok: false, status: 403, text: async () => 'PERMISSION_DENIED: quota project mismatch' })],
      ]);
      const r = await stitchRoundTripHealthy({ readFileFn: fakeReadFileFn, fetchFn: fetchStub, env: { APPDATA: 'C:/fake' } });
      checkTrue('Stitch MCP HTTP 403 -> ok=false, kind=ROUNDTRIP_HTTP_ERROR, detail carries the 403 (the exact month-long-blind failure mode)',
        r.ok === false && r.error?.kind === 'ROUNDTRIP_HTTP_ERROR' && /403/.test(r.detail));
    }
    {
      const fetchStub = makeFetchStub([
        ['oauth2.googleapis.com/token', async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })],
        [STITCH_MCP_ENDPOINT, async (opts) => {
          const body = JSON.parse(opts.body);
          if (body.method === 'initialize') return sseResponse({ jsonrpc: '2.0', id: 1, result: {} });
          return sseResponse({ jsonrpc: '2.0', id: 2, error: { code: -32602, message: 'invalid argument' } });
        }],
      ]);
      const r = await stitchRoundTripHealthy({ readFileFn: fakeReadFileFn, fetchFn: fetchStub, env: { APPDATA: 'C:/fake' } });
      checkTrue('list_projects JSON-RPC error object (HTTP 200 but RPC-level failure) -> ok=false, kind=JSONRPC_ERROR -- proves a 200-with-error-body is NOT read as healthy',
        r.ok === false && r.error?.kind === 'JSONRPC_ERROR');
    }
    {
      const fetchStub = makeFetchStub([
        ['oauth2.googleapis.com/token', async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })],
        [STITCH_MCP_ENDPOINT, async () => ({ ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => 'event: ping\n\n' /* no data: line */ })],
      ]);
      const r = await stitchRoundTripHealthy({ readFileFn: fakeReadFileFn, fetchFn: fetchStub, env: { APPDATA: 'C:/fake' } });
      checkTrue('malformed SSE (no data: line) on a 200 -> ok=false, kind=BAD_RESPONSE, never a false PASS',
        r.ok === false && r.error?.kind === 'BAD_RESPONSE');
    }

    console.log(`\n[selftest] ${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  })();
}