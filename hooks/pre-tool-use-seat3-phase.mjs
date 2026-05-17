#!/usr/bin/env node
// ~/.claude/hooks/pre-tool-use-seat3-phase.mjs
// PreToolUse hook — Seat 3 two-phase independence gate.
//
// Blocks Write/Edit to any *sonnet-synthesis* file unless a corresponding
// sonnet-blind.txt exists in the same directory. This enforces the two-phase
// Seat 3 protocol: Phase 1 (blind substrate eval) must produce an artifact
// before Phase 2 (delta synthesis) can be written.
//
// Without this gate, an instance can claim independent evaluation while
// actually reading prior seats first. The artifact dependency makes
// independence verifiable by structure, not by trust.

import { readFileSync, existsSync } from 'fs';
import { dirname, join, basename } from 'path';

let inp;
try {
  inp = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

if (!inp) process.exit(0);

const toolName = inp.tool_name;
if (toolName !== 'Write' && toolName !== 'Edit') process.exit(0);

const target = inp.tool_input?.file_path || '';
if (!target) process.exit(0);

if (!/sonnet-synthesis/i.test(basename(target))) process.exit(0);

const blindPath = join(dirname(target), 'sonnet-blind.txt');
if (!existsSync(blindPath)) {
  const reason = [
    'SEAT 3 PHASE GATE (~/.claude/hooks/pre-tool-use-seat3-phase.mjs).',
    '',
    `Attempted to write: ${target}`,
    '',
    'sonnet-blind.txt is missing from the same directory.',
    'Seat 3 must complete Phase 1 (blind substrate eval, no prior seat output)',
    'before Phase 2 (synthesis) can be written.',
    '',
    'Steps:',
    '  1. Read the substrate files under review directly (no gemma/qwen output yet)',
    '  2. Form your independent assessment',
    '  3. Write sonnet-blind.txt',
    '  4. Then read Seats 1 and 2 output',
    '  5. Write sonnet-synthesis.txt (delta only)',
  ].join('\n');

  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(1);
}

process.exit(0);
