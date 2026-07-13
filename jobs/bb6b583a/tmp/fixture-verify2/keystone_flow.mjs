// keystone_flow.mjs — end-to-end Muezzin keystone (agy M31 orchestrator integration, minus dispatch).
// seat JSON verdicts -> deterministic gate (merge) -> verify facts on disk -> render -> atomic write.
// No LLM writes the record; the gate is computed, not judged; paths are verified, not claimed.

import { mergeVerdicts } from './verdict_merge.mjs';
import { renderStateMd } from './render_state.mjs';
import { checkSubstrate } from './substrate_guard.mjs';
import { writeFileSync, readFileSync, renameSync, existsSync, accessSync, constants, unlinkSync } from 'fs';
import crypto from 'crypto';
import os from 'os';
import path from 'path';

// agy M31 atomic write: temp -> re-read round-trip check -> backup -> rename. Returns the content hash.
function atomicWriteState(p, content) {
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, content, 'utf8');
  if (readFileSync(tmp, 'utf8') !== content) { unlinkSync(tmp); throw new Error('round-trip integrity FAILED'); }
  if (existsSync(p)) writeFileSync(`${p}.prev`, readFileSync(p, 'utf8'), 'utf8'); // backup
  renameSync(tmp, p);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function runPhaseCompaction(seatVerdicts, missionData, statePath, prevHash = 'GENESIS') {
  const merged = mergeVerdicts(seatVerdicts);                  // deterministic gate
  // substrate-primacy pre-gate (#24): a verdict citing a missing path or a contradictory board is not trusted.
  const guard = checkSubstrate({ citedPaths: missionData.handoff_paths || [], missions: missionData.missions || [] });
  let consensus = merged.consensus, escalate = merged.escalate;
  if (!guard.ok) { escalate = true; if (consensus === 'APPROVE') consensus = 'BLOCK'; } // can't APPROVE on a broken substrate
  const handoff = (missionData.handoff_paths || []).map((fp) => { // verify each path on disk
    let exists = false; try { accessSync(fp, constants.R_OK); exists = true; } catch { }
    return { path: fp, exists };
  });
  const state = { ...missionData, handoff_paths: handoff, verdict: consensus, prev_hash: prevHash };
  const prevStateMd = existsSync(statePath) ? readFileSync(statePath, 'utf8') : null; // D8: carry forward prior agent-authored sections
  const md = renderStateMd(state, prevStateMd);
  const hash = atomicWriteState(statePath, md);
  return { verdict: consensus, escalate, state_hash: hash, carried: merged.carried_concerns, substrate_violations: guard.violations };
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('keystone_flow.mjs')) {
  const sp = path.join(os.tmpdir(), '_muezzin_state_test.md');
  const realFile = process.argv[1];                            // this script exists on disk
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  const r = runPhaseCompaction(
    [{ seat: 'laguna', verdict: 'APPROVE', findings: [] }, { seat: 'granite', verdict: 'BLOCK', findings: [{ id: 'F1' }] }],
    { timestamp: '2026-06-10', missions: [{ id: 'M99', status: 'PHASE_3', confidence: 0.9 }], concerns: [], rulings: [], handoff_paths: [realFile, sp + '-missing'] },
    sp, 'GENESIS');

  ck(r.verdict === 'BLOCK' && r.escalate, 'gate computed BLOCK + escalate from seat JSON (not from prose)');
  ck(existsSync(sp), 'STATE.md written atomically');
  const w = readFileSync(sp, 'utf8');
  ck(w.includes('verdict: BLOCK'), 'written record reflects the deterministic verdict');
  ck(w.includes('✗ MISSING') && w.includes('✓ ' + realFile), 'paths verified against disk (one real, one missing) — Directive 1');
  ck(/^[a-f0-9]{64}$/.test(r.state_hash), 'state content hashed for the prev-hash chain');

  // #24 substrate-primacy: a WITNESSED APPROVE that cites a MISSING path is still downgraded to BLOCK.
  const sp2 = sp + '2';
  const r2 = runPhaseCompaction(
    [{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: [{ ok: true }] }],
    { timestamp: '2026-06-10', missions: [{ id: 'M1', status: 'X', confidence: 1 }], concerns: [], rulings: [], handoff_paths: [sp + '-ghost-does-not-exist'] },
    sp2, 'GENESIS');
  ck(r2.verdict === 'BLOCK' && (r2.substrate_violations || []).length > 0, 'substrate-primacy: witnessed APPROVE citing a MISSING path -> BLOCK (#24)');

  try { unlinkSync(sp); } catch { } try { unlinkSync(sp + '.prev'); } catch { }
  try { unlinkSync(sp2); } catch { } try { unlinkSync(sp2 + '.prev'); } catch { }
  console.log(`\n${fails === 0 ? 'ALL PASS — keystone runs end-to-end: seat JSON -> deterministic gate -> disk-verified, hashed, atomic STATE.md' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
