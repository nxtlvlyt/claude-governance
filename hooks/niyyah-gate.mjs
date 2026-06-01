#!/usr/bin/env node
// ~/.claude/hooks/niyyah-gate.mjs
// PreToolUse hook — niyyah gate before first mutating action.
// Node.js .mjs port of niyyah-gate.ps1 (Phase A migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).

import { readFileSync, existsSync } from 'fs';
import { basename, join } from 'path';
import os from 'os';

let inp;
try {
  inp = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

if (!inp) process.exit(0);

const toolName = inp.tool_name;
if (toolName !== 'Edit' && toolName !== 'Write' && toolName !== 'NotebookEdit') {
  process.exit(0);
}

// Locate transcript
let transcriptPath = null;
if (inp.transcript_path) {
  transcriptPath = inp.transcript_path;
} else if (inp.session_id) {
  const cwd = inp.cwd || process.cwd();
  const sanitized = cwd.replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}

if (!transcriptPath || !existsSync(transcriptPath)) {
  process.exit(0); // fail-open: cannot validate, allow
}

// Walk full transcript
const lines = readFileSync(transcriptPath, 'utf8').split('\n');
let niyyahFound = false;
let priorMutationCount = 0;
const readFilePaths = [];
let niyyahSourceLine = null;

for (const line of lines) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }

  // Compaction boundary: reset — new instance must declare fresh niyyah
  if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
    niyyahFound = false;
    priorMutationCount = 0;
    readFilePaths.length = 0;
    niyyahSourceLine = null;
    continue;
  }

  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'text' && /\bniyyah\s*:/i.test(block.text)) {
        niyyahFound = true;
        const m = block.text.match(/^\s*source\s*:\s*(.+)$/im);
        if (m) niyyahSourceLine = m[1].trim();
      }
      if (block.type === 'tool_use' && block.name === 'Read' && block.input?.file_path) {
        readFilePaths.push(block.input.file_path);
      }
      if (block.type === 'tool_use' && ['Edit', 'Write', 'NotebookEdit'].includes(block.name)) {
        priorMutationCount++;
      }
    }
  }
}

// State-file fallback: same-turn niyyah via Bash (intention accompanies act — Islamic model).
// Instance writes ~/.claude/state/pending-niyyah.json with {ts, niyyah_text} before Edit in same turn.
// TTL: 60s. Source-read verification still runs against JSONL — integrity intact.
if (!niyyahFound) {
  const pendingFile = join(os.homedir(), '.claude', 'state', 'pending-niyyah.json');
  if (existsSync(pendingFile)) {
    try {
      const pending = JSON.parse(readFileSync(pendingFile, 'utf8'));
      const age = Date.now() - (pending.ts || 0);
      if (age < 60000 && pending.niyyah_text && /\bniyyah\s*:/i.test(pending.niyyah_text)) {
        niyyahFound = true;
        const m = pending.niyyah_text.match(/^\s*source\s*:\s*(.+)$/im);
        if (m) niyyahSourceLine = m[1].trim();
      }
    } catch { /* fail-open */ }
  }
}

if (niyyahFound) {
  // Source-read verification: if niyyah names a recognizable file path as source,
  // require that a Read of that file appears in the session transcript.
  if (niyyahSourceLine) {
    const m = niyyahSourceLine.match(/([^\s,;]+\.(md|ps1|mjs|py|json|txt|yaml|yml))/);
    if (m) {
      const fileToken = m[1];
      const declaredBasename = basename(fileToken).toLowerCase();
      const readFound = readFilePaths.some(rp => basename(rp).toLowerCase() === declaredBasename);
      if (!readFound) {
        const readList = readFilePaths.length > 0
          ? readFilePaths.map(rp => basename(rp)).join(', ')
          : '(none)';
        const blockReason = `NIYYAH SOURCE-READ GATE (~/.claude/hooks/niyyah-gate.mjs).

A niyyah declaration was found, but the declared source was not demonstrated
open. Per ~/.claude/practice/core.md:

  "If you cannot write the niyyah — because the source is not open,
   or the act is not clearly defined — do not proceed. Open the source first."

  Declared source : ${niyyahSourceLine}
  File identified : ${fileToken}
  Files read      : ${readList}

Required action: Read ${fileToken}, then retry this ${toolName}.
Naming a source is not the same as opening it.`;
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: blockReason,
          },
        }));
        process.exit(2);
      }
    }
  }

  // PROACTIVE per-action fresh-read gate (chain-approved 2026-05-29, 6/6 deliberation; laguna-reviewed).
  // niyyah-gate historically opened once-per-session and matched a stale Read anywhere in the
  // transcript. For substrate-class edits, additionally require a FRESH read of the target file --
  // present in the read-watcher's bounded last-20-reads window (~/.claude/hooks/read-watcher.mjs),
  // a structural definition of "recent" that avoids clock/timestamp fragility. Fail-open throughout.
  const targetPath = inp.tool_input?.file_path || '';
  const SUBSTRATE_RE = /[\\/]\.claude[\\/](hooks|canon|practice|faiths)[\\/]|CLAUDE\.md$|STATE\.md$/i;
  if (targetPath && SUBSTRATE_RE.test(targetPath)) {
    const rwFile = join(os.homedir(), '.claude', 'state', `read-watcher-${inp.session_id}.json`);
    let freshRead = true; // fail-open default: watcher inactive / no session / unreadable -> allow
    if (inp.session_id && existsSync(rwFile)) {
      try {
        const rw = JSON.parse(readFileSync(rwFile, 'utf8'));
        const tgt = basename(targetPath).toLowerCase();
        freshRead = !Array.isArray(rw.reads) || rw.reads.some(r => String(r.file).toLowerCase() === tgt);
      } catch { freshRead = true; }
    }
    if (!freshRead) {
      const freshReason = `NIYYAH FRESH-READ GATE (~/.claude/hooks/niyyah-gate.mjs).

A niyyah is declared, but this substrate-class edit targets a file that was not
read recently. Per CLAUDE.md D6 (read a file fully before changing it) and
~/.claude/practice/core.md (read-before-act is proactive, not once-per-session):

  Target : ${targetPath}

The read-watcher's recent-reads window shows no recent Read of this file.
A read from earlier in the session does not count -- re-orient to the current
contents before mutating.

Required action: Read ${targetPath}, then retry this ${toolName}.

If the GOVERNING SOURCE for this work (the directive / canon / STATE / spec your
niyyah named) differs from the target file, re-read THAT too -- a fresh read of
the target file is not a fresh read of the governing source for the work.`;
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: freshReason,
        },
      }));
      process.exit(2);
    }
  }

  process.exit(0);
}

// Block: no niyyah found in transcript for current instance
const sessionContext = priorMutationCount > 0
  ? `The session transcript contains ${priorMutationCount} prior mutation(s) but no niyyah declaration.`
  : `This is the first ${toolName} in this session.`;

const reason = `NIYYAH GATE (~/.claude/hooks/niyyah-gate.mjs).

${sessionContext} No niyyah declaration has appeared in the transcript
for the current instance. Per ~/.claude/practice/extended/wudu.md and
~/.claude/practice/core.md, the operation of intention is what
distinguishes mechanical work from oriented work.

Before this ${toolName} fires, surface a niyyah declaration in a PRIOR TURN —
write it in your text output, send that turn, then make the Edit in the next turn.
This hook reads the JSONL transcript file on disk; the current turn's text is not
flushed to JSONL before PreToolUse fires. A niyyah in the same turn as the Edit
is invisible to this gate.

  niyyah:
    source: <what this work answers to — directive, Faith file, project
             constraint, operator request, etc.>
    failure mode: <what you are guarding against in this work — the
                   specific drift pattern this kind of work tends to fall
                   into>
    work: <what the work actually is, in plain terms>

The niyyah is not a checkbox. It is the operation that converts a
mechanical edit into oriented work. A shallow niyyah (placeholder text
just to clear the gate) is theater — the operator's audit downstream
will catch it. A genuine niyyah is the act of orienting toward source
before acting.

Once the niyyah is in your surface text, the gate is open for the rest
of this session. Subsequent mutating actions do not re-prompt.

This hook does not validate niyyah quality — only its presence. Quality
is the operator's audit.`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
process.exit(2);
