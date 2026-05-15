#!/usr/bin/env node
// ~/.claude/hooks/pre-compact.mjs
// PreCompact hook — Directive 8 enforcement reminder before context compaction.
// Node.js .mjs port of pre-compact.ps1 (Phase B migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Fires when Claude Code is about to compress context. Injects a reminder to write
// LAST-SESSION-STATE.md and STATE.md before compaction erases in-flight context.
// Also writes a structural fallback to LAST-SESSION-STATE.md and a timestamped
// session summary to the AnythingLLM hotdir if it exists.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const claud      = join(os.homedir(), '.claude');
const sessionDir = 'D:\\Desktop\\ai book\\session-summaries';
const lastState  = join(claud, 'LAST-SESSION-STATE.md');
const cwd        = process.cwd();
const ts         = new Date().toISOString().replace('T', '_').replace(/:/g, '-').replace(/\.\d+Z$/, '');
const tsHuman    = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

// Tier 2: inject prior session state as %%GOVERNANCE-STATE%% block into compaction context
let govBlock = '';
if (existsSync(lastState)) {
  try {
    const prior = readFileSync(lastState, 'utf8');
    govBlock = `\n\n%%GOVERNANCE-STATE%% - preserved from last compaction:\n${prior}\n%%END-GOVERNANCE-STATE%%`;
  } catch { /* non-fatal */ }
}

// Tier 1: compaction instruction
const reminder = `COMPACT EVENT - D8 CHECKPOINT + COMPACTION RESILIENCE (~/.claude/hooks/pre-compact.mjs).

Context is about to compress. Before compaction completes, write or update:

1. ~/.claude/LAST-SESSION-STATE.md - include:
   - Active Faith (if any) and its key constraint
   - Serial inference rule: ONE Ollama model at a time, api/ps check before every dispatch
   - No frontier models: GPT/Gemini/Grok/GLM forbidden. Local quorum is the governance witness.
   - Current task: what is in flight, what is blocked, what is next
   - Open governance gates: any niyyah declared, any surrender articulation in progress
   - Authority chain: CLAUDE.md -> canon -> operator-context -> LAST-SESSION-STATE.md -> RAG

2. STATE.md in project directory (${cwd}): what landed, what is in flight, what is next.

3. Compaction summary MUST preserve verbatim:
   - "Serial discipline: ONE Ollama model at a time. api/ps before every dispatch."
   - "No frontier models: GPT/Gemini/Grok/GLM forbidden."
   - "Authority chain: CLAUDE.md -> canon -> operator-context -> STATE.md -> RAG"
   - Any open governance gates or niyyah declared this session.

If everything is committed to substrate, no action needed. Verify, do not assume.` + govBlock;

// Hook-written structural LAST-SESSION-STATE.md fallback. Instance should overwrite with rich content.
const snapshot = `# LAST-SESSION-STATE.md

Written by: pre-compact.mjs hook at compaction event
Timestamp: ${tsHuman}
Project CWD: ${cwd}

## Governance constants (always true)

- Serial inference: ONE Ollama model at a time. api/ps check before every dispatch. ollama stop after.
- No frontier models: GPT/Gemini/Grok/GLM forbidden. Local quorum (gemma4:31b, qwen3.6:27b, granite4.1:30b, nemotron-super) is the governance witness.
- Authority chain: CLAUDE.md -> canon/ -> operator-context.md -> this file -> RAG

## Session state

(Not yet updated by instance - hook-written structural fallback only.)
`;
try { writeFileSync(lastState, snapshot, 'utf8'); } catch { /* non-fatal */ }

// Write timestamped session summary to AnythingLLM hotdir if it exists
if (existsSync(sessionDir)) {
  const summaryPath = join(sessionDir, `session-${ts}.md`);
  let richContent = false;
  try {
    richContent = existsSync(lastState) && (readFileSync(lastState).length > 500);
  } catch { /* non-fatal */ }

  let summaryContent;
  if (richContent) {
    const stateContent = readFileSync(lastState, 'utf8');
    const stateBytes   = Buffer.byteLength(stateContent, 'utf8');
    summaryContent = `# Session Summary - ${ts}

Project: ${cwd}
Compaction event: ${tsHuman}
Content source: LAST-SESSION-STATE.md (instance-written, ${stateBytes} bytes)

## Required sections (instance must populate before compaction)
### failures_this_session
### corrections_applied
### patterns_confirmed
### open_carries

## Session state

${stateContent}
`;
  } else {
    summaryContent = `# Session Summary - ${ts} — STUB WARNING

Project: ${cwd}
Compaction event: ${tsHuman}
WARNING: Instance did not write session content before compaction.
LAST-SESSION-STATE.md is a hook-written stub (500 bytes or less). Failure record unavailable for this session.

## Required sections NOT populated
- failures_this_session: MISSING
- corrections_applied: MISSING
- patterns_confirmed: MISSING
- open_carries: MISSING

## Governance constants
Serial discipline: ONE Ollama model at a time.
No frontier models: GPT/Gemini/Grok/GLM forbidden.
Authority chain: CLAUDE.md -> canon/ -> operator-context.md -> LAST-SESSION-STATE.md -> RAG
`;
  }
  try { writeFileSync(summaryPath, summaryContent, 'utf8'); } catch { /* non-fatal */ }
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreCompact',
    additionalContext: reminder,
  },
}));
process.exit(0);
