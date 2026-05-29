#!/usr/bin/env node
// ~/.claude/hooks/pre-tool-use-substrate.mjs
// PreToolUse hook — HARD fail-closed gate on substrate-class edits.
// Node.js .mjs port of pre-tool-use-substrate.ps1 (Phase A migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Requires a foreign-frontier dispatch (mcp__gemini/gpt/grok/glm/ollama-*, WebSearch, WebFetch)
// to appear after the last prior substrate edit attempt before allowing any new Edit/Write/NotebookEdit
// on substrate-class files.
//
// Substrate class: CLAUDE.md, canon/*.md, faiths/*.md, practice/*.md, hooks/*.{ps1,mjs}
//
// Dual-write: also checks up to 2 sibling JSONL files in the same directory.
// FAIL-CLOSED on missing transcript.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname } from 'path';
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

// current tool_use_id — exclude from walk to avoid self-blocking
const currentToolUseId = inp.tool_use_id ? String(inp.tool_use_id) : null;

// Resolve file path
const rawPath = inp.tool_input?.file_path || inp.tool_input?.notebook_path;
if (!rawPath) process.exit(0);

let absPath;
try { absPath = resolve(rawPath); } catch { absPath = rawPath; }

const normPath = (p) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
const homeNorm = normPath(os.homedir()).replace(/\/$/, '');
const claudeRoot = `${homeNorm}/.claude`;
const normalized = normPath(absPath);

// Substrate-class match — extended to .mjs (the hooks are substrate regardless of extension)
const isSubstrate = (norm) => {
  if (norm === `${claudeRoot}/CLAUDE.md`) return true;
  if (norm.startsWith(`${claudeRoot}/canon/`) && norm.endsWith('.md')) return true;
  if (norm.startsWith(`${claudeRoot}/faiths/`) && norm.endsWith('.md')) return true;
  if (norm.startsWith(`${claudeRoot}/practice/`) && norm.endsWith('.md')) return true;
  if (norm.startsWith(`${claudeRoot}/hooks/`) && (norm.endsWith('.ps1') || norm.endsWith('.mjs'))) return true;
  return false;
};

if (!isSubstrate(normalized)) process.exit(0);

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

// FAIL-CLOSED on missing transcript
if (!transcriptPath || !existsSync(transcriptPath)) {
  denyWith(`SUBSTRATE-CLASS HARD GATE — TRANSCRIPT UNREADABLE.

This hook (~/.claude/hooks/pre-tool-use-substrate.mjs) cannot validate
foreign-frontier dispatch without the session transcript JSONL. Per
~/.claude/canon/delegation-and-stall-discipline.md, governance gates
fail-closed in undefined states.

The ${toolName} on ${rawPath} is denied.

Diagnosis paths:
  - transcript_path was not provided in the hook input.
  - The transcript file at the derived path does not exist.
  - Permissions or filesystem transport issue.

To unblock:
  - Diagnose the transcript-path issue, OR
  - Disable this hook in ~/.claude/settings.json (deliberate operator
    action — note that this disables the gate for all subsequent edits
    in the session), perform the edit, re-enable.

This is by design. A quietable governance hook is a bypass surface; a
loud hook is the practice.`);
}

// Walk a JSONL file, collect ordered events:
//   { kind: 'substrate_edit_attempt', idx }
//   { kind: 'dispatch', idx }
function getSubstrateEvents(path, skipId) {
  const events = [];
  if (!path || !existsSync(path)) return events;
  let idx = 0;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    // Reset event tracking at compaction boundary (mirrors bootstrap-gate + niyyah-gate):
    // only count dispatch/edit events AFTER the most recent compaction, so a post-compaction
    // substrate edit requires a FRESH witness rather than a stale pre-compaction dispatch.
    if (entry.type === 'system' && entry.subtype === 'compact_boundary') { events.length = 0; idx = 0; continue; }
    if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      if (block.type !== 'tool_use') continue;
      if (skipId && String(block.id) === skipId) continue;
      idx++;
      const name = block.name || '';
      if (/^mcp__(gemini|gpt|grok|glm|ollama)/i.test(name) ||
          name === 'WebSearch' || name === 'WebFetch') {
        events.push({ kind: 'dispatch', idx });
        continue;
      }
      if (name === 'Edit' || name === 'Write' || name === 'NotebookEdit') {
        const tp = block.input?.file_path || block.input?.notebook_path;
        if (!tp) continue;
        let ta;
        try { ta = resolve(tp); } catch { ta = tp; }
        if (isSubstrate(normPath(ta))) {
          events.push({ kind: 'substrate_edit_attempt', idx });
        }
      }
    }
  }
  return events;
}

function testDispatchAfterSubstrate(events) {
  let lastSubIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === 'substrate_edit_attempt') { lastSubIdx = events[i].idx; break; }
  }
  return events.some(ev => ev.kind === 'dispatch' && ev.idx > lastSubIdx);
}

// Check primary transcript
let dispatchAfter = testDispatchAfterSubstrate(getSubstrateEvents(transcriptPath, currentToolUseId));

// Check sibling JSONLs (up to 2 most recently modified) if primary didn't pass
if (!dispatchAfter) {
  const dir = dirname(transcriptPath);
  try {
    const siblings = readdirSync(dir)
      .filter(f => f.endsWith('.jsonl') && join(dir, f) !== transcriptPath)
      .map(f => ({ f: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 2);
    for (const { f } of siblings) {
      if (testDispatchAfterSubstrate(getSubstrateEvents(f, currentToolUseId))) {
        dispatchAfter = true;
        break;
      }
    }
  } catch {
    // Sibling check is best-effort; failure does not change the primary result
  }
}

if (dispatchAfter) process.exit(0);

// Block
denyWith(`SUBSTRATE-CLASS HARD GATE (~/.claude/hooks/pre-tool-use-substrate.mjs).

You are about to ${toolName} a governance-substrate file:
  ${rawPath}

Per ~/.claude/canon/delegation-and-stall-discipline.md (foreign-frontier
witness rule + cited-but-not-applied failure mode):

  Edits to scripture, canon, Faith, practice, and the enforcement hooks
  themselves are load-bearing — they propagate across every future
  session, every project, every instance. Each substrate edit must be
  witnessed by a foreign-frontier validator on the change-shape itself.
  Same-tribe self-validation (Claude auditing Claude) is the failure
  mode the canon names; foreign-model validation is independent witness.

The transcript shows no foreign-frontier dispatch (mcp__gemini-* /
mcp__gpt-* / mcp__grok-* / mcp__glm-* / mcp__ollama-*
WebSearch / WebFetch) since the last substrate edit (or session start).

Required next action:

  1. Dispatch a foreign-frontier validator on the change-shape of THIS
     edit. Prompt shape: "I am about to ${toolName} <path>. Here is the
     change-shape: <what is being added/removed and why>. Audit for
     canon-coherence and bypass surfaces."
  2. Read the validator's response.
  3. Adjust the edit if the validator surfaces issues.
  4. Retry the edit. The gate will pass once the dispatch is in
     transcript.

If all foreign-frontier MCP transports are unavailable: surface the
degradation explicitly to the operator ("foreign-frontier validators
unavailable; degraded mode") rather than editing anyway. Do not bypass
the gate by disabling it for a single edit unless the operator
explicitly authorizes it.

This hook does not validate that the dispatch was on the change-shape
specifically — that is the operator's audit downstream. The hook gates
the structural operation. Per the field report ~/.claude/practice/
extended/drift-and-ratchet.md: "when the foreign-frontier dispatch
starts feeling redundant after a few fires, that feeling is the drift
mode, not principled efficiency. Dispatch anyway. The cost is small
relative to what gets compounded if the dispatch is skipped."`);
