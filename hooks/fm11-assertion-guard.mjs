#!/usr/bin/env node
// fm11-assertion-guard.mjs — REBUILT 2026-06-10 from the legible logic in the June-5
// corrupted dump, under ghusl + ceremony, witnessed by laguna-xs.2:q4_K_M (verdict:
// faithful APPROVE; soundness REVISE -> fail-open on tooling failure, applied below;
// rebuild-now-with-selftest APPROVE) + output schema verified against current Claude
// Code hooks docs via WebFetch 2026-06-10. See GOVERNANCE-EVENTS.md EVENT-001
// wudu-layer finding: this hook and purification-state.mjs ARE the purification layer;
// their death let a conductor assert-from-memory ~12 times unchecked on 2026-06-09.
//
// FM-11 (practice/core.md): MEMORY.md / STATE.md / prior-session content is ADVISORY.
// Asserting system state from it requires current-session Read evidence. This hook:
//   - PreToolUse on ollama dispatch tools -> DENY when the recent assistant text makes
//     a memory-assertion with no matching current-session Read (drift must not be
//     exported into seat prompts).
//   - UserPromptSubmit -> non-blocking additionalContext warning naming the unverified
//     assertion (the conversational layer gets a tap, not a wall).
// FAIL-OPEN (witness REVISE): any error, unreadable transcript, or missing read-watcher
// state exits 0 — a broken guard must never strand the agent. Its liveness is watched
// by the hook-health check, not by failing closed.
//
// Self-test: node fm11-assertion-guard.mjs --selftest

import { readFileSync, existsSync } from 'fs';
import { join as pathJoin } from 'path';
import os from 'os';

// Memory-assertion patterns, verbatim from the corrupted dump's legible array.
const MEMORY_PATTERNS = [
  'MEMORY\\.md says', 'MEMORY\\.md shows', 'from MEMORY\\.md',
  'STATE\\.md says', 'STATE\\.md shows', 'from STATE\\.md',
  'prior session', 'last session', 'previous session',
  'from memory', 'I recall', 'I remember', 'as noted previously',
];

// Which Read evidence satisfies which assertion class (from the dump's guidance text).
function requiredReadsFor(assertion) {
  const a = assertion.toLowerCase();
  if (a.includes('memory.md')) return ['memory.md'];
  if (a.includes('state.md')) return ['state.md', 'current-state.md', 'last-session-state.md'];
  return ['memory.md', 'state.md', 'current-state.md', 'last-session-state.md']; // generic recall
}

export function findUnverifiedAssertions(text, recentReads) {
  const out = [];
  const regex = new RegExp(MEMORY_PATTERNS.join('|'), 'gi');
  let match;
  while ((match = regex.exec(String(text))) !== null) {
    const assertion = match[0];
    const ok = requiredReadsFor(assertion).some((f) => recentReads.has(f));
    if (!ok) out.push(assertion);
  }
  return [...new Set(out)];
}

// Collect current-session Read evidence: transcript tool_use Reads since the last
// compact boundary, plus the read-watcher's recent-reads window.
export function collectRecentReads(transcriptPath) {
  const recentReads = new Set();
  try {
    if (transcriptPath && existsSync(transcriptPath)) {
      const lines = readFileSync(transcriptPath, 'utf8').split('\n');
      for (const line of lines.reverse()) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'system' && entry.subtype === 'compact_boundary') break;
          if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
            for (const block of entry.message.content) {
              if (block.type === 'tool_use' && block.name === 'Read' && block.input?.file_path) {
                recentReads.add(block.input.file_path.split(/[\\/]/).pop().toLowerCase());
              }
            }
          }
        } catch { /* skip malformed line */ }
      }
    }
    const rwPath = pathJoin(os.homedir(), '.claude', 'state', 'read-watcher.json');
    if (existsSync(rwPath)) {
      const rw = JSON.parse(readFileSync(rwPath, 'utf8'));
      if (Array.isArray(rw.reads)) {
        for (const r of rw.reads) recentReads.add(String(r.file || r).split(/[\\/]/).pop().toLowerCase());
      }
    }
  } catch { /* fail-open: evidence collection must never throw */ }
  return recentReads;
}

// Most recent assistant TEXT since last compact boundary (what the deny inspects).
function lastAssistantText(transcriptPath) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return '';
    const lines = readFileSync(transcriptPath, 'utf8').split('\n');
    for (const line of lines.reverse()) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'system' && entry.subtype === 'compact_boundary') return '';
        if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
          const txt = entry.message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
          if (txt.trim()) return txt;
        }
      } catch { /* skip */ }
    }
  } catch { /* fail-open */ }
  return '';
}

// ---------------- self-test (offline, argv-guarded) ----------------
if (process.argv.includes('--selftest')) {
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
  const none = new Set();
  ck(findUnverifiedAssertions('MEMORY.md says the port is 3001', none).length === 1, 'assert-without-read -> flagged');
  ck(findUnverifiedAssertions('MEMORY.md says the port is 3001', new Set(['memory.md'])).length === 0, 'assert-WITH-read -> allowed');
  ck(findUnverifiedAssertions('I recall the daemon uses 3 lanes', none).length === 1, 'generic recall without evidence -> flagged');
  ck(findUnverifiedAssertions('I recall the lanes', new Set(['state.md'])).length === 0, 'generic recall with state.md read -> allowed');
  ck(findUnverifiedAssertions('the file contains a parser', none).length === 0, 'plain technical text -> not flagged');
  ck(findUnverifiedAssertions('from STATE.md the queue is empty', new Set(['current-state.md'])).length === 0, 'STATE claim satisfied by current-state.md');
  const reads = collectRecentReads('Z:\\nonexistent\\transcript.jsonl');
  ck(reads instanceof Set, 'missing transcript -> fail-open empty set, no throw');
  console.log(fails === 0 ? '\nALL PASS — fm11 assertion guard sound' : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

// ---------------- hook entry ----------------
let inp = {};
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); } // fail-open
const hookEventName = inp.hook_event_name || '';
const toolName = inp.tool_name || '';
const toolInput = inp.tool_input || {};
const isPromptSubmit = hookEventName === 'UserPromptSubmit';
const isDispatchTool =
  toolName === 'mcp__ollama-mcp__ollama_chat' ||
  toolName === 'mcp__ollama-mcp__ollama_generate' ||
  (toolName === 'Bash' && /ollama\s+(run|generate|chat)/i.test(String(toolInput.command || ''))) ||
  (toolName === 'PowerShell' && /ollama\s+(run|generate|chat)/i.test(String(toolInput.script || toolInput.command || '')));

if (!isPromptSubmit && !isDispatchTool) process.exit(0);

let transcriptPath = inp.transcript_path;
if (!transcriptPath) {
  const cwd = inp.cwd || process.cwd();
  const sanitized = cwd.replace(/[/\\:]/g, '-');
  transcriptPath = pathJoin(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id || ''}.jsonl`);
}

try {
  const text = lastAssistantText(transcriptPath);
  if (!text) process.exit(0);
  const recentReads = collectRecentReads(transcriptPath);
  const unverified = findUnverifiedAssertions(text, recentReads);
  if (!unverified.length) process.exit(0);

  const reason = `FM-11 ASSERTION GUARD (~/.claude/hooks/fm11-assertion-guard.mjs).

Unverified memory-assertion(s) in recent output: ${unverified.map((a) => `"${a}"`).join(', ')}.
All MEMORY.md/STATE.md/prior-session assertions require current-session Read evidence. The substrate is truth (D1).

Required action: Read the source file(s) first:
  - For MEMORY.md claims: Read ~/.claude/projects/.../memory/MEMORY.md
  - For STATE.md claims: Read ~/.claude/STATE.md or ~/.claude/CURRENT-STATE.md
  - For prior-session claims: Read ~/.claude/LAST-SESSION-STATE.md
Evidence must be a Read tool call in the current session since the last compaction.`;

  if (isDispatchTool) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }));
  } else {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: reason,
      },
    }));
  }
  process.exit(0);
} catch { process.exit(0); } // fail-open (witness REVISE): the guard must never strand the agent