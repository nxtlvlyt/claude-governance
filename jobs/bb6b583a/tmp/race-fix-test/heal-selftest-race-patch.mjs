#!/usr/bin/env node
// heal-selftest-race-patch.mjs — one-shot patcher for conduct-cycle.mjs's selftest()
// race condition (gap-heal-selftest-chain-crash, 2026-07-12). Committed as a mission
// input artifact per the srcsha-anchor-patch precedent: literal scripted precision,
// never an LLM edit-step on a multi-region change. Idempotent: exits 0 with
// ALREADY-PATCHED if the fix is already present.
//
// Root cause (missions/_logs/heal-selftest-crash-diagnosis.md, EXECUTED-grade, directly
// reproduced): selftest() uses a fixed, non-PID-suffixed tmp path, so two concurrent
// `--selftest` invocations race on the same shared files with no isolation. Fix 1 gives
// each process its own tmp tree. Fix 2 threads the existing offline stubs into the 9
// heal() call sites that were falling through to real network/git backends, which both
// widened the race window (5m29s instead of ~instant) and independently risked a
// real WORKTREE-HEAL exec() firing into a fixture's throw-on-any-call stub.
import { readFileSync, writeFileSync } from 'fs';

const path = 'conduct-cycle.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('_selftest-conduct-${process.pid}')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const edits = [
  // Fix 1: PID-suffix the selftest tmp path, closing the concurrent-invocation race.
  {
    old: `const tmp = path.join(HERE, '_selftest-conduct');`,
    new: `const tmp = path.join(HERE, \`_selftest-conduct-\${process.pid}\`);`,
  },
  // Fix 2: thread the offline stubs into the 9 previously-unstubbed heal() call sites.
  {
    old: `const healed = heal(tmp, now, { exec: () => { throw new Error('must not restart a healthy daemon'); } });`,
    new: `const healed = heal(tmp, now, { exec: () => { throw new Error('must not restart a healthy daemon'); }, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const healPartial = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });`,
    new: `const healPartial = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); }, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const healFull = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });`,
    new: `const healFull = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); }, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const h1c2 = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });`,
    new: `const h1c2 = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); }, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const h2 = heal(tmp, now, { exec: () => { throw new Error('RESTART FIRED WHILE A LANE WAS RUNNING'); } });`,
    new: `const h2 = heal(tmp, now, { exec: () => { throw new Error('RESTART FIRED WHILE A LANE WAS RUNNING'); }, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const hStuck = heal(tmp, now, { exec: (cmd) => { killed.push(cmd); } });`,
    new: `const hStuck = heal(tmp, now, { exec: (cmd) => { killed.push(cmd); }, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const healedLoop = heal(tmp, now, { exec: () => {} });`,
    new: `const healedLoop = heal(tmp, now, { exec: () => {}, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const healedLoop2 = heal(tmp, now, { exec: () => {} });`,
    new: `const healedLoop2 = heal(tmp, now, { exec: () => {}, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const healedStranded = heal(tmp, now, { exec: () => {} });`,
    new: `const healedStranded = heal(tmp, now, { exec: () => {}, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
  {
    old: `const healedStranded2 = heal(tmp, now, { exec: () => {} });`,
    new: `const healedStranded2 = heal(tmp, now, { exec: () => {}, sightFn: sightOk.sightFn, worktreeReposFn: () => [], gitFn: stubGit });`,
  },
];

for (const [i, e] of edits.entries()) {
  const n = t.split(e.old).length - 1;
  if (n !== 1) {
    console.error(`EDIT-${i}-NOT-UNIQUE: found ${n} occurrences of: ${e.old.slice(0, 80)}`);
    process.exit(1);
  }
  t = t.replace(e.old, e.new);
}

writeFileSync(path, t);
console.log('PATCHED');
