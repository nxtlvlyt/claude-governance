#!/usr/bin/env node
// ~/.claude/hooks/perform-fix-gate.mjs
// Stop hook — enforces the muezzin-plugin self-heal rule mechanically.
//
// The operator's standing rule (2026-06-10, embedded in conduct-cycle.mjs):
// "perform the named fix (split/stage/restructure), then requeue the fixed shape;
//  never wait for the operator to ask"
//
// This rule was documentation-only in the plugin's tool output. Instances read it
// as informational and ignored it — multiple sessions sat on 20+ PERFORM-NAMED-FIX
// actions for hours while doing other work. This hook makes the rule mechanical:
// the conductor cannot end a session with outstanding PERFORM-NAMED-FIX actions
// unless they performed AT LEAST ONE this session (evidenced by a --record call).
//
// Fail-open everywhere — this hook must never break a non-conductor session.

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import os from 'os';

let inp;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inp) process.exit(0);

// Scope: only fire when the session's cwd is the muezzin-plugin tree.
// Outside that tree this hook does NOTHING — no global drag on other projects.
const cwd = (inp.cwd || process.cwd() || '').replace(/\\/g, '/').toLowerCase();
const MUEZZIN_KEY = '.claude/muezzin-plugin';
if (!cwd.includes(MUEZZIN_KEY)) process.exit(0);

// Resolve transcript path
let transcriptPath = inp.transcript_path || null;
if (!transcriptPath && inp.session_id) {
  const sanitized = (inp.cwd || process.cwd()).replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}

// Check whether the conductor PERFORMED any fix this session.
// Evidence: a Bash tool call containing 'conduct-cycle.mjs --record' OR a successful
// muezzin-plugin git commit on a feature branch (the cutover case).
let performedThisSession = false;
if (transcriptPath && existsSync(transcriptPath)) {
  try {
    const lines = readFileSync(transcriptPath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content) {
          if (block.type !== 'tool_use') continue;
          const cmd = String(block.input?.command || '');
          if (/conduct-cycle\.mjs[^\n]*--record/.test(cmd)) { performedThisSession = true; break; }
          // Cutover-class shipping counts too: a wrangler pages deploy that succeeded
          if (/wrangler\s+pages\s+deploy/.test(cmd)) { performedThisSession = true; break; }
        }
        if (performedThisSession) break;
      }
    }
  } catch { /* fail-open */ }
}

// Count current outstanding PERFORM-NAMED-FIX actions via conduct-cycle.mjs --json
let outstanding = [];
try {
  const pluginRoot = join(os.homedir(), '.claude', 'muezzin-plugin');
  const out = execSync(`node "${join(pluginRoot, 'conduct-cycle.mjs')}" --json`, {
    cwd: pluginRoot, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000,
  }).toString();
  const j = JSON.parse(out);
  outstanding = (j.actions || []).filter(a => /^PERFORM-NAMED-FIX-/.test(a.id || ''));
} catch { process.exit(0); /* fail-open on any conduct-cycle error */ }

if (outstanding.length === 0) process.exit(0);                  // nothing to enforce
if (performedThisSession) process.exit(0);                       // conductor did SOME work — allow close

// Block close. The conductor sat on outstanding PERFORM-NAMED-FIX actions and did
// none of the canonical self-heal moves (no --record, no cutover deploy). Surface
// the list and require at least one performed fix before this session can end.
const sample = outstanding.slice(0, 10).map(a => `  - ${a.id}`).join('\n');
const more = outstanding.length > 10 ? `\n  ...and ${outstanding.length - 10} more` : '';
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: `PERFORM-FIX-GATE (~/.claude/hooks/perform-fix-gate.mjs).

This session has ${outstanding.length} outstanding PERFORM-NAMED-FIX action(s) from conduct-cycle.mjs
and NO --record / cutover deploy was logged this session.

Per operator's self-heal rule (2026-06-10, embedded in conduct-cycle.mjs):
  "perform the named fix (split/stage/restructure), then requeue the fixed shape;
   never wait for the operator to ask"

The plugin's mechanism is named fixes ARE imperatives, not informational. Sitting on
them for an entire session IS the violation pattern this hook closes.

Outstanding (sample):
${sample}${more}

To proceed:
  1. Perform AT LEAST ONE fix from the list (rewrite the mission text, split, etc.)
  2. Record it: node conduct-cycle.mjs --record --class <c> --fix "<text>" --requeue <missions>
  3. OR ship via cutover (wrangler pages deploy on a verified branch)
  4. Then this hook will let the session close.

This hook fires only inside ~/.claude/muezzin-plugin/. Non-conductor sessions are unaffected.`,
}));
process.exit(0);
