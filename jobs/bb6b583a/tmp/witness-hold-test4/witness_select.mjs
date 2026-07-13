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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

// CORPUS BUILDER (hunt-item #11, 2026-07-05 design pass — the gap QUEUE.md left open:
// "what is producer_verdict for the structural witness, which dispatches exactly one
// model with no natural second opinion?"). Resolution: the structural witness fires
// PER STEP, but the mission's own phase-3 VERDICT PANEL fires ONCE at the end and is
// ALREADY dispatched regardless — its consensus is real, already-paid-for ground truth,
// not a new cost. That answers producer_verdict for free. It does NOT answer the other
// half (comparing MULTIPLE candidate witness models needs at least one of them to
// actually be dispatched) — that genuinely costs something, so it is bounded by
// sampling (shouldSampleShadowWitness below), never dispatched on every call.
//
// logWitnessCase() is the append-only corpus writer: one JSON line per mission, written
// AFTER verdictFn resolves (so producer_verdict is real, not guessed). Best-effort —
// a logging failure must never fail a mission (mirrors seat_record.mjs's own contract).
export function logWitnessCase(corpusPath, { producerVerdict, candidateVerdicts, ts = null }) {
  if (!producerVerdict || !candidateVerdicts || typeof candidateVerdicts !== 'object') return { ok: false, reason: 'incomplete case — nothing written' };
  try {
    mkdirSync(path.dirname(corpusPath), { recursive: true });
    const line = JSON.stringify({ producer_verdict: producerVerdict, candidate_verdicts: candidateVerdicts, ts: ts || new Date(0).toISOString() });
    // ts default is epoch (new Date(0)) — this module's selftests stay deterministic; the
    // real call site (orchestrate.mjs, wired 2026-07-05) passes the actual timestamp in.
    writeFileSync(corpusPath, existsSync(corpusPath) ? readFileSync(corpusPath, 'utf8') + line + '\n' : line + '\n');
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e).slice(0, 120) };
  }
}

// Reads the JSONL corpus back into the array shape selectWitnessByDivergence expects.
// Corrupt/unreadable lines are skipped, never thrown — a bad line must not blind the
// whole selector to every case before it.
export function loadWitnessCorpus(corpusPath) {
  try {
    const raw = readFileSync(corpusPath, 'utf8');
    return raw.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

// SAMPLING GATE — bounds the real dispatch cost of building a multi-candidate corpus.
// Shadow-dispatching an alternative witness model on EVERY call would double the
// per-step GPU cost for every mission forever; sampling accumulates real comparison
// data at a bounded rate instead. Injectable rng for determinism (selftests forbid
// Math.random()); the real call site supplies Math.random directly.
export function shouldSampleShadowWitness(sampleRate = 0.15, rng = Math.random) {
  if (!(sampleRate > 0) || !(sampleRate <= 1)) return false;
  return rng() < sampleRate;
}

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

  // ---- corpus builder + sampling gate (hunt-item #11 design pass) ----
  {
    const os = await import('os');
    const fs = await import('fs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsel_'));
    const corpusPath = path.join(tmp, 'nested', 'corpus.jsonl');   // nested dir: mkdirSync recursive must fire

    check(logWitnessCase(corpusPath, { producerVerdict: 'APPROVE', candidateVerdicts: { ornith9b: 'APPROVE' } }), { ok: true }, 'logWitnessCase: writes a well-formed case');
    check(JSON.parse(fs.readFileSync(corpusPath, 'utf8').trim().split('\n')[0]).ts, new Date(0).toISOString(), 'logWitnessCase: no ts passed -> deterministic epoch default');
    logWitnessCase(path.join(tmp, 'ts.jsonl'), { producerVerdict: 'APPROVE', candidateVerdicts: { a: 'APPROVE' }, ts: '2026-07-05T00:00:00.000Z' });
    check(JSON.parse(fs.readFileSync(path.join(tmp, 'ts.jsonl'), 'utf8').trim()).ts, '2026-07-05T00:00:00.000Z', 'logWitnessCase: a caller-passed ts lands verbatim (the orchestrate call-site contract)');
    check(logWitnessCase(corpusPath, {}), { ok: false, reason: 'incomplete case — nothing written' }, 'logWitnessCase: refuses an incomplete case, never corrupts the file');
    logWitnessCase(corpusPath, { producerVerdict: 'REJECT', candidateVerdicts: { ornith9b: 'REJECT', laguna: 'APPROVE' } });
    const loaded = loadWitnessCorpus(corpusPath);
    check(loaded.length, 2, 'loadWitnessCorpus: reads back exactly the 2 well-formed cases (the incomplete one never landed)');
    check(loaded[1].candidate_verdicts.laguna, 'APPROVE', 'loadWitnessCorpus: second case round-trips correctly');
    check(selectWitnessByDivergence(['ornith9b', 'laguna'], loaded), { id: 'laguna', divergence_rate: 1 }, 'the corpus this builder writes is directly consumable by selectWitnessByDivergence (laguna diverged its only scored case)');

    fs.writeFileSync(path.join(tmp, 'garbage.jsonl'), 'not json\n{"producer_verdict":"APPROVE","candidate_verdicts":{"a":"APPROVE"}}\n');
    check(loadWitnessCorpus(path.join(tmp, 'garbage.jsonl')).length, 1, 'loadWitnessCorpus: a corrupt line is skipped, not thrown — the good line still loads');
    check(loadWitnessCorpus(path.join(tmp, 'does-not-exist.jsonl')), [], 'loadWitnessCorpus: missing file -> empty array, never throws');

    check(shouldSampleShadowWitness(1, () => 0.5), true, 'shouldSampleShadowWitness: rate 1 always samples');
    check(shouldSampleShadowWitness(0, () => 0.0001), false, 'shouldSampleShadowWitness: rate 0 never samples, even on a near-zero roll');
    check(shouldSampleShadowWitness(0.15, () => 0.1), true, 'shouldSampleShadowWitness: roll below the rate -> sample');
    check(shouldSampleShadowWitness(0.15, () => 0.2), false, 'shouldSampleShadowWitness: roll above the rate -> skip (bounds the real dispatch cost)');

    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`\n${fails === 0 ? 'ALL PASS — divergence-selected witness sound' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
