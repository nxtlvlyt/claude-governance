// verdict_merge.mjs — Muezzin keystone: deterministic verdict merge (agy Mission 31).
//
// Seats emit JSON verdict contracts; the Muezzin merges them BY RULE — no runtime judgment.
// The merge RULES (severity hierarchy, 50-finding cap) are explicit, governance-set DESIGN
// decisions — auditable here, not improvised per mission. That is the honest reading of
// "muezzin does no judgment": no runtime judgment; the rules are fixed and inspectable.
//
// Fail-safes (witness round-3): truncation/overflow/failed-seat NEVER bias toward APPROVE.
//   - failed/invalid seat   -> BLOCK   ("absence is not APPROVE", 6/7-agent canon)
//   - findings overflow      -> forced >= REVISE (a seat can't spam findings into a pass)
//   - zero seats             -> BLOCK
// assertion-closed concerns carry forward for independent verification (ḥasan li-ghayrihi).

export const VERDICTS = ['APPROVE', 'REVISE', 'REJECT', 'BLOCK'];
// GRADUATED EXPIATION (operator-ratified 2026-06-11, the Hajj-fiqh model): findings carry
// a class — 'arkan' (violates the mission's single essential criterion: invalidates),
// 'wajib' (real gap, repairable by a follow-up: incurs DAMM — a receipted compensating
// micro-task — but the mission STANDS), 'sunnah' (optional improvement: no penalty).
// APPROVE_WITH_DAMM sits between APPROVE and REVISE: the mission completes, the damm
// queue carries the gaps. UNCLASSIFIED findings keep FULL severity (conservative: the
// graduation never weakens a finding nobody graded).
export const VERDICTS_MERGED = [...VERDICTS, 'APPROVE_WITH_DAMM'];
const SEVERITY = { APPROVE: 0, APPROVE_WITH_DAMM: 0.5, REVISE: 1, REJECT: 2, BLOCK: 3 }; // higher wins
export const MAX_FINDINGS = 50;
const FINDING_CLASSES = new Set(['arkan', 'wajib', 'sunnah']);

export function validateVerdictContract(c) {
  const errors = [];
  if (!c || typeof c !== 'object') return { ok: false, errors: ['not an object'], overflow: false, unwitnessed: false };
  if (!VERDICTS.includes(c.verdict)) errors.push(`verdict "${c.verdict}" not in ${VERDICTS.join('|')}`);
  if (!Array.isArray(c.findings)) errors.push('findings is not an array');
  const overflow = Array.isArray(c.findings) && c.findings.length > MAX_FINDINGS;
  // DEEDS-NOT-CLAIMS (Islamic-engineering root-cause fix): an APPROVE must carry >=1 witnessed receipt,
  // all ok. receipts: [{ type:'exec'|'read', ref, ok }] — exec receipts (node -c / bash -n / docker build /
  // test, run BY THE MUEZZIN) back code claims; read receipts back governance claims. A claimed PASS with
  // no witnessed deed is NOT APPROVE — this is what agy missed (it trusted the claim as if it were the deed).
  const witnessed = Array.isArray(c.receipts) && c.receipts.length > 0 && c.receipts.every((r) => r && r.ok !== false);
  const unwitnessed = c.verdict === 'APPROVE' && !witnessed;
  return { ok: errors.length === 0, errors, overflow, unwitnessed };
}

export function mergeVerdicts(contracts) {
  const dispositions = [];
  const carried_concerns = [];
  let effective = 'APPROVE';      // optimistic floor; any real signal raises it
  let escalate = false;

  if (!Array.isArray(contracts) || contracts.length === 0) {
    return { consensus: 'BLOCK', escalate: true, dispositions: [{ seat: 'none', verdict: 'BLOCK', reason: 'no seats — absence is not APPROVE' }], carried_concerns };
  }

  for (const c of contracts) {
    const v = validateVerdictContract(c);
    if (!v.ok) {                  // failed seat — does not get to count as agreement
      dispositions.push({ seat: c?.seat ?? 'unknown', verdict: 'BLOCK', reason: 'invalid contract: ' + v.errors.join('; ') });
      effective = 'BLOCK'; escalate = true; continue;
    }
    let seatV = c.verdict;
    if (v.unwitnessed) {          // deeds-not-claims: a claimed PASS with no witnessed receipt is NOT APPROVE
      seatV = 'BLOCK'; escalate = true;
      dispositions.push({ seat: c.seat, verdict: seatV, reason: 'unwitnessed APPROVE — claimed PASS with no exec/read receipt (deeds-not-claims)' });
    } else if (v.overflow) {      // fail-safe: spam can't truncate into a pass
      if (SEVERITY[seatV] < SEVERITY.REVISE) seatV = 'REVISE';
      dispositions.push({ seat: c.seat, verdict: seatV, reason: `findings overflow (${c.findings.length}>${MAX_FINDINGS}) — forced >= REVISE` });
    } else {
      // GRADUATED EXPIATION downgrade path. Applies ONLY to content verdicts
      // (REVISE/REJECT) whose findings are ALL classified — and only when the seat is
      // witnessed (the mission's deeds ran): any 'arkan' finding ESCALATES to >= REJECT
      // (a missed pillar invalidates); all-'sunnah' findings = APPROVE (no penalty);
      // wajib-or-sunnah with >=1 wajib = APPROVE_WITH_DAMM, gaps carried as damm.
      // Any UNCLASSIFIED finding = no downgrade (full original severity). BLOCK never
      // downgrades (structural/integrity verdicts are not content findings).
      const witnessed = Array.isArray(c.receipts) && c.receipts.length > 0 && c.receipts.every((r) => r && r.ok !== false);
      const fs = Array.isArray(c.findings) ? c.findings : [];
      const allClassified = fs.length > 0 && fs.every((f) => FINDING_CLASSES.has(f?.class));
      // BLOCK NEVER DOWNGRADES — re-affirmed by laguna witness REJECT 2026-06-11
      // ("downgrading explicit dissent creates a gaming path and semantic drift; fix
      // coherence UPSTREAM"). Incoherent contracts (BLOCK + all-wajib findings) are
      // handled BEFORE the merge by the coherence-repair loop in defaultVerdictPhase
      // (orchestrate.mjs): the seat is re-asked ONCE with its contradiction named and
      // resolves it ITSELF. A post-repair BLOCK is coherent dissent and stands here.
      if ((seatV === 'REVISE' || seatV === 'REJECT') && allClassified) {
        if (fs.some((f) => f.class === 'arkan')) {
          if (SEVERITY[seatV] < SEVERITY.REJECT) seatV = 'REJECT';
          dispositions.push({ seat: c.seat, verdict: seatV, reason: 'arkan finding — the mission\'s essential criterion is violated (invalidates; no expiation)' });
        } else if (witnessed && fs.some((f) => f.class === 'wajib')) {
          seatV = 'APPROVE_WITH_DAMM';
          for (const f of fs.filter((x) => x.class === 'wajib')) carried_concerns.push({ id: f.id, from: c.seat, damm: true, description: f.description });
          dispositions.push({ seat: c.seat, verdict: seatV, reason: `wajib-only findings (${fs.length}) — mission stands, gaps incur damm (receipted follow-up)` });
        } else if (witnessed) {   // all sunnah
          seatV = 'APPROVE';
          dispositions.push({ seat: c.seat, verdict: seatV, reason: 'sunnah-only findings — optional improvements, no penalty' });
        } else {
          dispositions.push({ seat: c.seat, verdict: seatV, reason: 'classified findings but unwitnessed seat — no downgrade' });
        }
      } else {
        dispositions.push({ seat: c.seat, verdict: seatV });
      }
    }
    if (SEVERITY[seatV] > SEVERITY[effective]) effective = seatV;
    for (const cc of (c.closed_concerns || [])) {
      if (cc.close_type === 'assertion') carried_concerns.push({ id: cc.id, from: c.seat });
    }
  }
  if (effective === 'BLOCK' || effective === 'REJECT') escalate = true;
  const damm = carried_concerns.filter((cc) => cc.damm);
  return { consensus: effective, escalate, dispositions, carried_concerns, damm };
}

// --------------------------------------------------------------------------- self-test
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('verdict_merge.mjs')) {
  let fails = 0;
  const check = (got, want, msg) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
    if (!ok) fails++;
  };
  const F = (n) => Array.from({ length: n }, (_, i) => ({ id: 'F' + i }));

  const RC = [{ type: 'exec', ref: 'node -c x.js', ok: true }];   // a witnessed receipt (deed ran, exit 0)
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: RC }, { seat: 'b', verdict: 'APPROVE', findings: [], receipts: RC }]).consensus, 'APPROVE', 'all-approve (witnessed) -> APPROVE');
  { const r = mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: RC }, { seat: 'b', verdict: 'BLOCK', findings: F(2) }]); check([r.consensus, r.escalate], ['BLOCK', true], 'one BLOCK -> BLOCK + escalate'); }
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: RC }, { seat: 'b', verdict: 'REVISE', findings: [] }]).consensus, 'REVISE', 'a REVISE -> REVISE');
  { const r = mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: RC }, { seat: 'b', verdict: 'NONSENSE', findings: [] }]); check([r.consensus, r.escalate], ['BLOCK', true], 'failed seat -> BLOCK (absence is not APPROVE)'); }
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: F(99), receipts: RC }]).consensus, 'REVISE', 'overflow spam cannot become APPROVE');
  check(mergeVerdicts([]).consensus, 'BLOCK', 'zero seats -> BLOCK');
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: RC, closed_concerns: [{ id: 'C1', close_type: 'assertion' }] }]).carried_concerns, [{ id: 'C1', from: 'a' }], 'assertion-close carries forward');
  // deeds-not-claims witness rule (the root-cause fix)
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [] }]).consensus, 'BLOCK', 'unwitnessed APPROVE (no receipt) -> BLOCK');
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: [{ ok: false }] }]).consensus, 'BLOCK', 'failed receipt -> BLOCK');
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: RC }]).consensus, 'APPROVE', 'witnessed APPROVE -> APPROVE');

  // GRADUATED EXPIATION (Hajj-fiqh model, operator-ratified 2026-06-11)
  const W = (d) => ({ id: 'W1', class: 'wajib', description: d });
  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [W('missing appendix')], receipts: RC }]).consensus, 'APPROVE_WITH_DAMM', 'wajib-only REVISE -> APPROVE_WITH_DAMM (mission stands, gap carried)');
  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [W('gap')], receipts: RC }]).damm.length, 1, 'damm queue carries the wajib finding');
  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [{ id: 'S1', class: 'sunnah' }], receipts: RC }]).consensus, 'APPROVE', 'sunnah-only REVISE -> APPROVE (no penalty)');
  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [{ id: 'A1', class: 'arkan' }, W('gap')], receipts: RC }]).consensus, 'REJECT', 'any arkan finding -> >= REJECT (a missed pillar invalidates; no expiation)');
  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [{ id: 'U1', description: 'ungraded' }], receipts: RC }]).consensus, 'REVISE', 'UNCLASSIFIED finding -> full severity (graduation never weakens ungraded findings)');
  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [W('gap')] }]).consensus, 'REVISE', 'unwitnessed seat -> no downgrade (damm rides only on witnessed deeds)');
  // BLOCK NEVER DOWNGRADES (laguna witness REJECT 2026-06-11 upheld the original rule;
  // incoherence is repaired UPSTREAM in defaultVerdictPhase, never overridden at merge).
  check(mergeVerdicts([{ seat: 'v', verdict: 'BLOCK', findings: [W('gap')], receipts: RC }]).consensus, 'BLOCK', 'seat BLOCK never downgrades at merge — incoherence is repaired upstream, dissent is never overridden');
  check(mergeVerdicts([{ seat: 'a', verdict: 'APPROVE', findings: [], receipts: RC }, { seat: 'b', verdict: 'REVISE', findings: [W('gap')], receipts: RC }]).consensus, 'APPROVE_WITH_DAMM', 'two seats: APPROVE + wajib-REVISE -> consensus APPROVE_WITH_DAMM');

  console.log(`\n${fails === 0 ? 'ALL PASS — keystone merge engine sound' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
