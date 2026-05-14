#!/usr/bin/env node
'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_URL = 'https://github.com/nxtlvlyt/claude-governance.git';
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const GOVERNANCE_MARKER = path.join(CLAUDE_DIR, 'CLAUDE.md');
const INSTALL_SCRIPT = path.join(CLAUDE_DIR, 'install.ps1');

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: 'inherit', ...opts });
}

function check(cmd) {
  try { execSync(cmd, { stdio: 'pipe' }); return true; } catch { return false; }
}

function abort(msg) {
  console.error('\n  ERROR:', msg, '\n');
  process.exit(1);
}

function header(msg) {
  console.log('\n' + msg);
}

const isWindows = os.platform() === 'win32';

header('claude-governance — structural governance layer for Claude Code');
console.log('  Repo: ' + REPO_URL);

// ── git ─────────────────────────────────────────────────────────────────────
if (!check('git --version')) {
  abort('git not found. Install git first: https://git-scm.com/downloads');
}

// ── ~/.claude ────────────────────────────────────────────────────────────────
if (fs.existsSync(CLAUDE_DIR)) {
  if (!fs.existsSync(GOVERNANCE_MARKER)) {
    abort(
      `~/.claude exists but does not appear to be the governance repo (CLAUDE.md missing).\n` +
      `  If this is an existing Claude Code config dir, back it up first:\n` +
      `    mv ~/.claude ~/.claude.bak\n` +
      `  Then re-run: npx @nxtlvl/claude-governance`
    );
  }
  header('  ~/.claude already present — skipping clone.');
} else {
  header('  Cloning governance repo to ~/.claude ...');
  const result = run(`git clone "${REPO_URL}" "${CLAUDE_DIR}"`);
  if (result.status !== 0) {
    abort('git clone failed. Check your internet connection and try again.');
  }
  console.log('  Clone complete.');
}

// ── installer ────────────────────────────────────────────────────────────────
if (!fs.existsSync(INSTALL_SCRIPT)) {
  abort('install.ps1 not found in ~/.claude — the clone may be incomplete.');
}

if (!isWindows) {
  console.log(`
  The full installer (install.ps1) is currently Windows-only (PowerShell).

  Manual steps for Mac/Linux:
    1. Register hooks in ~/.claude/settings.json (see hooks/ directory)
    2. Install Ollama: https://ollama.com/download
    3. Pull governance models: ollama pull laguna-xs.2:q4_K_M
    4. Set up AnythingLLM for episodic memory (P5)
    5. Configure P6 dual-remote: add GitHub + Codeberg remotes to ~/.claude

  Full instructions: ~/.claude/README.md
  Cross-platform installer: tracked in https://github.com/nxtlvlyt/claude-governance/issues
`);
  process.exit(0);
}

header('  Running install.ps1 ...\n');
const result = run(`pwsh -ExecutionPolicy Bypass -File "${INSTALL_SCRIPT}"`);
process.exit(result.status ?? 0);
