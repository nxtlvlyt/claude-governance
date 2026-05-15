#!/usr/bin/env node
// ~/.claude/hooks/bootstrap-gate.mjs
// PreToolUse hook — Fajr gate: bootstrap orientation before first write.
//
// Fires on Edit/Write/NotebookEdit. Passes on Read/Glob/Grep (bootstrap reads
// are the point — don't block them).
//
// Required before any write in a session:
//   1. ~/.claude/practice/core.md has been Read
//   2. ~/.claude/CANON-MANIFEST.md has been Read
//
// These are the minimum bootstrap reads per CLAUDE.md Bootstrap section and
// practice/extended/pillars-and-sunnah.md. Niyyah is handled by niyyah-gate.mjs.
//
// Fail-open on missing/unreadable transcript (cannot validate → allow).
// Resets at compaction boundary — new instance must demonstrate fresh reads.

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

// Fail-open on missing transcript
if (!transcriptPath || !existsSync(transcriptPath)) {
  process.exit(0);
}

// Path-suffix matcher (normalize separators, case-insensitive)
const normSlash = (p) => p.replace(/\\/g, '/').toLowerCase();
const endsWith = (haystack, suffix) => normSlash(haystack).endsWith(normSlash(suffix));

// Required reads — must match path suffixes
const REQUIRED = [
  { suffix: '.claude/practice/core.md', label: '~/.claude/practice/core.md' },
  { suffix: '.claude/CANON-MANIFEST.md', label: '~/.claude/CANON-MANIFEST.md' },
];

// Forward scan from compaction boundary
const lines = readFileSync(transcriptPath, 'utf8').split('\n');
const readPaths = [];

for (const line of lines) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }

  // Compaction boundary: reset — new instance must demonstrate fresh reads
  if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
    readPaths.length = 0;
    continue;
  }

  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && block.name === 'Read' && block.input?.file_path) {
        readPaths.push(block.input.file_path);
      }
    }
  }
}

// Check which required reads are missing
const missing = REQUIRED.filter(req =>
  !readPaths.some(rp => endsWith(rp, req.suffix))
);

if (missing.length === 0) {
  process.exit(0);
}

// Compose denial
const missingList = missing.map(r => `  - ${r.label}`).join('\n');
const allList = REQUIRED.map(r => `  - ${r.label}`).join('\n');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `BOOTSTRAP GATE (~/.claude/hooks/bootstrap-gate.mjs).

This is the first mutating action in this session. The Fajr reads have not been
demonstrated in the session transcript.

Missing reads:
${missingList}

Required before any Edit/Write:
${allList}

Per CLAUDE.md Bootstrap and ~/.claude/practice/extended/pillars-and-sunnah.md:
orientation reads are a precondition for writing, not a response to noticing
drift. Read the required files, then proceed — niyyah-gate.mjs will require
the niyyah declaration.

Read calls are allowed without restriction — this gate does not block them.
Once both required reads appear in the transcript, this gate opens for the
remainder of the session.`,
  },
}));
process.exit(2);
