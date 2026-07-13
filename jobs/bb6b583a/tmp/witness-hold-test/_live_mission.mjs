// _live_mission.mjs — #29 live validation: run a REAL mission through orchestrate() with the REAL seats
// (real architect decomposes, real executor implements, real witness/repair/commit). The ultimate proof.
import { orchestrate } from './orchestrate.mjs';
import { execSync } from 'node:child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live_mission_'));
const git = (c) => execSync(`git ${c}`, { cwd: dir, stdio: 'pipe' });
git('init -q'); git('config user.email t@t.local'); git('config user.name t');
// --no-verify: skip the inherited global laguna pre-commit hook on the sandbox seed (it does a per-commit
// Ollama review that would hang). The mission's per-step commits go through hook-proof git_steps.commitStep.
fs.writeFileSync(path.join(dir, 'README.md'), '# live mission sandbox\n'); git('add -A'); git('commit -q --no-verify -m init');

const mission = `Niyyah: a reliable fizzbuzz a caller can trust.
Maqsad: a working Node.js ESM module fizzbuzz.mjs exporting a function fizzbuzz(n) that returns 'FizzBuzz' if n is divisible by both 3 and 5, 'Fizz' if divisible by 3, 'Buzz' if divisible by 5, otherwise the number n itself; plus a test file fizzbuzz.test.mjs that uses the built-in node:test and node:assert/strict to verify fizzbuzz(3)==='Fizz', fizzbuzz(5)==='Buzz', fizzbuzz(15)==='FizzBuzz', and fizzbuzz(7)===7.
Context: a bare Node.js 20+ ESM project (no dependencies). Tests run with the command \`node --test\`. Keep it to at most these two files.`;

console.log('[live #29] orchestrating a REAL mission with real seats in', dir, '\n');
const r = await orchestrate(mission, dir, { maxRepairs: 1 });
console.log('\n[live #29] result:', JSON.stringify(r, null, 2));
console.log('[live #29] files written:', fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).join(', ') || '(none)');
console.log(r.ok
  ? '\nLIVE MISSION OK — a real mission ran end-to-end: plan -> implement -> witness -> commit'
  : `\nLIVE MISSION stopped at phase '${r.phase}'${r.stoppedAt ? ' step ' + r.stoppedAt : ''} — last: ${JSON.stringify((r.steps || []).slice(-1))}`);
process.exit(r.ok ? 0 : 1);
