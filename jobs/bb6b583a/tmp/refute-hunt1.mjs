// Adversarial re-check of hunt-1: independent reimplementation of the OLD cwd derivation
// (from commit 7ae0153's diff: basename -> strip .mission.txt -> strip one more dotted segment)
// vs the shipped missionSandboxStem export at HEAD.
import path from 'node:path';
import { missionSandboxStem } from 'file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs';

const oldCwdStem = (f) => path.basename(f).replace(/\.mission\.txt$/i, '').replace(/\.[^.]+$/, '');
const oldRetroStem = (f) => path.basename(f).replace(/\.mission\.txt$/i, ''); // writeRetro's old (correct) derivation

const chain = [
  'mt-integrate-geocode-2026-06-23.mission.txt',
  'mt-integrate-geocode-2026-06-23.S1.mission.txt',
  'mt-integrate-geocode-2026-06-23.S1.S1.mission.txt',
];

// 1) OLD logic must reproduce the receipted collision (2 distinct of 3; S1 -> parent's dir)
const oldDirs = chain.map(oldCwdStem);
console.log('OLD cwd stems:', JSON.stringify(oldDirs), '-> distinct:', new Set(oldDirs).size, 'of 3');
if (new Set(oldDirs).size !== 2) { console.log('REFUTE-FAIL: old logic does NOT reproduce receipted 2-of-3 collision'); process.exit(1); }
if (oldDirs[1] !== 'mt-integrate-geocode-2026-06-23') { console.log('REFUTE-FAIL: S1 did not land in parent dir under old logic'); process.exit(1); }
if (oldDirs[2] !== 'mt-integrate-geocode-2026-06-23.S1') { console.log('REFUTE-FAIL: S1.S1 did not land in S1 dir under old logic'); process.exit(1); }

// 2) OLD divergence: cwd stem !== retro stem for dotted missions (the hollow-retro mechanism)
const s1 = chain[1];
console.log('OLD divergence on S1: cwd=', oldCwdStem(s1), ' retro-lookup=', oldRetroStem(s1), ' diverged=', oldCwdStem(s1) !== oldRetroStem(s1));
if (oldCwdStem(s1) === oldRetroStem(s1)) { console.log('REFUTE-FAIL: old logic shows no cwd/retro divergence'); process.exit(1); }

// 3) NEW shipped export: 3 distinct of 3, and convergence (same function used for both at HEAD,
//    verified separately by reading lines 304 and 1043 -- here we verify the values themselves)
const newDirs = chain.map(missionSandboxStem);
console.log('NEW stems:', JSON.stringify(newDirs), '-> distinct:', new Set(newDirs).size, 'of 3');
if (new Set(newDirs).size !== 3) { console.log('REFUTE-CONFIRMED: shipped function still collides'); process.exit(1); }
if (newDirs[0] !== 'mt-integrate-geocode-2026-06-23' || newDirs[1] !== 'mt-integrate-geocode-2026-06-23.S1' || newDirs[2] !== 'mt-integrate-geocode-2026-06-23.S1.S1') {
  console.log('REFUTE-CONFIRMED: shipped stems are not the expected full dotted stems'); process.exit(1);
}

// 4) The engine-heal-symmetry shape named in the shipped comment
console.log('engine-heal-symmetry.S1 ->', missionSandboxStem('engine-heal-symmetry.S1.mission.txt'));
if (missionSandboxStem('engine-heal-symmetry.S1.mission.txt') !== 'engine-heal-symmetry.S1') { console.log('REFUTE-CONFIRMED'); process.exit(1); }

// 5) Path-prefixed input (daemon passes full missionFile paths)
if (missionSandboxStem('C:\\Users\\marka\\.claude\\muezzin-plugin\\missions\\mt-integrate-geocode-2026-06-23.S1.mission.txt') !== 'mt-integrate-geocode-2026-06-23.S1') {
  console.log('REFUTE-CONFIRMED: full-path input mishandled'); process.exit(1);
}

console.log('ADVERSARIAL REPLAY: could not refute — old logic reproduces the kill-shape collision, shipped export resolves it');
