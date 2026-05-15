#!/usr/bin/env node
// Temporary diagnostic: writes hook input to a log file, then exits 0 (allow).
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

let inp;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inp) process.exit(0);

const toolName = inp.tool_name;
if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);

const logPath = join(os.homedir(), '.claude', 'debug-inp.json');
writeFileSync(logPath, JSON.stringify({
  tool_name: inp.tool_name,
  transcript_path: inp.transcript_path || null,
  session_id: inp.session_id || null,
  cwd: inp.cwd || null,
  file_path: inp.tool_input?.file_path || null,
}, null, 2));

process.exit(0);
