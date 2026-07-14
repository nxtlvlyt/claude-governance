#!/usr/bin/env node
// orchestrate-relevance-slice-patch.mjs -- gap-panel-truncation-false-reject (QUEUE ITEM 15),
// the artifact-slicing half (the verdict_merge visibility-downgrade landed the mechanical
// half earlier this session). defaultVerdictPhase fed the panel `full.slice(0, ARTIFACT_CAP)`
// -- the first 10,000 chars of each artifact. Receipt: a 398,166-char map.html was judged on
// ~2.5% of its content and wrongly REJECTed. Since Phase-2 commits each step BEFORE Phase-3
// verdict runs, the RELEVANT content for a code-repo mission is the diff the mission itself
// made vs the pre-mission baseline HEAD (already captured as `baselineHead`), not the file's
// head. This threads baselineHead into defaultVerdictPhase and replaces head-only truncation
// with: prefer the mission's own diff (relevance-extracted) -> head+tail of the diff if it
// exceeds cap -> head+tail of the file (no baseline / git error / empty diff) -> the fallback
// is STRICTLY BETTER than the current head-only cut, so even if the diff path ever errs the
// change cannot regress below today's behavior.
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'orchestrate.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('relevantArtifactSlice')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

// ---- edit 1: the helper, inserted immediately before defaultVerdictPhase ----
const anchor1 = 'export async function defaultVerdictPhase(mission, cwd, steps, opts = {}) {';
const helper = [
  '// RELEVANCE-EXTRACTED ARTIFACT SLICE (gap-panel-truncation-false-reject, QUEUE ITEM 15):',
  '// head-only truncation fed the panel the first ARTIFACT_CAP chars of a file, so a large',
  '// artifact (receipt: a 398,166-char map.html sliced to 10,000) was judged on ~2.5% of its',
  '// content and wrongly REJECTed. Phase-2 commits each step BEFORE Phase-3 verdict runs, so',
  '// the RELEVANT content for a code-repo mission is the diff the mission itself made vs the',
  '// pre-mission baseline HEAD -- not the file head. Prefer that diff; fall back to head+tail',
  '// (opening AND closing structure visible, unlike head-only); fall back again to the file',
  "// head+tail on any git error or missing baseline. gitFn injectable for offline selftests.",
  'export function relevantArtifactSlice(cwd, f, full, cap, baselineHead, gitFn) {',
  '  const headTail = (s, kind) => {',
  '    if (s.length <= cap) return { text: s, mode: kind === \'diff\' ? \'diff\' : \'full\' };',
  '    const head = Math.floor(cap * 0.6), tail = cap - head;',
  '    const note = kind === \'diff\' ? `diff ${s.length - cap} chars omitted` : `${s.length - cap} chars omitted — file on disk is complete`;',
  '    return { text: `${s.slice(0, head)}\\n…[${note}]…\\n${s.slice(-tail)}`, mode: kind === \'diff\' ? \'diff-head+tail\' : \'head+tail\' };',
  '  };',
  '  if (!baselineHead) return headTail(full, \'file\');',
  '  try {',
  '    const run = gitFn || ((args) => execSync(`git -C "${cwd}" ${args}`, { stdio: [\'ignore\', \'pipe\', \'ignore\'], maxBuffer: 16 * 1024 * 1024 }).toString());',
  '    const diff = String(run(`diff ${baselineHead}..HEAD -- "${f}"`) || \'\');',
  '    if (diff.trim()) return headTail(diff, \'diff\');   // the mission changed this file -> show the change',
  '    return headTail(full, \'file\');                    // unchanged by this mission (e.g. a read-only context file)',
  '  } catch {',
  '    return headTail(full, \'file\');                    // git error -> never worse than head-only',
  '  }',
  '}',
  '',
  anchor1,
].join('\n');
if (t.split(anchor1).length - 1 !== 1) { console.error('NOT-UNIQUE: anchor1 (defaultVerdictPhase decl)'); process.exit(1); }
t = t.replace(anchor1, helper);

// ---- edit 2: read baselineHead from opts, inside defaultVerdictPhase ----
const anchor2 = '  const files = artifactFilesFor(steps, cwd);\n  let total = 0, omitted = 0;';
const anchor2New = '  const baselineHead = opts.baselineHead || null;\n  const files = artifactFilesFor(steps, cwd);\n  let total = 0, omitted = 0;';
if (t.split(anchor2).length - 1 !== 1) { console.error('NOT-UNIQUE: anchor2 (files/total init)'); process.exit(1); }
t = t.replace(anchor2, anchor2New);

// ---- edit 3: the artifacts.map body ----
const oldBody = [
  '  const artifacts = files.map((f) => {',
  '    const full = readMaybe(cwd, f);',
  '    const body = full.slice(0, ARTIFACT_CAP);',
  '    total += body.length;',
  '    if (total > ARTIFACT_TOTAL_CAP) { omitted++; return `--- ARTIFACT ${f} (omitted: total cap) ---`; }',
  '    // SLICE MARKER (card-merge 10:57 receipt: a complete 16,954-byte artifact was',
  '    // silently sliced at the cap; the panel saw a mid-word cut and honestly flagged',
  '    // "Content Truncation at Arafat" — the contract must own its own truncation).',
  '    const sliceNote = full.length > body.length',
  "      ? ` (CONTRACT SLICE: first ${body.length} of ${full.length} chars — the FILE ON DISK IS COMPLETE and passed its validation command; the cut below is the contract's, NOT the artifact's; never flag truncation at or beyond it)`",
  "      : '';",
  '    return `--- ARTIFACT ${f}${sliceNote} ---\\n${body}\\n--- END ${f} ---`;',
  "  }).join('\\n\\n');",
].join('\n');
const newBody = [
  '  const artifacts = files.map((f) => {',
  '    const full = readMaybe(cwd, f);',
  '    // RELEVANCE-EXTRACTED SLICE (gap-panel-truncation-false-reject, QUEUE ITEM 15): prefer the',
  '    // diff THIS mission made vs the pre-mission baseline over the file head — head-only slicing',
  '    // judged a 398,166-char map.html on its first 10,000 chars and wrongly REJECTed. Fail-soft.',
  '    const sliced = relevantArtifactSlice(cwd, f, full, ARTIFACT_CAP, baselineHead);',
  '    const body = sliced.text;',
  '    total += body.length;',
  '    if (total > ARTIFACT_TOTAL_CAP) { omitted++; return `--- ARTIFACT ${f} (omitted: total cap) ---`; }',
  '    const sliceNote =',
  "      sliced.mode === 'diff' ? ` (RELEVANCE SLICE — the ${body.length}-char DIFF this mission made to ${f} vs baseline ${String(baselineHead).slice(0, 8)}; the FILE ON DISK IS COMPLETE and passed its validation command; judge the CHANGE, never flag file-level truncation)`",
  "      : sliced.mode === 'diff-head+tail' ? ` (RELEVANCE SLICE, head+tail — this mission's diff to ${f} exceeded ${ARTIFACT_CAP} chars; opening and closing of the diff shown, middle omitted; the file on disk is complete)`",
  "      : sliced.mode === 'head+tail' ? ` (CONTRACT SLICE, head+tail — first and last of ${full.length} chars; the FILE ON DISK IS COMPLETE and passed its validation command; the cut is the contract's, NOT the artifact's; never flag truncation)`",
  "      : '';",
  '    return `--- ARTIFACT ${f}${sliceNote} ---\\n${body}\\n--- END ${f} ---`;',
  "  }).join('\\n\\n');",
].join('\n');
if (t.split(oldBody).length - 1 !== 1) { console.error('NOT-UNIQUE: oldBody (artifacts.map)'); process.exit(1); }
t = t.replace(oldBody, newBody);

// ---- edit 4: thread baselineHead into the verdict call site ----
const anchor4 = 'verdict = await verdictFn(mission, writeRoot, steps);';
const anchor4New = 'verdict = await verdictFn(mission, writeRoot, steps, { baselineHead });';
if (t.split(anchor4).length - 1 !== 1) { console.error('NOT-UNIQUE: anchor4 (verdict call site)'); process.exit(1); }
t = t.replace(anchor4, anchor4New);

// ---- edit 5: selftest coverage ----
const anchor5 = "  ck(hasConflictMarkers('') === false && hasConflictMarkers(null) === false, 'CONFLICT-GATE: empty/null -> false (never throws)');";
const tests = [
  anchor5,
  '',
  '  // RELEVANCE-EXTRACTED ARTIFACT SLICE (gap-panel-truncation-false-reject, QUEUE ITEM 15)',
  '  {',
  '    const bigFile = "x".repeat(50000);   // far over ARTIFACT_CAP (10000)',
  '    const fakeDiff = "diff --git a/f.mjs b/f.mjs\\n@@ -1,3 +1,4 @@\\n+the one line this mission changed\\n context\\n";',
  '    const gitDiff = () => fakeDiff;',
  '    const rDiff = relevantArtifactSlice("/r", "f.mjs", bigFile, 10000, "abc1234", gitDiff);',
  "    ck(rDiff.mode === 'diff' && rDiff.text === fakeDiff, 'relevance-slice: a mission that CHANGED the file -> the panel sees the DIFF, not the 50k-char file head');",
  '    const gitEmpty = () => "";',
  '    const rUnchanged = relevantArtifactSlice("/r", "f.mjs", bigFile, 10000, "abc1234", gitEmpty);',
  "    ck(rUnchanged.mode === 'head+tail' && rUnchanged.text.includes('chars omitted') && rUnchanged.text.startsWith('xxxx'), 'relevance-slice: a file the mission did NOT change (empty diff) -> head+tail of the file, both ends visible');",
  '    const rNoBaseline = relevantArtifactSlice("/r", "f.mjs", bigFile, 10000, null, gitDiff);',
  "    ck(rNoBaseline.mode === 'head+tail', 'relevance-slice: NO baseline -> head+tail fallback (never calls git)');",
  '    const gitThrow = () => { throw new Error("git boom"); };',
  '    const rErr = relevantArtifactSlice("/r", "f.mjs", bigFile, 10000, "abc1234", gitThrow);',
  "    ck(rErr.mode === 'head+tail' && rErr.text.length < bigFile.length, 'relevance-slice: git ERROR -> head+tail fallback, never throws, never worse than head-only');",
  '    const small = "tiny complete file";',
  '    const rSmall = relevantArtifactSlice("/r", "f.mjs", small, 10000, null, gitDiff);',
  "    ck(rSmall.mode === 'full' && rSmall.text === small, 'relevance-slice: a file under cap is shown in full (no slicing)');",
  '    const hugeDiff = "d".repeat(50000);',
  '    const rHugeDiff = relevantArtifactSlice("/r", "f.mjs", bigFile, 10000, "abc1234", () => hugeDiff);',
  "    ck(rHugeDiff.mode === 'diff-head+tail' && rHugeDiff.text.includes('diff') && rHugeDiff.text.length < hugeDiff.length, 'relevance-slice: a diff OVER cap -> head+tail of the DIFF (still the change, not the file head)');",
  '  }',
].join('\n');
if (t.split(anchor5).length - 1 !== 1) { console.error('NOT-UNIQUE: anchor5 (selftest insertion)'); process.exit(1); }
t = t.replace(anchor5, tests);

writeFileSync(path, t);
console.log('PATCHED');
