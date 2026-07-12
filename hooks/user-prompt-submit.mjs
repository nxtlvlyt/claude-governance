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

[COMPLIANT DISPATCH CHANNELS] (per ~/.claude/rules/operator-rulings.md 2026-06-09):
- mcp__ollama-* — local-model dispatch (laguna, qwen, granite, nemotron) running on nxtbeast over Tailscale.
- WebFetch — live external info, current docs, attributed-source fetches.
NEVER: mcp__gemini-worker, mcp__gpt-worker, mcp__grok-worker, mcp__glm-worker (operator forbids closed-frontier worker dispatch outside Ollama).
NOT in compliant list: WebSearch (per operator-rulings' narrowing — use WebFetch for substantive external retrieval).

[LOCAL MECHANICAL DELEGATION] - context-saving offload; mcp__ollama dispatches ALSO satisfy the stop hook (stop-validation.mjs isFF — mcp__ollama* is valid dispatch — frontier NOT required when local Ollama dispatch is present):
- Agent (subagent_type=Explore for code search; general-purpose for autonomous multi-step work; specialized agents per their descriptions).
- mcp__ollama-mcp__ollama_chat / mcp__ollama-mcp__ollama_generate — local model offload; satisfies stop hook (use exact model strings):
    * laguna-xs-2.1:q8_0              - code review, syntax checks, structural analysis
    * qwen3.6:27b                       - deliberation team (Alibaba); consulted first on governance questions before any frontier dispatch
    * nemotron-3-super:latest          - deliberation team (NVIDIA); high-throughput deliberation, long-batch reasoning
    * granite4.1:30b                    - deliberation team (IBM); governance audits, canon coherence, change-shape review
  DISPATCH NOTE: only laguna-xs-2.1:q8_0 works via mcp__ollama-mcp__ollama_chat without timing out (satisfies stop hook).
  qwen/granite/nemotron exceed MCP timeout - dispatch via Invoke-RestMethod instead, but that does NOT satisfy the stop hook (appears as PowerShell tool use, not mcp__ollama-*).
- TaskCreate - track multi-step work explicitly.

Per ~/.claude/canon/delegation-and-stall-discipline.md (stop-language trigger):
When drafting "your call" / "want me to" / "should I" / "operator decision required" / "stopping here for clean break" - that is the canon-trigger to:
  1. Verify against substrate (does source on disk already answer this?).
  2. If unclear, dispatch a compliant channel: mcp__ollama-mcp__ollama_chat with laguna-xs-2.1:q8_0 (MCP dispatch - satisfies stop hook) or WebFetch for live external info. Forbidden: mcp__gemini/gpt/grok/glm workers (per ~/.claude/rules/operator-rulings.md). Dispatching qwen/granite/nemotron via Invoke-RestMethod does NOT satisfy the stop hook because it appears as PowerShell tool use, not mcp__ollama-*.
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
  const heartbeat = `# CURRENT-STATE.md

Written by: user-prompt-submit.mjs hook (turn ${turnCount} heartbeat)
Timestamp: ${ts}
Project CWD: ${cwd}
model_version: (instance: write your actual model ID here at session start — e.g. claude-sonnet-4-6)

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

// DIAGNOSIS-DEBT SURFACE (seventh law's mechanical escalation, 2026-07-10 — paid for by the
// 7h idle-loop failure: conduct-cycle.mjs computed the full DIAGNOSE list all along, the
// conductor just never ran it; operator: "I thought we built this process so good even a
// local model could be the conductor"). Judgment drains out of the seat into this hook:
// every prompt counts FAILED AUTORUN lines that lack a judgment annotation (RESOLVED/
// PARKED/DIAGNOSED/FIX/SUPERSEDED/BLOCKED/re-queued) and injects the debt so NO conductor —
// frontier or local — can fail to see it. Fail-open: any error injects nothing. Bounded:
// top-3 items only (~600 chars), inside the documented 10k additionalContext cap
// (change-shape witnessed 2x via WebFetch against code.claude.com/docs/en/hooks 2026-07-10).
try {
  const autorunDebt = readFileSync(join(os.homedir(), '.claude', 'muezzin-plugin', 'missions', 'AUTORUN.md'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^FAILED\s+missions\//.test(l) && !/RESOLVED|PARKED|DIAGNOSED|FIX:|SUPERSEDED|BLOCKED|re-queued/i.test(l));
  if (autorunDebt.length > 0) {
    reminder += `

DIAGNOSIS DEBT (seventh law, ~/.claude/rules/conductor-core.md — computed mechanically by this hook):
${autorunDebt.length} FAILED mission(s) carry NO judgment annotation. A FAILED mark is a diagnosis
debt with a due date, never ambient debt. Run \`node conduct-cycle.mjs\` in
~/.claude/muezzin-plugin and work its DIAGNOSE list before new product work. Oldest first:
${autorunDebt.slice(0, 3).map((l) => '  - ' + (l.match(/missions\/\S+/) || [''])[0]).join('\n')}`;
  }
} catch { /* fail-open — a broken debt count must never break prompt submission */ }

// GAP-REGISTER SURFACE (QUEUE item 24, 2026-07-12 — paid for by FIVE same-day
// misclassifications the operator counted: design-MD filed as a lead, Stitch graves
// unowned a month, hold prefixes never enrolling atv-*, the fork's product bypassing its
// own hold, W1-W6 undated. The one gap class that never failed is the hook-computed one
// above — so gap bookkeeping moves here too. The conductor's judgment shrinks to writing
// one register line at arrival; this check makes unowned/rotten/stale entries impossible
// to not-see). Fail-open; bounded to top-3.
// WITNESS NOTE (Gemini foreign-frontier audit 2026-07-12, VERDICT: ADJUST — accepted):
// the owner-token regex is a cheap SURFACE heuristic and is self-spoofable; the SOUND
// resolution (does the owner actually exist as a live queue line/item?) belongs to
// conduct-cycle's offline sweep per item 24(b), which can afford the file I/O this
// per-prompt hook cannot. Keep the register small (archive closed entries) — this read
// is synchronous like the AUTORUN read above and must stay cheap.
try {
  const gapLines = readFileSync(join(os.homedir(), '.claude', 'muezzin-plugin', 'missions', '_logs', 'GAP-REGISTER.jsonl'), 'utf8')
    .split(/\r?\n/).filter((l) => l.trim());
  const gaps = gapLines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const open = gaps.filter((g) => g.status === 'open');
  const ownedNoRef = gaps.filter((g) => g.status === 'owned' && !(g.owner && /QUEUE ITEM|ENGINE BATCH|missions\/|INBOX|INTAKE|wf_|\.md/i.test(g.owner)));
  const staleDays = 5;
  const now = Date.now();
  const dormantStale = gaps.filter((g) => g.status !== 'closed' && g.class === 'dormant'
    && g.arrived && (now - new Date(g.arrived).getTime()) > staleDays * 86400000
    && !/BATCH 2|dated/i.test(String(g.owner || '')));
  const flagged = [...open, ...ownedNoRef, ...dormantStale];
  if (flagged.length > 0) {
    const closed = gaps.filter((g) => g.status === 'closed').length;
    reminder += `

GAP REGISTER (item 24, computed mechanically by this hook — ${gaps.length} tracked, ${closed} closed):
${flagged.length} gap(s) need conductor attention (open-with-no-owner-action, untracked owner, or dormant-aging):
${flagged.slice(0, 3).map((g) => `  - ${g.id} [${g.status}] owner: ${g.owner || 'NONE'}`).join('\n')}
Rule: every gap entry needs an owner resolvable to tracked work; dormant gaps need a dated batch.
Register: ~/.claude/muezzin-plugin/missions/_logs/GAP-REGISTER.jsonl`;
  }
} catch { /* fail-open — a broken gap count must never break prompt submission */ }

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: reminder,
  },
}));
process.exit(0);
