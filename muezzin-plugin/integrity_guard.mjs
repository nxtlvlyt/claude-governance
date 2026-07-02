// integrity_guard.mjs
// Pure, synchronous receipt-integrity check for the muezzin plugin.
//
// Closes the SOTA-found "receipt-gaming" seam (SpecBench / Reward-Hacking-Benchmark):
// a green receipt must not have been MANUFACTURED by tampering with the verifier.
// Detected DETERMINISTICALLY — no model judgment — by comparing the edit's
// before/after content and the validation command against canonical rules.
//
// checkReceiptIntegrity(step, prevContent, newContent, command)
//   -> { ok: boolean, violations: string[] }
//
// Violation classes:
//   (1a) WEAKENED-VERIFICATION  — a non-write-test edit removes assertion lines
//   (1b) TEST-FILE-TAMPER       — a non-write-test step targets a test file
//   (2)  NON-CANONICAL-COMMAND  — the validation command is gamed to force a pass
//   (3)  EXPORT-REGRESSION      — an edit drops a previously-exported symbol (ANY step,
//                                 including write-test steps — see below)
//
// No I/O. No async. No mutation of inputs.
//
// EXPORT-REGRESSION (added 2026-06-30, live receipt): mission_lint.mjs was destroyed by a
// step whose description was "Edit mission_lint.mjs to add self-tests locking the hajj..." —
// isWriteTestStep's intent-regex matched "self-tests", exempting the WHOLE step from rule
// (1a)/(1b), even though the actual rewrite replaced the entire file (8 real exported rule
// functions: unstaged-evidence, jail-contradiction, ..., deploy-without-commit) with an
// unrelated stub. The step's own verify command (`grep 'ALL PASS'`) passed because the stub
// printed its own unrelated "ALL PASS". Rule (3) closes this deliberately WITHOUT being
// gated by isWriteTestStep: "this step legitimately adds tests" is never a license to
// silently delete unrelated exports a rewrite happened to drop. A step that GENUINELY means
// to remove an export should say so in its description or target a different file shape —
// this guard does not special-case that; it flags every export-name disappearance, always.

// Matches assertion / test-declaration lines whose removal weakens verification.
const ASSERTION_RE = /\b(assert|expect|test\(|it\(|describe\()/;

// Matches a test-file path: .test. / .spec. infixes, __tests__ dir, or a /test/ segment.
const TEST_FILE_RE = /(\.test\.|\.spec\.|__tests__|[\\/]test[\\/]|^test[\\/])/i;

// Matches an explicit test/spec INTENT mention (in a description or a target string).
const TEST_INTENT_RE = /\b(test|spec|tests|specs)\b|test|spec/i;

// Matches a top-level `export function NAME`, `export async function NAME`,
// `export class NAME`, or `export const/let/var NAME` declaration and captures NAME.
const EXPORT_RE = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)|^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;

// Matches a single-line `export { a, b as c, ... }` re-export list. Multi-line lists
// (the `{` and `}` on different lines) are NOT matched -- same line-based-not-AST
// tradeoff as EXPORT_RE; this codebase's own files use single-line lists exclusively.
const EXPORT_LIST_RE = /^\s*export\s*\{([^}]*)\}/;

/**
 * The set of top-level exported symbol names found in `text` — the PUBLIC name (the
 * alias in `export { a as b }`, not the local `a`). Line-based and intentionally simple
 * (no AST) — matches this module's existing style (assertion/test-file detection are also
 * plain regexes). 2026-06-30: the ornith9b self-witness flagged the original version of
 * this function (declaration-only, no `export { ... }` list support) as a real false-
 * negative risk — a rewrite could drop an export via the list form undetected. Fixed.
 * @param {string} text
 * @returns {Set<string>}
 */
function exportedSymbols(text) {
  const names = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(EXPORT_RE);
    if (m) names.add(m[1] || m[2]);
    const lm = raw.match(EXPORT_LIST_RE);
    if (lm) {
      for (const part of lm[1].split(',')) {
        const p = part.trim();
        if (!p) continue;
        const asMatch = p.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        names.add(asMatch ? asMatch[2] : p.split(/\s+/)[0]);
      }
    }
  }
  return names;
}

/**
 * Is this step explicitly a "write-test" step? Such a step is ALLOWED to author
 * or alter test files and assertions — that is its whole purpose.
 *
 * The signal is an explicit test/spec INTENT mention in the step's description
 * (or in target_files[0]). It is deliberately driven by the INTENT mention, NOT
 * by the target merely being a test-file PATH — otherwise rule (1b)
 * (a non-write-test step that targets a test file is tampering) would be
 * unreachable: every test-file target would self-exempt.
 *
 * @param {object} step
 * @returns {boolean}
 */
function isWriteTestStep(step) {
  const desc = typeof step?.description === 'string' ? step.description : '';
  return TEST_INTENT_RE.test(desc);
}

/**
 * @param {object} step          { step_index, description, action_type, target_files, ... }
 * @param {string} prevContent   target file's content BEFORE the edit ('' if new file)
 * @param {string} newContent    target file's content AFTER the edit
 * @param {string} command       the validation command that produced the receipt
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkReceiptIntegrity(step, prevContent, newContent, command) {
  const violations = [];

  const prev = typeof prevContent === 'string' ? prevContent : '';
  const next = typeof newContent === 'string' ? newContent : '';
  const cmd = typeof command === 'string' ? command : '';

  const writeTest = isWriteTestStep(step);

  // --- Rule (1): an edit must not WEAKEN verification (unless it is a write-test step) ---
  if (!writeTest) {
    // (1b) A non-write-test step whose target IS a test file is tampering by definition.
    const t0 = step?.target_files?.[0];
    const target = typeof t0 === 'string' ? t0 : '';
    if (target && TEST_FILE_RE.test(target)) {
      violations.push(
        `TEST-FILE-TAMPER: non-write-test step targets a test file: ${JSON.stringify(target)}`
      );
    }

    // (1a) Assertion lines present before but absent after = removed verification.
    // Multiset diff: count assertion lines on each side; any net removal is a violation.
    const removed = removedAssertionLines(prev, next);
    for (const line of removed) {
      violations.push(
        `WEAKENED-VERIFICATION: edit removes assertion line: ${JSON.stringify(line)}`
      );
    }
  }

  // --- Rule (3): an edit must not silently DROP a previously-exported symbol ---
  // Deliberately NOT gated by `writeTest` — see the EXPORT-REGRESSION header note above.
  // A brand-new file (empty prev) has nothing to lose, so this is a no-op for step 1 of a
  // fresh mission; it only fires once a file already has real exports to protect.
  if (prev.trim()) {
    const beforeExports = exportedSymbols(prev);
    const afterExports = exportedSymbols(next);
    for (const name of beforeExports) {
      if (!afterExports.has(name)) {
        violations.push(
          `EXPORT-REGRESSION: edit removes previously-exported symbol ${JSON.stringify(name)} — a rewrite must extend the file, never silently drop existing exports`
        );
      }
    }
  }

  // --- Rule (2): the validation command must be CANONICAL ---
  // Each pattern is a way to force a green receipt regardless of the real result.
  if (/--no-verify/.test(cmd)) {
    violations.push(`NON-CANONICAL-COMMAND: command bypasses verification with '--no-verify': ${JSON.stringify(cmd)}`);
  }
  if (/\|\|\s*true/.test(cmd)) {
    violations.push(`NON-CANONICAL-COMMAND: command swallows failure with '|| true': ${JSON.stringify(cmd)}`);
  }
  if (/;\s*exit\s+0/.test(cmd) || /exit\s+0\s*#/.test(cmd)) {
    violations.push(`NON-CANONICAL-COMMAND: command forces success with 'exit 0': ${JSON.stringify(cmd)}`);
  }
  if (/\brm\s+[^|&;]*\b(test|spec|__tests__)/i.test(cmd)) {
    violations.push(`NON-CANONICAL-COMMAND: command deletes tests with 'rm': ${JSON.stringify(cmd)}`);
  }
  if (/\.skip\(/.test(cmd)) {
    violations.push(`NON-CANONICAL-COMMAND: command injects '.skip(' to suppress tests: ${JSON.stringify(cmd)}`);
  }

  // --- Rule (4): an edit must not SILENTLY DELETE a large fraction of an existing file ---
  // (M-EDIT-CONTENT-PRESERVATION, 2026-07-02). Receipt: mt-integrate-email-redaction-docs step 3
  // — an [edit] "resolve conflicts KEEPING BOTH SIDES" step — produced a whole-file rewrite that
  // deleted 126 of 305 doc lines and committed it to `main`. The executor's whole-file edit path
  // (buildFraming, which does NOT embed the current file) lets the seat re-emit a shorter file,
  // silently dropping content. Rules 1/1b/3 only protect CODE (assertions, exports, test files);
  // a prose/docs file has none of those, so the gutting sailed through every existing guard. This
  // is the type-agnostic backstop: a large deletion on an edit step whose description never SAID it
  // meant to delete is refused (fail-closed) — a genuine prune just states delete/prune/remove/… in
  // the step description. Thresholds require a substantial file + large absolute drop + >35% gone,
  // so ordinary edits and appends never trip it.
  const isEdit = step?.action_type === 'edit';
  const desc = String(step?.description || '');
  // Affirmative delete-intent exempts the guard — BUT not when negated. The email-redaction
  // step said "resolve KEEPING BOTH SIDES, NEVER delete either side": that contains the word
  // "delete" yet intends the OPPOSITE, so a naive word-match would wrongly exempt the exact
  // gutting this rule exists to catch. Require a delete verb AND no preserve/negation signal.
  const hasDeleteVerb = /\b(delet|prun|remov|trim|shrink|truncat|strip|purg|slim|dedup|consolidat|shorten|condens|clean[\s-]*up|cut[\s-]*down|reduc)/i.test(desc);
  const hasPreserveNegation = /\b(never|not|n't|do not|keep both|both sides|preserve|retain|neither|without\s+(?:delet|remov))/i.test(desc);
  const deleteIntent = hasDeleteVerb && !hasPreserveNegation;
  if (isEdit && prev.trim() && !deleteIntent) {
    const nonEmpty = (t) => t.split(/\r?\n/).filter((l) => l.trim()).length;
    const prevLines = nonEmpty(prev);
    const nextLines = nonEmpty(next);
    const removed = prevLines - nextLines;
    if (prevLines >= 40 && removed >= 60 && nextLines <= prevLines * 0.65) {
      violations.push(
        `LARGE-DELETION: edit dropped ${removed} of ${prevLines} non-empty lines (${Math.round((removed / prevLines) * 100)}%) with no delete/prune/remove intent in the step description — refusing (likely a whole-file rewrite silently dropping existing content; state an explicit prune intent in the step if the deletion is genuinely intended)`
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Returns the assertion-bearing lines that exist in `prev` but were removed in `next`,
 * accounting for multiplicity (removing 1 of 2 identical asserts still counts as 1 removal).
 * @param {string} prev
 * @param {string} next
 * @returns {string[]}
 */
function removedAssertionLines(prev, next) {
  const tally = (text) => {
    const counts = new Map();
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (line && ASSERTION_RE.test(line)) {
        counts.set(line, (counts.get(line) || 0) + 1);
      }
    }
    return counts;
  };

  const before = tally(prev);
  const after = tally(next);
  const removed = [];
  for (const [line, n] of before) {
    const left = after.get(line) || 0;
    for (let i = 0; i < n - left; i++) removed.push(line);
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Self-test — runs only when executed directly (node integrity_guard.mjs).
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}

if (isMainModule()) {
  let failures = 0;
  const assert = (cond, label) => {
    const tag = cond ? 'PASS' : 'FAIL';
    if (!cond) failures++;
    console.log(`  [${tag}] ${label}`);
  };

  console.log('integrity_guard self-test');

  // --- Test 1: clean code edit + canonical command -> ok ---
  {
    const step = {
      step_index: 1,
      description: 'add cost calculation',
      action_type: 'edit',
      target_files: ['src/cost.mjs'],
    };
    const prev = 'export function cost(a){ return a; }\n';
    const next = 'export function cost(a, b){ return a + b; }\n';
    const r = checkReceiptIntegrity(step, prev, next, 'node -c src/cost.mjs');
    assert(r.ok === true, 'clean code edit + canonical command -> ok:true');
    assert(r.violations.length === 0, 'clean code edit -> zero violations');
  }

  // --- Test 2: edit DELETES an assertion (non-test step) -> violation ---
  {
    const step = {
      step_index: 2,
      description: 'refactor totals',
      action_type: 'edit',
      target_files: ['src/totals.mjs'],
    };
    const prev = [
      'function f(x){',
      '  assert(x > 0, "positive");',
      '  return x * 2;',
      '}',
    ].join('\n');
    const next = [
      'function f(x){',
      '  return x * 2;',
      '}',
    ].join('\n');
    const r = checkReceiptIntegrity(step, prev, next, 'node -c src/totals.mjs');
    const hit = r.violations.filter((v) => v.startsWith('WEAKENED-VERIFICATION:'));
    assert(r.ok === false, 'deleted assertion (non-test step) -> ok:false');
    assert(hit.length === 1, 'deleted assertion -> exactly one WEAKENED-VERIFICATION');
    assert(hit[0].includes('assert(x > 0'), 'WEAKENED-VERIFICATION names the removed line');
  }

  // --- Test 3: step targets a .test. file (non-write-test) -> violation ---
  {
    const step = {
      step_index: 3,
      description: 'tweak the helper',           // no test/spec signal in description
      action_type: 'edit',
      target_files: ['src/cost.test.mjs'],
    };
    const r = checkReceiptIntegrity(step, 'expect(1).toBe(1);\n', 'expect(1).toBe(1);\n', 'node src/cost.test.mjs');
    const hit = r.violations.filter((v) => v.startsWith('TEST-FILE-TAMPER:'));
    assert(r.ok === false, 'non-write-test step targeting .test. file -> ok:false');
    assert(hit.length === 1, '.test. target -> exactly one TEST-FILE-TAMPER');
  }

  // --- Test 4: command with '--no-verify' -> violation ---
  {
    const step = {
      step_index: 4,
      description: 'commit the change',
      action_type: 'command',
      target_files: ['src/cost.mjs'],
    };
    const r = checkReceiptIntegrity(step, 'x', 'x', 'git commit -m wip --no-verify');
    const hit = r.violations.filter((v) => v.startsWith('NON-CANONICAL-COMMAND:'));
    assert(r.ok === false, "command with '--no-verify' -> ok:false");
    assert(hit.length === 1, "'--no-verify' -> exactly one NON-CANONICAL-COMMAND");
  }

  // --- Test 5: legitimate write-test step editing a .test. file -> ok ---
  {
    const step = {
      step_index: 5,
      description: 'write the cost test',         // 'test' signals a write-test step
      action_type: 'edit',
      target_files: ['src/cost.test.mjs'],
    };
    // Even though the new content has FEWER assertions than prev, a write-test step is exempt.
    const prev = 'expect(a).toBe(1);\nexpect(b).toBe(2);\n';
    const next = 'expect(a).toBe(1);\n';
    const r = checkReceiptIntegrity(step, prev, next, 'node src/cost.test.mjs');
    assert(r.ok === true, 'legit write-test step editing .test. file -> ok:true');
    assert(r.violations.length === 0, 'write-test step -> zero violations');
  }

  // --- Test 6 (extra): canonical-command gaming variants are each caught ---
  {
    const step = { step_index: 6, description: 'run checks', action_type: 'command', target_files: ['a.mjs'] };
    const variants = [
      'node -c a.mjs || true',
      'node test.mjs ; exit 0',
      'rm -rf test/ && node a.mjs',
      'node a.mjs # then it.skip( something',
    ];
    let allCaught = true;
    for (const cmd of variants) {
      const r = checkReceiptIntegrity(step, 'x', 'x', cmd);
      if (r.ok !== false || !r.violations.some((v) => v.startsWith('NON-CANONICAL-COMMAND:'))) {
        allCaught = false;
        console.log(`    (uncaught gamed command: ${JSON.stringify(cmd)})`);
      }
    }
    assert(allCaught, 'each gamed command variant -> NON-CANONICAL-COMMAND');
  }

  // --- Test 7 (extra): a write-test step removing assertions in a NORMAL file is exempt ---
  {
    const step = { step_index: 7, description: 'author spec for parser', action_type: 'edit', target_files: ['parser.mjs'] };
    const prev = 'assert(true);\n';
    const next = 'const x = 1;\n';
    const r = checkReceiptIntegrity(step, prev, next, 'node parser.mjs');
    assert(r.ok === true, 'write-test step (by description) removing asserts -> exempt, ok:true');
  }

  // --- Test 8: EXPORT-REGRESSION (2026-06-30 live receipt) ---
  {
    // the EXACT failure shape: a step described as adding self-tests that ALSO wholesale-
    // replaces the file, dropping real exported rule functions. isWriteTestStep exempts it
    // from rule (1a)/(1b) — rule (3) must catch it anyway.
    const step = { step_index: 8, description: 'Edit mission_lint.mjs to add self-tests locking the hajj contract', action_type: 'edit', target_files: ['mission_lint.mjs'] };
    const prev = `import { parseMissionClass } from './mission_class.mjs';\nexport function lintMission(text) { /* 8 real rules */ return { ok: true, problems: [] }; }\nexport function unrelatedHelper() { return 1; }\n`;
    const next = `export function passesMiqat(child) { return child.render === 'Done'; }\nexport function lintMission(mission) { return true; }\n`;
    const r = checkReceiptIntegrity(step, prev, next, 'node mission_lint.mjs 2>&1 | Select-String -Pattern "ALL PASS" -Quiet');
    assert(r.ok === false, 'EXPORT-REGRESSION: the exact mission_lint.mjs failure shape is now BLOCKED (was silently exempt before this fix)');
    assert(r.violations.some((v) => v.includes('EXPORT-REGRESSION') && v.includes('unrelatedHelper')),
      'EXPORT-REGRESSION: names the specific dropped export (unrelatedHelper), not just a generic failure');
    // isWriteTestStep's exemption still holds for rule (1a) specifically -- this mission-text
    // does NOT also demand a WEAKENED-VERIFICATION violation; it demands EXPORT-REGRESSION.
    assert(!r.violations.some((v) => v.startsWith('WEAKENED-VERIFICATION:')),
      'EXPORT-REGRESSION: rule (1a) stays exempt for write-test steps as before -- only rule (3) is unconditional');
  }

  // --- Test 9: a LEGITIMATE edit that only ADDS an export never trips EXPORT-REGRESSION ---
  {
    const step = { step_index: 9, description: 'add a new rule', action_type: 'edit', target_files: ['mission_lint.mjs'] };
    const prev = `export function lintMission(text) { return { ok: true }; }\n`;
    const next = `export function lintMission(text) { return { ok: true }; }\nexport function newRule(text) { return true; }\n`;
    const r = checkReceiptIntegrity(step, prev, next, 'node mission_lint.mjs');
    assert(r.ok === true, 'EXPORT-REGRESSION: adding a NEW export alongside existing ones -> clean, no false positive');
  }

  // --- Test 10: a LEGITIMATE edit that only changes a function BODY (export kept) is clean ---
  {
    const step = { step_index: 10, description: 'fix a bug in lintMission', action_type: 'edit', target_files: ['mission_lint.mjs'] };
    const prev = `export function lintMission(text) { return { ok: false }; }\n`;
    const next = `export function lintMission(text) { return { ok: true }; }\n`;
    const r = checkReceiptIntegrity(step, prev, next, 'node mission_lint.mjs');
    assert(r.ok === true, 'EXPORT-REGRESSION: changing a function BODY while keeping its export name -> clean, no false positive');
  }

  // --- Test 11: EXPORT-REGRESSION via `export { ... }` re-export LIST syntax ---
  // (the exact gap the 2026-06-30 ornith9b self-witness flagged as a false-negative
  // risk in the original declaration-only exportedSymbols()).
  {
    const step = { step_index: 11, description: 'reorganize exports', action_type: 'edit', target_files: ['mission_lint.mjs'] };
    const prev = `function lintMission(text) { return true; }\nfunction unrelatedHelper() { return 1; }\nexport { lintMission, unrelatedHelper as helperAlias };\n`;
    const next = `function lintMission(text) { return true; }\nexport { lintMission };\n`;
    const r = checkReceiptIntegrity(step, prev, next, 'node mission_lint.mjs');
    assert(r.ok === false, 'EXPORT-REGRESSION: dropping a name from an `export { ... }` list is now caught');
    assert(r.violations.some((v) => v.includes('EXPORT-REGRESSION') && v.includes('helperAlias')),
      'EXPORT-REGRESSION: names the dropped ALIAS (helperAlias), the public export name, not the local name');
  }

  // --- Test 12: a LEGITIMATE `export { ... }` list edit that only ADDS a name is clean ---
  {
    const step = { step_index: 12, description: 'export a new helper', action_type: 'edit', target_files: ['mission_lint.mjs'] };
    const prev = `function a() {}\nexport { a };\n`;
    const next = `function a() {}\nfunction b() {}\nexport { a, b };\n`;
    const r = checkReceiptIntegrity(step, prev, next, 'node mission_lint.mjs');
    assert(r.ok === true, 'EXPORT-REGRESSION: adding a name to an `export { ... }` list -> clean, no false positive');
  }

  // --- Test 13: LARGE-DELETION (M-EDIT-CONTENT-PRESERVATION) — the email-redaction gutting shape ---
  {
    const step = { step_index: 13, description: 'resolve conflicts keeping BOTH sides, never delete either side', action_type: 'edit', target_files: ['docs/EMAIL-REDACTION-PATTERN.md'] };
    const prev = Array.from({ length: 305 }, (_, i) => `doc line ${i + 1} — real content`).join('\n');
    const next = Array.from({ length: 179 }, (_, i) => `doc line ${i + 1} — real content`).join('\n');
    const r = checkReceiptIntegrity(step, prev, next, 'node -c x');
    const hit = r.violations.filter((v) => v.startsWith('LARGE-DELETION:'));
    assert(r.ok === false, 'LARGE-DELETION: 305->179 edit with "never delete" description -> ok:false (the real gutting shape)');
    assert(hit.length === 1, 'LARGE-DELETION: exactly one violation for the gutting');
  }

  // --- Test 14: LARGE-DELETION exempted when the step EXPLICITLY states delete/prune intent ---
  {
    const step = { step_index: 14, description: 'prune the deprecated section from the guide', action_type: 'edit', target_files: ['docs/guide.md'] };
    const prev = Array.from({ length: 305 }, (_, i) => `line ${i + 1}`).join('\n');
    const next = Array.from({ length: 179 }, (_, i) => `line ${i + 1}`).join('\n');
    const r = checkReceiptIntegrity(step, prev, next, 'node -c x');
    assert(r.ok === true, 'LARGE-DELETION: same drop but "prune" in description -> clean (intended deletion allowed)');
  }

  // --- Test 15: ordinary edits and appends never trip LARGE-DELETION ---
  {
    const base = Array.from({ length: 120 }, (_, i) => `line ${i + 1}`).join('\n');
    const small = { step_index: 15, description: 'fix a typo', action_type: 'edit', target_files: ['a.md'] };
    const rSmall = checkReceiptIntegrity(small, base, base.replace('line 5', 'line five'), 'node -c x');
    assert(rSmall.ok === true, 'LARGE-DELETION: a small same-size edit -> clean');
    const append = { step_index: 15, description: 'add a section', action_type: 'edit', target_files: ['a.md'] };
    const rApp = checkReceiptIntegrity(append, base, base + '\n' + Array.from({ length: 40 }, (_, i) => `new ${i}`).join('\n'), 'node -c x');
    assert(rApp.ok === true, 'LARGE-DELETION: an append (grows the file) -> clean');
    // a tiny file dropping most of its lines is below the 40-line floor -> not flagged (avoids false-positives on stubs)
    const tiny = { step_index: 15, description: 'rewrite the stub', action_type: 'edit', target_files: ['a.md'] };
    const rTiny = checkReceiptIntegrity(tiny, Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n'), 'l0\n', 'node -c x');
    assert(rTiny.ok === true, 'LARGE-DELETION: a small file (<40 lines) is below the floor -> not flagged');
  }

  console.log(
    failures === 0
      ? 'RESULT: ALL TESTS PASSED'
      : `RESULT: ${failures} ASSERTION(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}
