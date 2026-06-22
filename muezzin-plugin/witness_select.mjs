// witness_select.mjs — Muezzin: divergence-selected witness (Task 38).
//
// SOTA-validation refinement. A witness is informative to the degree it DISAGREES
// with the producer. Selecting a witness by family label (e.g. "pick a different
// org/model family") is a proxy; the thing the proxy is reaching for is MEASURED
// disagreement. So measure it directly: over a corpus of prior cases, score each
// candidate by how often its verdict diverged from the producer's, and seat the
// candidate that diverged MOST. A witness that rubber-stamps the producer tells us
// nothing; a witness that has historically caught what the producer missed is the
// one worth a dispatch.
//
// Honesty constraints (so the score is not gamed by sparsity):
//   - divergence rate is over cases where THAT candidate actually has a verdict
//     (missing verdicts do not count as agreement OR disagreement — they are absent)
//   - empty corpus, or no candidate with any data, falls back to candidates[0]
//     and SAYS SO (fellback: true) rather than presenting a guess as a measurement.
//   - ties broken by first-listed (stable, deterministic, auditable).

export function selectWitnessByDivergence(candidates, corpus) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { id: undefined, divergence_rate: 0, fellback: true };
  }
  const cases = Array.isArray(corpus) ? corpus : [];

  let best = null; // { id, divergence_rate, index }
  candidates.forEach((id, index) => {
    let seen = 0;      // cases where this candidate has a verdict
    let diverged = 0;  // of those, cases where it disagreed with the producer
    for (const cs of cases) {
      if (!cs || typeof cs !== 'object') continue;
      const cv = cs.candidate_verdicts;
      if (!cv || typeof cv !== 'object') continue;
      if (!Object.prototype.hasOwnProperty.call(cv, id)) continue; // no verdict -> absent, not agreement
      const v = cv[id];
      if (v === undefined || v === null) continue;
      seen++;
      if (v !== cs.producer_verdict) diverged++;
    }
    if (seen === 0) return; // no data for this candidate — cannot score it
    const rate = diverged / seen;
    // HIGHEST divergence wins; ties broken by first listed (strictly-greater keeps the earlier).
    if (best === null || rate > best.divergence_rate) {
      best = { id, divergence_rate: rate, index };
    }
  });

  if (best === null) {
    // no candidate had any data over the corpus — honest fallback, flagged.
    return { id: candidates[0], divergence_rate: 0, fellback: true };
  }
  return { id: best.id, divergence_rate: best.divergence_rate };
}

// --------------------------------------------------------------------------- self-test
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('witness_select.mjs')) {
  let fails = 0;
  const check = (got, want, msg) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
    if (!ok) fails++;
  };

  // Corpus: 5 cases. Candidate 'A' diverges from the producer in 4/5; 'B' in 1/5.
  // producer always says APPROVE here; A disagrees in cases 1-4, agrees in case 5;
  // B disagrees only in case 1.
  const corpus = [
    { producer_verdict: 'APPROVE', candidate_verdicts: { A: 'REJECT',  B: 'REJECT'  } }, // A div, B div
    { producer_verdict: 'APPROVE', candidate_verdicts: { A: 'REVISE',  B: 'APPROVE' } }, // A div
    { producer_verdict: 'APPROVE', candidate_verdicts: { A: 'REJECT',  B: 'APPROVE' } }, // A div
    { producer_verdict: 'APPROVE', candidate_verdicts: { A: 'BLOCK',   B: 'APPROVE' } }, // A div
    { producer_verdict: 'APPROVE', candidate_verdicts: { A: 'APPROVE', B: 'APPROVE' } }, // neither
  ];
  check(selectWitnessByDivergence(['A', 'B'], corpus), { id: 'A', divergence_rate: 0.8 }, "A diverges 4/5, B 1/5 -> A @ 0.8");

  // Empty corpus -> candidates[0] + fellback
  check(selectWitnessByDivergence(['A', 'B'], []), { id: 'A', divergence_rate: 0, fellback: true }, 'empty corpus -> candidates[0] + fellback');

  // --- additional guards (do not affect the two required assertions) ---
  // No candidate has any verdict data in the corpus -> fallback flagged.
  check(selectWitnessByDivergence(['X', 'Y'], corpus), { id: 'X', divergence_rate: 0, fellback: true }, 'no data for any candidate -> fallback');
  // Missing verdicts are absent, not agreement: A diverges in its only 1 scored case -> 1.0.
  const sparse = [
    { producer_verdict: 'APPROVE', candidate_verdicts: { A: 'REJECT' } }, // A scored (div); B absent
    { producer_verdict: 'APPROVE', candidate_verdicts: { B: 'APPROVE' } }, // B scored (agree); A absent
  ];
  check(selectWitnessByDivergence(['B', 'A'], sparse), { id: 'A', divergence_rate: 1 }, 'A 1/1 beats B 0/1 despite later listing');
  // Tie broken by first listed (both diverge 1/1).
  const tie = [{ producer_verdict: 'APPROVE', candidate_verdicts: { A: 'REJECT', B: 'REJECT' } }];
  check(selectWitnessByDivergence(['A', 'B'], tie), { id: 'A', divergence_rate: 1 }, 'tie -> first listed (A)');

  console.log(`\n${fails === 0 ? 'ALL PASS — divergence-selected witness sound' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
