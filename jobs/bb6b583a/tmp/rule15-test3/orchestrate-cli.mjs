#!/usr/bin/env node
// orchestrate-cli.mjs — one-command runner for the muezzin.
// Usage: node orchestrate-cli.mjs "<mission: Maqsad + niyyah>" [cwd]
// Creates a fresh git sandbox (if no cwd given), runs the mission through orchestrate(), prints the
// JSON result to stdout (logs to stderr), and exits 0 on success / 1 on a stop. This is what /muezzin drives.
import { orchestrate } from './orchestrate.mjs';
import { execSync } from 'node:child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';

const mission = process.argv[2];
if (!mission) {
  console.error('usage: node orchestrate-cli.mjs "<mission stated as Maqsad + niyyah, not mechanics>" [cwd]');
  process.exit(2);
}

let cwd = process.argv[3];
if (!cwd) {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'muezzin_mission_'));
  const git = (c) => execSync(`git ${c}`, { cwd, stdio: 'pipe' });
  git('init -q'); git('config user.email muezzin@local'); git('config user.name muezzin');
  // --no-verify: the global pre-commit hook (laguna Ollama review) inherited from ~/.gitconfig would
  // otherwise fire on every commit in this fresh sandbox and stall the mission (see git_steps.commitStep).
  fs.writeFileSync(path.join(cwd, 'README.md'), '# muezzin mission sandbox\n'); git('add -A'); git('commit -q --no-verify -m init');
}

console.error(`[muezzin] running mission in ${cwd}`);
const r = await orchestrate(mission, cwd, { maxRepairs: 1 });
console.log(JSON.stringify({ ...r, cwd }, null, 2));
const healed = (r.steps || []).filter((s) => s.repaired).length;
console.error(r.ok
  ? `[muezzin] DONE — ${r.steps.length} steps, ${healed} self-healed`
  : `[muezzin] STOPPED at phase '${r.phase}'${r.stoppedAt ? ' step ' + r.stoppedAt : ''}`);
process.exit(r.ok ? 0 : 1);
