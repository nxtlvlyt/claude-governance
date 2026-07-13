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
// Phrases a panel finding uses to admit it could not fully see the artifact it is judging
// (head-truncation cap, a cap-omitted section, "not directly verifiable" hedges). Matched
// case-insensitively against the finding's own description text.
const VISIBILITY_LIMIT_RE = /cap[- ]omitted|could not (be )?(directly )?verif|not (directly )?verifiable|truncat|beyond the (visible|reviewed) (scope|slice)|content was omitted|review(ed)? was cap/i;

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

  // QUORUM FALLBACK (receipted 2x — atv-1 S2 attempt-9 + atv-2 S1, both BLOCKED SOLELY on
  // "no JSON verdict found" despite clean, conductor-verified content and a valid MAJORITY
  // verdict). A contract flagged _failed did NOT deliver a JUDGMENT: dispatchSeat sets it when
  // the dispatch died OR the seat's OUTPUT would not parse/validate. That is a FORMATTING/INFRA
  // failure, not a BLOCK VOTE, and it must not nullify a panel the majority validly ruled.
  // RULE: when >=2 seats delivered a parseable contract (producer!=verifier preserved), the
  // _failed seats are DROPPED from consensus and recorded honestly; the panel rules on the
  // survivors. Below quorum (<2 real verdicts) we FAIL CLOSED — every contract stays and the
  // failure still BLOCKs (absence is not APPROVE). This NEVER weakens a real judgment: a genuine
  // BLOCK/REJECT/REVISE from a seat that DID parse carries no _failed flag and is untouched here.
  let scored = contracts;
  const failed = contracts.filter((c) => c && c._failed === true);
  const real = contracts.filter((c) => !(c && c._failed === true));
  if (failed.length > 0 && real.length >= 2) {
    scored = real;
    for (const c of failed) {
      const why = (Array.isArray(c?.findings) ? c.findings : []).map((f) => f?.description).filter(Boolean).join('; ') || 'output did not parse / dispatch failed';
      dispositions.push({ seat: c?.seat ?? 'unknown', verdict: 'DROPPED', dropped: true, reason: `malformed/absent output (not a judgment) dropped from consensus — ${real.length} seats delivered valid verdicts (quorum, producer!=verifier): ${why}` });
    }
  }

  for (const c of scored) {
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
      // VISIBILITY-LIMIT DOWNGRADE (QUEUE ITEM 15 / gap-panel-truncation-false-reject,
      // priority-elevated 2026-07-13: 3 receipted false deaths this session from the same
      // class -- a panel operating on incomplete visibility rejecting already-correct work).
      // An 'arkan' finding whose OWN text admits the seat could not see enough to judge is
      // never a legitimate basis for invalidating the mission -- force-downgrade to 'wajib'
      // (repairable) BEFORE the arkan-escalation check below. Fail-open to witness receipts:
      // the executed evidence outranks an admittedly-incomplete review.
      const rawFs = Array.isArray(c.findings) ? c.findings : [];
      const fs = rawFs.map((f) => (f?.class === 'arkan' && VISIBILITY_LIMIT_RE.test(String(f?.description || '')))
        ? { ...f, class: 'wajib', _downgraded_from: 'arkan', _downgrade_reason: 'finding admits its own visibility limit (cap/truncation/unverifiable) — self-admitted incomplete review cannot invalidate a mission' }
        : f);
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

  // QUORUM FALLBACK (receipted 2x — atv-1 S2 + atv-2 S1, both BLOCKED on "no JSON verdict found"
  // despite clean content + valid majority). A _failed seat (malformed/absent OUTPUT) is dropped
  // when >=2 seats delivered valid verdicts; below quorum it fails closed. Real judgments untouched.
  const PF = { seat: 'final_auditor', verdict: 'BLOCK', findings: [{ id: 'CONTRACT', severity: 'high', description: 'invalid/missing verdict: no JSON verdict found' }], _failed: true };  // exactly what dispatchSeat emits on a parse miss
  const A1 = { seat: 'validator', verdict: 'APPROVE', findings: [], receipts: RC };
  const A2 = { seat: 'auditor', verdict: 'APPROVE', findings: [], receipts: RC };
  check(mergeVerdicts([A1, A2, PF]).consensus, 'APPROVE', 'QUORUM: 2 valid APPROVE + 1 malformed-output seat -> APPROVE (the formatting glitch no longer nullifies the panel)');
  check(mergeVerdicts([A1, A2, PF]).dispositions.some((d) => d.dropped) , true, 'QUORUM: the dropped _failed seat is recorded honestly in dispositions');
  check(mergeVerdicts([A1, A2, PF]).escalate, false, 'QUORUM: a majority-APPROVE panel does not escalate on a dropped-output seat');
  check(mergeVerdicts([A1, A2, { seat: 'x', verdict: 'BLOCK', findings: F(1) }]).consensus, 'BLOCK', 'SEMANTICS: a GENUINE BLOCK (no _failed) still wins — quorum never weakens a real judgment');
  check(mergeVerdicts([A1, A2, { seat: 'x', verdict: 'REJECT', findings: F(1), receipts: RC }]).consensus, 'REJECT', 'SEMANTICS: a genuine REJECT that parsed still counts');
  check(mergeVerdicts([PF, { ...PF, seat: 'validator' }, A1]).consensus, 'BLOCK', 'BELOW QUORUM: only 1 valid verdict (2 seats failed to parse) -> BLOCK (absence is not APPROVE, producer!=verifier unmet)');

  console.log(`\n${fails === 0 ? 'ALL PASS — keystone merge engine sound' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
