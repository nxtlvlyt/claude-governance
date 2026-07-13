// substrate_guard.mjs
// Pure, synchronous substrate-integrity checks for the muezzin plugin.
//
// checkSubstrate({ citedPaths, missions, stateInternalDate, stateMtimeMs })
//   -> { ok: boolean, violations: string[] }
//
// Violation classes:
//   (1) MISSING-PATH        — a cited path does not exist on disk
//   (2) CONTRADICTORY-BOARD — two missions share an id but differ in status
//   (3) FUTURE-DATED-STATE  — STATE's internal date is later than its file mtime
//
// No I/O beyond fs.accessSync existence probes. No async. No mutation of inputs.

import fs from 'node:fs';

/**
 * @param {object}   args
 * @param {string[]} [args.citedPaths=[]]        Filesystem paths that must exist.
 * @param {object[]} [args.missions=[]]          Objects with { id, status }.
 * @param {number|null} [args.stateInternalDate] STATE's self-reported date (ms epoch).
 * @param {number|null} [args.stateMtimeMs]      STATE file's mtime (ms epoch).
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkSubstrate({
  citedPaths = [],
  missions = [],
  stateInternalDate = null,
  stateMtimeMs = null,
} = {}) {
  const violations = [];

  // (1) Every cited path must exist on disk.
  for (const p of citedPaths) {
    let exists = false;
    try {
      fs.accessSync(p);
      exists = true;
    } catch {
      exists = false;
    }
    if (!exists) {
      violations.push(`MISSING-PATH: cited path does not exist on disk: ${p}`);
    }
  }

  // (2) Two missions sharing an id but differing in status = contradictory board.
  const seen = new Map(); // id -> status
  for (const m of missions) {
    if (m == null || m.id === undefined || m.id === null) continue;
    if (seen.has(m.id)) {
      const prior = seen.get(m.id);
      if (prior !== m.status) {
        violations.push(
          `CONTRADICTORY-BOARD: mission id ${JSON.stringify(m.id)} has conflicting statuses ${JSON.stringify(prior)} vs ${JSON.stringify(m.status)}`
        );
      }
    } else {
      seen.set(m.id, m.status);
    }
  }

  // (3) STATE's internal date later than its file mtime = future-dated STATE.
  if (
    stateInternalDate !== null &&
    stateMtimeMs !== null &&
    typeof stateInternalDate === 'number' &&
    typeof stateMtimeMs === 'number' &&
    stateInternalDate > stateMtimeMs
  ) {
    violations.push(
      `FUTURE-DATED-STATE: STATE internal date (${stateInternalDate}) is later than file mtime (${stateMtimeMs})`
    );
  }

  return { ok: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Self-test — runs only when executed directly (node substrate_guard.mjs).
// ---------------------------------------------------------------------------
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
  const thisPath = fileURLToPath(import.meta.url);
  const fakePath = thisPath + '.DOES_NOT_EXIST_' + Date.now();

  let failures = 0;
  const assert = (cond, label) => {
    const tag = cond ? 'PASS' : 'FAIL';
    if (!cond) failures++;
    console.log(`  [${tag}] ${label}`);
  };

  console.log('substrate_guard self-test');

  // --- Test 1: clean input returns ok:true, no violations ---
  {
    const r = checkSubstrate({
      citedPaths: [thisPath],          // this file exists
      missions: [
        { id: 'A', status: 'open' },
        { id: 'B', status: 'done' },
        { id: 'A', status: 'open' },   // duplicate id, SAME status — allowed
      ],
      stateInternalDate: 1000,
      stateMtimeMs: 2000,              // internal <= mtime — fine
    });
    assert(r.ok === true, 'clean input -> ok:true');
    assert(r.violations.length === 0, 'clean input -> zero violations');
  }

  // --- Test 2: missing cited path is caught ---
  {
    const r = checkSubstrate({ citedPaths: [thisPath, fakePath] });
    const hit = r.violations.filter((v) => v.startsWith('MISSING-PATH:'));
    assert(r.ok === false, 'missing path -> ok:false');
    assert(hit.length === 1, 'missing path -> exactly one MISSING-PATH violation');
    assert(hit[0].includes(fakePath), 'MISSING-PATH names the offending path');
  }

  // --- Test 3: existing path produces no MISSING-PATH ---
  {
    const r = checkSubstrate({ citedPaths: [thisPath] });
    const hit = r.violations.filter((v) => v.startsWith('MISSING-PATH:'));
    assert(hit.length === 0, 'existing path (this file) -> no MISSING-PATH');
  }

  // --- Test 4: contradictory mission pair is caught ---
  {
    const r = checkSubstrate({
      missions: [
        { id: 'X', status: 'open' },
        { id: 'X', status: 'done' },   // same id, different status
      ],
    });
    const hit = r.violations.filter((v) => v.startsWith('CONTRADICTORY-BOARD:'));
    assert(r.ok === false, 'contradictory missions -> ok:false');
    assert(hit.length === 1, 'contradictory missions -> exactly one CONTRADICTORY-BOARD violation');
    assert(hit[0].includes('"X"'), 'CONTRADICTORY-BOARD names the offending id');
  }

  // --- Test 5: future-dated STATE is caught ---
  {
    const r = checkSubstrate({
      stateInternalDate: 5000,
      stateMtimeMs: 4000,              // internal > mtime
    });
    const hit = r.violations.filter((v) => v.startsWith('FUTURE-DATED-STATE:'));
    assert(r.ok === false, 'future-dated STATE -> ok:false');
    assert(hit.length === 1, 'future-dated STATE -> exactly one FUTURE-DATED-STATE violation');
  }

  // --- Test 6: equal internal date and mtime is NOT future-dated ---
  {
    const r = checkSubstrate({ stateInternalDate: 4000, stateMtimeMs: 4000 });
    const hit = r.violations.filter((v) => v.startsWith('FUTURE-DATED-STATE:'));
    assert(hit.length === 0, 'internal == mtime -> no FUTURE-DATED-STATE');
  }

  // --- Test 7: all three violation classes together ---
  {
    const r = checkSubstrate({
      citedPaths: [fakePath],
      missions: [
        { id: 'Z', status: 'open' },
        { id: 'Z', status: 'blocked' },
      ],
      stateInternalDate: 9000,
      stateMtimeMs: 1,
    });
    assert(r.ok === false, 'combined -> ok:false');
    assert(r.violations.length === 3, 'combined -> exactly three violations');
  }

  console.log(
    failures === 0
      ? 'RESULT: ALL TESTS PASSED'
      : `RESULT: ${failures} ASSERTION(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}
