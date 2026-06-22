// doctor.mjs — one-shot conduct-readiness check.
// Checks in order: (a) node present + version via process.version; (b) the four env keys rendered PRESENT/MISSING (boolean computed); (c) wrangler auth via exit code; (d) cloud canary ping + claude CLI ping; (e) git status (offline-safe); (f) governance present.
// Render two-column PASS/FAIL board with final RESULT line.
// Conduct-critical gate = node OK AND (>=1 of {Ollama Cloud, Claude} reachable) AND governance present; process.exit(0) only when all conduct-critical pass, else process.exit(1).
// Non-critical fails (wrangler, git-behind, one tier down) print WARN/FAIL but do not flip the exit code.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ENV_KEYS = ['OLLAMA_API_KEY', 'OLLAMA_CLOUD_API_KEY', 'GOOGLE_PLACES_API_KEY', 'AIMLAPI_KEY'];
const OLLAMA_CLOUD_BASE = 'https://ollama.com/v1';
const CLOUD_TIMEOUT_MS = 10000;
const GOV_FILES = ['~/.claude/practice/core.md', '~/.claude/CANON-MANIFEST.md'];

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

// Compute conduct-critical gate: node OK AND (>=1 of {Ollama Cloud, Claude} reachable) AND governance present
const nodeOK = checks.node.ok;
const cloudOrClaudeOK = checks.cloud.ok || checks.claude.ok;
const govOK = checks.gov.every((g) => g.present);

const criticalPass = nodeOK && cloudOrClaudeOK && govOK;

console.log(`\nRESULT: ${criticalPass ? 'PASS' : 'FAIL'} (conduct-critical: node=${nodeOK ? 'OK' : 'FAIL'}, cloud/claude=${cloudOrClaudeOK ? 'OK' : 'FAIL'}, governance=${govOK ? 'OK' : 'FAIL'})`);

process.exit(criticalPass ? 0 : 1);
