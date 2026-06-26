// seat_dispatch.mjs — Muezzin seat dispatch: faith-loaded open-weight cloud seat -> structured JSON verdict.
//
// Ported from antigravity-muezzin.mjs (getFaith / attemptProvider / PROVIDERS waterfall / SearXNG tool loop),
// adapted for the Claude muezzin's locked design:
//   - waterfall = cloud -> 3 ADAPTIVE HEALS -> local  (operator spec: 3 reattempts before local fallback)
//   - systemAnchor injected into every seat (current date + "search SOTA, do not answer from stale training")
//   - SearXNG ONLY as the search tool (no raw web_search), per the locked design
//   - verification seats emit a JSON verdict_contract, validated by the keystone's validateVerdictContract
// This is the INPUT HALF of the keystone: it produces the verdicts that verdict_merge/keystone_flow consume.

import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { execSync, execFile, execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVerdictContract, VERDICTS } from './verdict_merge.mjs';
import { dispatchAgy, agyAvailable, resolveAgyModel } from './agy_dispatch.mjs';

// DISPATCH HEARTBEAT (bug #5, 2026-06-10): two lanes hung 39-46 min SILENT — legal
// retry math (3 heals x doubling timeouts up to 10 min + waits) was invisible from
// outside, so "working" and "hung" looked identical. Every attempt start/end/heal now
// writes one line here. Watchdogs are for the watcher.
const HB_LOG = join(dirname(fileURLToPath(import.meta.url)), 'missions', '_logs', 'dispatch-heartbeat.log');
function hb(line) {
  try { mkdirSync(dirname(HB_LOG), { recursive: true }); appendFileSync(HB_LOG, `${new Date().toISOString()} ${line}\n`); } catch { /* heartbeat must never break dispatch */ }
}

const FAITH_DIR = 'C:/Users/marka/.agents/faiths';
const FETCH_TIMEOUT_MS = 180000;
const MAX_CLOUD_HEALS = 3;            // operator spec: 3 reattempts to fix the cloud failure before local
const SEARXNG_URL = 'http://localhost:8080/search';

// cloud first, then local. Cloud key: antigravity uses OLLAMA_API_KEY; this env also has OLLAMA_CLOUD_API_KEY.
const PROVIDERS = [
  { id: 'ollama-cloud', url: 'https://ollama.com/v1/chat/completions', envKeys: ['OLLAMA_API_KEY', 'OLLAMA_CLOUD_API_KEY'] },
  { id: 'ollama-local', url: 'http://localhost:11434/v1/chat/completions', envKeys: [] },
];

// LOCAL-ONLY MODELS (cloud-budget cut): models that exist ONLY on the local ollama —
// ollama-cloud 404s on them, so the waterfall would burn all MAX_CLOUD_HEALS adaptive
// heals on guaranteed-miss cloud attempts before the local fallback ever runs (granite4.1:8b
// receipted 4 wasted cloud heals). These dispatch straight to ollama-local. Mirrors the
// namedClaude cloud-skip rail: never re-dispatch a name to a provider that cannot serve it.
const LOCAL_ONLY_MODELS = new Set(['granite4.1:8b']);

class WaterfallError extends Error {
  constructor(kind, provider, model, msg) { super(msg); this.kind = kind; this.provider = provider; this.model = model; }
}

const searchToolDef = {
  type: 'function',
  function: {
    name: 'searxng_web_search',
    description: 'Search the web via SearXNG for CURRENT / SOTA information (models, benchmarks, versions, best practices).',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'the search query' } }, required: ['query'] },
  },
};

// read-only — for the Discovery Gate / Maghrib source reads (ANTIGRAVITY.md, faiths, mission substrate).
// NO file_write tool by design: seats never write the record; the keystone does (Directive 1, stricter than agy).
const readFileToolDef = {
  type: 'function',
  function: {
    name: 'file_read',
    description: 'Read a UTF-8 text file from disk (read-only) for your Discovery Gate / Maghrib check before ruling.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'absolute file path' } }, required: ['path'] },
  },
};

function keyFor(provider) {
  for (const k of provider.envKeys) if (process.env[k]) return process.env[k];
  return provider.envKeys.length ? null : 'local';
}

export function getFaith(roleName) {
  try { return readFileSync(`${FAITH_DIR}/${roleName}.faith.md`, 'utf8'); }
  catch { return `You are the ${roleName}.`; }
}

// systemAnchor — structurally defeats stale-knowledge: confidence is a trigger to VERIFY, not to answer.
export function systemAnchor(today) {
  return [
    `Today is ${today}. Your training data is stale relative to today.`,
    `For ANY claim about current SOTA models, benchmarks, versions, or best practices, you MUST call`,
    `searxng_web_search and read results BEFORE asserting. Confidence is a trigger to verify, not a license`,
    `to answer from memory. A suspicion is a hypothesis to check, not a fact to state.`,
  ].join(' ');
}

async function executeSearxngSearch(query) {
  // AbortController-bounded: this GET runs in the seat tool-call loop on EVERY searxng_web_search of an
  // autonomous mission. A SearxNG that accepts the socket but never replies (hung process / half-open
  // connection) would otherwise hang the whole mission here forever. 20s mirrors searxng_preflight (above
  // SearxNG's 15s request_timeout). All failure paths return a string the seat reads as "search failed".
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const u = `${SEARXNG_URL}?format=json&q=${encodeURIComponent(query)}`;
    const res = await fetch(u, { method: 'GET', signal: ctl.signal });
    if (!res.ok) return `Search error: HTTP ${res.status}`;
    const data = await res.json();
    const out = (data.results || []).slice(0, 6)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${(r.content || '').slice(0, 240)}\n   ${r.url}`)
      .join('\n');
    if (out) return out;
    // ZERO RESULTS: blind backend or genuinely empty? (quirky receipts 2026-06-11, two
    // x2 deaths: engine suspensions create ~5-min blind windows; a seat searching inside
    // one gets zeros, emits thin research, and the witness kills the attempt. The
    // control query distinguishes — 'github' cannot honestly return nothing.)
    const cres = await fetch(`${SEARXNG_URL}?format=json&q=github`, { method: 'GET', signal: ctl.signal });
    if (cres.ok && ((await cres.json()).results || []).length === 0) return 'BLIND_BACKEND';
    return 'No results.';
  } catch (e) {
    return `Search error: ${e.name === 'AbortError' ? 'timeout (20s) — SearxNG not responding' : e.message}`;
  } finally {
    clearTimeout(timer);
  }
}

function readFileText(p) {
  const bin = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.gz', '.db', '.sqlite', '.exe', '.dll', '.bin', '.mp4', '.mov'];
  if (!p) return 'Error: no path given.';
  if (bin.some((e) => p.toLowerCase().endsWith(e))) return `Error: ${p} is binary, not readable as text.`;
  try { return readFileSync(p, 'utf8').slice(0, 20000); } catch (e) { return `Error reading ${p}: ${e.message}`; }
}

// the muezzin runs a verification command ITSELF and captures the receipt — the witness for a CODE claim
// (node -c / bash -n / docker build / a test). ok=true ONLY on exit 0. This is the deed; the seat's word is not.
export function execReceipt(cmd, cwd) {
  // WITNESS SHELL = PowerShell on Windows (2026-06-10 receipts: agy-import + vanlife-muddy
  // both witness-halted on "'Get-ChildItem' is not recognized" — architects write PS-flavored
  // validation commands; cmd.exe judged the work in the wrong language). PowerShell runs
  // exe-based commands (node/curl/findstr) and cmd-alias styles (type/dir) too. The command
  // rides an ARG ARRAY (execFileSync) — no string-interpolation quoting surface.
  //
  // NON-INTERACTIVE ENV (2026-06-22): wrangler and other CLIs probe TTY/env for prompts;
  // without these, `wrangler pages deploy` and friends will hang asking about telemetry,
  // login, or color choices. CI=true is the universal "I am a robot, do not prompt" hint;
  // WRANGLER_SEND_METRICS=false silences wrangler's first-run metrics question; FORCE_COLOR=0
  // keeps ANSI escapes out of receipts (they corrupt the 2000-char captured out).
  // stdio[0]='ignore' attaches /dev/null to stdin — any prompt reads EOF and either errors
  // cleanly or defaults, instead of blocking until the 120s timeout.
  const childEnv = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' };
  try {
    const out = process.platform === 'win32'
      ? execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { cwd, env: childEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 })  // pwsh (PS7) not powershell (5.1): seats chain with && — proven live
      : execSync(cmd, { cwd, env: childEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    return { type: 'exec', ref: cmd, ok: true, exit: 0, out: String(out).slice(0, 2000) };
  } catch (e) {
    return { type: 'exec', ref: cmd, ok: false, exit: e.status ?? 1, out: (String(e.stdout || '') + String(e.stderr || '')).slice(0, 2000) };
  }
}

// CLAUDE TIER (#29, operator ruling 2026-06-10): when Ollama Cloud is rate-limited or
// failing, Sonnet relieves the executor seat (qwen3-coder-next) and Opus relieves the
// architect/validator seat (kimi-k2.6). Slots BETWEEN cloud heals and local fallback —
// every dispatch still tries cloud first, so cloud takes back over per-call the moment
// quota returns. Transport: claude CLI print mode (subscription auth; no ANTHROPIC_API_KEY
// on this machine). Async execFile, never execSync — the daemon runs 3 lanes in one
// process and a sync child would freeze the other lanes' timers. Prompt fed via stdin
// (framings can exceed Windows arg limits). Identity is never silent: heartbeats label
// provider=claude-<model>, and the return's provider field carries the same.
// Kill switch: MUEZZIN_CLAUDE_TIER=off.
const CLAUDE_CMD = 'C:/Users/marka/AppData/Roaming/npm/claude.cmd';
const CLAUDE_SEAT_MAP = {
  'qwen3-coder-next': 'sonnet', 'kimi-k2.6': 'opus', 'kimi-k2.7-code': 'sonnet',
  // verdict seats (phase-3 adversarial verify, wired 2026-06-10): outage must not skip
  // the verify phase (absence is not APPROVE). Per the locked seat plan: validator
  // (deepseek) falls to Sonnet; auditor (minimax) falls to HAIKU — a fast rigorous
  // sweep is Haiku's shape, and it spreads the Claude family across its two weekly
  // pools (operator's dual-pool strategy).
  'deepseek-v4-pro': 'sonnet', 'nemotron-3-ultra': 'sonnet', 'minimax-m3': 'haiku', 'glm-5.1': 'sonnet', 'glm-5.2': 'sonnet',
  // per-step WITNESS (phase-2, operator ruling 2026-06-10): Opus-PREFERRED (route file
  // standing_prefer lists nemotron-3-super) → nemotron-3-super (Ollama) → qwen3.6 local.
  'nemotron-3-super': 'opus',
};
const CLAUDE_TIMEOUT_MS = 8 * 60 * 1000;
const AGY_TIMEOUT_MS = 8 * 60 * 1000;

// AGY LANE (2026-06-23, lock pending in MUEZZIN-SEAT-PLAN-LOCKED.md "Pending revision"):
// When env USE_AGY_EXECUTOR=true OR route file declares prefer:"agy", the dispatch tries
// agy FIRST (before namedClaude and the cloud waterfall). Burns agy's separate 4-hour
// rolling quota; spares the weekly direct-API Claude budget for the heaviest phase.
// OFF BY DEFAULT — existing waterfall behavior unchanged when flag not set.
//
// CRITICAL — EXECUTOR-CLASS SEATS ONLY (2026-06-23T23:05Z fix): agy's --print mode has a
// planner-loop swallow that emits short non-structured-JSON output (substrate-verified
// `chars=57` failures with error "no valid JSON micro_queue in the seat output"). This
// is fine for the EXECUTOR seat (its deliverable is files on disk, not structured JSON
// stdout — execReceipt verifies the deed). But it BREAKS architects/witnesses/auditors
// that MUST emit structured JSON. Restrict agy routing to executor-class model names.
// Per the locked seat plan: executor is qwen3-coder-next (or kimi-k2.7-code / sonnet).
const AGY_EXECUTOR_SEATS = new Set([
  'qwen3-coder-next',  // canonical Phase-2 executor
  'kimi-k2.7-code',    // alternate executor
  'sonnet',            // direct-Claude executor via seating-modes (anthropic-heavy mode)
]);
function routePrefersAgy(model) {
  // Gate 1: only executor-class seats — architects/witnesses/auditors stay on existing waterfall
  if (!AGY_EXECUTOR_SEATS.has(model)) return false;
  // Gate 2: env or route file declares the agy preference + agy binary present
  if (process.env.USE_AGY_EXECUTOR === 'true' && agyAvailable()) return true;
  try {
    const r = JSON.parse(readFileSync(ROUTE_FILE, 'utf8'));
    if (r.prefer === 'agy' && Date.parse(r.until) > Date.now() && agyAvailable()) return true;
  } catch { /* absent/invalid = no agy preference */ }
  return false;
}

async function attemptAgy(body, seatOrModel, timeoutMs, cwd) {
  const agyModel = resolveAgyModel(seatOrModel);
  const prompt = body.messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
  const r = await dispatchAgy(prompt, {
    model: agyModel,
    timeoutMs,
    cwd,
    printTimeout: '5m',
  });
  if (!r.ok) {
    throw new WaterfallError(r.error?.kind || 'AGY_FAILED', 'agy', agyModel,
      r.error?.detail || `agy exited ${r.exitCode}`);
  }
  // Trust the deed (files on disk) over stdout — agy --print frequently returns exit 0
  // with empty stdout due to planner-loop swallow. The runner's execReceipt is the deed.
  const content = r.stdout.trim() || '(empty stdout — agy planner-mode; verify via execReceipt)';
  return { content, toolTrace: [], provider: 'agy', model: agyModel };
}

// ROUTE PREFERENCE (operator ruling 2026-06-10: "we are not using our claude and ollama
// usage together in a smart way" — receipt: Ollama ran dry while 75% of the Claude window
// sat expiring). A declared window flips the order: Claude FIRST, cloud as fallback —
// use-it-or-lose-it budget gets spent instead of expiring. State file read PER CALL
// (webhook pattern — no restart to arm/disarm): {"prefer":"claude","until":"<ISO>"}.
// Conductor or operator sets it; expiry self-disarms. Absent/invalid/expired = normal order.
const ROUTE_FILE = 'C:/Users/marka/.claude/state/muezzin-route.json';
// Two preference shapes (operator rulings 2026-06-10):
//   window:   {"prefer":"claude","until":"<ISO>"} — everything Claude-first until expiry
//             (use-it-or-lose-it budget windows).
//   standing: {"standing_prefer":["qwen3-coder-next"]} — named seats Claude-first ALWAYS.
//             The executor is INPUT-heavy (tool-loop re-billing, 174K/714K receipts);
//             metered Ollama charges per input token, the Claude plan is flat — so the
//             input-heavy seat lives on the flat plan ("sonnet needs to bring our qwen
//             usage down"). Ollama remains its fallback, and keeps the output-light seats.
function routePrefersClaude(model) {
  try {
    const r = JSON.parse(readFileSync(ROUTE_FILE, 'utf8'));
    if (r.prefer === 'claude' && Date.parse(r.until) > Date.now()) return true;
    if (Array.isArray(r.standing_prefer) && r.standing_prefer.includes(model)) return true;
  } catch { /* absent/invalid = normal order */ }
  return false;
}

// DIRECTLY-NAMED CLAUDE SEAT (2026-06-15, seating-modes build): the seating modes
// (seat_modes.mjs) hand some seats a BARE Claude model name — e.g. anthropic-heavy seats the
// phase-1 architects as opus/sonnet/haiku and the executor as sonnet. Those are not in
// CLAUDE_SEAT_MAP (that map is ollama-name -> claude-fallback) and routePrefersClaude only
// matches standing_prefer entries — so without this, a bare "opus" would be dispatched to the
// OLLAMA cloud endpoint as model "opus" (a 404 that heals into local). This recognizer makes a
// Claude family name dispatch CLAUDE-FIRST, with the SAME cloud->local waterfall as the
// fallback (the safe rail: if the Claude seat is unavailable, the existing waterfall still
// runs). Pure string check — never reads the route file.
const CLAUDE_MODELS = new Set(['opus', 'sonnet', 'haiku']);
export function recognizeClaudeModel(model) {
  const m = String(model || '').toLowerCase();
  if (CLAUDE_MODELS.has(m)) return m;
  if (/^claude-/.test(m)) return m;   // explicit claude-<...> ids pass through verbatim
  return null;
}
function attemptClaude(body, claudeModel, timeoutMs, cwd) {
  return new Promise((resolve, reject) => {
    // SEARCH LIVES ON THIS TRANSPORT TOO (operator 2026-06-10: "you are refusing to give
    // our claude models our sota search?" — correct catch; v1 shipped tool-less out of
    // caution, not necessity). The spawned claude session gets WebSearch+WebFetch via
    // --allowedTools. READ joined 2026-06-10 19:55 (root-cause receipts: half-a CITED
    // FILES IT NEVER READ — "citation laundering" — because the seat physically could
    // not open them; studio-tools emitted EMPTY for the same reason. A research seat
    // that must cite files needs eyes.) Read is granted ONLY when the caller passes a
    // cwd (executor seats with a sandbox); verdict/witness seats stay tool-light.
    // Write/Bash stay ungranted — seats still never MUTATE substrate (muezzin witnesses deeds).
    const tools = cwd ? 'WebSearch,WebFetch,Read' : 'WebSearch,WebFetch';
    const prompt = body.messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n') +
      (cwd
        ? '\n\n[DISPATCH NOTE] You HAVE WebSearch, WebFetch, and Read on this dispatch. Your working directory is the mission sandbox — Read relative paths from it, and Read any absolute paths the instructions name (READ-ONLY). NEVER cite a file you did not actually Read. Answer with your final content only.'
        : '\n\n[DISPATCH NOTE] You HAVE WebSearch and WebFetch on this dispatch — use them wherever the instructions above demand verification or current/SOTA facts. file_read is unavailable; mark any file-dependent claim you cannot verify as "unverified". Answer with your final content only.');
    // GOVERNANCE ISOLATION (root-cause 2026-06-11 19:30: claude -p inherits the
    // OPERATOR'S global CLAUDE.md + hooks — seats were bathed in niyyah doctrine and
    // performed it INSIDE emissions (4b's three intent-shaped artifacts; the validator
    // even FABRICATED a "Niyyah Audit / Validator Faith §2" rule that exists nowhere
    // on disk). --setting-sources project drops user-level config from the seat
    // subprocess; auth + model selection are unaffected (CLI help). The seat's ONLY
    // doctrine is the framing the engine hands it.
    const child = execFile(CLAUDE_CMD, ['-p', '--model', claudeModel, '--output-format', 'text', '--allowedTools', tools, '--setting-sources', 'project'],
      // shell:true — Node 24 Windows refuses bare .cmd spawns (EINVAL, CVE-2024-27980
      // hardening). Safe: path has no spaces, args are fixed flags, prompt rides stdin.
      // NO timeout option here: .cmd wrappers spawn a grandchild node process, and Node's
      // own timeout kills only the direct shell child, orphaning the real claude process
      // to burn quota (laguna witness REVISE finding 2). The manual timer below fells the
      // whole tree with taskkill /T instead.
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true, shell: true, ...(cwd ? { cwd } : {}) },
      (err, stdout, stderr) => {
        clearTimeout(killTimer);
        // INSTRUMENTATION (2026-06-10: the "empty claude executor" gremlin was a MYSTERY
        // only because this callback discarded stderr on the empty-exit-0 path. Capture
        // the evidence on every non-happy outcome so the NEXT empty call proves its cause
        // — diagnose by receipt, not theory.)
        const errTail = String(stderr || '').replace(/\s+/g, ' ').trim().slice(-220);
        if (err) {
          hb(`claude-exec err model=${claudeModel} killed=${err.killed} code=${err.code ?? '?'} stdout_len=${String(stdout || '').length} stderr="${errTail}"`);
          return reject(new WaterfallError(timedOut ? 'TIMEOUT' : 'CLAUDE_FAILED', 'claude', claudeModel, String(stderr || err.message).slice(0, 200)));
        }
        const content = String(stdout).trim();
        if (!content) {
          hb(`claude-exec EMPTY model=${claudeModel} exit=0 stdout_len=${String(stdout || '').length} stderr="${errTail || '(stderr also empty)'}"`);
          return reject(new WaterfallError('EMPTY_CONTENT', 'claude', claudeModel, `claude returned empty stdout (stderr: ${errTail.slice(-120) || 'empty'})`));
        }
        resolve({ content, toolTrace: [] });
      });
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => { /* exec callback above reports the kill */ });
    }, timeoutMs);
    child.stdin.on('error', () => { /* child died first; the exec callback reports it */ });
    child.stdin.write(prompt); child.stdin.end();
  });
}

// adaptive heal: given a cloud WaterfallError, return a (possibly mutated) request body + backoff, or null = give up on cloud.
// kindCounts (cloud-budget cut, 2026-06-15): per-error-kind heal tally so a single kind can be capped
// WITHOUT lowering the global MAX_CLOUD_HEALS (which would also kneecap the cheap FIXING heals below).
// It records how many times each kind has ALREADY been healed before this call.
export function healCloud(err, body, healCount, kindCounts = {}) {
  const k = err.kind || '';
  const msg = err.message || '';
  if (k === 'HTTP_429') return { waitMs: 800 * (healCount + 1) * (healCount + 1), body };                    // backoff, same body
  if (k === 'HTTP_400' || /context|num_ctx|too long|exceed|maximum/i.test(msg)) {                            // drop ctx (FIXING heal)
    const cur = body.options?.num_ctx || 32768;
    return { waitMs: 0, body: { ...body, options: { ...(body.options || {}), num_ctx: Math.max(8192, cur >> 1) } } };
  }
  if (k === 'HTTP_404' || /not found|unknown model|no such model/i.test(msg))                                // fix model suffix (FIXING heal)
    return { waitMs: 0, body: { ...body, model: body.model.replace(/:cloud$/, '').replace(/-cloud$/, '') } };
  if (k === 'TIMEOUT') {
    // CLOUD-BUDGET CUT (2026-06-15, mission M-ENGINE.RELIABILITY.1): a timing-out cloud call
    // does NOT get fixed by a longer timeout — extending just re-dispatches the same full call
    // at 360s then 600s (up to 4 cloud dispatches = most of the receipted 20%/day burn). Unlike
    // ctx-drop or think:false, this heal does not REPAIR the call, it just retries it bigger.
    // So allow ONE extend-and-retry, then fail over to the Claude/local tier. This is the only
    // branch capped per-kind; every FIXING heal keeps its full behavior under MAX_CLOUD_HEALS.
    if ((kindCounts.TIMEOUT || 0) >= 1) return null;                                                         // already extended once -> fail over
    return { waitMs: 0, body, extendTimeout: true };                                                         // first timeout: one extend + retry
  }
  if (k === 'EMPTY_CONTENT_THINKING' || k === 'EMPTY_CONTENT')                                               // thinking ate the budget (FIXING heal)
    return { waitMs: 0, extendTimeout: true, body: { ...body, think: false, max_tokens: (body.max_tokens || 8192) * 2 } };
  if (/^HTTP_4/.test(k)) return null;                                                                        // other 4xx: fail-fast to local
  return { waitMs: 600, body };                                                                              // NETWORK / 5xx / API_ERROR: simple retry
}

// ADAPTIVE TOOL-ROUND CAP (2026-06-15, mission M-ENGINE.RELIABILITY.1, live receipts on
// corpus-complete-1 + studio-tools-card): an AUTHORING/RESEARCH step that legitimately
// READS a cloned repo to write a pattern card blows a fixed 7-round cap and the dispatch
// is thrown into the heal path -> re-plan loop / claude-tier degrade on EVERY such step.
// A flat 7->20 bump would also hand 20 free rounds to a server genuinely stuck in an
// infinite tool-loop. So the cap is PROGRESS-GATED, not raised globally:
//   - rounds <= BASE_TOOL_ROUNDS (the original comfortable budget): always continue.
//   - BASE < rounds <= HARD_TOOL_ROUND_CEILING: continue ONLY if the last round made
//     PROGRESS — emitted at least one tool call with a (tool|args) signature never seen
//     before (a distinct file read / distinct query). A round that only repeats prior
//     calls = a true loop -> stop now.
//   - rounds > HARD_TOOL_ROUND_CEILING: never continue. This hard ceiling means a genuine
//     infinite tool-loop (or a server emitting tool_calls with no tools declared) still
//     trips, just later — bounded, never unbounded.
// Pure + side-effect free so the selftest exercises the cap decision without any fetch.
export const BASE_TOOL_ROUNDS = 6;            // the original MAX_TOOL_ROUNDS (throw fired on round 7)
export const HARD_TOOL_ROUND_CEILING = 20;    // absolute ceiling: a true loop still trips here
// progressedLastRound = did the PRIOR tool round emit at least one tool call whose
// (tool|args) signature was never seen before (a distinct file read / distinct query).
// rounds = the round about to run (1-based).
export function mayContinueToolLoop(rounds, progressedLastRound, base = BASE_TOOL_ROUNDS, ceiling = HARD_TOOL_ROUND_CEILING) {
  if (rounds <= base) return true;            // within the original comfortable budget — always continue
  if (rounds > ceiling) return false;         // hard ceiling — infinite loop guard, NEVER exceeded
  return progressedLastRound;                 // past base: only a still-PROGRESSING reader continues
}

// one provider attempt: full OpenAI-compatible tool-call loop (SearXNG), returns accumulated text content.
async function attemptProvider(provider, body, timeoutMs) {
  const apiKey = keyFor(provider);
  if (provider.envKeys.length && !apiKey) throw new WaterfallError('NETWORK', provider.id, body.model, `Missing ${provider.envKeys.join('/')}`);

  const messages = [...body.messages];
  let accumulated = '';
  let reasoning = '';   // thinking-model budget drain is invisible without this (P0-CORPUS root cause)
  const toolTrace = [];
  const usage = { prompt: 0, completion: 0 };  // #30: real token counts, accumulated across the tool loop

  // TOOL-LOOP COST CAP (2026-06-10, token-instrument receipts: tokens=713998 on one
  // executor call — every tool round re-bills the ENTIRE growing transcript, the
  // receipted window-drain). Past the cap the request omits tools, so the seat must
  // answer from what it has gathered — a graceful close, not an error. Tool RESULTS are
  // also trimmed after round 2: early reads earn full context, later rounds ride a
  // smaller transcript.
  // ADAPTIVE CAP (2026-06-15, M-ENGINE.RELIABILITY.1): the cap is now PROGRESS-GATED
  // (see mayContinueToolLoop). Up to BASE_TOOL_ROUNDS it is the old fixed budget; past
  // BASE it keeps offering tools ONLY while the seat is still reading DISTINCT sources
  // (legitimate authoring), up to a HARD_TOOL_ROUND_CEILING that a true infinite loop
  // still trips. distinctSigs tracks the (tool|args) signatures seen; progressedLastRound
  // is whether the previous round added a new one.
  const LATE_ROUND_RESULT_CAP = 8000;
  const distinctSigs = new Set();
  let progressedLastRound = true;   // round 1 has no prior round; treat as progressing
  let rounds = 0;

  while (true) {
    rounds++;
    const offerTools = mayContinueToolLoop(rounds, progressedLastRound);
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ ...body, messages, ...(offerTools ? { tools: [searchToolDef, readFileToolDef], tool_choice: 'auto' } : {}) }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(tid);
      if (e.name === 'AbortError') throw new WaterfallError('TIMEOUT', provider.id, body.model, `timeout ${timeoutMs}ms`);
      throw new WaterfallError('NETWORK', provider.id, body.model, e.message);
    }
    clearTimeout(tid);

    if (!res.ok) {
      let t = ''; try { t = await res.text(); } catch { }
      throw new WaterfallError(`HTTP_${res.status}`, provider.id, body.model, `${res.status}: ${t.slice(0, 200)}`);
    }
    let data; try { data = await res.json(); } catch (e) { throw new WaterfallError('API_ERROR', provider.id, body.model, e.message); }
    if (data.error) throw new WaterfallError('API_ERROR', provider.id, body.model, JSON.stringify(data.error));

    if (data.usage) { usage.prompt += data.usage.prompt_tokens || 0; usage.completion += data.usage.completion_tokens || 0; }
    const m = data.choices?.[0]?.message;
    if (!m) throw new WaterfallError('API_ERROR', provider.id, body.model, 'no message in response');
    messages.push(m);
    if (m.content) accumulated += m.content + '\n';
    const rz = m.reasoning ?? m.reasoning_content; if (rz) reasoning += rz;

    if (m.tool_calls?.length) {
      // termination belt (laguna witness finding 1): some servers emit tool_calls even
      // with no tools declared (offerTools=false). Past the adaptive cap — i.e. past
      // BASE without progress, or past the hard ceiling — that would spin forever, so
      // throw into the bounded heal path instead. `offerTools` already encodes the
      // mayContinueToolLoop decision for this round.
      if (!offerTools)
        throw new WaterfallError('TOOL_LOOP_CAP', provider.id, body.model, `tool_calls emitted past round cap (${rounds} rounds${rounds > HARD_TOOL_ROUND_CEILING ? '; hard ceiling' : '; no new distinct reads — looping'})`);
      let addedDistinct = false;   // did THIS round read/query something not seen before?
      for (const tc of m.tool_calls) {
        let content = `Unknown tool ${tc.function?.name}`;
        // distinct-progress signature: tool name + raw args. A repeated identical call
        // (same query / same path) does NOT count as progress; a new one does.
        const sig = `${tc.function?.name}:${tc.function?.arguments || ''}`;
        if (!distinctSigs.has(sig)) { distinctSigs.add(sig); addedDistinct = true; }
        if (tc.function?.name === 'searxng_web_search') {
          let q = ''; try { q = JSON.parse(tc.function.arguments).query; } catch { }
          content = await executeSearxngSearch(q);
          // BLIND BACKEND = FAILED DISPATCH, never a quiet 'No results.' — failing the
          // attempt lets the waterfall reach a WebSearch-capable tier (the operator's
          // standing rule: SearXNG first, Anthropic WebSearch when SearXNG is down).
          if (content === 'BLIND_BACKEND')
            throw new WaterfallError('SEARCH_BLIND', provider.id, body.model, 'searxng zero on control query — backend blind (engine suspensions); dispatch fails over to a WebSearch-capable tier');
        } else if (tc.function?.name === 'file_read') {
          let p = ''; try { p = JSON.parse(tc.function.arguments).path; } catch { }
          content = readFileText(p);
        }
        if (rounds > 2 && content.length > LATE_ROUND_RESULT_CAP)
          content = content.slice(0, LATE_ROUND_RESULT_CAP) + '\n<<trimmed: tool-loop cost cap — re-read with a narrower ask if essential>>';
        toolTrace.push({ tool: tc.function?.name, args: (tc.function?.arguments || '').slice(0, 140) });
        messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function?.name, content });
      }
      progressedLastRound = addedDistinct;   // feeds the next round's mayContinueToolLoop
      continue; // let the model read tool results and continue
    }
    // EMPTY CONTENT IS AN ERROR, NEVER A RESULT (P0-CORPUS root cause, 2026-06-09: a
    // thinking architect consumed the default output budget on reasoning; content came
    // back empty and was silently passed downstream as "no valid JSON micro_queue").
    // Throwing lets healCloud retry with think:false + a bigger budget.
    if (!accumulated.trim()) {
      throw new WaterfallError(
        reasoning ? 'EMPTY_CONTENT_THINKING' : 'EMPTY_CONTENT',
        provider.id, body.model,
        reasoning ? `content empty; reasoning consumed budget (${reasoning.length} chars; head: ${reasoning.slice(0, 200)})`
                  : 'content empty, no reasoning returned');
    }
    return { content: accumulated.trim(), toolTrace, usage };
  }
}

// cloud (3 adaptive heals) -> local. Returns { content, provider, heals }.
// TOTAL WALL-CLOCK BUDGET (bug #5): retry math could legally run 30+ min invisible.
// The whole waterfall now fits inside TOTAL_BUDGET_MS; each attempt gets the smaller of
// its own timeout and what remains. Budget exhaustion throws into the normal heal path.
const TOTAL_BUDGET_MS = 12 * 60 * 1000;
export async function dispatchWithWaterfall(baseBody, { cwd } = {}) {
  let lastErr;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const remaining = () => deadline - Date.now();
  // -- ROUTE-PREFERENCE WINDOW: Claude first when declared (use-it-or-lose-it); one
  // attempt, then the normal cloud waterfall as fallback. preferTried suppresses the
  // post-cloud claude tier so a failed preferred attempt is never double-charged.
  let preferTried = false;
  // -- AGY LANE: when USE_AGY_EXECUTOR=true OR route prefer:"agy", try agy first.
  // Burns agy's separate 4-hour quota instead of the weekly Claude budget. On any
  // failure (binary missing, timeout, non-zero exit, etc) falls through to the
  // existing namedClaude/cloud/local waterfall — same safe rail as the Claude tier.
  if (routePrefersAgy(baseBody.model) && remaining() > 30000) {
    preferTried = true;   // suppress post-cloud claude tier (same anti-double-charge logic as routePrefersClaude path)
    const agyModel = resolveAgyModel(baseBody.model);
    hb(`attempt-start provider=agy-${agyModel} (USE_AGY_EXECUTOR or route prefer) timeout=${Math.min(AGY_TIMEOUT_MS, remaining())}ms`);
    const ta = Date.now();
    try {
      const out = await attemptAgy(baseBody, baseBody.model, Math.min(AGY_TIMEOUT_MS, remaining()), cwd);
      hb(`attempt-ok provider=agy-${agyModel} ms=${Date.now() - ta} chars=${out.content.length}`);
      return { ...out, provider: `agy-${agyModel}`, heals: 0 };
    } catch (e) {
      hb(`attempt-fail provider=agy-${agyModel} ms=${Date.now() - ta} kind=${e.kind || e.name}: ${String(e.message).slice(0, 120)} — falling through to existing waterfall`);
      /* fall through to existing namedClaude / cloud / local waterfall */
    }
  }
  // DIRECTLY-NAMED CLAUDE SEAT first (seating-modes): a seat whose model IS a Claude family
  // name (opus/sonnet/haiku/claude-*, from seat_modes anthropic-heavy) dispatches Claude-FIRST.
  // Honors the kill switch (MUEZZIN_CLAUDE_TIER=off -> skip, fall straight to the waterfall, so
  // a Claude-named seat still runs on cloud/local if Claude is disabled — never a hard-fail).
  const namedClaude = (process.env.MUEZZIN_CLAUDE_TIER === 'off') ? null : recognizeClaudeModel(baseBody.model);
  if (namedClaude && remaining() > 30000) {
    preferTried = true;   // suppress the post-cloud claude tier (no double-charge on a failed named-claude attempt)
    hb(`attempt-start provider=claude-${namedClaude} (NAMED claude seat — seating mode) timeout=${Math.min(CLAUDE_TIMEOUT_MS, remaining())}ms`);
    const tn = Date.now();
    try {
      const out = await attemptClaude(baseBody, namedClaude, Math.min(CLAUDE_TIMEOUT_MS, remaining()), cwd);
      hb(`attempt-ok provider=claude-${namedClaude} (named) ms=${Date.now() - tn} chars=${out.content.length}`);
      return { ...out, provider: `claude-${namedClaude}`, heals: 0 };
    } catch (e) {
      // Claude seat unavailable (budget/outage). The OLD "safe rail" fell through to the
      // cloud->local waterfall with the SAME base model name — but a Claude-family name
      // ('opus'/'sonnet'/'haiku'/'claude-*') is ANTHROPIC-ONLY: ollama-cloud AND ollama-local
      // both 404 on it ("model 'sonnet' not found", proven live 2026-06-10), wasting two
      // attempts before any real fallback. CLAUDE_SEAT_MAP is the REVERSE mapping
      // (ollama-name -> claude-fallback) so it cannot resolve a Claude name to an ollama model.
      // Correct behavior: do NOT re-dispatch the Claude name to ollama. Surface the Claude
      // failure so the caller's own fallback (dispatchSeat -> BLOCK; "absence is not APPROVE")
      // handles it, instead of burning two guaranteed-404 ollama attempts.
      hb(`attempt-fail provider=claude-${namedClaude} (named) ms=${Date.now() - tn} kind=${e.kind || e.name}: ${String(e.message).slice(0, 120)}`);
      throw new WaterfallError(e.kind || 'CLAUDE_FAILED', 'claude', namedClaude,
        `claude-named seat '${namedClaude}' failed and has no ollama equivalent (Anthropic-only name) — not re-dispatching to ollama: ${String(e.message).slice(0, 160)}`);
    }
  }
  const preferModel = (!namedClaude && routePrefersClaude(baseBody.model)) ? CLAUDE_SEAT_MAP[baseBody.model] : null;
  if (preferModel && remaining() > 30000) {
    preferTried = true;
    hb(`attempt-start provider=claude-${preferModel} (PREFERRED — route window) timeout=${Math.min(CLAUDE_TIMEOUT_MS, remaining())}ms`);
    const tp = Date.now();
    try {
      const out = await attemptClaude(baseBody, preferModel, Math.min(CLAUDE_TIMEOUT_MS, remaining()), cwd);
      hb(`attempt-ok provider=claude-${preferModel} (preferred) ms=${Date.now() - tp} chars=${out.content.length}`);
      return { ...out, provider: `claude-${preferModel}`, heals: 0 };
    } catch (e) {
      hb(`attempt-fail provider=claude-${preferModel} (preferred) ms=${Date.now() - tp} kind=${e.kind || e.name}: ${String(e.message).slice(0, 120)}`);
    }
  }
  // -- LOCAL-ONLY SHORT-CIRCUIT: a local-only model (granite4.1:8b) skips the cloud waterfall
  // entirely — ollama-cloud 404s on it, so every cloud heal is a guaranteed miss. Dispatch
  // straight to ollama-local (PROVIDERS[1]) and surface a WaterfallError on failure rather
  // than falling through to a cloud loop that cannot serve this model.
  if (LOCAL_ONLY_MODELS.has(baseBody.model)) {
    const localOnly = PROVIDERS[1];
    hb(`attempt-start provider=${localOnly.id} model=${baseBody.model} (LOCAL-ONLY short-circuit — cloud skipped)`);
    const tLo = Date.now();
    try {
      const out = await attemptProvider(localOnly, baseBody, Math.max(60000, Math.min(FETCH_TIMEOUT_MS, remaining())));
      hb(`attempt-ok provider=${localOnly.id} model=${baseBody.model} (local-only) ms=${Date.now() - tLo} chars=${out.content.length}`);
      return { ...out, provider: 'ollama-local', heals: 0 };
    } catch (e) {
      hb(`attempt-fail provider=${localOnly.id} model=${baseBody.model} (local-only) ms=${Date.now() - tLo} kind=${e.kind || e.name}: ${String(e.message).slice(0, 120)}`);
      throw new WaterfallError(e.kind || 'LOCAL_ONLY_FAILED', 'ollama-local', baseBody.model,
        `local-only model '${baseBody.model}' failed on ollama-local (cloud skipped — not a cloud model): ${String(e.message).slice(0, 160)}`);
    }
  }
  // -- cloud, with up to MAX_CLOUD_HEALS adaptive heal attempts
  const cloud = PROVIDERS[0];
  let body = baseBody, timeout = FETCH_TIMEOUT_MS;
  const kindCounts = {};   // per-error-kind heal tally (cloud-budget cut): lets healCloud cap a single kind (TIMEOUT) without touching the global heal budget the FIXING heals need
  for (let heal = 0; heal <= MAX_CLOUD_HEALS; heal++) {
    if (remaining() < 10000) { hb(`BUDGET-EXHAUSTED cloud model=${body.model} after ${heal} heals`); break; }
    hb(`attempt-start provider=${cloud.id} model=${body.model} heal=${heal} timeout=${Math.min(timeout, remaining())}ms`);
    const t0 = Date.now();
    try {
      const out = await attemptProvider(cloud, body, Math.min(timeout, remaining()));
      hb(`attempt-ok provider=${cloud.id} model=${body.model} heal=${heal} ms=${Date.now() - t0} chars=${out.content.length} tokens=${out.usage?.prompt || 0}+${out.usage?.completion || 0}`);
      return { ...out, provider: cloud.id, heals: heal };
    }
    catch (e) {
      lastErr = e;
      hb(`attempt-fail provider=${cloud.id} model=${body.model} heal=${heal} ms=${Date.now() - t0} kind=${e.kind || e.name}: ${String(e.message).slice(0, 120)}`);
      if (heal === MAX_CLOUD_HEALS) break;
      const plan = healCloud(e, body, heal, kindCounts);  // kindCounts holds prior tallies; healCloud reads TIMEOUT count to cap the retry-storm
      kindCounts[e.kind || ''] = (kindCounts[e.kind || ''] || 0) + 1;   // record THIS kind's heal AFTER the decision (so the cap is "already healed once")
      if (!plan) break;                                   // unhealable (4xx) OR capped kind (TIMEOUT after 1 extend) -> fall to local/claude now
      if (plan.waitMs) { hb(`heal-wait ${plan.waitMs}ms`); await new Promise((r) => setTimeout(r, Math.min(plan.waitMs, Math.max(0, remaining() - 10000)))); }
      body = plan.body; if (plan.extendTimeout) timeout = Math.min(timeout * 2, 600000);
    }
  }
  // -- CLAUDE TIER (#29): mapped seats only, only when cloud failed, never when disabled,
  // and never re-tried when the preferred-route attempt already failed this dispatch.
  const claudeModel = (process.env.MUEZZIN_CLAUDE_TIER === 'off' || preferTried) ? null : CLAUDE_SEAT_MAP[baseBody.model];
  if (claudeModel && remaining() > 30000) {
    hb(`attempt-start provider=claude-${claudeModel} (claude tier for ${baseBody.model}) timeout=${Math.min(CLAUDE_TIMEOUT_MS, remaining())}ms`);
    const t2 = Date.now();
    try {
      const out = await attemptClaude(baseBody, claudeModel, Math.min(CLAUDE_TIMEOUT_MS, remaining()), cwd);
      hb(`attempt-ok provider=claude-${claudeModel} ms=${Date.now() - t2} chars=${out.content.length}`);
      return { ...out, provider: `claude-${claudeModel}`, heals: MAX_CLOUD_HEALS, cloudError: lastErr?.message };
    } catch (e) {
      hb(`attempt-fail provider=claude-${claudeModel} ms=${Date.now() - t2} kind=${e.kind || e.name}: ${String(e.message).slice(0, 120)}`);
    }
  }
  // -- local fallback (gets a floor of 60s even if the cloud burned the budget)
  const local = PROVIDERS[1];
  hb(`attempt-start provider=${local.id} model=${baseBody.model} (local fallback)`);
  const t1 = Date.now();
  try {
    const out = await attemptProvider(local, baseBody, Math.max(60000, Math.min(FETCH_TIMEOUT_MS, remaining())));
    hb(`attempt-ok provider=${local.id} model=${baseBody.model} ms=${Date.now() - t1} chars=${out.content.length} tokens=${out.usage?.prompt || 0}+${out.usage?.completion || 0}`);
    return { ...out, provider: local.id, heals: MAX_CLOUD_HEALS, cloudError: lastErr?.message };
  }
  catch (e) { hb(`attempt-fail provider=${local.id} ms=${Date.now() - t1}: ${String(e.message).slice(0, 120)}`); throw new WaterfallError('ALL_FAILED', 'waterfall', baseBody.model, `cloud: ${lastErr?.message}; local: ${e.message}`); }
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  let raw = fenced ? fenced[1] : null;
  if (!raw) { const last = text.lastIndexOf('{'); if (last >= 0) raw = text.slice(last); }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// dispatch a SEAT. seat = { role, model, today, sampling? }. framing = the mission text the seat judges.
// wantVerdict=true appends the verdict-contract instruction and returns a validated contract (or a BLOCK on failure — "absence is not APPROVE").
export async function dispatchSeat(seat, framing, { wantVerdict = true } = {}) {
  const faith = getFaith(seat.role);
  const contractLine = wantVerdict
    ? `\n\nYou MUST end your reply with ONE json code block — the verdict contract:\n` +
      '```json\n{"seat":"' + seat.role + '","verdict":"APPROVE|REVISE|REJECT|BLOCK","findings":[{"id":"F1","severity":"high|med|low","description":"..."}],"closed_concerns":[]}\n```\n' +
      `verdict MUST be exactly one of ${VERDICTS.join(', ')}. findings = [] if none.`
    : '';
  const system = `${faith}\n\n[RESTRAINT] You are a seat in a deliberation chain. Judge only what the framing gives you; ` +
    `do not write project files. ${systemAnchor(seat.today)}${contractLine}`;
  const body = {
    model: seat.model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: framing }],
    // Explicit output budget + thinking off by default: most roster seats carry the
    // 'thinking' tag, and an unset budget let reasoning silently starve content
    // (P0-CORPUS root cause). Fields are dialect-tolerant — ignored where unsupported.
    // seat.max_tokens override (2026-06-10 quota fix): kimi-k2.6 IGNORES think:false on
    // the v1 endpoint and reasons 40-70K chars regardless — under the old fixed 8192 the
    // reasoning starved content (EMPTY_CONTENT_THINKING, 236K chars of receipted waste in
    // one window). Planning seats pass a budget that fits the thinking on attempt ONE.
    max_tokens: Math.min(Math.max(seat.max_tokens || 8192, 1024), 65536),  // clamp: laguna witness finding 4
    think: false,
    ...(seat.sampling ? { temperature: seat.sampling.temperature, top_p: seat.sampling.top_p } : {}),
  };

  let r;
  // pass the executor's sandbox cwd so the Claude-tier executor gets its Read tool rooted
  // there (2026-06-11: confirmed gap — executor set seat.cwd but this call dropped it, so
  // the claude executor ran toolless → "file_read unavailable" → empty emissions). Verdict/
  // witness seats have no cwd and stay tool-light, unchanged.
  try { r = await dispatchWithWaterfall(body, { cwd: seat.cwd }); }
  catch (e) {                                            // failed seat -> BLOCK (6/7-agent canon: absence is not APPROVE)
    return { seat: seat.role, verdict: 'BLOCK', findings: [{ id: 'DISPATCH', severity: 'high', description: e.message }], _failed: true };
  }
  if (!wantVerdict) return { seat: seat.role, content: r.content, provider: r.provider, heals: r.heals };

  const obj = extractJson(r.content);
  const v = obj ? validateVerdictContract(obj) : { ok: false, errors: ['no JSON verdict found'] };
  if (!v.ok) return { seat: seat.role, verdict: 'BLOCK', findings: [{ id: 'CONTRACT', severity: 'high', description: 'invalid/missing verdict: ' + (v.errors || []).join('; ') }], _failed: true, _raw: r.content?.slice(0, 400), _tools: r.toolTrace };
  // WITNESS: receipts the MUEZZIN observed, not what the seat claimed. Governance verdicts are witnessed by the
  // wudu read-trace (file_read calls actually made); code verdicts by exec receipts the engine attaches via
  // seat.execReceipts (execReceipt(), the muezzin running the artifact). A seat cannot self-certify — only
  // observed deeds count. An APPROVE with no observed witness gets downgraded to BLOCK at the merge.
  const witnessReceipts = (r.toolTrace || [])
    .filter((t) => t.tool === 'file_read')
    .map((t) => { let p = ''; try { p = JSON.parse(t.args).path; } catch { } return { type: 'read', ref: p, ok: true }; });
  return { ...obj, receipts: [...witnessReceipts, ...(seat.execReceipts || [])], seat: obj.seat || seat.role, _provider: r.provider, _heals: r.heals, _tools: r.toolTrace };
}

// ------------------------------------------------------------- OFFLINE selftest (no fetch)
// `node seat_dispatch.mjs --selftest` exercises the adaptive tool-round cap decision
// (mayContinueToolLoop) without any network. Proves: a dispatch making DISTINCT-file tool
// calls past the old round-7 cap is ALLOWED up to the hard ceiling; a dispatch that stops
// progressing (or exceeds the ceiling) TRIPS. M-ENGINE.RELIABILITY.1, 2026-06-15.
if (process.argv[1]?.endsWith('seat_dispatch.mjs') && process.argv.includes('--selftest')) {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = got === want;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (got=${got} want=${want})`);
    ok ? pass++ : fail++;
  };
  console.log(`[selftest] BASE_TOOL_ROUNDS=${BASE_TOOL_ROUNDS} HARD_TOOL_ROUND_CEILING=${HARD_TOOL_ROUND_CEILING}`);

  // 1. Within the base budget: always continue, regardless of progress flag.
  check('round 1 always allowed', mayContinueToolLoop(1, false), true);
  check('round 6 (== base) allowed even if not progressing', mayContinueToolLoop(6, false), true);

  // 2. THE FIX: past the old round-7 cap, a seat still reading DISTINCT sources continues.
  check('round 7 ALLOWED when last round read a new distinct source', mayContinueToolLoop(7, true), true);
  check('round 12 ALLOWED while still progressing', mayContinueToolLoop(12, true), true);
  check('round 20 (== ceiling) ALLOWED while still progressing', mayContinueToolLoop(20, true), true);

  // 3. LOOP GUARD: past base WITHOUT progress (same call repeated) trips.
  check('round 7 TRIPS when last round added no new distinct call (looping)', mayContinueToolLoop(7, false), false);
  check('round 15 TRIPS when no longer progressing', mayContinueToolLoop(15, false), false);

  // 4. HARD CEILING: past the ceiling, even a "progressing" seat is stopped — the
  //    absolute infinite-loop guard. A genuine infinite tool-loop still trips here.
  check('round 21 (> ceiling) TRIPS even while claiming progress', mayContinueToolLoop(21, true), false);
  check('round 100 TRIPS even while claiming progress', mayContinueToolLoop(100, true), false);

  // 5. Simulate the receipted authoring step: a seat reading 10 distinct repo files
  //    across 10 rounds. Old fixed cap threw on round 7; new cap lets it run to the end.
  let progressed = true, allowedThrough = 0;
  for (let r = 1; r <= 10; r++) {
    if (!mayContinueToolLoop(r, progressed)) break;
    allowedThrough = r;
    progressed = true;   // each round reads a NEW distinct file
  }
  check('10-distinct-file authoring step runs all 10 rounds (old cap stopped at 6)', allowedThrough, 10);

  // 6. Simulate a true loop: progresses for 3 rounds then repeats the same call forever.
  //    Must stop shortly after the base budget, never run to infinity.
  progressed = true; let stoppedAt = 0;
  for (let r = 1; r <= 1000; r++) {
    if (!mayContinueToolLoop(r, progressed)) { stoppedAt = r; break; }
    progressed = r < 3;   // distinct only for first 3 rounds, then loops on one call
  }
  check('true loop (distinct only 3 rounds) stops at round 7 (base+1), not infinity', stoppedAt, 7);

  // 7. NAMED-CLAUDE RECOGNIZER (seating-modes): a bare Claude family name is recognized so it
  //    dispatches Claude-first; an ollama name is NOT (it stays on the cloud->local waterfall).
  check('recognizeClaudeModel: opus -> opus (Claude-first)', recognizeClaudeModel('opus'), 'opus');
  check('recognizeClaudeModel: SONNET (case) -> sonnet', recognizeClaudeModel('SONNET'), 'sonnet');
  check('recognizeClaudeModel: haiku -> haiku', recognizeClaudeModel('haiku'), 'haiku');
  check('recognizeClaudeModel: claude-3-5 id passes verbatim', recognizeClaudeModel('claude-3-5-sonnet'), 'claude-3-5-sonnet');
  check('recognizeClaudeModel: ollama name (kimi-k2.6) NOT recognized -> null (waterfall as today)', recognizeClaudeModel('kimi-k2.6'), null);
  check('recognizeClaudeModel: ollama name (qwen3.6:27b) NOT recognized -> null', recognizeClaudeModel('qwen3.6:27b'), null);
  check('recognizeClaudeModel: empty -> null', recognizeClaudeModel(''), null);

  // 8. CLAUDE-NAMED SEAT NEVER DISPATCHES TO OLLAMA (bug fix 2026-06-10: live heartbeat
  //    "attempt-fail provider=ollama-local ms=7: 404: model 'sonnet' not found"). A seat
  //    whose model is a Claude family name tries the Claude tier first; when THAT fails, the
  //    ollama cloud/local waterfall must NOT re-dispatch the Anthropic-only name (it 404s on
  //    both). We assert dispatchWithWaterfall(model='sonnet') issues ZERO ollama fetches and
  //    surfaces the Claude failure (which dispatchSeat converts to BLOCK). Offline: the Claude
  //    attempt fails fast (CLAUDE_CMD missing/erroring in the test env), and we intercept
  //    globalThis.fetch — attemptProvider is the only thing that fetch()es a provider URL.
  await (async () => {
    const realFetch = globalThis.fetch;
    const ollamaModelsSeen = [];
    globalThis.fetch = async (url, opts) => {
      // record any model name sent to an ollama provider endpoint
      try {
        const u = String(url);
        if (u.includes('ollama.com') || u.includes('localhost:11434')) {
          const parsed = JSON.parse(opts?.body || '{}');
          ollamaModelsSeen.push(parsed.model);
        }
      } catch { /* record best-effort */ }
      // any ollama fetch in this test is a BUG; return a 404 so even if reached it's bounded
      return { ok: false, status: 404, async text() { return `model not found (test stub)`; } };
    };
    // Force the Claude tier ON (default), but the real claude.cmd attempt will reject in the
    // test env — exactly the failure that used to trigger the buggy ollama fall-through.
    const savedKill = process.env.MUEZZIN_CLAUDE_TIER;
    delete process.env.MUEZZIN_CLAUDE_TIER;
    // Whether the real claude.cmd is reachable in THIS env is irrelevant to the invariant:
    // the Claude attempt either resolves (returns a claude-* provider result) or rejects
    // (the failure is surfaced, never falling through to ollama). Either branch must produce
    // ZERO ollama dispatches. We record the outcome and assert the ollama-free invariant plus
    // the correct terminal shape (claude-* provider on success, a thrown Claude failure on
    // failure — both correct; the BUG was a THIRD outcome: an ollama dispatch of 'sonnet').
    let outcome;
    try {
      const r = await dispatchWithWaterfall({ model: 'sonnet', messages: [{ role: 'user', content: 'x' }] });
      outcome = { kind: 'resolved', provider: r.provider };
    } catch (e) { outcome = { kind: 'threw', provider: e.provider }; }
    globalThis.fetch = realFetch;
    if (savedKill === undefined) delete process.env.MUEZZIN_CLAUDE_TIER; else process.env.MUEZZIN_CLAUDE_TIER = savedKill;

    check("claude-named seat 'sonnet' issues ZERO ollama dispatches", ollamaModelsSeen.length, 0);
    check("claude-named seat 'sonnet' NEVER sends model='sonnet' to ollama", ollamaModelsSeen.includes('sonnet'), false);
    // terminal shape: either a Claude result or a Claude-surfaced failure — never an ollama provider.
    const okTerminal = (outcome.kind === 'resolved' && String(outcome.provider).startsWith('claude-'))
                    || (outcome.kind === 'threw' && outcome.provider === 'claude');
    check(`claude-named seat terminates on Claude tier, never ollama (got ${outcome.kind}/${outcome.provider})`, okTerminal, true);
  })();

  console.log(`[selftest] ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// --------------------------------------------------------------------------- live self-test
if (process.argv[1]?.endsWith('seat_dispatch.mjs')) {
  const today = process.argv[2] || '2026-06-09';
  const seat = { role: 'auditor', model: 'deepseek-v4-pro', today, sampling: { temperature: 0.3, top_p: 0.9 } };
  const framing = [
    'MISSION M-TEST: A contributor changed render_state.mjs to write STATE.md.',
    'Substrate evidence: render_state.mjs renders sections programmatically from a structured state object; no LLM writes the record.',
    'Claim: this satisfies Directive 1 (substrate is truth — no model hallucinates the record).',
    'Question for you, Auditor: does this PASS the boundary check, or is there a violation? Emit your verdict.',
  ].join('\n');

  console.log(`[live] dispatching seat=${seat.role} model=${seat.model} (cloud->3heals->local)...`);
  const verdict = await dispatchSeat(seat, framing);
  console.log('[live] verdict contract:', JSON.stringify({ ...verdict, _tools: undefined }, null, 2));
  const trace = verdict._tools || [];
  console.log(`[wudu] tool calls the seat actually made (${trace.length}):`, trace.length ? JSON.stringify(trace) : 'NONE — seat ruled without reading source (wudu NOT performed; must be hook-enforced)');

  // feed the tested keystone end-to-end
  const { runPhaseCompaction } = await import('./keystone_flow.mjs');
  const sp = (await import('path')).join((await import('os')).tmpdir(), '_muezzin_spine_test.md');
  const res = runPhaseCompaction([verdict], { timestamp: today, missions: [{ id: 'M-TEST', status: 'PHASE_3', confidence: 0.9 }], concerns: [], rulings: [], handoff_paths: [process.argv[1]] }, sp, 'GENESIS');
  console.log('[live] keystone gate ->', JSON.stringify({ verdict: res.verdict, escalate: res.escalate, state_hash: res.state_hash.slice(0, 12) + '...' }));
  console.log(`[live] STATE.md written: ${sp}`);
  console.log(verdict._failed ? '\nSEAT FAILED (BLOCK) — see findings above' : '\nSPINE OK — real seat -> real verdict -> tested gate -> STATE.md');
}
