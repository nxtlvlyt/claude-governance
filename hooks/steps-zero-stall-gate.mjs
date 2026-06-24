#!/usr/bin/env node
// ~/.claude/hooks/steps-zero-stall-gate.mjs
// Stop hook — blocks session close when the ledger shows DONE-via-split spam (steps:0)
// without real shipping (steps>0) AND no explicit park/diagnose annotation this session.
//
// Operator rule (NEXT-INSTANCE-WARNINGS-2026-06-24.md:11-32):
//   "Chain producing big plans is NOT productivity. Steps>0 IS."
//   "DONE-VIA-SPLIT is a tracking artifact, not a success signal."
//   "Don't close session with 'let it run' while ledger shows steps:0 cycling."
//
// Cost paid 2026-06-24 morning: 8 hours overnight soak + ~2.5M Claude tokens on
// b13-sitemap, 11 DONE-via-split entries (every one steps:0), zero code shipped.
// This hook closes that exact pattern.
//
// Scope: only inside ~/.claude/muezzin-plugin/. Fail-open everywhere.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

let inp;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inp) process.exit(0);

// stop_hook_active means we're ALREADY in forced-continuation from a prior block.
// Honor the loop guard — exit clean so the user can end if they truly want.
if (inp.stop_hook_active === true) process.exit(0);

// Scope to muezzin-plugin
const cwd = (inp.cwd || process.cwd() || '').replace(/\\/g, '/').toLowerCase();
if (!cwd.includes('.claude/muezzin-plugin')) process.exit(0);

// Read the ledger. Each line shape:
//   | 2026-06-24T05:33:03Z | <mission> | DONE | <Nm> | plans:N steps:M heals:H halts:X |
const ledgerPath = join(os.homedir(), '.claude', 'muezzin-plugin', 'missions', '_logs', 'MISSION-LEDGER.md');
if (!existsSync(ledgerPath)) process.exit(0);

let lines;
try { lines = readFileSync(ledgerPath, 'utf8').split('\n').filter(l => l.includes('|') && /^\|\s*\d{4}-\d{2}-\d{2}T/.test(l)); }
catch { process.exit(0); }

// Look at the last hour of entries. Parse each line for ts + verdict + steps.
// "Last hour" relative to the freshest ts in the ledger (NOT wall-clock — avoids
// time-drift complications and works correctly even on cron / batch reruns).
const parsed = [];
for (const l of lines) {
  const m = l.match(/^\|\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*\|\s*([^|]+?)\s*\|\s*(\w+(?:\([^)]+\))?)\s*\|\s*\d+m\s*\|\s*plans:(\d+)\s+steps:(\d+)/);
  if (!m) continue;
  parsed.push({
    ts: Date.parse(m[1]),
    mission: m[2].trim(),
    verdict: m[3].trim(),
    plans: Number(m[4]),
    steps: Number(m[5]),
  });
}
if (parsed.length === 0) process.exit(0);

const latestTs = parsed[parsed.length - 1].ts;
const hourAgo = latestTs - 60 * 60 * 1000;
const window = parsed.filter(p => p.ts >= hourAgo);

const doneViaSplit = window.filter(p => p.verdict === 'DONE' && p.steps === 0);
const realShipping = window.filter(p => p.steps > 0);

// Only the pathological case fires the gate: many DONE-via-split + zero real shipping.
// Single DONE-via-split is normal autosplit; what burns budget is many in a row.
const PATHOLOGICAL_DONE_VIA_SPLIT_THRESHOLD = 3;
if (doneViaSplit.length < PATHOLOGICAL_DONE_VIA_SPLIT_THRESHOLD) process.exit(0);
if (realShipping.length > 0) process.exit(0);

// Check transcript for an explicit conductor acknowledgement this session — a `--record`
// call, a park annotation (`# BLOCKED` / `# HELD` written to a mission file), a
// wrangler deploy, or a conduct-cycle.mjs invocation in the latter half of the session.
// Any of these = conductor acted on the stall, not closed-while-it-cycled.
let transcriptPath = inp.transcript_path || null;
if (!transcriptPath && inp.session_id) {
  const sanitized = (inp.cwd || process.cwd()).replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}
let conductorActed = false;
if (transcriptPath && existsSync(transcriptPath)) {
  try {
    const txt = readFileSync(transcriptPath, 'utf8');
    if (/conduct-cycle\.mjs[^\n]*--record/.test(txt)) conductorActed = true;
    else if (/wrangler\s+pages\s+deploy/.test(txt)) conductorActed = true;
    else if (/#\s*BLOCKED|#\s*HELD/.test(txt) && /\.mission\.txt/.test(txt)) conductorActed = true;
  } catch { /* fail-open */ }
}
if (conductorActed) process.exit(0);

// Block. Pathological cycling + no conductor intervention = the 8h-wasted-soak pattern.
const cyclingMission = doneViaSplit[doneViaSplit.length - 1]?.mission || '<unknown>';
const sampleCounts = doneViaSplit.slice(-3).map(p => `  steps:0 plans:${p.plans} on ${p.mission}`).join('\n');
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: `STEPS-ZERO-STALL GATE (~/.claude/hooks/steps-zero-stall-gate.mjs).

The mission ledger shows ${doneViaSplit.length} DONE entries with steps:0 in the last hour, AND
zero DONE entries with steps>0 in the same window. This is the DONE-via-split spam
pattern — the chain is "completing" missions by emitting children, but no actual code
is shipping. Receipt from the cost paid 2026-06-24 morning: 8 hours overnight, 11
DONE-via-split entries on b13-sitemap, zero code shipped.

Most recent cycling mission: ${cyclingMission}

Sample (last 3 cycle entries):
${sampleCounts}

Per NEXT-INSTANCE-WARNINGS-2026-06-24.md: "steps>0 is productivity. 17KB plans with
steps:0 is a STALL, not progress. Don't close session 'to let it run' while ledger
shows DONE-via-split spam."

This session has not performed ANY of the canonical conductor interventions:
  - No \`conduct-cycle.mjs --record\` call (the self-heal mechanism)
  - No \`wrangler pages deploy\` (conductor-direct cutover shipping)
  - No \`# BLOCKED\` / \`# HELD\` annotation appended to a cycling mission

To close this session, perform AT LEAST ONE of:
  1. Park the cycling mission: append \`# BLOCKED pending <reason>\` to its mission text
  2. Ship via conductor-direct: \`wrangler pages deploy\` if a verified branch is ready
  3. Record a fix-landing: \`node conduct-cycle.mjs --record --class <c> --fix "<text>" --requeue <missions>\`
  4. Apply a diagnosed engine patch (if a workflow returned one)

Scope: only inside ~/.claude/muezzin-plugin/. Other projects unaffected.`,
}));
process.exit(0);
