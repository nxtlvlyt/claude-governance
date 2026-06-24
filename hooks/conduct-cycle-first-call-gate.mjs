#!/usr/bin/env node
// ~/.claude/hooks/conduct-cycle-first-call-gate.mjs
// PreToolUse hook on Bash — Fajr gate for conductor sessions.
//
// Operator rule (STATE.md:3-9, NEXT-INSTANCE-WARNINGS-2026-06-23.md:47-83):
//   "FIRST tool call of every conductor turn = node conduct-cycle.mjs"
//
// Documented for months; cost paid 2026-06-23 in 7 hours of re-deriving conduct-cycle
// output by hand from status.json/heartbeat tails after the conductor skipped the
// script. Documentation in STATE.md didn't bind. This hook does.
//
// Scope: ONLY fires inside ~/.claude/muezzin-plugin/. Other projects unaffected.
// Fail-open everywhere on parse errors, missing transcripts, etc.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

let inp;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inp) process.exit(0);

// Only gate Bash tool calls — the conductor's primary hand
if (inp.tool_name !== 'Bash') process.exit(0);

// Scope to muezzin-plugin
const cwd = (inp.cwd || process.cwd() || '').replace(/\\/g, '/').toLowerCase();
if (!cwd.includes('.claude/muezzin-plugin')) process.exit(0);

// The bash command this call is about to run
const cmd = String(inp.tool_input?.command || '');

// ALWAYS-ALLOW set: meta-tools the conductor uses BEFORE conduct-cycle to orient
// (these aren't doing chain work; they're orienting/inspecting before action)
const ALLOW_BEFORE_FIRST_CALL = [
  /conduct-cycle\.mjs/,              // the gate's whole point — let conduct-cycle through
  /^\s*(ls|pwd|date|echo|cat|tail|head|grep|find)\b/,  // read-only inspection
  /^\s*git\s+(status|log|diff|branch|rev-parse|show|ls-files|ls-remote)\b/,  // read-only git
  /^\s*node\s+--check\b/,            // syntax check
  /^\s*node\s+\S+\.mjs\s+--selftest\b/,  // module selftests
];
if (ALLOW_BEFORE_FIRST_CALL.some(re => re.test(cmd))) process.exit(0);

// Resolve transcript
let transcriptPath = inp.transcript_path || null;
if (!transcriptPath && inp.session_id) {
  const sanitized = (inp.cwd || process.cwd()).replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}
if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0); // fail-open

// Scan transcript for any prior `node conduct-cycle.mjs` invocation this session.
// Reset at compaction boundary (per bootstrap-gate pattern — a new cold instance
// must re-demonstrate the call).
let conductCycleRunThisSession = false;
try {
  const lines = readFileSync(transcriptPath, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
      conductCycleRunThisSession = false; // reset after compaction
      continue;
    }
    if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block.type !== 'tool_use' || block.name !== 'Bash') continue;
        const prevCmd = String(block.input?.command || '');
        if (/conduct-cycle\.mjs/.test(prevCmd)) { conductCycleRunThisSession = true; break; }
      }
      if (conductCycleRunThisSession) break;
    }
  }
} catch { process.exit(0); } // fail-open on transcript parse error

if (conductCycleRunThisSession) process.exit(0);

// Block. The conductor is about to do chain work without first running the proactive sweep.
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `CONDUCT-CYCLE-FIRST-CALL GATE (~/.claude/hooks/conduct-cycle-first-call-gate.mjs).

The first non-inspection Bash tool call in any muezzin-plugin conductor turn MUST be:

  cd ~/.claude/muezzin-plugin && node conduct-cycle.mjs

You are about to run a different Bash command without having run conduct-cycle.mjs first
in this session. Per STATE.md:3-9 and NEXT-INSTANCE-WARNINGS-2026-06-23.md:47-83 —
this is the operator's standing rule, paid for by 7 hours of re-derivation 2026-06-23.

Read-only inspection (ls, cat, grep, git status/log/diff, --check, --selftest) is allowed.
Any other Bash command — chain edits, mission rewrites, daemon ops, deploys — is blocked
until conduct-cycle.mjs has been observed in this session's transcript.

Run it first. Then proceed.

Resets at compaction boundary. Scope: only inside ~/.claude/muezzin-plugin/.`,
  },
}));
process.exit(2);
