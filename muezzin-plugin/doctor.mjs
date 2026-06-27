// doctor.mjs — one-shot conduct-readiness check.
// Checks in order: (a) node present + version via process.version; (b) the four env keys rendered PRESENT/MISSING (boolean computed); (c) wrangler auth via exit code; (d) cloud canary ping + claude CLI ping; (e) git status (offline-safe); (f) governance present.
// Render two-column PASS/FAIL board with final RESULT line.
// Conduct-critical gate = node OK AND (>=1 of {Ollama Cloud, Claude} reachable) AND governance present; process.exit(0) only when all conduct-critical pass, else process.exit(1).
// Non-critical fails (wrangler, git-behind, one tier down) print WARN/FAIL but do not flip the exit code.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
// PREFLIGHT deps (ENGINE-READINESS, 2026-06-26): the active seat table + the well-tested
// SearXNG reachability probe. Importing these runs NO side effects (each module's self-test
// is guarded by `argv endsWith <module>.mjs`).
import { activeSeats, readMode, resolveMode, MODES } from './seat_modes.mjs';
import { searxngPreflight } from './searxng_preflight.mjs';

const ENV_KEYS = ['OLLAMA_API_KEY', 'OLLAMA_CLOUD_API_KEY', 'GOOGLE_PLACES_API_KEY', 'AIMLAPI_KEY'];
const OLLAMA_CLOUD_BASE = 'https://ollama.com/v1';
// OPERATOR RULING 2026-06-26: local models live on nxtbeast only, never the laptop.
const OLLAMA_LOCAL_TAGS = 'http://nxtbeast:11434/api/tags';
const CLOUD_TIMEOUT_MS = 10000;
const GOV_FILES = ['~/.claude/practice/core.md', '~/.claude/CANON-MANIFEST.md'];
// SearXNG endpoints: SEAT_SEARXNG mirrors seat_dispatch.mjs's resolution EXACTLY (SEARXNG_URL
// base, else the localhost tunnel) — that is the URL seats actually hit, so it is the
// fire-critical one. CANON_SEARXNG is the searxng_preflight.mjs default (nxtbeast:8080),
// reported for the discrepancy case where the localhost tunnel is down but the backend itself
// is reachable on the LAN/Tailscale.
const SEAT_SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8080';
const CANON_SEARXNG_URL = process.env.SEARXNG_URL || 'http://nxtbeast:8080';

function checkNode() {
  try {
    const version = process.version;
    return { ok: true, detail: `node ${version}` };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

function checkEnvKeys() {
  const out = [];
  for (const k of ENV_KEYS) {
    const present = !!process.env[k];
    out.push({ name: k, present });
    if (present) console.log(`[ENV] ${k}: PRESENT`);
    else console.log(`[ENV] ${k}: MISSING`);
  }
  return out;
}

function checkWrangler() {
  try {
    execSync('wrangler whoami', { stdio: 'ignore', timeout: 15000 });
    return { ok: true, detail: 'wrangler whoami: authenticated' };
  } catch (e) {
    const code = e.status ?? 1;
    return { ok: false, detail: `wrangler whoami exit ${code} (not authenticated or unavailable)` };
  }
}

async function pingOllamaCloud() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CLOUD_TIMEOUT_MS);
    const key = process.env.OLLAMA_API_KEY || process.env.OLLAMA_CLOUD_API_KEY;
    if (!key) {
      clearTimeout(timer);
      return { ok: false, detail: 'no OLLAMA_API_KEY or OLLAMA_CLOUD_API_KEY set' };
    }
    try {
      const res = await fetch(`${OLLAMA_CLOUD_BASE}/chat/completions`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: ctl.signal,
      });
      clearTimeout(timer);
      return { ok: true, detail: 'Ollama Cloud reachable' };
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        return { ok: false, detail: 'Ollama Cloud unreachable (timeout)' };
      }
      return { ok: false, detail: 'Ollama Cloud unreachable (network error)' };
    }
  } catch (e) {
    return { ok: false, detail: `Ollama Cloud ping failed: ${e.message}` };
  }
}

function checkClaudeCLI() {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 15000 });
    return { ok: true, detail: 'claude --version: available' };
  } catch (e) {
    const code = e.status ?? 1;
    return { ok: false, detail: `claude --version exit ${code} (unavailable or not installed)` };
  }
}

function checkGit() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore', timeout: 10000 });
    try {
      const status = execSync('git status --porcelain=v1', { encoding: 'utf8', timeout: 10000 }).trim();
      const clean = status.length === 0;
      try {
        const ahead = execSync('git log --oneline origin/HEAD..HEAD', { encoding: 'utf8', timeout: 10000 }).trim();
        const behind = execSync('git log --oneline HEAD..origin/HEAD', { encoding: 'utf8', timeout: 10000 }).trim();
        if (!clean) return { ok: false, detail: 'git: dirty working tree' };
        if (ahead.length === 0 && behind.length === 0) return { ok: true, detail: 'git: clean, in sync with origin' };
        if (ahead.length > 0 && behind.length === 0) return { ok: false, detail: 'git: clean but ahead of origin (WARN)' };
        if (ahead.length === 0 && behind.length > 0) return { ok: false, detail: 'git: clean but behind origin (WARN)' };
        return { ok: false, detail: 'git: clean but diverged from origin (WARN)' };
      } catch (e) {
        if (clean) return { ok: true, detail: 'git: clean, offline (no origin access)' };
        return { ok: false, detail: 'git: offline dirty (WARN)' };
      }
    } catch (e) {
      try {
        const ahead = execSync('git log --oneline origin/HEAD..HEAD', { encoding: 'utf8', timeout: 10000 }).trim();
        const behind = execSync('git log --oneline HEAD..origin/HEAD', { encoding: 'utf8', timeout: 10000 }).trim();
        if (ahead.length === 0 && behind.length === 0) return { ok: true, detail: 'git: offline, in sync with origin' };
        if (ahead.length > 0 && behind.length === 0) return { ok: false, detail: 'git: offline but ahead of origin (WARN)' };
        if (ahead.length === 0 && behind.length > 0) return { ok: false, detail: 'git: offline but behind origin (WARN)' };
        return { ok: false, detail: 'git: offline and diverged (WARN)' };
      } catch (e2) {
        return { ok: false, detail: 'git: offline status unknown (WARN)' };
      }
    }
  } catch (e) {
    return { ok: false, detail: 'git: not installed or not in repo' };
  }
}

function checkGovernance() {
  const home = homedir();
  const found = [];
  for (const rel of GOV_FILES) {
    const p = rel.replace(/^~[/\\]/, `${home.replace(/[/\\]$/, '')}${path.sep}`);
    if (existsSync(p)) found.push({ file: rel, present: true });
    else found.push({ file: rel, present: false });
  }
  return found;
}

// ============================================================ PREFLIGHT (fire-readiness)
// Checks the conductor runs BEFORE firing a mission, so a run never fires into a missing
// prerequisite (no pwsh, dead search, dead local ollama) or — the costliest — a model name
// that 404s on every provider. Each returns { ok, detail, ... } for the board renderer.

async function fetchJson(url, opts = {}, timeoutMs = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(timer); }
}

// ollama-local reachable + its model list (needed for the local fallback, local-only models,
// and per-seat availability resolution). Non-fatal if down WHEN cloud is up, but reported loud.
async function checkOllamaLocal() {
  const r = await fetchJson(OLLAMA_LOCAL_TAGS, {}, 6000);
  if (!r.ok) return { ok: false, names: new Set(), detail: `unreachable (${r.error || 'HTTP ' + r.status}) — local fallback + local-only models unavailable` };
  const names = new Set((r.data?.models || []).map((m) => m.name));
  return { ok: true, names, detail: `up — ${names.size} local models` };
}

// the cloud model CATALOG (OpenAI-compatible /v1/models) — the authority for whether a cloud
// seat name will resolve or 404. Distinct from the cloud reachability PING above.
async function fetchCloudModels() {
  const key = process.env.OLLAMA_API_KEY || process.env.OLLAMA_CLOUD_API_KEY;
  if (!key) return { ok: false, ids: new Set(), detail: 'no OLLAMA_API_KEY — cannot list cloud catalog' };
  const r = await fetchJson(`${OLLAMA_CLOUD_BASE}/models`, { headers: { Authorization: `Bearer ${key}` } }, CLOUD_TIMEOUT_MS);
  if (!r.ok) return { ok: false, ids: new Set(), detail: `cloud catalog fetch failed (${r.error || 'HTTP ' + r.status})` };
  const ids = new Set((r.data?.data || []).map((m) => m.id));
  return { ok: true, ids, detail: `cloud catalog — ${ids.size} models` };
}

// pwsh availability. NOTE the witness-shell fix (seat_dispatch execReceipt, 2026-06-26): PS7
// is preferred but its absence is NO LONGER fatal — execReceipt falls back to Windows
// PowerShell 5.1 and translates &&/|| chains. So pwsh7-absent is a WARN, not a FAIL; only
// BOTH shells missing is fire-critical.
function checkPwsh() {
  try {
    execSync('pwsh.exe -NoProfile -NonInteractive -Command "$null"', { stdio: 'ignore', timeout: 15000 });
    return { ok: true, pwsh7: true, detail: 'pwsh.exe (PowerShell 7) present — native &&/|| chaining in code receipts' };
  } catch {
    try {
      execSync('powershell.exe -NoProfile -NonInteractive -Command "$null"', { stdio: 'ignore', timeout: 15000 });
      return { ok: true, pwsh7: false, detail: 'pwsh.exe ABSENT — using Windows PowerShell 5.1 fallback (execReceipt translates &&/||). Install PS7 for native: winget install --id Microsoft.PowerShell -e' };
    } catch {
      return { ok: false, pwsh7: false, detail: 'NEITHER pwsh.exe NOR powershell.exe found — code receipts CANNOT be verified; every code mission fails' };
    }
  }
}

function checkGitBinary() {
  try { return { ok: true, detail: execSync('git --version', { encoding: 'utf8', timeout: 10000 }).trim() }; }
  catch { return { ok: false, detail: 'git not found on PATH' }; }
}

// SearXNG: the engine seats hit SEAT_SEARXNG_URL (localhost:8080) — that is what makes search
// fire-critical (operator ruling: planning/research seats are search-grounded fail-closed).
// We probe BOTH the seat URL and the canonical backend so a localhost-tunnel-down /
// backend-LAN-up discrepancy is surfaced explicitly instead of read as "search is gone".
async function checkSearxng() {
  const seat = await searxngPreflight(SEAT_SEARXNG_URL);
  const canon = await searxngPreflight(CANON_SEARXNG_URL);
  const seatOK = seat.verdict === 'OK';
  if (seatOK) return { ok: true, detail: `seat URL ${SEAT_SEARXNG_URL} OK (${seat.reason})` };
  // seat URL unusable — is the canonical backend up? If so, this is a tunnel/config gap, not a dead backend.
  if (canon.verdict === 'OK')
    return { ok: false, detail: `seat URL ${SEAT_SEARXNG_URL} DOWN (${seat.reason}) BUT ${CANON_SEARXNG_URL} is UP — start the localhost:8080 tunnel OR repoint seat_dispatch SEARXNG_URL at the backend before firing search-grounded seats` };
  return { ok: false, detail: `SearXNG unusable on BOTH ${SEAT_SEARXNG_URL} (${seat.reason}) and ${CANON_SEARXNG_URL} (${canon.reason}) — search-grounded seats will BLOCK` };
}

// Resolve whether a seat model name can be served by SOME provider. A name that resolves
// NOWHERE is the 404-on-fire case this preflight exists to catch.
function resolveModelProvider(name, cloudIds, localNames, claudeOK) {
  if (/^(opus|sonnet|haiku|claude-)/i.test(name)) return claudeOK ? 'claude' : null;
  if (cloudIds.has(name)) return 'cloud';
  if (localNames.has(name)) return 'local';
  const bare = name.replace(/:cloud$/, '').replace(/-cloud$/, '');   // waterfall heals these suffixes
  if (cloudIds.has(bare)) return 'cloud';
  if (localNames.has(name + ':cloud')) return 'local';
  return null;
}

// The set of seat models to validate. If a mode is active, validate THAT mode's seats (what
// will actually fire). If no mode is set, validate the UNION of every mode's seats as a
// defensive superset (the engine's hardcoded defaults are a subset of these names).
function gatherSeatModels() {
  const mode = readMode();
  const seats = activeSeats();
  const out = [];
  const push = (role, v) => Array.isArray(v) ? v.forEach((m, i) => out.push({ role: `${role}[${i}]`, model: m })) : out.push({ role, model: v });
  if (seats) {
    for (const [role, v] of Object.entries(seats)) push(role, v);
    return { mode: mode || '(active)', models: out };
  }
  // no mode -> defensive union across all modes (deduped by model name)
  const seen = new Set();
  for (const mname of MODES) {
    const t = resolveMode(mname); if (!t) continue;
    for (const [role, v] of Object.entries(t)) {
      const vals = Array.isArray(v) ? v : [v];
      for (const m of vals) if (!seen.has(m)) { seen.add(m); out.push({ role: `${mname}.${role}`, model: m }); }
    }
  }
  return { mode: '(default — checking union of all modes)', models: out };
}

// Run all checks
console.log('=== DOCTOR CHECKS ===\n');

const checks = {};

checks.node = checkNode();
checks.env = checkEnvKeys();

checks.wrangler = checkWrangler();
const cloudPing = await pingOllamaCloud();
const claudePing = checkClaudeCLI();
checks.cloud = cloudPing;
checks.claude = claudePing;

checks.git = checkGit();

checks.gov = checkGovernance();

// ---- PREFLIGHT (fire-readiness) ----
const ollamaLocal = await checkOllamaLocal();
const cloudCatalog = await fetchCloudModels();
const pwsh = checkPwsh();
const gitBin = checkGitBinary();
const searxng = await checkSearxng();

// per-seat model availability — the anti-404 check
const { mode: activeMode, models: seatModels } = gatherSeatModels();
const claudeOK = checks.claude.ok;
const modelRows = seatModels.map((s) => ({ ...s, provider: resolveModelProvider(s.model, cloudCatalog.ids, ollamaLocal.names, claudeOK) }));
const unresolved = modelRows.filter((r) => !r.provider);
// If we could not fetch the cloud catalog, model resolution is UNRELIABLE (a real cloud model
// would look unresolved) — flag that explicitly instead of a false 404 alarm.
const catalogReliable = cloudCatalog.ok;
const modelsOK = catalogReliable && unresolved.length === 0;

// Render two-column PASS/FAIL board
const board = [];
const renderCheck = (label, obj, crit = false) => {
  const ok = obj.ok;
  const status = ok ? 'PASS' : (crit ? 'FAIL' : 'WARN');
  board.push(`[${status}] ${label.padEnd(30)} ${obj.detail || ''}`);
  return ok;
};
const renderEnv = (k, present) => {
  const status = present ? 'PASS' : 'FAIL';
  board.push(`[${status}] env.${k.padEnd(20)} ${present ? 'PRESENT' : 'MISSING'}`);
  return present;
};

renderCheck('Node runtime', checks.node, true);
for (const e of checks.env) renderEnv(e.name, e.present);
renderCheck('Wrangler auth', checks.wrangler);
renderCheck('Ollama Cloud ping', checks.cloud, true);
renderCheck('Claude CLI ping', checks.claude, true);
renderCheck('Git health', checks.git);
for (const g of checks.gov) renderCheck(`Governance ${path.basename(g.file)}`, { ok: g.present, detail: g.present ? 'found' : 'missing' }, true);

console.log('\n=== BOARD ===\n');
for (const line of board) console.log(line);

// ---- PREFLIGHT board (fire-readiness) ----
const pf = [];
const renderPf = (label, obj, crit = false) => {
  const status = obj.ok ? 'PASS' : (crit ? 'FAIL' : 'WARN');
  pf.push(`[${status}] ${label.padEnd(30)} ${obj.detail || ''}`);
  return obj.ok;
};
renderPf('Ollama-local reachable', ollamaLocal);                 // WARN if down (cloud can still serve)
renderPf('Cloud model catalog', cloudCatalog, true);            // FAIL: needed to validate seats won't 404
renderPf('pwsh / witness shell', pwsh, pwsh.ok ? false : true); // WARN if only 5.1 (fallback active); FAIL if neither shell
renderPf('Git binary', gitBin);
renderPf('SearXNG (seat URL)', searxng, true);                   // FAIL: search-grounded seats fail-closed
// model availability rows
if (!catalogReliable) {
  pf.push(`[WARN] ${'Seat model availability'.padEnd(30)} cloud catalog unavailable — cannot confirm models won't 404 (mode=${activeMode})`);
} else if (unresolved.length === 0) {
  pf.push(`[PASS] ${'Seat model availability'.padEnd(30)} all ${modelRows.length} seat models resolve (mode=${activeMode})`);
} else {
  pf.push(`[FAIL] ${'Seat model availability'.padEnd(30)} ${unresolved.length}/${modelRows.length} seat models 404 on ALL providers (mode=${activeMode})`);
}
for (const r of modelRows) {
  const tag = r.provider ? `-> ${r.provider}` : '-> UNRESOLVED (404 on cloud+local+claude)';
  pf.push(`        ${String(r.role).padEnd(16)} ${String(r.model).padEnd(22)} ${tag}`);
}

console.log('\n=== PREFLIGHT (fire-readiness) ===\n');
for (const line of pf) console.log(line);

// Compute conduct-critical gate: node OK AND (>=1 of {Ollama Cloud, Claude} reachable) AND governance present
const nodeOK = checks.node.ok;
const cloudOrClaudeOK = checks.cloud.ok || checks.claude.ok;
const govOK = checks.gov.every((g) => g.present);

const conductPass = nodeOK && cloudOrClaudeOK && govOK;

// Fire-readiness gate (ENGINE-READINESS, 2026-06-26): on top of conduct-critical, a mission
// must not fire without a working witness shell, a usable search backend, and every active
// seat model resolvable. Ollama-local / pwsh7 / git-sync are WARN-only (cloud serves, 5.1
// fallback exists). OLLAMA_API_KEY is implied by cloudOrClaude + catalog.
const witnessShellOK = pwsh.ok;            // true even on 5.1 fallback; false only if NO shell
const searxngOK = searxng.ok;
const firePass = conductPass && witnessShellOK && searxngOK && modelsOK;

console.log(`\nRESULT: ${firePass ? 'PASS' : 'FAIL'}`);
console.log(`  conduct-critical: node=${nodeOK ? 'OK' : 'FAIL'}, cloud/claude=${cloudOrClaudeOK ? 'OK' : 'FAIL'}, governance=${govOK ? 'OK' : 'FAIL'}`);
console.log(`  fire-readiness:   witness-shell=${witnessShellOK ? 'OK' : 'FAIL'}, searxng=${searxngOK ? 'OK' : 'FAIL'}, seat-models=${modelsOK ? 'OK' : (catalogReliable ? 'FAIL' : 'UNKNOWN')}`);
if (!firePass) {
  const reasons = [];
  if (!nodeOK) reasons.push('node down');
  if (!cloudOrClaudeOK) reasons.push('no cloud/claude provider');
  if (!govOK) reasons.push('governance files missing');
  if (!witnessShellOK) reasons.push('no PowerShell (code receipts cannot run)');
  if (!searxngOK) reasons.push(`searxng unusable: ${searxng.detail}`);
  if (!modelsOK) reasons.push(catalogReliable ? `seat models 404: ${unresolved.map((u) => u.model).join(', ')}` : 'cloud catalog unavailable (model check inconclusive)');
  console.log(`  RED: ${reasons.join(' | ')}`);
}

process.exit(firePass ? 0 : 1);
