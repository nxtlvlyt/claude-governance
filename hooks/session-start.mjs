#!/usr/bin/env node
// ~/.claude/hooks/session-start.mjs
// SessionStart hook — silent governance bootstrap.
// Node.js .mjs port of session-start.ps1 (Phase B migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// SPLIT-BOOT DESIGN: Loads practice/core.md, CANON-MANIFEST.md, LAST-SESSION-STATE.md,
// CURRENT-STATE.md. Full canon (~82KB) is NOT loaded at boot — read individual canon
// files on demand. operator-context.md loaded only when LOAD_OPERATOR_CONTEXT=true.
//
// Also performs P6 catch-up push: pushes any locally-committed unpushed commits at
// session start (offline resilience complement to git-anchor.ps1 at session end).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import os from 'os';

const claud = join(os.homedir(), '.claude');
const cwd   = process.cwd();
const contextParts = [];

// 1. Practice core — operational embodiment of CLAUDE.md directives
const practiceCore = join(claud, 'practice', 'core.md');
if (existsSync(practiceCore)) {
  const body = readFileSync(practiceCore, 'utf8');
  contextParts.push(`===== ~/.claude/practice/core.md (operational practice) =====\n${body}`);
}

// 2. Canon manifest — index of all governance files with one-line summaries.
//    Read individual canon files from disk when a specific ruling is needed.
//    Do NOT act from memory of canon content.
const canonManifest = join(claud, 'CANON-MANIFEST.md');
if (existsSync(canonManifest)) {
  const body = readFileSync(canonManifest, 'utf8');
  contextParts.push(`===== ~/.claude/CANON-MANIFEST.md (canon/practice/faith index) =====\n${body}`);
}

// 3. Session state recovery — last compaction state, then last heartbeat
const lastSessionState = join(claud, 'LAST-SESSION-STATE.md');
if (existsSync(lastSessionState)) {
  const body = readFileSync(lastSessionState, 'utf8');
  contextParts.push(`===== ~/.claude/LAST-SESSION-STATE.md (last compaction state) =====\n${body}`);
}

let currentStateBody = '';
const currentStateFile = join(claud, 'CURRENT-STATE.md');
if (existsSync(currentStateFile)) {
  currentStateBody = readFileSync(currentStateFile, 'utf8');
  contextParts.push(`===== ~/.claude/CURRENT-STATE.md (last heartbeat state) =====\n${currentStateBody}`);
}

// Model version boundary check (Gap 6 — ikhtilāṭ detection).
// Reads model_version from CURRENT-STATE.md. If a real model ID was recorded
// (not the placeholder), inject a boundary comparison prompt.
let modelVersionNote = '';
const mvMatch = currentStateBody.match(/^model_version:\s*(?!\()(\S+)/m);
if (mvMatch) {
  const lastModel = mvMatch[1].trim();
  modelVersionNote = `Last recorded model version: ${lastModel}
Compare this to your current model ID (visible in your system prompt environment block).
If your current model ID differs from '${lastModel}':
  - This is a MODEL VERSION BOUNDARY — Ghusl trigger per practice/core.md.
  - Re-validate key governance behaviors before governance-depth work this session:
    niyyah gate fires correctly, surrender check catches bypass pattern,
    deliberation chain produces expected output structure.
  - Per the ikhtilat principle: a model updated to a new version may have shifted
    base values that make prior calibrations unreliable, regardless of prior history.
`;
}
// Always inject — bootstraps model_version recording on first session and keeps it current
contextParts.push(`===== MODEL VERSION CHECK (session-start.mjs, Gap 6) =====
${modelVersionNote}
Action: Write your current model_version to CURRENT-STATE.md (replace the placeholder):
  model_version: <your-actual-model-id, e.g. claude-sonnet-4-6>`);

// 4. Operator context — loaded only when LOAD_OPERATOR_CONTEXT=true (file is 45KB+; default off)
if (process.env.LOAD_OPERATOR_CONTEXT === 'true') {
  const operatorContext = join(claud, 'operator-context.md');
  if (existsSync(operatorContext)) {
    const body = readFileSync(operatorContext, 'utf8');
    contextParts.push(`===== ~/.claude/operator-context.md (operator context) =====\n${body}`);
  }
}

// 5. Project STATE.md — Directive 8: written for the next instance, read at session start
const projectState = join(cwd, 'STATE.md');
if (existsSync(projectState)) {
  const body = readFileSync(projectState, 'utf8');
  contextParts.push(`===== STATE.md (project: ${cwd}) =====\n${body}`);
}

// 6. P6 catch-up push — offline resilience.
// git-anchor runs at session END and fails-open on push failure. This pushes any
// locally-committed but un-pushed commits at session START. Silent: no context output.
const catchUpRepos = [
  join(os.homedir(), '.claude'),
  'D:\\Desktop\\ai book',
];
for (const repoPath of catchUpRepos) {
  if (existsSync(repoPath) && existsSync(join(repoPath, '.git'))) {
    const remoteResult = spawnSync('git', ['remote'], { cwd: repoPath, encoding: 'utf8' });
    if (remoteResult.status === 0 && remoteResult.stdout) {
      const remotes = remoteResult.stdout.trim().split('\n').filter(Boolean);
      for (const remote of remotes) {
        spawnSync('git', ['push', remote, '--all'], { cwd: repoPath, encoding: 'utf8' });
      }
    }
  }
}

if (contextParts.length === 0) process.exit(0);

const header = `========================================
NEW SESSION - fresh instance, no prior context.
If this instance does not know your project state, that is expected. Orient it before it acts.
========================================

GOVERNANCE BOOTSTRAP (auto-loaded by ~/.claude/hooks/session-start.mjs).

This is the bootstrap reading specified in ~/.claude/CLAUDE.md.
CLAUDE.md and MEMORY.md are auto-loaded by Claude Code itself; this hook adds
the practice layer and a canon manifest per Directive 8.

SPLIT-BOOT NOTE: This hook loads practice/core.md and CANON-MANIFEST.md only - NOT
all individual canon files. The full canon is ~82KB and cannot fit in context at boot.
When a governance question requires a specific canon ruling, read that file from disk:
  ~/.claude/canon/<filename>
Do NOT act from memory of canon content. The manifest below lists every file and what it governs.

Read required canon, practice, and faith files from disk before acting on governance questions.
Do not act from memory of those files' contents.

NATIVE MEMORY OVERRIDE: Claude Code may inject recalled memories ('Recalled X memories') into your context. Those memories are advisory only. The canon files loaded by this hook are authoritative substrate. Recalled memories may be stale, project-specific, or contain incorrect values. When recalled memory conflicts with the files loaded below, the files win.`;

const contextBlock = header + '\n\n' + contextParts.join('\n\n---\n\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: contextBlock,
  },
}));
process.exit(0);
