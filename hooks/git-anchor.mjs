#!/usr/bin/env node
// ~/.claude/hooks/git-anchor.mjs
// Stop hook — SSH-signed Git commit + dual-remote push for P6 artifact anchoring.
// Node.js .mjs port of git-anchor.ps1 (Phase C migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Static repos anchored at every session end:
//   - ~/.claude/   (governance framework)
//   - D:\Desktop\ai book\  (AI book)
//
// Dynamic repo anchoring (project-aware):
//   Reads session CWD from hook stdin. If CWD passes the safety guard it is anchored too.
//   If CWD is not yet a git repo, auto-init runs: git init + GitHub/Codeberg via API + push.
//
// Commits are SSH-signed and pushed to two independent remotes.
//
// Credential resolution for Codeberg token (C1 blocking concern resolution):
//   1. CODEBERG_TOKEN env var (primary — cross-platform, works in CI/CD)
//   2. Platform credential store (Windows: pwsh CredentialManager; Linux: secret-tool; macOS: security)
//   3. p6-config.json plaintext fallback (deprecated, logs WARN)
//
// Failure behavior: fail-OPEN. Push failures log WARNING but do not block session end.
// The signed commit exists locally even if push fails.

import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { spawnSync } from 'child_process';
import os from 'os';

// Read stdin
let inp = null;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { /* ok */ }
const sessionCwd = inp?.cwd || null;

// Load p6-config.json
const p6ConfigPath = join(os.homedir(), '.claude', 'p6-config.json');
let p6Config = null;
if (existsSync(p6ConfigPath)) {
  try { p6Config = JSON.parse(readFileSync(p6ConfigPath, 'utf8')); } catch { /* ok */ }
}

// System path guard — paths that must never be auto-init'd
const systemGuards = [
  process.env.SystemRoot,
  process.env.ProgramFiles,
  process.env['ProgramFiles(x86)'],
  process.env.ProgramData,
  process.env.SystemDrive ? process.env.SystemDrive + '\\' : null,
].filter(Boolean).map(p => p.toLowerCase().replace(/\\+$/, ''));

function isSafePath(p) {
  if (!p) return false;
  const norm = p.toLowerCase().replace(/\\+$/, '');
  for (const guard of systemGuards) {
    if (norm.startsWith(guard)) return false;
  }
  if (norm.startsWith(os.homedir().toLowerCase())) return true;
  if (p6Config?.project_root_prefixes) {
    for (const prefix of p6Config.project_root_prefixes) {
      if (prefix && norm.startsWith(prefix.toLowerCase().replace(/\\+$/, ''))) return true;
    }
  }
  return false;
}

// Credential resolution (C1 blocking concern resolved):
//   CODEBERG_TOKEN env var → platform credential store → p6-config.json fallback
function getCodebergToken() {
  if (process.env.CODEBERG_TOKEN) return process.env.CODEBERG_TOKEN;

  try {
    if (process.platform === 'win32') {
      // pwsh CredentialManager is the Windows platform credential tool (cmdkey cannot return passwords)
      const r = spawnSync('pwsh', [
        '-NoProfile', '-NonInteractive', '-Command',
        'try { Import-Module CredentialManager -EA Stop; $c = Get-StoredCredential -Target "governance:codeberg" -EA Stop; $c.GetNetworkCredential().Password } catch { exit 1 }',
      ], { encoding: 'utf8', timeout: 8000 });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    } else if (process.platform === 'linux') {
      const r = spawnSync('secret-tool', ['lookup', 'target', 'governance:codeberg'],
        { encoding: 'utf8', timeout: 5000 });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    } else if (process.platform === 'darwin') {
      const r = spawnSync('security', ['find-generic-password', '-s', 'governance:codeberg', '-w'],
        { encoding: 'utf8', timeout: 5000 });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    }
  } catch { /* non-fatal */ }

  if (p6Config?.codeberg_token) {
    process.stderr.write('WARN: Codeberg token read from plaintext p6-config.json — migrate to CODEBERG_TOKEN env var or platform credential store\n');
    return p6Config.codeberg_token;
  }

  return null;
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

// Auto-init: git init + create remote repos + push
function initializeProjectRepo(repoPath) {
  if (!p6Config) return `[SKIP] auto-init ${basename(repoPath)} — no p6-config.json`;

  const repoName = basename(repoPath);
  const msgs = [`[INIT] ${repoName}`];

  git(['init', '-b', 'master'], repoPath);
  git(['add', '-A'], repoPath);

  let commitResult = git(['commit', '-S', '-m', 'project: initial commit'], repoPath);
  if (commitResult.status !== 0) {
    git(['commit', '-m', 'project: initial commit [signing-failed]'], repoPath);
  }

  // GitHub
  if (p6Config.github_user) {
    const gh = spawnSync('gh', ['repo', 'create', `${p6Config.github_user}/${repoName}`, '--private'],
      { encoding: 'utf8' });
    const existingRemotes = git(['remote'], repoPath).stdout.trim().split('\n');
    if (!existingRemotes.includes('github')) {
      git(['remote', 'add', 'github', `git@github.com:${p6Config.github_user}/${repoName}.git`], repoPath);
    }
    const pushResult = git(['push', '-u', 'github', 'master'], repoPath);
    msgs.push(pushResult.status === 0 ? 'pushed to github' : 'WARN: github push failed');
  }

  // Codeberg
  const codebergToken = getCodebergToken();
  if (p6Config.codeberg_user && codebergToken) {
    const payload = JSON.stringify({ name: repoName, private: true, auto_init: false });
    spawnSync('curl', [
      '-s', '-X', 'POST', 'https://codeberg.org/api/v1/user/repos',
      '-H', `Authorization: token ${codebergToken}`,
      '-H', 'Content-Type: application/json',
      '-d', payload,
    ], { encoding: 'utf8' });

    const existingRemotes = git(['remote'], repoPath).stdout.trim().split('\n');
    if (!existingRemotes.includes('codeberg')) {
      git(['remote', 'add', 'codeberg', `git@codeberg.org:${p6Config.codeberg_user}/${repoName}.git`], repoPath);
    }
    const pushResult = git(['push', '-u', 'codeberg', 'master'], repoPath);
    msgs.push(pushResult.status === 0 ? 'pushed to codeberg' : 'WARN: codeberg push failed');
  }

  return msgs.join('; ');
}

// Anchor an existing git repo
function anchorRepo(repoPath, label) {
  if (!existsSync(repoPath)) return `[SKIP] ${label} — path not found`;
  if (!existsSync(join(repoPath, '.git'))) return `[SKIP] ${label} — not a git repo`;

  git(['add', '-A'], repoPath);

  const statusResult = git(['status', '--porcelain'], repoPath);
  if (!statusResult.stdout.trim()) {
    const remotes = git(['remote'], repoPath).stdout.trim().replace(/\n/g, ', ');
    return `[OK] ${label} — no changes to commit (remotes: ${remotes})`;
  }

  const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '') + ' +00:00';
  const commitMsg = `governance: session-end anchor ${ts}`;

  let commitResult = git(['commit', '-S', '-m', commitMsg], repoPath);
  if (commitResult.status !== 0) {
    commitResult = git(['commit', '-m', `${commitMsg} [signing-failed]`], repoPath);
    if (commitResult.status !== 0) {
      return `[WARN] ${label} — commit failed: ${commitResult.stderr.trim()}`;
    }
  }

  const remotes = git(['remote'], repoPath).stdout.trim().split('\n').filter(Boolean);
  const pushResults = [];
  for (const remote of remotes) {
    const branch = git(['branch', '--show-current'], repoPath).stdout.trim();
    const pushResult = git(['push', remote, branch], repoPath);
    pushResults.push(pushResult.status === 0
      ? `pushed to ${remote}`
      : `WARN: push to ${remote} failed: ${pushResult.stderr.trim()}`);
  }

  return `[OK] ${label} — committed + ${pushResults.join('; ')}`;
}

// Build repo list
const reposToAnchor = [
  { path: join(os.homedir(), '.claude'), label: 'governance' },
  { path: 'D:\\Desktop\\ai book',        label: 'ai-book'    },
];

const results = [];

// Add session CWD if safe and not already listed
if (sessionCwd && isSafePath(sessionCwd)) {
  const cwdNorm = sessionCwd.toLowerCase().replace(/\\+$/, '');
  const alreadyListed = reposToAnchor.some(r => r.path.toLowerCase().replace(/\\+$/, '') === cwdNorm);
  if (!alreadyListed) {
    if (!existsSync(join(sessionCwd, '.git'))) {
      results.push(initializeProjectRepo(sessionCwd));
    }
    reposToAnchor.push({ path: sessionCwd, label: basename(sessionCwd) });
  }
}

// Anchor all repos
for (const { path, label } of reposToAnchor) {
  results.push(anchorRepo(path, label));
}

const summary = results.join(' | ');
process.stdout.write(JSON.stringify({ decision: 'approve', reason: `P6 git-anchor: ${summary}` }));
process.exit(0);
