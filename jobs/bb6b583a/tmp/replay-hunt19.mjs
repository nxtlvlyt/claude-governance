// E2E replay of hunt-item #19 kill-shape: conduct-cycle divergence guard must fail CLOSED
// on git error. Pre-fix behavior: a git error on `rev-list --count github/main...github/master`
// left div.ok:false and NO blocking entry was pushed (silent fail-OPEN).
// Post-fix (6c1363a): divergenceCount === null on error -> explicit fail-closed L3 BLOCK.
import { computeDoneness } from 'file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'hunt19-'));
mkdirSync(path.join(tmp, 'missions', '_logs'), { recursive: true });
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\n');

// Baseline stub mirroring the selftest's stubGit: healthy repo, everything clean.
const stubGit = (repo, argstr) => {
  if (/rev-parse --abbrev-ref/.test(argstr)) return { ok: true, out: 'github/main\n' };
  if (/^rev-list --count/.test(argstr)) return { ok: true, out: '0\n' };
  if (/log -p/.test(argstr) || /patch-id/.test(argstr)) return { ok: true, out: '' };
  return { ok: true, out: '' };
};
const arun = { done: [], failed: [], pending: [], running: [], notes: {} };
let fails = 0;
const ck = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) fails++; };

// CASE 1 — THE ORIGINAL KILL-SHAPE: git ERRORS on the divergence rev-list.
{
  const divErrGit = (repo, argstr) => {
    if (/^rev-list --count github\/main\.\.\.github\/master/.test(argstr)) return { ok: false, out: '' };
    return stubGit(repo, argstr);
  };
  const dn = computeDoneness(tmp, arun, { gitFn: divErrGit });
  ck(dn.counts.divergenceCount === null, 'kill-shape: git error -> divergenceCount is null (not a silent 0)');
  ck(dn.blocking.some((b) => b.layer === 'L3' && /cannot determine github\/main vs github\/master divergence — fail-closed/.test(b.reason)),
    'kill-shape: git error -> explicit fail-closed L3 BLOCK entry (pre-fix: NO entry at all)');
  ck(dn.barMet === false, 'kill-shape: barMet is false (doneness bar cannot be met on an undeterminable divergence)');
}

// CASE 2 — garbage output with ok:true (non-numeric): must ALSO fail closed, never parse to a false int.
{
  const divGarbageGit = (repo, argstr) => {
    if (/^rev-list --count github\/main\.\.\.github\/master/.test(argstr)) return { ok: true, out: 'fatal: ambiguous argument\n' };
    return stubGit(repo, argstr);
  };
  const dn = computeDoneness(tmp, arun, { gitFn: divGarbageGit });
  ck(dn.counts.divergenceCount === null, 'garbage-out: non-numeric output -> divergenceCount null');
  ck(dn.blocking.some((b) => /cannot determine github\/main vs github\/master divergence — fail-closed/.test(b.reason)),
    'garbage-out: non-numeric output -> fail-closed BLOCK');
}

// CASE 3 — healthy path: 0 diverged commits -> integer 0, NO divergence block (no behavior change).
{
  const dn = computeDoneness(tmp, arun, { gitFn: stubGit });
  ck(dn.counts.divergenceCount === 0, 'healthy: clean git -> divergenceCount 0 (a real integer, not null)');
  ck(!dn.blocking.some((b) => /divergence/i.test(b.reason)), 'healthy: zero divergence -> no divergence blocking entry');
}

// CASE 4 — real divergence: >0 commits -> the original (pre-existing) blocking behavior still fires.
{
  const div14Git = (repo, argstr) => {
    if (/^rev-list --count github\/main\.\.\.github\/master/.test(argstr)) return { ok: true, out: '14\n' };
    return stubGit(repo, argstr);
  };
  const dn = computeDoneness(tmp, arun, { gitFn: div14Git });
  ck(dn.counts.divergenceCount === 14, 'diverged: 14 -> divergenceCount 14');
  ck(dn.blocking.some((b) => /DIVERGED by 14 commit\(s\)/.test(b.reason)), 'diverged: 14 -> DIVERGED blocking entry');
}

rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS (hunt-19 replay)');
process.exit(fails ? 1 : 0);
