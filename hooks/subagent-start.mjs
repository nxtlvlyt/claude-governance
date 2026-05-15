#!/usr/bin/env node
// ~/.claude/hooks/subagent-start.mjs
// SubagentStart hook — silent governance bootstrap for delegated agents.
// Node.js .mjs port of subagent-start.ps1 (Phase B migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Subagents in Claude Code do NOT inherit their parent's hooks. This hook injects
// the same governance bootstrap (CLAUDE.md, practice/core.md, all canon/*.md,
// project STATE.md) into every subagent at start-of-life.

import { readFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Read stdin — subagent input may carry cwd
let inp = null;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { /* ok */ }

const cwd = inp?.cwd || process.cwd();
const claud = join(os.homedir(), '.claude');
const contextParts = [];

// Scripture — auto-loaded for parent sessions but not subagents
const claudeMd = join(claud, 'CLAUDE.md');
if (existsSync(claudeMd)) {
  const body = readFileSync(claudeMd, 'utf8');
  contextParts.push(`===== ~/.claude/CLAUDE.md (scripture) =====\n${body}`);
}

// Practice core
const practiceCore = join(claud, 'practice', 'core.md');
if (existsSync(practiceCore)) {
  const body = readFileSync(practiceCore, 'utf8');
  contextParts.push(`===== ~/.claude/practice/core.md (operational practice) =====\n${body}`);
}

// Canon rulings — all *.md files sorted by name
const canonDir = join(claud, 'canon');
if (existsSync(canonDir)) {
  try {
    const files = readdirSync(canonDir)
      .filter(f => f.endsWith('.md'))
      .sort();
    for (const f of files) {
      const body = readFileSync(join(canonDir, f), 'utf8');
      contextParts.push(`===== ~/.claude/canon/${f} =====\n${body}`);
    }
  } catch { /* non-fatal */ }
}

// Project STATE.md
const projectState = join(cwd, 'STATE.md');
if (existsSync(projectState)) {
  const body = readFileSync(projectState, 'utf8');
  contextParts.push(`===== STATE.md (project: ${cwd}) =====\n${body}`);
}

if (contextParts.length === 0) process.exit(0);

const header = `SUBAGENT GOVERNANCE BOOTSTRAP (auto-loaded by ~/.claude/hooks/subagent-start.mjs).

This subagent was dispatched from a parent Claude Code session. Subagents do
not inherit parent hooks, so this hook injects the same governance the parent
operates under. You operate within the same scripture, practice, and canon as
the parent.

Per CLAUDE.md D14: cross-session memory does not exist; you have only what is
committed to substrate. Per CLAUDE.md D8: write for the one who comes after
you — your output returns to the parent, treat that handoff as you would any
substrate write.`;

let contextBlock = header + '\n\n' + contextParts.join('\n\n---\n\n');

// Serial discipline advisory — check .ollama.lock
const lockPath = join(claud, '.ollama.lock');
if (existsSync(lockPath)) {
  const lockAge = Date.now() - statSync(lockPath).mtimeMs;
  if (lockAge > 10 * 60 * 1000) {
    // Stale lock — remove it (likely from a crash)
    try { unlinkSync(lockPath); } catch { /* ok */ }
    contextBlock += '\n\nSERIAL DISCIPLINE: Stale .ollama.lock removed (>10 min old). Serial inference is clear.';
  } else {
    contextBlock += '\n\nSERIAL DISCIPLINE: .ollama.lock is held. Another Ollama model may be running. Check api/ps before dispatching. Do not dispatch a second model until the lock is released.';
  }
} else {
  contextBlock += '\n\nSERIAL DISCIPLINE: Serial inference — ONE Ollama model at a time. Check api/ps before any Ollama dispatch. Acquire ~/.claude/.ollama.lock (atomic: fs.openSync with wx flag) before dispatch; release after ollama stop.';
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SubagentStart',
    additionalContext: contextBlock,
  },
}));
process.exit(0);
