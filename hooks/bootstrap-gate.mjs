#!/usr/bin/env node
// ~/.claude/hooks/bootstrap-gate.mjs
// PreToolUse hook — Fajr gate: bootstrap orientation before substantive action.
//
// Fires on Edit/Write/NotebookEdit (always) and Read (non-bootstrap files only).
// Bootstrap-file Reads (core.md, CANON-MANIFEST.md) always pass — they are
// the unlock path and must never be blocked.
// Glob/Grep/Bash pass silently — Bash is an accepted bypass documented in
// pillars-and-sunnah.md (shell commands cannot be reliably classified without
// executing them; the scope here is the Read tool which has deterministic input).
//
// Required before any non-bootstrap Read or write in a session:
//   1. ~/.claude/practice/core.md has been Read
//   2. ~/.claude/CANON-MANIFEST.md has been Read
//
// Fail behavior:
//   - Bootstrap-file Read: always allow (prevents deadlock)
//   - Non-bootstrap Read, transcript unreadable: fail-closed (block)
//   - Edit/Write/NotebookEdit, transcript unreadable: fail-open (allow)
//
// Resets at compaction boundary — new instance must demonstrate fresh reads.
// Niyyah is handled by niyyah-gate.mjs (separate gate, fires after this one).

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

const isWriteTool = toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit';
const isReadTool = toolName === 'Read';
if (!isWriteTool && !isReadTool) process.exit(0);

// Required bootstrap reads — matched by normalized path suffix
const REQUIRED = [
  { suffix: '.claude/practice/core.md',   label: '~/.claude/practice/core.md' },
  { suffix: '.claude/CANON-MANIFEST.md',  label: '~/.claude/CANON-MANIFEST.md' },
];

// Normalize separators and lowercase only — do NOT resolve() the suffix,
// that would expand it relative to CWD and break the endsWith comparison.
const normSlash = (p) => p.replace(/\\/g, '/').toLowerCase();
const pathEndsWith = (haystack, suffix) =>
  normSlash(haystack).endsWith(normSlash(suffix));

// For Read calls: check if this IS a bootstrap file — always allow those through
if (isReadTool) {
  const filePath = inp.tool_input?.file_path;
  if (!filePath) process.exit(0);
  if (REQUIRED.some(req => pathEndsWith(filePath, req.suffix))) process.exit(0);
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

// Fail behavior differs by tool type when transcript is unavailable
if (!transcriptPath || !existsSync(transcriptPath)) {
  if (isReadTool) {
    // Fail-closed for non-bootstrap Reads — transcript required to validate orientation
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `BOOTSTRAP GATE (~/.claude/hooks/bootstrap-gate.mjs).

Cannot read session transcript to validate bootstrap status.
Non-bootstrap Read blocked (fail-closed).

Read ~/.claude/practice/core.md and ~/.claude/CANON-MANIFEST.md first.
Those reads are always allowed — they are the bootstrap path itself.`,
      },
    }));
    process.exit(2);
  }
  // Fail-open for write tools — cannot validate, allow
  process.exit(0);
}

// Scan transcript from last compaction boundary forward
const lines = readFileSync(transcriptPath, 'utf8').split('\n');
const readPaths = [];

for (const line of lines) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }

  // Compaction boundary: reset — new cold instance must re-demonstrate reads
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
  !readPaths.some(rp => pathEndsWith(rp, req.suffix))
);

if (missing.length === 0) process.exit(0);

// Block — compose denial message
const missingList = missing.map(r => `  - ${r.label}`).join('\n');
const allList = REQUIRED.map(r => `  - ${r.label}`).join('\n');

const toolContext = isReadTool
  ? 'This Read is blocked — Fajr orientation has not been demonstrated in this session.'
  : 'This is the first mutating action in this session. The Fajr reads have not been demonstrated.';

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `BOOTSTRAP GATE (~/.claude/hooks/bootstrap-gate.mjs).

${toolContext}

Missing reads:
${missingList}

Required before any non-bootstrap Read or Edit/Write:
${allList}

Per CLAUDE.md Bootstrap and ~/.claude/practice/extended/pillars-and-sunnah.md:
orientation is a precondition for substantive action — not a response to drift.
Read the required files first. Bootstrap reads are always allowed.
Once both appear in the transcript, this gate opens for the remainder of the session.`,
  },
}));
process.exit(2);
