// Adversarial re-check of hunt-24: exercise the LIVE exported retroRepeatBlocked
// with REAL files on disk, firing the gap's two receipted kill-shapes.
import { retroRepeatBlocked } from 'file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs';
import { mkdirSync, writeFileSync, readFileSync, statSync, utimesSync, rmSync } from 'node:fs';
import path from 'node:path';

const TMP = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/hunt24-refute';
rmSync(TMP, { recursive: true, force: true });
const retroDir = path.join(TMP, 'retro');
mkdirSync(retroDir, { recursive: true });

// 5 real FAILED(verify) retros on disk, hours 0..4 of 2026-07-03
const stem = 'rf';
for (const h of [0, 1, 2, 3, 4]) {
  const f = path.join(retroDir, `${stem}-2026-07-03T0${h}-00-00-000Z.md`);
  writeFileSync(f, `# RETRO ${stem} — FAILED(verify)\nreal file on disk\n`);
}
const NOW = Date.parse('2026-07-03T06:00:00Z');
const newestRetroMs = Date.parse('2026-07-03T04:00:00Z');
const missionMtimeAmended = Date.parse('2026-07-03T04:30:00Z'); // newer than newest retro

// real preflight file on disk; readPreflight overridden ONLY to redirect the fixed
// LOGDIR path to this scratch file -- content is genuinely read from disk
const pfPath = path.join(TMP, `${stem}.md`);
const readPf = () => readFileSync(pfPath, 'utf8');
const freshPfMtime = Date.parse('2026-07-03T04:55:00Z'); // newer than newest retro

const base = { now: NOW, preflightMtimeMs: freshPfMtime, readPreflight: readPf };

// KILL-SHAPE 1: hollow touch — empty file, fresh mtime
writeFileSync(pfPath, '');
const k1 = retroRepeatBlocked(stem, retroDir, missionMtimeAmended, { ...base });
console.log('KILL-SHAPE-1 hollow-touch:', JSON.stringify(k1));

// KILL-SHAPE 2: real receipt covering a DIFFERENT class (plan) vs killing class verify
writeFileSync(pfPath, 'Dry-ran the planning phase.\nCOVERS: FAILED(plan)\n');
const k2 = retroRepeatBlocked(stem, retroDir, missionMtimeAmended, { ...base });
console.log('KILL-SHAPE-2 stale-class:', JSON.stringify(k2));

// LEGIT: genuine receipt covering the current killing class, fresh, mission amended
writeFileSync(pfPath, 'Dry-ran the verify step, PASS.\nCOVERS: FAILED(verify)\n');
const ok = retroRepeatBlocked(stem, retroDir, missionMtimeAmended, { ...base });
console.log('LEGIT genuine-receipt:', JSON.stringify(ok));

// PRE-FIX BEHAVIOR CHECK: would mtime alone have passed? (what the old gate did)
// i.e. hollow touch must be blocked *because of content*, so blocked must carry
// needsPreflight and killingClass 'verify'
const pass =
  k1.blocked === true && k1.needsPreflight === true && k1.killingClass === 'verify' &&
  k2.blocked === true && k2.needsPreflight === true && k2.killingClass === 'verify' &&
  ok.blocked === false && ok.preflighted === true;
console.log(pass ? 'REPLAY ALL PASS' : 'REPLAY FAIL');
rmSync(TMP, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
