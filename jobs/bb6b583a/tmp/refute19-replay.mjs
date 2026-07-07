// Independent adversarial replay of hunt-19 kill-shape against computeDoneness at HEAD.
// Read-only against the repo: gitFn fully injected, fixture dir lives in scratch, deleted after.
import { computeDoneness } from 'file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const tmp = path.join('C:/Users/marka/.claude/jobs/bb6b583a/tmp', 'refute19-fixture');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(path.join(tmp, 'missions', '_logs'), { recursive: true });

const healthyGit = (repo, argstr) => {
  if (/rev-parse --abbrev-ref/.test(argstr)) return { ok: true, out: 'github/main\n' };
  if (/^rev-list --count/.test(argstr)) return { ok: true, out: '0\n' };
  return { ok: true, out: '' };
};
const DIV_RE = /^rev-list --count github\/main\.\.\.github\/master/;
const errGit = (repo, argstr) => DIV_RE.test(argstr) ? { ok: false, out: '' } : healthyGit(repo, argstr);
const garbageGit = (repo, argstr) => DIV_RE.test(argstr) ? { ok: true, out: 'fatal: something weird\n' } : healthyGit(repo, argstr);
const divergedGit = (repo, argstr) => DIV_RE.test(argstr) ? { ok: true, out: '14\n' } : healthyGit(repo, argstr);

const arun = { done: [], failed: [], pending: [], running: [], notes: {} };
let fails = 0;
const ck = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) fails++; };

// (a) the receipted kill-shape: git error on the divergence rev-list
const dErr = computeDoneness(tmp, arun, { gitFn: errGit });
ck(dErr.counts.divergenceCount === null, 'kill-shape: git error -> divergenceCount is null (not a silent 0)');
ck(dErr.blocking.some(b => b.layer === 'L3' && /cannot determine github\/main vs github\/master divergence — fail-closed/.test(b.reason)),
   'kill-shape: git error -> explicit fail-closed L3 BLOCK entry (pre-fix: NO entry at all)');
ck(dErr.barMet === false, 'kill-shape: barMet is false');

// (b) ok:true but garbage (non-numeric) output must also fail closed
const dGar = computeDoneness(tmp, arun, { gitFn: garbageGit });
ck(dGar.counts.divergenceCount === null && dGar.blocking.some(b => /divergence — fail-closed/.test(b.reason)),
   'garbage-out: non-numeric output -> fail-closed BLOCK');

// (c) healthy zero divergence: no divergence blocking entry (no behavior change)
const dOk = computeDoneness(tmp, arun, { gitFn: healthyGit });
ck(dOk.counts.divergenceCount === 0 && !dOk.blocking.some(b => /divergence/i.test(b.reason)),
   'healthy: zero divergence -> no divergence blocking entry');

// (d) real divergence still blocks with the DIVERGED reason
const dDiv = computeDoneness(tmp, arun, { gitFn: divergedGit });
ck(dDiv.counts.divergenceCount === 14 && dDiv.blocking.some(b => /DIVERGED by 14 commit/.test(b.reason)),
   'diverged: 14 -> DIVERGED blocking entry');

rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILURES (refute19 replay)` : '\nALL PASS (refute19 replay)');
process.exit(fails ? 1 : 0);
