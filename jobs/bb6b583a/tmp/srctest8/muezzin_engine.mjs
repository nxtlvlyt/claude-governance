// muezzin_engine.mjs — the 3-phase engine's core: run a PANEL of seats through a phase, deterministically.
//
// Extends the proven single-seat spine to a MULTI-SEAT panel — the structural answer to "one seat's verdict
// is noisy" (the REJECT->APPROVE flip). Dispatch all seats in PARALLEL: cloud is GPU-free and parallel-safe,
// so this is EXEMPT from the local serial-inference gate. Collect JSON verdicts -> tested merge -> gate ->
// STATE.md. Zero Opus tokens spent here: it is pure code + free cloud seats (criterion 11 in action).

import { dispatchSeat } from './seat_dispatch.mjs';
import { runPhaseCompaction } from './keystone_flow.mjs';
import { registry, selectSeatByChannel } from './model_rijal.mjs';

// run one phase: dispatch every seat in parallel; failed seats already come back as BLOCK contracts.
export async function runPhasePanel(seats, framing) {
  return Promise.all(seats.map((s) => dispatchSeat(s, framing).then((v) => ({ ...v, _model: s.model }))));
}

// run a verification phase end-to-end: panel -> deterministic merge -> gate -> STATE.md.
export async function runVerifyPhase(seats, framing, missionData, statePath, prevHash = 'GENESIS') {
  const verdicts = await runPhasePanel(seats, framing);
  const res = runPhaseCompaction(verdicts, missionData, statePath, prevHash);
  return { verdicts, ...res };
}

// locked Phase-3 boundary-auditor panel — all big cloud, diverse families (MiniMax / Z.ai / DeepSeek).
// Each seat's model id and unestablished flag are resolved from the rijāl registry via selectSeatByChannel.
// channel defaults to 'cloud' (operator mandate); pass 'local' for offline/fallback runs.
// The three slots enumerate ALL registered cloud candidates for role 'auditor' in registry order,
// preserving the diverse-family panel. unestablished is carried through for downstream provenance logging.
export const PHASE3_AUDITORS = (today, channel = 'cloud') => {
  // Enumerate auditor seats from registry in insertion order — preserves MiniMax/Z.ai/DeepSeek family diversity.
  const auditorSeats = Object.values(registry).filter(
    (s) => Array.isArray(s.role) && s.role.includes('auditor')
  );
  // For 'cloud' channel: prefer unestablished (cloud-native) seats; for 'local': prefer established.
  const ordered = channel === 'cloud'
    ? [...auditorSeats.filter((s) => !s.established), ...auditorSeats.filter((s) => s.established)]
    : [...auditorSeats.filter((s) => s.established), ...auditorSeats.filter((s) => !s.established)];
  // Return exactly 3 seats (the locked panel size); if fewer registered, selectSeatByChannel fills remainder.
  const panel = ordered.slice(0, 3);
  while (panel.length < 3) {
    const fallback = selectSeatByChannel('auditor', channel);
    panel.push(fallback ? { id: fallback.id, established: fallback.established } : panel[0]);
  }
  return panel.map((s) => ({
    role: 'auditor',
    model: s.id,
    today,
    sampling: { temperature: 0.3, top_p: 0.9 },
    unestablished: s.established === false,
  }));
};

// --------------------------------------------------------------------------- live self-test
if (process.argv[1]?.endsWith('muezzin_engine.mjs')) {
  const today = process.argv[2] || '2026-06-09';
  const path = await import('path'); const os = await import('os');
  const seats = PHASE3_AUDITORS(today);

  // a genuinely contestable governance question, so we can SEE whether the panel diverges and the merge resolves it.
  const framing = [
    'MISSION M42: the muezzin auto-merges per-mission sub-state files up into STATE.md at Isha (session close),',
    'programmatically, with NO human review of the merged STATE.md before the next session bootstraps from it.',
    'Substrate: the merge is deterministic code (render_state.mjs) + round-trip integrity check + sha256 hash-chain.',
    'Question, Auditor: does unattended auto-merge COMPLY with Directive 1 (substrate is truth) and Directive 8',
    '(write for the one who comes after), or does the absence of human review violate them? Rule with a verdict.',
  ].join('\n');

  const sp = path.join(os.tmpdir(), '_muezzin_panel_test.md');
  console.log(`[engine] dispatching ${seats.length}-seat verify panel IN PARALLEL (cloud, serial-gate-exempt)...`);
  const t0 = Date.now ? null : null; // (timing omitted — Date.now unused to stay portable)
  const r = await runVerifyPhase(seats, framing, {
    timestamp: today, missions: [{ id: 'M42', status: 'PHASE_3', confidence: 0.9 }], concerns: [], rulings: [], handoff_paths: [process.argv[1]],
  }, sp, 'GENESIS');

  console.log('\n[engine] per-seat verdicts:');
  r.verdicts.forEach((v) => console.log(`  ${(v._model || '?').padEnd(18)} ${String(v.verdict).padEnd(8)} findings=${(v.findings || []).length}  wudu-reads=${(v._tools || []).length}${v._failed ? '  [FAILED-SEAT->BLOCK]' : ''}`));
  console.log(`\n[engine] DETERMINISTIC MERGE -> ${r.verdict}  (escalate=${r.escalate})`);
  console.log(`[engine] STATE.md written: ${sp}`);
  const verdicts = r.verdicts.map((v) => v.verdict);
  const split = new Set(verdicts).size > 1;
  console.log(split
    ? `\nPANEL DIVERGED (${verdicts.join(' / ')}) — and the deterministic gate resolved it to ${r.verdict} without a model judging. THIS is why one seat was never enough.`
    : `\nPANEL AGREED (${verdicts.join(' / ')}) -> ${r.verdict}.`);
}
