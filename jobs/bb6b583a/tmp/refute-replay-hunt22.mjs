// Independent adversarial replay of the hunt-22 kill-shapes against the EXPORTED
// assertNoUndeclaredShrinkage on current HEAD. Scratch-only; temp git repo; deleted after use.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertNoUndeclaredShrinkage } from 'file:///C:/Users/marka/.claude/muezzin-plugin/git_steps.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refute-h22-'));
const run = (c) => execSync(c, { cwd: tmp, stdio: 'pipe' });
run('git init -q');
run('git config user.email t@t.local && git config user.name t');

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`PASS ${name}${detail ? ' (' + detail + ')' : ''}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? ' (' + detail + ')' : ''}`); }
};

// --- Shape 1: 44da372 — tracked nested docs/MARKER-INVENTORY.md, 313 lines committed,
// gutted to 1 line, checked with the OS-NATIVE (backslash on Windows) path.
fs.mkdirSync(path.join(tmp, 'docs'));
fs.writeFileSync(path.join(tmp, 'docs', 'MARKER-INVENTORY.md'), Array.from({ length: 313 }, (_, i) => `marker line ${i + 1}`).join('\n') + '\n');
run('git add . && git commit -q -m seed');
fs.writeFileSync(path.join(tmp, 'docs', 'MARKER-INVENTORY.md'), 'gutted\n');
const nativePath = path.join('docs', 'MARKER-INVENTORY.md'); // backslash on win32
const r1 = assertNoUndeclaredShrinkage(tmp, [nativePath], 'Update the marker inventory doc');
check('44da372 shape: tracked nested 313->1 gut via OS-native path REFUSED',
  r1.ok === false && r1.violations.length === 1 && r1.violations[0].source === 'head',
  JSON.stringify(r1.violations[0] || null));

// --- Shape 2: hunt-22a — UNTRACKED file, 32-line first emission, "repaired" to 1 line,
// baseline supplied (as orchestrate.mjs now does via firstEmission).
const firstEmission = Array.from({ length: 32 }, (_, i) => `authored line ${i + 1}`).join('\n');
fs.writeFileSync(path.join(tmp, 'brandnew.md'), 'stub\n'); // post-repair gutted content
const r2 = assertNoUndeclaredShrinkage(tmp, ['brandnew.md'], 'Fix the flagged citation issue', { baselines: { 'brandnew.md': firstEmission } });
check('hunt-22a shape: untracked 32->1 repair-gut REFUSED via first-emission baseline',
  r2.ok === false && r2.violations.length === 1 && r2.violations[0].source === 'baseline',
  JSON.stringify(r2.violations[0] || null));

// --- Negative control A: same untracked gut, NO baseline supplied -> pre-fix behavior (exempt).
const r3 = assertNoUndeclaredShrinkage(tmp, ['brandnew.md'], 'Fix the flagged citation issue');
check('no-baseline control: untracked file with no baseline still exempt (documented residual)', r3.ok === true);

// --- Negative control B: growth never blocks (tracked file grows).
fs.writeFileSync(path.join(tmp, 'docs', 'MARKER-INVENTORY.md'), Array.from({ length: 400 }, (_, i) => `marker line ${i + 1}`).join('\n') + '\n');
const r4 = assertNoUndeclaredShrinkage(tmp, [nativePath], 'Add more markers');
check('growth control: 313->400 allowed', r4.ok === true);

// --- Shape 3: THE ACTUAL RECEIPTED KILL-SHAPE for class (a) — commit 6957863:
// a PRE-EXISTING untracked file (the real catalog, restored by preflight, never committed)
// is overwritten by the executor's FIRST emission with 32 lines of fabricated content
// (32 insertions, 0 deletions). Engine behavior on HEAD: firstEmission = readTarget AFTER
// implementStep wrote — i.e. the fabrication itself becomes the baseline.
const realCatalog = Array.from({ length: 25 }, (_, i) => `real feature line ${i + 1}`).join('\n');
fs.writeFileSync(path.join(tmp, 'catalog.md'), realCatalog); // pre-edit untracked worktree bytes
// executor first emission overwrites (fabrication):
const fabrication = Array.from({ length: 32 }, (_, i) => `fabricated feature line ${i + 1}`).join('\n');
fs.writeFileSync(path.join(tmp, 'catalog.md'), fabrication);
const engineBaseline = fs.readFileSync(path.join(tmp, 'catalog.md'), 'utf8'); // what orchestrate.mjs:1196/1203 captures
const r5 = assertNoUndeclaredShrinkage(tmp, ['catalog.md'], 'Update the feature catalog', { baselines: { 'catalog.md': engineBaseline } });
check('6957863 RECEIPTED shape: first-emission fabrication of pre-existing untracked file — DOES THE FLOOR FIRE?',
  true, `ok=${r5.ok} violations=${JSON.stringify(r5.violations)} -> ${r5.ok ? 'FABRICATION PASSES CLEAN (kill-shape NOT covered)' : 'caught'}`);

// --- Shape 3b: even with the TRUE pre-edit bytes supplied as baseline (which the engine
// never captures), does the shrinkage-ratio floor fire on a 25->32 line fabrication?
const r6 = assertNoUndeclaredShrinkage(tmp, ['catalog.md'], 'Update the feature catalog', { baselines: { 'catalog.md': realCatalog } });
check('6957863 shape with PERFECT pre-edit baseline: 25->32 line fabrication — DOES THE FLOOR FIRE?',
  true, `ok=${r6.ok} -> ${r6.ok ? 'PASSES CLEAN (ratio floor is shrink-only, not a byte-guard)' : 'caught'}`);

console.log(fail === 0 ? `REPLAY ALL PASS (${pass}/${pass + fail})` : `REPLAY FAILURES: ${fail}`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);
