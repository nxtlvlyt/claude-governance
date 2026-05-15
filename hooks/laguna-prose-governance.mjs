#!/usr/bin/env node
// ~/.claude/hooks/laguna-prose-governance.mjs
// On-demand governance audit for prose repos (.laguna-prose).
// Node.js .mjs port of laguna-prose-governance.ps1 (Phase D migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Invoked via: git governance-prose
// NOT a blocking hook — explicit operator dispatch before prose commits.
//
// Reviews staged prose files against granite4.1:30b for:
//   - FAITH alignment
//   - Structural coherence
//   - Unverified claims
//   - STATE.md consistency
// Returns VERDICT: PASS / WARN / BLOCK
//
// Verdict parsing: LAST-MATCH (GLM finding: first-match can be fooled by echoed diff content)

import { spawnSync } from 'child_process';
import * as http from 'http';

const c = {
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  reset:  '\x1b[0m',
};

function log(msg, color = c.reset) {
  process.stdout.write(`${color}${msg}${c.reset}\n`);
}

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

function ollamaCheck(base, timeoutMs) {
  return new Promise((resolve) => {
    const url = new URL(`${base}/api/tags`);
    const req = http.request(
      { hostname: url.hostname, port: Number(url.port) || 11434, path: '/api/tags', method: 'GET' },
      () => resolve(true),
    );
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
      res.on('data', ch => chunks.push(ch));
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

const ollamaBase = 'http://localhost:11434';
const model      = 'granite4.1:30b';

const stagedFiles = git(['diff', '--cached', '--name-only']).stdout.split('\n').filter(Boolean);
const proseFiles  = stagedFiles.filter(f => /\.(md|txt|markdown)$/i.test(f));

if (proseFiles.length === 0) {
  log('[prose-governance] No prose files staged.', c.gray);
  process.exit(0);
}

const diff = git(['diff', '--cached', '--', ...proseFiles]).stdout;

const systemPrompt = `You are a governance auditor for an AI governance book. The book's thesis: AI systems
work better under governance derived from deep human traditions (specifically Islamic
practice), because those traditions have accumulated wisdom about holding relationship
to source across time.

Review staged prose changes for:
1. FAITH alignment — does the writing hold to the book's governing thesis?
2. Structural coherence — does the argument hold together internally?
3. Unverified claims — what is asserted more strongly than it can be supported?
4. STATE.md consistency — do the changes match what is documented as current?

Return your verdict in EXACTLY this format (the last VERDICT line is authoritative):
VERDICT: PASS
ISSUES:
- [WARN] description (file if visible in diff)
NOTES: one-line summary`;

const userMsg = `Staged files:\n${proseFiles.join('\n')}\n\n<<<DIFF_START>>>\n${diff}\n<<<DIFF_END>>>`;

log(`\n[prose-governance] Dispatching granite4.1:30b audit (${proseFiles.length} file(s))...`, c.cyan);

const reachable = await ollamaCheck(ollamaBase, 4000);
if (!reachable) {
  log(`[prose-governance] ERROR — Ollama not reachable at ${ollamaBase}. Audit did not run.`, c.red);
  process.exit(1);
}

let critique;
try {
  const response = await ollamaChat(ollamaBase, {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMsg      },
    ],
    stream:  false,
    options: { num_ctx: 65536, temperature: 0.3 },
  }, 600_000);
  critique = response.message?.content || '';
} catch (e) {
  log(`[prose-governance] ERROR — ${e.message}`, c.red);
  process.exit(1);
}

// Last-match verdict parsing (GLM finding: first-match can be fooled by echoed diff content)
let verdict = 'PASS';
const verdictMatches = [...critique.matchAll(/^VERDICT:\s*(BLOCK|WARN|PASS)/gim)];
if (verdictMatches.length > 0) {
  verdict = verdictMatches[verdictMatches.length - 1][1].toUpperCase();
}

log('');
log('┌─ Prose Governance Audit (Granite 4.1) ─────────────────────────', c.cyan);
process.stdout.write(critique + '\n');
log('└─────────────────────────────────────────────────────────────────', c.cyan);
log('');

if (verdict === 'BLOCK') {
  log('[prose-governance] BLOCK — resolve issues before committing.', c.red);
  process.exit(1);
} else if (verdict === 'WARN') {
  log('[prose-governance] WARN — issues noted. Commit at operator discretion.', c.yellow);
  process.exit(0);
} else {
  log('[prose-governance] PASS', c.green);
  process.exit(0);
}
