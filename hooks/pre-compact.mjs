#!/usr/bin/env node
// ~/.claude/hooks/pre-compact.mjs
// PreCompact hook — Directive 8 enforcement reminder before context compaction.
// Node.js .mjs port of pre-compact.ps1 (Phase B migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Fires when Claude Code is about to compress context. Injects a reminder to write
// LAST-SESSION-STATE.md and STATE.md before compaction erases in-flight context.
// Also writes a structural fallback to LAST-SESSION-STATE.md and a timestamped
// session summary to the AnythingLLM hotdir if it exists.
//
// 2026-05-19: Added stdin reading + last-prompt JSONL scan. Extracts last operator
// messages at compaction time and embeds them in the stub and additionalContext.
// Closes the gap where unexpected compaction drops in-flight questions.
// Operator text lives in last-prompt entries (not user text blocks) — confirmed by JSONL inspection.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import os from 'os';

// Read hook input — PreCompact receives session_id + transcript_path on stdin
let inp = {};
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { /* non-fatal */ }

// Resolve JSONL transcript path from hook input
let transcriptPath = inp.transcript_path || null;
if (!transcriptPath && inp.session_id) {
  const _cwd = inp.cwd || process.cwd();
  const sanitized = _cwd.replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}

// Extract last operator messages since last compaction boundary.
// Operator text lives in last-prompt entries (lastPrompt field), not user text blocks.
// Multiple last-prompt entries exist per message (one per leaf UUID) — deduplicate by content.
let openAtCompaction = '';
if (transcriptPath && existsSync(transcriptPath)) {
  try {
    const lines = readFileSync(transcriptPath, 'utf8').split('\n');
    const recentMsgs = [];
    const seen = new Set();
    for (let i = lines.length - 1; i >= 0 && recentMsgs.length < 3; i--) {
      if (!lines[i].trim()) continue;
      let entry;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      if (entry.type === 'system' && entry.subtype === 'compact_boundary') break;
      if (entry.type === 'last-prompt' && entry.lastPrompt) {
        const t = entry.lastPrompt.trim();
        if (t.length > 5 && !seen.has(t)) {
          seen.add(t);
          recentMsgs.unshift(t.slice(0, 400));
        }
      }
    }
    if (recentMsgs.length > 0) {
      openAtCompaction = '\n\n## OPEN AT COMPACTION — last operator messages (hook-extracted)\n\n' +
        recentMsgs.map((m, i) => `[${i + 1}] ${m}`).join('\n\n');
    }
  } catch { /* non-fatal */ }
}

// Capture git state — primary is ~/.claude governance repo (local repo, pushes to Codeberg+GitHub+Gitea).
// Project CWD added as secondary if it is also a git repo.
let gitState = '';
function gitSnapshot(dir, label) {
  const branch  = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  if (branch.status !== 0) return '';
  const log     = spawnSync('git', ['log', '--oneline', '-5'],             { cwd: dir, encoding: 'utf8' });
  const status  = spawnSync('git', ['status', '--short'],                  { cwd: dir, encoding: 'utf8' });
  const remotes = spawnSync('git', ['remote', '-v'],                       { cwd: dir, encoding: 'utf8' });
  const br = branch.stdout.trim();
  const lg = (log.status === 0 && log.stdout.trim()) ? log.stdout.trim() : '(none)';
  const st = (status.status === 0 && status.stdout.trim()) ? status.stdout.trim() : '(clean)';
  const rm = (remotes.status === 0 && remotes.stdout.trim()) ? remotes.stdout.trim() : '(none)';
  return `\n\n## Git state at compaction — ${label}\n\nbranch: ${br}\nrecent commits:\n${lg}\nuncommitted:\n${st}\nremotes:\n${rm}`;
}
try {
  const govRepo = join(os.homedir(), '.claude');
  const projCwd = inp.cwd || process.cwd();
  gitState = gitSnapshot(govRepo, 'governance repo (Codeberg+GitHub+Gitea)');
  if (projCwd !== govRepo) {
    const projSnap = gitSnapshot(projCwd, `project CWD: ${projCwd}`);
    if (projSnap) gitState += projSnap;
  }
} catch { /* non-fatal */ }

const claud      = join(os.homedir(), '.claude');
const sessionDir = 'D:\\Desktop\\ai book\\session-summaries';
const lastState  = join(claud, 'LAST-SESSION-STATE.md');
const cwd        = process.cwd();
const ts         = new Date().toISOString().replace('T', '_').replace(/:/g, '-').replace(/\.\d+Z$/, '');
const tsHuman    = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

// Schema v2 (chain-approved 2026-05-19, 6-seat deliberation APPROVED).
// LLM summarization via direct Ollama (laguna-xs.2). Serial discipline: /api/ps check first.
// Fail-open: busy/timeout/error all fall through to structural stub.
let llmSummary = '';
let compactionAttempted = false;
let compactionSkippedReason = '';
if (openAtCompaction) {
  try {
    const psRes = spawnSync('node', ['-e',
      `const h=require('http');const r=h.get('http://localhost:11434/api/ps',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{process.stdout.write(JSON.stringify({count:(JSON.parse(d).models||[]).length}));}catch{process.stdout.write('{"error":true}');}});});r.setTimeout(2000,()=>{process.stdout.write('{"count":0}');r.destroy();});r.on('error',()=>process.stdout.write('{"error":true}'));`
    ], { timeout: 4000, encoding: 'utf8' });

    const psData = (() => { try { return JSON.parse(psRes.stdout || '{}'); } catch { return { error: true }; } })();
    if (psData.error)      { compactionSkippedReason = 'ollama_unreachable'; }
    else if (psData.count > 0) { compactionSkippedReason = 'ollama_busy'; }
    else {
      compactionAttempted = true;
      const msgs = openAtCompaction.replace('## OPEN AT COMPACTION — last operator messages (hook-extracted)\n\n', '');
      const summarizePrompt = `You are a governance session summarizer. Operator messages open at compaction:\n${msgs}\n\nWrite a concise handoff summary (under 200 words) for the next AI instance: what was being worked on, what was decided, what is next.`;
      const ollamaBody = JSON.stringify({ model: 'laguna-xs.2:q4_K_M', prompt: summarizePrompt, stream: false, options: { num_ctx: 4096, num_predict: 300 } });

      const summaryRes = spawnSync('node', ['-e',
        `const h=require('http'),b=${JSON.stringify(ollamaBody)};const r=h.request({host:'localhost',port:11434,path:'/api/generate',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{process.stdout.write(JSON.parse(d).response||'');}catch{process.stdout.write('');}});});r.setTimeout(120000,()=>r.destroy());r.on('error',()=>{});r.write(b);r.end();`
      ], { timeout: 125000, encoding: 'utf8' });

      if (summaryRes.stdout && summaryRes.stdout.trim().length > 20) {
        llmSummary = `\n\n## LLM Handoff Summary (laguna-xs.2, ${tsHuman})\n\n${summaryRes.stdout.trim()}`;
      } else {
        compactionSkippedReason = 'empty_response';
        compactionAttempted = false;
      }
    }
  } catch { compactionSkippedReason = 'hook_error'; }
}

// Tier 2: inject prior session state as %%GOVERNANCE-STATE%% block into compaction context
let govBlock = '';
if (existsSync(lastState)) {
  try {
    const prior = readFileSync(lastState, 'utf8');
    govBlock = `\n\n%%GOVERNANCE-STATE%% - preserved from last compaction:\n${prior}\n%%END-GOVERNANCE-STATE%%`;
  } catch { /* non-fatal */ }
}

// Build open-carries warning for additionalContext if questions were in flight
const openCarriesNote = (openAtCompaction || gitState)
  ? `\n\n⚠️  OPEN AT COMPACTION — operator questions in flight when window filled:\n` +
    openAtCompaction.replace('## OPEN AT COMPACTION — last operator messages (hook-extracted)\n\n', '') +
    (gitState ? `\n${gitState}` : '') +
    `\n\nThese MUST go into open_carries in LAST-SESSION-STATE.md. The next instance will not know about them otherwise.`
  : '';

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

If everything is committed to substrate, no action needed. Verify, do not assume.${openCarriesNote}

BOOTSTRAP HANDOFF — FOR THE NEXT INSTANCE:
The compaction summary must include the following block at the TOP, before any task list:

  ╔══════════════════════════════════════════════════════════════╗
  ║  BOOTSTRAP REQUIRED BEFORE ANY TASK EXECUTION               ║
  ║  This session was compacted. The new instance must:          ║
  ║  1. Read ~/.claude/practice/core.md                          ║
  ║  2. Read ~/.claude/CANON-MANIFEST.md                         ║
  ║  3. Declare a niyyah naming those files as open source       ║
  ║  THEN — and only then — execute tasks from this summary.     ║
  ║  The bootstrap gate will enforce this at the tool boundary.  ║
  ╚══════════════════════════════════════════════════════════════╝

Do not bury this in the summary. It must precede the task list.
The athan fires at session start. The task list must not override it.` + govBlock;

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
${openAtCompaction}
${gitState}
${llmSummary}

## Schema v2 metadata
compaction_attempted: ${compactionAttempted}
compaction_skipped_reason: ${compactionSkippedReason || 'none'}
embedding_service_used: false
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
- open_carries: MISSING${openAtCompaction}

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
