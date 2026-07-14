// conductor_driftlog.mjs — the rijāl-of-the-conductor (self-catch-and-learn for the Opus conductor).
//
// Principle (LESSONS_FROM_THIS_SESSION.md): the CONDUCTOR is not exempt from the gates. A frontier
// conductor running on willpower is as untrustworthy as an open-weight seat. Every observed
// conductor-miss becomes a PERMANENT recorded failure class, each mapped to the structural gate that
// catches it. This is the video-editor's self-catch-and-learn discipline applied to the conductor:
// a miss is never patched silently — it lands in an append-only registry beside its gate.
//
// The log is APPEND-ONLY by contract (Directive 6: edit cleanly, never mutate-delete a record).
// recordDrift returns a NEW log array; it never mutates the one passed in, and never drops entries.
//
// Exports:
//   DRIFT_GATES                                  -> frozen mapping { driftClass: gate }
//   recordDrift(log, driftClass, { date, evidence }) -> new log with the entry appended
//   getGate(driftClass)                          -> gate string, or 'unmapped'

import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * The known conductor failure classes, each mapped to the structural gate that catches it.
 * Drawn directly from LESSONS_FROM_THIS_SESSION.md — the failures the Opus conductor exhibited
 * live, and the mechanisms (the muezzin's own gates) that corrected each.
 */
export const DRIFT_GATES = Object.freeze({
  // stop + wait to be prodded, repeatedly -> the live, tracked mission board + never-quiet heartbeat.
  SLEEP: 'board + heartbeat',
  // model/roster picks from memory + benchmarks, repeatedly wrong -> required source-read before deciding.
  MEMORY_ASSERTION: 'wudu (source-read gate)',
  // "I'm on it" then stopped -> a stated next-action must be backed by an actual tool-use.
  CLAIMS_NOT_DEEDS: 'narration-gate (stop-validation)',
  // super<->ultra, qwen<->minimax flip-flop / rijal side-road -> ground in tested reality, board keeps focus.
  DRIFT: 'board focus + tested-reality',
  // the human caught every drift -> structural chain gates keep the human's time qualified.
  OPERATOR_AS_GATE: 'structural chain gates',
});

const UNMAPPED = 'unmapped';

/**
 * The gate that catches a given drift class, or 'unmapped' for an unknown class.
 * @param {string} driftClass
 * @returns {string}
 */
export function getGate(driftClass) {
  // Own-property guard: never resolve inherited Object.prototype keys (e.g. 'toString') to a gate.
  return Object.prototype.hasOwnProperty.call(DRIFT_GATES, driftClass)
    ? DRIFT_GATES[driftClass]
    : UNMAPPED;
}

/**
 * Append a conductor-miss to the drift-log. APPEND-ONLY: returns a NEW array with the entry added;
 * the input log is never mutated and no prior entry is ever changed or dropped.
 * @param {Array<object>} log              the existing drift-log (any array; defaults to [])
 * @param {string} driftClass              a key of DRIFT_GATES, or an unknown class (-> 'unmapped')
 * @param {{date?: string, evidence?: string}} [meta]
 * @returns {Array<object>}                a new log with { driftClass, date, evidence, gate } appended
 */
export function recordDrift(log, driftClass, { date, evidence } = {}) {
  const prior = Array.isArray(log) ? log : [];
  const entry = {
    driftClass,
    date: date ?? null,
    evidence: evidence ?? null,
    gate: getGate(driftClass),
  };
  // New array — original is left untouched (append-only, never mutate-delete).
  return [...prior, entry];
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let fails = 0;
  const ck = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

  // 1. recordDrift appends an entry with the correct gate.
  const log0 = [];
  const log1 = recordDrift(log0, 'SLEEP', { date: '2026-06-09', evidence: 'stopped, waited to be prodded' });
  ck(log1.length === 1, 'recordDrift appended one entry');
  ck(log1[0].driftClass === 'SLEEP', 'entry carries the drift class');
  ck(log1[0].gate === 'board + heartbeat', 'entry carries the correct gate for SLEEP');
  ck(log1[0].date === '2026-06-09' && log1[0].evidence === 'stopped, waited to be prodded',
     'entry carries the supplied date + evidence');

  // 2. All 5 known classes resolve to a non-'unmapped' gate.
  const known = ['SLEEP', 'MEMORY_ASSERTION', 'CLAIMS_NOT_DEEDS', 'DRIFT', 'OPERATOR_AS_GATE'];
  for (const c of known) {
    const g = getGate(c);
    ck(g !== 'unmapped' && typeof g === 'string' && g.length > 0, `known class ${c} -> non-unmapped gate (${g})`);
  }
  ck(Object.keys(DRIFT_GATES).length === 5, 'DRIFT_GATES holds exactly the 5 known classes');

  // 3. An unknown class -> 'unmapped' (both getGate and the recorded entry).
  ck(getGate('TOTALLY_UNKNOWN') === 'unmapped', "getGate('TOTALLY_UNKNOWN') -> 'unmapped'");
  const logU = recordDrift(log1, 'TOTALLY_UNKNOWN', { date: '2026-06-09', evidence: 'novel miss' });
  ck(logU[logU.length - 1].gate === 'unmapped', 'unknown class recorded with gate=unmapped');
  // Inherited prototype keys must not masquerade as known classes.
  ck(getGate('toString') === 'unmapped', "inherited key 'toString' -> 'unmapped' (own-property guard)");

  // 4. Append-only: length grows, prior entries unchanged, input not mutated.
  ck(logU.length === log1.length + 1, 'log grows by one on each record (length grows)');
  ck(log0.length === 0, 'original empty log was not mutated');
  ck(log1.length === 1, 'intermediate log was not mutated by a later record');
  // The first entry must be byte-for-byte the same object content after later appends.
  const firstSnapshot = JSON.stringify({
    driftClass: 'SLEEP', date: '2026-06-09', evidence: 'stopped, waited to be prodded', gate: 'board + heartbeat',
  });
  ck(JSON.stringify(logU[0]) === firstSnapshot, 'prior entry [0] is unchanged after subsequent appends');
  ck(logU[0] === log1[0], 'prior entry object identity preserved (carried, not copied-and-mutated)');

  // 5. DRIFT_GATES is frozen (a record registry must not be silently re-pointed).
  ck(Object.isFrozen(DRIFT_GATES), 'DRIFT_GATES is frozen');

  console.log(`\n${fails === 0 ? 'ALL PASS — conductor drift-log sound (append-only, gates mapped)' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
