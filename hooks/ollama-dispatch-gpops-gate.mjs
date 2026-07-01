#!/usr/bin/env node
// ~/.claude/hooks/ollama-dispatch-gpops-gate.mjs
// PreToolUse hook — GR10 concurrency check before any Ollama inference dispatch.
//
// Built 2026-07-01 after a real, named violation: this same instance made two direct
// curl calls to Ollama Cloud (https://ollama.com/v1/chat/completions) mid-session without
// performing the check practice/core.md already requires:
//
//   "Before Ollama dispatch: check /api/ps on the Ollama server. If any model is
//    running, yield the turn... Do not proceed with dispatch. GR10 prohibits
//    concurrent inference. The check is not optional and cannot be satisfied by
//    'probably nothing is running.'"
//
// The text existed in context the whole session and was not mechanically enforced —
// only the niyyah-gate (Edit/Write) and the chain-timing gate (CPU chain models) had
// real PreToolUse enforcement. This closes that specific, named gap the same way:
// require a REAL /api/ps tool call in the transcript before letting an inference
// dispatch (Bash/PowerShell hitting an Ollama chat/generate/completions endpoint,
// local OR cloud) through. Mirrors niyyah-gate.mjs's structure.

import { readFileSync, existsSync } from 'fs';
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
if (toolName !== 'Bash' && toolName !== 'PowerShell') process.exit(0);

const command = inp.tool_input?.command;
if (!command) process.exit(0);

// A real Ollama chat/generate/completions dispatch, local or cloud. Deliberately does
// NOT match /api/ps, /api/tags, /api/show, /api/version — those are the metadata reads
// this very gate wants to see, and must never gate themselves (that would deadlock).
const isInferenceDispatch =
  /\/api\/(generate|chat)\b/i.test(command) ||
  /\/v1\/chat\/completions\b/i.test(command);
const touchesOllama = /ollama\.com|nxtbeast|11434|OLLAMA_API_KEY|OLLAMA_CLOUD_API_KEY/i.test(command);

if (!isInferenceDispatch || !touchesOllama) process.exit(0);

// Locate transcript
let transcriptPath = null;
if (inp.transcript_path) {
  transcriptPath = inp.transcript_path;
} else if (inp.session_id) {
  const cwd = inp.cwd || process.cwd();
  const sanitized = cwd.replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}
if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0); // fail-open: cannot validate, allow

const lines = readFileSync(transcriptPath, 'utf8').split('\n');
let sawApiPsCheck = false;

for (const line of lines) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }

  // Compaction boundary resets the check — a fresh instance must check again.
  if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
    sawApiPsCheck = false;
    continue;
  }

  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && (block.name === 'Bash' || block.name === 'PowerShell')) {
        const cmd = block.input?.command || '';
        if (/\/api\/ps\b/i.test(cmd)) sawApiPsCheck = true;
      }
    }
  }
}

if (sawApiPsCheck) process.exit(0);

const reason = `OLLAMA GR10 CONCURRENCY GATE (~/.claude/hooks/ollama-dispatch-gpops-gate.mjs).

This command dispatches Ollama inference (local or cloud) without a prior /api/ps
check anywhere in this session's transcript. Per ~/.claude/practice/core.md:

  "Before Ollama dispatch: check /api/ps on the Ollama server. If any model is
   running, yield the turn... Do not proceed with dispatch. GR10 prohibits
   concurrent inference. The check is not optional and cannot be satisfied by
   'probably nothing is running.'"

Command: ${command.slice(0, 200)}

Required action: run a real /api/ps check first (e.g. curl -s http://nxtbeast:11434/api/ps
or the cloud equivalent), read what's actually resident, THEN retry this dispatch.
If a model is already running, yield the turn instead of dispatching — write in
visible output: "[model-name] running — yielding turn until clear."

This gate resets on compaction (a fresh instance must check again) and stays open
for the rest of the session once one real /api/ps call appears in the transcript.`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
process.exit(2);
