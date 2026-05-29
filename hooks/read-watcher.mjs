#!/usr/bin/env node
// ~/.claude/hooks/read-watcher.mjs
// PreToolUse hook — records Read tool_use events for PROACTIVE read-before-act gating.
// Mirrors pre-tool-use-task-watcher.mjs (the proven Camel-Rule artifact pattern). NEVER blocks — tracking only.
// State: ~/.claude/state/read-watcher-{session_id}.json = { reads: [{file, ts}, ...] } (last 20).
// Purpose: lets niyyah-gate (and future gates) require a FRESH read of the relevant source before a
// mutating action — making read-before-act proactive + per-action instead of once-per-session + stale.
// Chain-approved 2026-05-29 (6-agent deliberation, unanimous APPROVE/CONDITIONAL_APPROVE; laguna witness APPROVE).

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import os from 'os';

let inp;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inp || inp.tool_name !== 'Read') process.exit(0);

const sessionId = inp.session_id;
if (!sessionId) process.exit(0);

const fp = inp.tool_input?.file_path;
if (!fp) process.exit(0);

const stateDir = join(os.homedir(), '.claude', 'state');
try { mkdirSync(stateDir, { recursive: true }); } catch { /* ok */ }
const stateFile = join(stateDir, `read-watcher-${sessionId}.json`);

let state = { reads: [] };
if (existsSync(stateFile)) {
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (parsed && Array.isArray(parsed.reads)) state = parsed;
  } catch { /* corrupt → reset, fail-open */ }
}

state.reads.push({ file: basename(String(fp)), ts: Date.now() });
if (state.reads.length > 20) state.reads = state.reads.slice(-20);

try { writeFileSync(stateFile, JSON.stringify(state)); } catch { /* fail-open: tracking only, never block */ }
process.exit(0);
