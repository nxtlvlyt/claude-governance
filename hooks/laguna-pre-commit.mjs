#!/usr/bin/env node
// ~/.claude/hooks/laguna-pre-commit.mjs
// Pre-commit code quality gate.
// Node.js .mjs port of laguna-pre-commit.ps1 (Phase D migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Verdict semantics:
//   BLOCK — security hole, data loss risk, broken dependency, production crash. Exits 1.
//   WARN  — code smell, missing error handling, style gap, perf concern. Exits 0.
//   PASS  — no significant issues. Exits 0.
//
// Cannot verify = cannot approve:
//   - Ollama unreachable → BLOCK
//   - Timeout           → BLOCK
//   - Diff exceeds context window → BLOCK
//
// Bypass: git commit --no-verify

import { createHash } from 'crypto';
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { spawnSync } from 'child_process';
import * as http from 'http';
import os from 'os';

const c = {
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  gray:    '\x1b[90m',
  reset:   '\x1b[0m',
};

function git(args, opts = {}) {
  return spawnSync('git', args, { encoding: 'utf8', ...opts });
}

function log(msg, color = c.reset) {
  process.stdout.write(`${color}${msg}${c.reset}\n`);
}

// --- Ollama helpers ---
function ollamaCheck(base, timeoutMs) {
  return new Promise((resolve) => {
    const url = new URL(`${base}/api/tags`);
    const req = http.request({ hostname: url.hostname, port: Number(url.port) || 11434, path: '/api/tags', method: 'GET' }, () => resolve(true));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

function ollamaChat(base, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const reqBody = JSON.stringify(body);
    const url = new URL(`${base}/api/chat`);
    const req = http.request({
      hostname: url.hostname,
      port: Number(url.port) || 11434,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqBody) },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
      });
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('Timeout')); });
    req.on('error', reject);
    req.write(reqBody);
    req.end();
  });
}

// --- Setup ---
let ollamaBase = 'http://localhost:11434';
const repoRootResult = git(['rev-parse', '--show-toplevel']);
const repoRoot = repoRootResult.status === 0 ? repoRootResult.stdout.trim() : null;

// Prose repo detection
if (repoRoot) {
  const proseMarker   = join(repoRoot, '.laguna-prose');
  const warroomMarker = join(repoRoot, '.laguna-warroom');
  const hasProse      = existsSync(proseMarker);
  const hasWarroom    = existsSync(warroomMarker);
  if (hasProse && hasWarroom) {
    log('[laguna-review] CONFIG ERROR — .laguna-prose and .laguna-warroom both present. Markers are mutually exclusive. Resolve before committing.', c.red);
    process.exit(1);
  }
  if (hasProse) {
    log("[laguna-review] PROSE MODE — Skipping automatic code review. Run 'git governance-prose' if required.", c.gray);
    process.exit(0);
  }
}

// Ollama host override from config/resources.yaml
if (repoRoot) {
  const resYaml = join(repoRoot, 'config', 'resources.yaml');
  if (existsSync(resYaml)) {
    try {
      const lines = readFileSync(resYaml, 'utf8').split('\n');
      let inOllama = false;
      for (const yamlLine of lines) {
        if (/^ollama:\s*$/.test(yamlLine)) { inOllama = true; continue; }
        if (inOllama) {
          const m = yamlLine.match(/^\s+host:\s*["']?([^"'#\s\r\n]+)/);
          if (m && m[1]) { ollamaBase = m[1].trim(); break; }
          if (/^[a-zA-Z]/.test(yamlLine)) break;
        }
      }
    } catch { /* non-fatal */ }
  }
}

const model       = 'laguna-xs.2:q4_K_M';
const maxChars    = 524288;     // laguna 131072 token ctx at 4 chars/token
const timeoutSec  = 131072;     // per Mark rule: timeout(s) >= num_ctx(tokens)

// --- Staged diff ---
const stagedFiles = git(['diff', '--cached', '--name-only']).stdout.split('\n').filter(Boolean);
const diff        = git(['diff', '--cached', '--unified=3', '--no-ext-diff', '--no-textconv']).stdout;

if (!diff.trim()) process.exit(0);

// --- Log setup ---
const logDir  = join(os.homedir(), '.claude', 'logs', 'laguna');
const logFile = join(logDir, 'verdicts.jsonl');
let diffHash  = null;
try {
  mkdirSync(logDir, { recursive: true });
  const diffContent = git(['diff', '--cached']).stdout;
  diffHash = spawnSync('git', ['hash-object', '--stdin'], { input: diffContent, encoding: 'utf8' }).stdout.trim() || null;
} catch {
  log('[laguna-review] WARN — log setup or diff hash failed. Logging may be degraded.', c.gray);
}

function writeLog(entry) {
  try { appendFileSync(logFile, JSON.stringify(entry) + '\n'); }
  catch { log('[laguna-review] WARN — log write failed.', c.gray); }
}

function blockCommit(kind, msg) {
  log(`\n[laguna-review] BLOCKED — ${msg}`, c.red);
  log('                To override: git commit --no-verify', c.gray);
  writeLog({ ts: new Date().toISOString(), verdict: 'BLOCK', kind, diff_hash: diffHash, files: stagedFiles.join(',') });
  process.exit(1);
}

// --- Diff size gate ---
if (diff.length > maxChars) {
  log(`\n[laguna-review] BLOCKED — diff exceeds laguna context window (${diff.length} chars > ${maxChars} limit).`, c.red);
  log('                Cannot review incomplete diff. Split commit or reduce diff size.', c.gray);
  log('                To override: git commit --no-verify', c.gray);
  writeLog({ ts: new Date().toISOString(), verdict: 'BLOCK', kind: 'context_exceeded', diff_hash: diffHash, files: stagedFiles.join(',') });
  process.exit(1);
}

// --- Main async flow ---
const reachable = await ollamaCheck(ollamaBase, 4000);
if (!reachable) blockCommit('ollama_unreachable', 'Ollama not reachable. Cannot verify commit.\n                Restore Ollama service or use: git commit --no-verify');

const systemPrompt = `You are a senior software engineer doing a pre-commit code review.
The codebase is a self-hosted AI media platform: PHP backend, Python workers, PowerShell scripts.

Return your review in EXACTLY this format — no extra text before the verdict line:

VERDICT: PASS
ISSUES:
- [WARN] description (file:line if visible in diff)
NOTES: one-line summary

VERDICT rules:
  BLOCK — use when: SQL injection / XSS / auth bypass, data loss, broken import/require,
           logic that will throw in production, secrets committed to diff.
  WARN  — use when: swallowed exception, missing null check, N+1 query risk,
           inconsistent error handling, dead code, style drift from surrounding file.
  PASS  — no issues worth surfacing.

Be specific. Cite file paths and line numbers from the diff when possible.
If diff is large, prioritize highest-risk changes.`;

const userMessage = `Files changed:\n${stagedFiles.join('\n')}\n\nDiff:\n${diff}`;

log(`\n[laguna-review] Reviewing ${stagedFiles.length} file(s) — timeout ${timeoutSec}s (full context window)...`, c.cyan);

let critique;
try {
  const response = await ollamaChat(ollamaBase, {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    stream: false,
  }, timeoutSec * 1000);
  critique = response.message?.content || '';
} catch (e) {
  const isTimeout = /timeout/i.test(e.message);
  blockCommit(isTimeout ? 'timeout' : 'error', `call ${isTimeout ? 'timeout' : 'error'} (${e.message}).\n                Cannot verify = cannot approve. Use --no-verify for explicit bypass.`);
}

// --- Parse verdict ---
let verdict = 'PASS';
const verdictMatch = critique.match(/(?m)^VERDICT:\s*(BLOCK|WARN|PASS)/im);
if (verdictMatch) verdict = verdictMatch[1].toUpperCase();

// --- Log ---
writeLog({ ts: new Date().toISOString(), verdict, diff_hash: diffHash, files: stagedFiles.join(',') });

// --- Display ---
log('');
log('┌─ Laguna Code Review ────────────────────────────────────────────', c.cyan);
process.stdout.write(critique + '\n');
log('└─────────────────────────────────────────────────────────────────', c.cyan);
log('');

// --- Workshop receipt gate (F7) — warroom repos with core/*.py staged ---
const lagunaIsWarroom = repoRoot && existsSync(join(repoRoot, '.laguna-warroom'));
const lagunaCorePyFiles = stagedFiles.filter(f => /^core\//.test(f) && /\.py$/.test(f));

if (lagunaIsWarroom && lagunaCorePyFiles.length > 0 && verdict !== 'BLOCK') {
  const lagunaTs = new Date();

  const lagunaMutatedFiles = git(['diff', '--cached', '--diff-filter=ACMRT', '--name-only'])
    .stdout.split('\n').filter(f => /^core\//.test(f) && /\.py$/.test(f));

  let lagunaContentHash = null;
  if (lagunaMutatedFiles.length > 0) {
    const lsResult = spawnSync('git', ['ls-files', '--cached', '--stage', '--', ...lagunaMutatedFiles], { encoding: 'utf8' });
    if (!lsResult.stdout.trim()) {
      log('\n[laguna-receipt] BLOCKED — git ls-files returned empty for staged core/*.py mutations.', c.red);
      log('                 Index may be in an inconsistent state. Use --no-verify to bypass.', c.gray);
      process.exit(1);
    }
    const lsLines = lsResult.stdout.trim().split('\n').sort().join('\n');
    lagunaContentHash = createHash('sha256').update(Buffer.from(lsLines, 'utf8')).digest('hex');
  } else {
    const input = `DELETED:${[...lagunaCorePyFiles].sort().join(',')}`;
    lagunaContentHash = createHash('sha256').update(Buffer.from(input, 'utf8')).digest('hex');
  }

  if (!lagunaContentHash) {
    log('\n[laguna-receipt] BLOCKED — content hash computation failed.', c.red);
    log('                 Use --no-verify to bypass.', c.gray);
    process.exit(1);
  }

  const authorRaw = git(['config', 'user.name']).stdout.trim();
  const author = authorRaw || process.env.USERNAME || process.env.USER || 'unknown';

  // Governance audit (Granite 4.1)
  log('[laguna-receipt] Dispatching governance audit (granite4.1:30b)...', c.cyan);
  const graniteSystem = `You are a governance-aware systems auditor. Your task is to identify untested
assumptions, skipped validations, and blind spots in architectural or operational
decisions. Review the staged changes for canon-coherence and bypass surfaces.`;

  let graniteAudit = null;
  try {
    const graniteResponse = await ollamaChat(ollamaBase, {
      model:    'granite4.1:30b',
      messages: [
        { role: 'system', content: graniteSystem },
        { role: 'user',   content: userMessage   },
      ],
      stream:  false,
      options: { num_ctx: 131072 },
    }, timeoutSec * 1000);
    graniteAudit = graniteResponse.message?.content || null;
    log('┌─ Granite Governance Audit ──────────────────────────────────────', c.cyan);
    process.stdout.write((graniteAudit || '') + '\n');
    log('└─────────────────────────────────────────────────────────────────', c.cyan);
  } catch (e) {
    log(`[laguna-receipt] WARN — governance audit (Granite) failed: ${e.message}`, c.gray);
  }

  // Write receipt
  const yyyy = String(lagunaTs.getFullYear());
  const mm   = String(lagunaTs.getMonth() + 1).padStart(2, '0');
  const dd   = String(lagunaTs.getDate()).padStart(2, '0');
  const tsStr = lagunaTs.toISOString().replace(/[:.]/g, '').replace('T', '').slice(0, 17);
  const receiptDir = join(repoRoot, 'logs', 'receipts', yyyy, mm, dd);
  const receiptLog = join(receiptDir, `${tsStr}.jsonl`);

  const receiptObj = {
    schema_version:   1,
    ts:               lagunaTs.toISOString(),
    author,
    repo:             repoRoot,
    core_py_files:    lagunaCorePyFiles,
    content_hash:     lagunaContentHash,
    laguna_verdict:   verdict,
    governance_audit: graniteAudit,
    diff_hash:        diffHash,
  };

  try {
    mkdirSync(receiptDir, { recursive: true });
    appendFileSync(receiptLog, JSON.stringify(receiptObj) + '\n');
    log(`[laguna-receipt] Core change logged → ${receiptLog}`, c.cyan);
  } catch (e) {
    log('\n[laguna-receipt] BLOCKED — receipt write failed.', c.red);
    log(`                 Target: ${receiptLog}`, c.gray);
    log(`                 Error: ${e.message}`, c.gray);
    log('                 Resolve write access or use: git commit --no-verify', c.gray);
    process.exit(1);
  }
}

// --- Exit ---
if (verdict === 'BLOCK') {
  log('[laguna-review] BLOCKED — fix the issues above before committing.', c.red);
  log('                To override: git commit --no-verify', c.gray);
  process.exit(1);
} else if (verdict === 'WARN') {
  log('[laguna-review] WARN — issues noted. Commit allowed.', c.yellow);
  process.exit(0);
} else {
  log('[laguna-review] PASS', c.green);
  process.exit(0);
}
