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
//
// No I/O. No async. No mutation of inputs.

// Matches assertion / test-declaration lines whose removal weakens verification.
const ASSERTION_RE = /\b(assert|expect|test\(|it\(|describe\()/;

// Matches a test-file path: .test. / .spec. infixes, __tests__ dir, or a /test/ segment.
const TEST_FILE_RE = /(\.test\.|\.spec\.|__tests__|[\\/]test[\\/]|^test[\\/])/i;

// Matches an explicit test/spec INTENT mention (in a description or a target string).
const TEST_INTENT_RE = /\b(test|spec|tests|specs)\b|test|spec/i;

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

  console.log(
    failures === 0
      ? 'RESULT: ALL TESTS PASSED'
      : `RESULT: ${failures} ASSERTION(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}
