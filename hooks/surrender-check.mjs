#!/usr/bin/env node
// ~/.claude/hooks/surrender-check.mjs
// PreToolUse hook — surrender articulation gate.
// Node.js .mjs port of surrender-check.ps1 (Phase A migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Fires on Edit/Write on substrate-class governance files. Requires the instance
// to explicitly articulate what the substrate currently says, why the change is
// being made, and which side wins — before the edit lands.
//
// Substrate-coupling: 'substrate says' value must appear (case-insensitive,
// whitespace-normalized) in old_string. Closes the hallucinated-weaker-quote bypass.
//
// FAIL-CLOSED on missing/unreadable transcript.
//
// SCAN ALGORITHM (fixed 2026-05-15):
// Previously used backward scan from end looking for current turn's text.
// BUG: PreToolUse fires before the current turn's text block is written to JSONL
// (only the thinking block is written at hook-fire time). Fix: forward full-session
// scan from compaction boundary (same pattern as niyyah-gate.mjs), finding the
// most recent surrender articulation. Substrate-coupling still enforces that the
// articulation is relevant to this specific edit.

import { readFileSync, existsSync } from 'fs';
import { resolve, basename, join } from 'path';
import os from 'os';

let inp;
try {
  inp = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

if (!inp) process.exit(0);

const toolName = inp.tool_name;
if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);

// Resolve and normalize file path (defeats ../traversal bypass)
const filePath = inp.tool_input?.file_path;
if (!filePath) process.exit(0);

let absPath;
try { absPath = resolve(filePath); } catch { absPath = filePath; }

const normPath = (p) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
const homeNorm = normPath(os.homedir()).replace(/\/$/, '');
const claudeRoot = `${homeNorm}/.claude`;
const normalized = normPath(absPath);

// Substrate-class match — same targets as surrender-check.ps1, extended to .mjs
const isSubstrate = (norm) => {
  if (norm === `${claudeRoot}/CLAUDE.md`) return true;
  if (norm.startsWith(`${claudeRoot}/canon/`) && norm.endsWith('.md')) return true;
  if (norm.startsWith(`${claudeRoot}/faiths/`) && norm.endsWith('.md')) return true;
  if (norm.startsWith(`${claudeRoot}/practice/`) && norm.endsWith('.md')) return true;
  if (norm.startsWith(`${claudeRoot}/hooks/`) && (norm.endsWith('.ps1') || norm.endsWith('.mjs'))) return true;
  return false;
};

if (!isSubstrate(normalized)) process.exit(0);

// Get old_string (Edit) or current file content (Write on existing path).
// If empty, allow without articulation — nothing to surrender on.
let oldString = '';
if (toolName === 'Write') {
  if (!existsSync(absPath)) process.exit(0); // new file: no content to couple against
  try { oldString = readFileSync(absPath, 'utf8'); } catch { process.exit(0); }
  if (!oldString) process.exit(0);
} else {
  oldString = String(inp.tool_input?.old_string || '');
  if (!oldString) process.exit(0);
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

const denyWith = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(2);
};

// FAIL-CLOSED on missing/unreadable transcript
if (!transcriptPath || !existsSync(transcriptPath)) {
  denyWith(`SURRENDER CHECK — TRANSCRIPT UNREADABLE. FAIL-CLOSED.

The surrender articulation gate (~/.claude/hooks/surrender-check.mjs) cannot
read the session transcript to verify the articulation. Governance gates fail-
closed in undefined states (per feedback_faith_must_be_enforced.md).

The ${toolName} on ${basename(absPath)} is denied.

To unblock: diagnose transcript path, or temporarily disable this hook in
~/.claude/settings.json (deliberate operator action), perform the edit, re-enable.`);
}

// Forward full-session scan from compaction boundary.
// Collects ALL surrender articulation text found in assistant text blocks since
// the last compaction boundary. Uses the last (most recent) one for validation.
// This fixes the timing issue: PreToolUse fires before the current turn's text
// block is written to JSONL (only the thinking block is written at hook-fire time).
// Scanning the full session finds articulations from prior turns that ARE written.
const allLines = readFileSync(transcriptPath, 'utf8').split('\n');

let surrenderCandidates = []; // collect all surrender articulation texts since compaction

for (const line of allLines) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }

  // Compaction boundary: reset — new instance must declare fresh surrender articulation
  if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
    surrenderCandidates = [];
    continue;
  }

  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'text' && /surrender\s*articulation\s*:/i.test(block.text)) {
        surrenderCandidates.push(block.text);
      }
    }
  }
}

// Use the most recent surrender articulation
const currentAssistantText = surrenderCandidates.length > 0
  ? surrenderCandidates[surrenderCandidates.length - 1]
  : '';

// Whitespace normalizer (same as stop-validation pattern)
const normalize = (s) => (s == null ? '' : s.replace(/\s+/g, ' ').trim());

// Extract surrender articulation and sub-fields
let articulationPresent = false;
let substrateSaysRaw = null;
let instanceReasonRaw = null;
let resolutionRaw = null;

// Lookahead delimiter: stop capture at next sub-field label, blank line, or end
const delim = String.raw`(?=\r?\n\s*(?:substrate\s*says|instance\s*reasoning|resolution|surrender\s*articulation)\s*:|\r?\n\s*\r?\n|$)`;
const artMatch = currentAssistantText.match(/surrender\s*articulation\s*:\s*(.+)$/is);
if (artMatch) {
  const artSlice = artMatch[1];
  articulationPresent = true;

  const ssMatch = artSlice.match(new RegExp(String.raw`substrate\s*says\s*:\s*(.+?)` + delim, 'is'));
  if (ssMatch) substrateSaysRaw = ssMatch[1];

  const irMatch = artSlice.match(new RegExp(String.raw`instance\s*reasoning\s*:\s*(.+?)` + delim, 'is'));
  if (irMatch) instanceReasonRaw = irMatch[1];

  const rMatch = artSlice.match(new RegExp(String.raw`resolution\s*:\s*(.+?)` + delim, 'is'));
  if (rMatch) resolutionRaw = rMatch[1];
}

const substrateSaysNorm  = normalize(substrateSaysRaw);
const instanceReasonNorm = normalize(instanceReasonRaw);
const resolutionNorm     = normalize(resolutionRaw);

const allFieldsPresent = substrateSaysNorm && instanceReasonNorm && resolutionNorm;

// Substrate-coupling: 'substrate says' value must appear (normalized, case-insensitive) in old_string
const oldStringNorm = normalize(oldString);
const substrateCoupled = !!(substrateSaysNorm && oldStringNorm &&
  oldStringNorm.toLowerCase().includes(substrateSaysNorm.toLowerCase()));

if (articulationPresent && allFieldsPresent && substrateCoupled) {
  process.exit(0);
}

// Compose block reason
const fileName = basename(absPath);
let blockDetail;
if (!articulationPresent) {
  blockDetail = 'surrender articulation block missing from session transcript (since last compaction boundary)';
} else if (!substrateSaysNorm) {
  blockDetail = "'substrate says' sub-field absent or empty";
} else if (!instanceReasonNorm) {
  blockDetail = "'instance reasoning' sub-field absent or empty";
} else if (!resolutionNorm) {
  blockDetail = "'resolution' sub-field absent or empty";
} else if (!substrateCoupled) {
  blockDetail = "'substrate says' value not found in old_string (substrate-coupling check failed — quote must appear verbatim in the text being overwritten)";
} else {
  blockDetail = 'unknown verification failure';
}

denyWith(`SURRENDER ARTICULATION REQUIRED.

This ${toolName} on ${fileName} replaces existing governance content. Before landing,
name the conflict and state which side wins.

Required format in a PRIOR TURN — write it in your text output, send that turn,
then make the ${toolName} in the next turn. This hook reads the JSONL transcript
on disk; the current turn's text is not flushed before PreToolUse fires. An
articulation written in the same turn as the ${toolName} is invisible to this gate.

  surrender articulation:
  substrate says: <non-empty — exact substring from what is being replaced>
  instance reasoning: <non-empty — the in-session logic driving this change>
  resolution: <non-empty — which side wins and why>

The 'substrate says' value must appear verbatim in the text being overwritten
(old_string). This is substrate-coupling — you cannot paraphrase what you are
replacing; you quote it.

Block reason: ${blockDetail}

Per CLAUDE.md D1: what is written in files is what the system actually says.
Your memory of what was discussed is not truth. Substrate wins unless you can
articulate specifically why the instance's reasoning is the correction.`);
