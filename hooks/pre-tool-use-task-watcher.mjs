#!/usr/bin/env node
// ~/.claude/hooks/pre-tool-use-task-watcher.mjs
// PreToolUse hook — FM-12 (Camel Rule) state tracker.
// Records TaskCreate/ScheduleWakeup/TaskUpdate/TaskStop events for stop-validation.mjs FM-12 check.
// State file: ~/.claude/state/active-tasks-{session_id}.json
// Format: { active_count: number, wakeup_set: boolean }
// Never blocks — tracking only.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

let inp;
try {
  inp = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

if (!inp) process.exit(0);

const toolName = inp.tool_name;
const TRACKED = new Set(['TaskCreate', 'TaskUpdate', 'TaskStop', 'ScheduleWakeup']);
if (!TRACKED.has(toolName)) process.exit(0);

const sessionId = inp.session_id;
if (!sessionId) process.exit(0);

const stateDir = join(os.homedir(), '.claude', 'state');
try { mkdirSync(stateDir, { recursive: true }); } catch { /* ok */ }
const stateFile = join(stateDir, `active-tasks-${sessionId}.json`);

let state = { active_count: 0, wakeup_set: false };
if (existsSync(stateFile)) {
  try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* use default */ }
}

switch (toolName) {
  case 'TaskCreate':
    state.active_count = (state.active_count || 0) + 1;
    break;
  case 'TaskUpdate': {
    const status = (inp.tool_input?.status || '').toLowerCase();
    if (status === 'completed') {
      state.active_count = Math.max(0, (state.active_count || 0) - 1);
    }
    break;
  }
  case 'TaskStop':
    state.active_count = Math.max(0, (state.active_count || 0) - 1);
    break;
  case 'ScheduleWakeup':
    state.wakeup_set = true;
    break;
}

try { writeFileSync(stateFile, JSON.stringify(state)); } catch { /* fail-open */ }
process.exit(0);
