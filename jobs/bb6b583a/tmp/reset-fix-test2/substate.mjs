// substate.mjs — Muezzin per-mission sub-states (Fajr/Isha boundary discipline).
//
// The problem: one monolithic STATE.md bloats context with cross-mission history
// (13.4K tokens). The fix mirrors the prayer cycle's boundary acts —
//   Fajr (bootstrap):  load ONLY the one mission you're about to work (fajrLoad),
//                      not the whole registry. Small context in.
//   Isha  (merge-up):  at session close the Muezzin reads every sub-state and
//                      compresses each mission down to a thin pointer + status
//                      (mergeAtIsha), so the up-merged registry stays thin.
//
// Each mission keeps its full working state in its OWN file (substate-<id>.json),
// written atomically with the same temp -> re-read round-trip -> rename pattern
// keystone_flow.mjs uses, so a crash mid-write never leaves a torn record
// (Directive 1: the file on disk is the truth, and it is never half-true).

import { writeFileSync, readFileSync, renameSync, existsSync, unlinkSync, readdirSync, mkdirSync, rmdirSync } from 'fs';
import path from 'path';
import os from 'os';

const PREFIX = 'substate-';
const SUFFIX = '.json';

// The on-disk path for a mission's sub-state. Centralized so reader and writer agree.
function subStatePath(missionId, dir) {
  return path.join(dir, `${PREFIX}${missionId}${SUFFIX}`);
}

// Atomic write (mirrors keystone_flow.atomicWriteState): temp -> re-read round-trip
// integrity check -> rename. The rename is the atomic commit; readers never see a
// partial file. No '.prev' backup here — a sub-state is per-mission working scratch
// that the Isha merge already compresses upward, so the registry is its durable copy.
function atomicWriteJson(p, obj) {
  const content = JSON.stringify(obj, null, 2);
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, content, 'utf8');
  if (readFileSync(tmp, 'utf8') !== content) { unlinkSync(tmp); throw new Error('round-trip integrity FAILED'); }
  renameSync(tmp, p);
  return p;
}

// writeSubState — persist one mission's full state to its own file, atomically.
// Returns the path written (so a caller can record the pointer).
export function writeSubState(missionId, stateObj, dir) {
  if (!missionId) throw new Error('writeSubState: missionId required');
  if (stateObj == null || typeof stateObj !== 'object') throw new Error('writeSubState: stateObj must be an object');
  return atomicWriteJson(subStatePath(missionId, dir), stateObj);
}

// readSubState — the full stored stateObj for one mission, or null if absent.
// Returns null (not throw) on a missing file so a caller can branch on "no prior".
export function readSubState(missionId, dir) {
  const p = subStatePath(missionId, dir);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

// fajrLoad — the Fajr bootstrap: load ONLY the requested mission's sub-state,
// never the whole registry. This is the context-thinning half of the design —
// you orient on one mission, not on every mission's accumulated history.
// Missing mission -> null (an honest "nothing committed for this mission yet").
export function fajrLoad(missionId, dir) {
  return readSubState(missionId, dir);
}

// mergeAtIsha — the Isha merge-up: read every substate-*.json in the dir and
// compress each mission down to a thin registry pointer { id, status, confidence,
// sub_state_path }. The full state stays in the sub-state file; the registry only
// carries the pointer + status, so the up-merged record stays small regardless of
// how much working history each mission accumulated. Returns the registry array.
export function mergeAtIsha(dir) {
  let names = [];
  try { names = readdirSync(dir); } catch { return []; } // no dir / unreadable -> empty registry
  const registry = [];
  for (const name of names) {
    if (!name.startsWith(PREFIX) || !name.endsWith(SUFFIX)) continue;
    const id = name.slice(PREFIX.length, name.length - SUFFIX.length);
    const p = path.join(dir, name);
    let st;
    try { st = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; } // skip torn/unparseable file, don't poison the merge
    registry.push({
      id: st.id != null ? st.id : id,          // prefer in-file id; fall back to the filename's id
      status: st.status != null ? st.status : null,
      confidence: st.confidence != null ? st.confidence : null,
      sub_state_path: p,                         // the pointer back to the full state
    });
  }
  registry.sort((a, b) => String(a.id).localeCompare(String(b.id))); // deterministic order
  return registry;
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('substate.mjs')) {
  const dir = path.join(os.tmpdir(), `_muezzin_substate_test_${process.pid}`);
  mkdirSync(dir, { recursive: true });

  let fails = 0;
  const ck = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

  // Write 2 sub-states with DIFFERENT statuses.
  writeSubState('M01', { id: 'M01', status: 'PHASE_2', confidence: 0.8, notes: 'big working history A'.repeat(50) }, dir);
  writeSubState('M02', { id: 'M02', status: 'COMPLETE', confidence: 0.95, notes: 'big working history B'.repeat(50) }, dir);

  ck(existsSync(path.join(dir, 'substate-M01.json')), 'sub-state file written for M01');
  ck(existsSync(path.join(dir, 'substate-M02.json')), 'sub-state file written for M02');

  // readSubState round-trips the full object.
  const back = readSubState('M01', dir);
  ck(back && back.status === 'PHASE_2' && back.confidence === 0.8, 'readSubState round-trips the full stored state for M01');

  // mergeAtIsha -> thin 2-entry registry with correct ids/statuses.
  const reg = mergeAtIsha(dir);
  ck(Array.isArray(reg) && reg.length === 2, 'mergeAtIsha returns a 2-entry registry');
  const byId = Object.fromEntries(reg.map((e) => [e.id, e]));
  ck(byId.M01 && byId.M01.status === 'PHASE_2' && byId.M01.confidence === 0.8, 'registry entry M01 has correct id/status/confidence');
  ck(byId.M02 && byId.M02.status === 'COMPLETE' && byId.M02.confidence === 0.95, 'registry entry M02 has correct id/status/confidence');
  // Thin = pointer + status only, NOT the full state (no carried 'notes' history).
  const onlyThinKeys = reg.every((e) => Object.keys(e).sort().join(',') === 'confidence,id,status,sub_state_path');
  ck(onlyThinKeys, 'registry entries are THIN (id/status/confidence/sub_state_path only — no carried history)');
  ck(byId.M01.sub_state_path === path.join(dir, 'substate-M01.json'), 'registry pointer points back to the full sub-state file');

  // fajrLoad returns ONLY the requested mission.
  const fajr = fajrLoad('M02', dir);
  ck(fajr && fajr.id === 'M02' && fajr.status === 'COMPLETE', 'fajrLoad returns ONLY the requested mission (M02)');

  // Missing mission -> null (both readSubState and fajrLoad).
  ck(readSubState('M99', dir) === null, 'readSubState of a missing mission -> null');
  ck(fajrLoad('M99', dir) === null, 'fajrLoad of a missing mission -> null');

  // Cleanup.
  try {
    for (const n of readdirSync(dir)) unlinkSync(path.join(dir, n));
    rmdirSync(dir);
  } catch { }

  console.log(`\n${fails === 0 ? 'ALL PASS — per-mission sub-states: atomic write, Fajr single-mission load, Isha thin merge-up' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
