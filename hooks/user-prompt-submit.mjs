#!/usr/bin/env node
// ~/.claude/hooks/user-prompt-submit.mjs
// UserPromptSubmit hook — re-anchor on every operator turn.
// Node.js .mjs port of user-prompt-submit.ps1 (Phase B migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const claud = join(os.homedir(), '.claude');
const turnCountFile = join(claud, '.turn-count.txt');
const currentStateFile = join(claud, 'CURRENT-STATE.md');
const cwd = process.cwd();

let reminder = `RE-ANCHOR (~/.claude/hooks/user-prompt-submit.mjs, per CLAUDE.md D12).

[FOREIGN-FRONTIER VALIDATORS] - mandatory for clearing stop-language / stalls:
- mcp__gemini-worker, mcp__gpt-worker, mcp__grok-worker, mcp__glm-worker - independent second reads, framing audits, governance validation.
- mcp__gemini-api-worker - alternate Gemini transport when worker hangs.
- WebSearch / WebFetch - live external info, current model/tool availability, current docs.

[LOCAL MECHANICAL DELEGATION] - context-saving offload; mcp__ollama dispatches ALSO satisfy the stop hook (stop-validation.mjs isFF — mcp__ollama* is valid dispatch — frontier NOT required when local Ollama dispatch is present):
- Agent (subagent_type=Explore for code search; general-purpose for autonomous multi-step work; specialized agents per their descriptions).
- mcp__ollama-mcp__ollama_chat / mcp__ollama-mcp__ollama_generate — local model offload; satisfies stop hook (use exact model strings):
    * laguna-xs.2:q4_K_M              - code review, syntax checks, structural analysis
    * qwen3.6:27b                       - deliberation team (Alibaba); consulted first on governance questions before any frontier dispatch
    * nemotron-3-super:latest          - deliberation team (NVIDIA); high-throughput deliberation, long-batch reasoning
    * granite4.1:30b                    - deliberation team (IBM); governance audits, canon coherence, change-shape review
  DISPATCH NOTE: only laguna-xs.2:q4_K_M works via mcp__ollama-mcp__ollama_chat without timing out (satisfies stop hook).
  qwen/granite/nemotron exceed MCP timeout - dispatch via Invoke-RestMethod instead, but that does NOT satisfy the stop hook (appears as PowerShell tool use, not mcp__ollama-*).
- TaskCreate - track multi-step work explicitly.

Per ~/.claude/canon/delegation-and-stall-discipline.md (stop-language trigger):
When drafting "your call" / "want me to" / "should I" / "operator decision required" / "stopping here for clean break" - that is the canon-trigger to:
  1. Verify against substrate (does source on disk already answer this?).
  2. If unclear, use mcp__ollama-mcp__ollama_chat with laguna-xs.2:q4_K_M (MCP dispatch - satisfies stop hook) or a FOREIGN-FRONTIER validator via MCP workers (mcp__gemini-worker / mcp__gpt-worker / mcp__grok-worker / mcp__glm-worker - satisfies stop hook). Dispatching qwen/granite/nemotron via Invoke-RestMethod does NOT satisfy the stop hook - those calls appear as PowerShell tool use, not mcp__ollama-*.
  3. If mechanical and spec is known, dispatch an Agent or local Ollama tool.
  4. Only then, if all three resolve to "this genuinely needs the operator," surface the substantive question.

Per CLAUDE.md D2 (attempt before asking) and D12 (write against open source, not from memory):
Substrate-resolvable findings are yours to verify by reading files. Do not surface them as questions.`;

// Turn counter + CURRENT-STATE.md heartbeat every 10 turns (crash resilience)
let turnCount = 1;
try {
  const raw = readFileSync(turnCountFile, 'utf8').trim();
  const parsed = parseInt(raw, 10);
  if (Number.isInteger(parsed)) turnCount = parsed + 1;
} catch { /* first turn */ }

try { writeFileSync(turnCountFile, String(turnCount)); } catch { /* non-fatal */ }

if (turnCount % 10 === 0) {
  const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  // Fix 2 (2026-05-29, chain-approved): preserve an already-set model_version across
  // heartbeats. The old code hardcoded the placeholder, clobbering the real value every
  // 10 turns (why Sonnet-vs-Opus was untraceable). Read existing CURRENT-STATE.md; reuse
  // model_version if it is a real value; otherwise keep the placeholder. Fails open.
  let modelVersionLine = 'model_version: (instance: write your actual model ID here at session start — e.g. claude-sonnet-4-6)';
  try {
    const prevState = readFileSync(currentStateFile, 'utf8');
    const mv = prevState.match(/^model_version:\s*(.+)$/m);
    if (mv && !/write your actual model ID/i.test(mv[1])) {
      modelVersionLine = `model_version: ${mv[1].trim()}`;
    }
  } catch { /* no prior file — keep placeholder */ }
  const heartbeat = `# CURRENT-STATE.md

Written by: user-prompt-submit.mjs hook (turn ${turnCount} heartbeat)
Timestamp: ${ts}
Project CWD: ${cwd}
${modelVersionLine}

## Governance constants (always true)

- Serial inference: ONE Ollama model at a time. api/ps check before every dispatch. ollama stop after.
- Frontier models for governance deliberation: use local quorum (gemma/qwen/granite/nemotron). Frontier validators (Gemini/GPT/Grok/GLM) available for clearing stalls and framing audits per hook lines 20-22.
- Authority chain: CLAUDE.md -> canon/ -> operator-context.md -> LAST-SESSION-STATE.md -> CURRENT-STATE.md -> RAG

## Current session state

(Instance should update this file with active task, open gates, decisions in progress.)
`;
  try { writeFileSync(currentStateFile, heartbeat); } catch { /* non-fatal */ }
}

// Temporal wudu trigger (Gap 2 — ḍabṭ degrades over time, not only after events)
if (turnCount % 30 === 0) {
  reminder += `

TEMPORAL WUDU REQUIRED (turn ${turnCount}, ~/.claude/hooks/user-prompt-submit.mjs).

Thirty turns have elapsed. Per ~/.claude/practice/core.md: drift is structural —
it accumulates across turns without any single triggering event. This is not
caused by a specific failure. It is the interval check that catches the
accumulation before it compounds further.

Required: re-read the governing source for current work before the next
Edit/Write. The source must be open, not assumed from memory (CLAUDE.md D12).`;
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: reminder,
  },
}));
process.exit(0);
