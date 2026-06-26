/**
 * model_rijal.mjs — ʿIlm al-Rijāl model-trustworthiness registry
 *
 * Encodes ʿadāla (verdict trustworthiness) and ḍabṭ (accuracy of retention)
 * for every seat in the deliberation chain, seeded from canon/model-rijal.md.
 *
 * Two categories of seats:
 *   established  — qualifying_runs >= 1, verdict record exists in the canon
 *   unestablished — cloud candidates with benchmark scores but NO verdict
 *                   record in this system (ʿadāla not yet demonstrated)
 *
 * APPEND-ONLY design: recordVerdict() only pushes; history is never deleted.
 */

// ---------------------------------------------------------------------------
// SEAT REGISTRY — seeded from canon/model-rijal.md (2026-05-13 runs, Gaps 1-7)
// ---------------------------------------------------------------------------

// Accuracy notes sourced verbatim from the canon's "Accurate?" column:
//
//   gemma4:31b     — 7 runs. Gap 2 = partially accurate (semantic miss).
//                    Gap 1 = partial (closure confidence overstated).
//                    Gaps 3-7 = accurate. Count honestly: 5 fully accurate,
//                    2 partial. Canon says "No false positives or negatives
//                    across 7 gaps" but documents two misses. We encode
//                    correct_runs=5 (fully accurate verdicts) and preserve
//                    the partial records in adala_record.
//
//   qwen3.6:27b    — 6 qualifying runs (1 aborted, not qualifying).
//                    Gap 1 = accurate. Gap 2 = partially accurate (session-
//                    boundary miss). Gaps 3,5,7 = accurate. Gap 6 = accurate
//                    (both concerns confirmed). correct_runs=5.
//
//   laguna-xs.2    — 7 runs, "all correct verdicts" per canon. Gap 6 had
//                    a PARSE_ERROR but raw content was APPROVE (correct
//                    verdict). Canon says "all verdicts correct".
//                    correct_runs=7.
//
//   granite4.1:8b — 7 runs, "verdicts correct" per canon. Gap 6 = PARSE_ERROR
//                    but raw content was APPROVE (correct verdict).
//                    correct_runs=7.
//
//   nemotron-3-super — 8 runs, "all correct verdicts" per canon.
//                    correct_runs=8.
//
//   claude-sonnet-4-6 — Seat 3 produces synthesis not BLOCK/APPROVE verdicts.
//                    Seat 7 is the executor. "Not independently auditable in
//                    this file." qualifying_runs=0 (by design of the canon).

export const registry = {

  // ---- ESTABLISHED SEATS (canon-seeded) -----------------------------------

  "gemma4:31b": {
    id: "gemma4:31b",
    role: ["architect", "workshop"],
    qualifying_runs: 7,
    // 5 fully accurate + 2 partial (Gap 1 closure-confidence, Gap 2 semantic miss)
    // Canon: "No false positives or negatives across 7 gaps" — encoding as 5
    // fully-accurate because canon also documents two partial misses. Using
    // conservative honest count per Directive 5 (mark confidence honestly).
    correct_runs: 5,
    established: true,
    adala_record: [
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 1 (ʿIlm al-Rijāl implementation) — Phase 1",
        accurate: "partial" // concerns accurate; closure confidence overstated; empty database missed
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 1",
        accurate: "partial" // mechanism correct; session-local counter semantic gap missed
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 3 (niyyah gate source-read coupling) — Phase 1",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 4 (concern closure strength classifier) — Phase 1",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "BLOCK",
        context: "Gap 5 (formation testimony āḥād) — Phase 1",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 6 (model version boundary) — Phase 1",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 7 (no parallel-chain option) — Phase 1",
        accurate: true
      }
    ]
  },

  "qwen3.6:27b": {
    id: "qwen3.6:27b",
    role: ["architect", "deep-dive"],
    qualifying_runs: 6, // 1 aborted (Gap 4 Ollama deadlock) — not qualifying
    // Gap 1 accurate, Gap 2 partial, Gaps 3/5/6/7 accurate → 5 fully accurate
    correct_runs: 5,
    established: true,
    adala_record: [
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 1 (ʿIlm al-Rijāl implementation) — Phase 1",
        accurate: true // concerns substrate-verified, confidence well-calibrated
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 1",
        accurate: "partial" // mechanism correct; session-boundary semantics gap missed
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 3 (niyyah gate source-read coupling) — Phase 1",
        accurate: true
      },
      // Gap 4: aborted (Ollama deadlock) — not a qualifying verdict, omitted
      {
        date: "2026-05-13",
        verdict: "BLOCK",
        context: "Gap 5 (formation testimony āḥād) — Phase 1",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 6 (model version boundary) — Phase 1",
        accurate: true // both concerns confirmed; C2 fixed by evidence
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 7 (no parallel-chain option) — Phase 1",
        accurate: true // evidence-based closure
      }
    ]
  },

  // Canon name in registry key uses the id as it appears in Ollama
  "laguna-xs.2": {
    id: "laguna-xs.2",
    role: ["code-review", "governance-scanner"],
    qualifying_runs: 7,
    correct_runs: 7, // canon: "all verdicts correct" — Gap 6 PARSE_ERROR raw content was APPROVE
    established: true,
    adala_record: [
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 1 (ʿIlm al-Rijāl implementation) — Phase 2, code-review seat",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 2, code-review seat",
        accurate: true // C1 substrate-verified by direct file read; caught what phase-1 missed
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 3 (niyyah gate source-read coupling) — Phase 2, code-review seat",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 4 (concern closure strength classifier) — Phase 2, code-review",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 5 (formation testimony āḥād) — Phase 2, code-review",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "PARSE_ERROR", // raw content was APPROVE — correct verdict
        context: "Gap 6 (model version boundary) — Phase 2, code-review",
        accurate: true // correct verdict in raw content; JSON fence wrap was format failure
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 7 (no parallel-chain option) — Phase 2, code-review",
        accurate: true
      }
    ]
  },

  "granite4.1:8b": {
    id: "granite4.1:8b",
    role: ["governance-audit"],
    qualifying_runs: 7,
    correct_runs: 7, // canon: "verdicts correct" — Gap 6 PARSE_ERROR raw content was APPROVE
    established: true,
    adala_record: [
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 1 (ʿIlm al-Rijāl implementation) — Phase 2, governance-audit seat",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 2, governance-audit seat",
        accurate: true // accurate concern; closure method weaker (assertion, not evidence)
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 3 (niyyah gate source-read coupling) — Phase 2, governance-audit seat",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 4 (concern closure strength classifier) — Phase 2, governance-audit",
        accurate: true // verdict correct; C1 scope was adjacent file, not gap substrate
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 5 (formation testimony āḥād) — Phase 2, governance-audit",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "PARSE_ERROR", // raw content was APPROVE — correct verdict
        context: "Gap 6 (model version boundary) — Phase 2, governance-audit",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 7 (no parallel-chain option) — Phase 2, governance-audit",
        accurate: true // verdict correct; assertion-closure pattern holds
      }
    ]
  },

  "nemotron-3-super": {
    id: "nemotron-3-super",
    role: ["final-verdict"],
    qualifying_runs: 8,
    correct_runs: 8, // canon: "all correct verdicts" across P6 + Gaps 1-7
    established: true,
    adala_record: [
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "P6 cryptographic non-repudiation architecture (RFC 3161 TSA + SSH-signed git)",
        accurate: true // C1/C2 accurate; C3 closure = assertion (not yet downstream-confirmed)
      },
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 1 (ʿIlm al-Rijāl implementation) — Phase 2, synthesis seat",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "CONDITIONAL_APPROVE",
        context: "Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 2, synthesis seat",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 3 (niyyah gate source-read coupling) — Phase 2, synthesis seat",
        accurate: true // treats prior agent convergence as evidence — notable pattern
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 4 (concern closure strength classifier) — Phase 2, synthesis",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 5 (formation testimony āḥād) — Phase 2, synthesis",
        accurate: true
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 6 (model version boundary) — Phase 2, synthesis",
        accurate: true // correct differential: evidence vs. assertion per concern resolution level
      },
      {
        date: "2026-05-13",
        verdict: "APPROVE",
        context: "Gap 7 (no parallel-chain option) — Phase 2, synthesis",
        accurate: true
      }
    ]
  },

  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    role: ["architect-synthesis", "executor"],
    // Seat 3 produces synthesis not BLOCK/APPROVE verdicts.
    // Canon explicitly: "Not independently auditable in this file — operator audit applies."
    // qualifying_runs=0 per canon design (not tracked in this file).
    qualifying_runs: 0,
    correct_runs: 0,
    established: true, // acknowledged established role in chain; just not verdict-tracked here
    adala_record: []
    // Note: adala_record intentionally empty per canon — this instance maintains
    // the file, creating a conflict of interest. Operator audit is the mechanism.
  },

  // ---- CHOSEN CLOUD ROSTER (the active roster, selected 2026-06-09) ----------
  // "chosen" = today's ACTIVE roster, picked by CURRENT evidence (SOTA research +
  // live head-to-head coding tests + diverse-family variance). ORTHOGONAL to
  // "established" (has a verdict track record). A chosen cloud seat starts
  // unestablished and EARNS its ʿadāla via recordVerdict over qualifying runs —
  // it is NOT second-class, and selectSeat NEVER lets an old local seat's record
  // override it. The established local seats above are preserved as FALLBACK +
  // reference, records intact. THIS is how the day's work is kept.

  "kimi-k2.6": {
    id: "kimi-k2.6", role: ["architect", "validator"],
    chosen: true, selection_basis: "2026-06-09 — SOTA reasoning index + family variance",
    qualifying_runs: 0, correct_runs: 0, established: false, adala_record: []
  },

  "deepseek-v4-pro": {
    id: "deepseek-v4-pro", role: ["architect", "auditor", "governance-scanner"],
    chosen: true, selection_basis: "2026-06-09 — SOTA reasoning index + variance; WON the live scanner test 3/3 format-clean + 3/3 correct (minimax 2/3, glm 1/3 over-flagged) -> scanner seat earned by a run, not a benchmark",
    qualifying_runs: 0, correct_runs: 0, established: false, adala_record: []
  },

  "nemotron-3-ultra": {
    id: "nemotron-3-ultra", role: ["architect", "witness"],
    chosen: true,
    selection_basis: "2026-06-09 — chosen and KEPT over nemotron-3-super: today's pick stands. super's record was earned in the OLD LOCAL chain, not this cloud muezzin; an old-context record does not override a current-evidence cloud choice.",
    qualifying_runs: 0, correct_runs: 0, established: false, adala_record: []
  },

  "qwen3-coder-next": {
    id: "qwen3-coder-next", role: ["executor"],
    chosen: true,
    selection_basis: "2026-06-09 — SOTA-validated upgrade from qwen3-coder:480b (SWE-Bench Verified 70.6-71.3, current Qwen agentic coder). Confirmed SERVABLE on Ollama Cloud + tied 13/13 with qwen3-coder:480b on the live evaluate test -> newer, purpose-built for agentic coding, no observed regression.",
    qualifying_runs: 0, correct_runs: 0, established: false, adala_record: []
  },

  "minimax-m3": {
    id: "minimax-m3", role: ["auditor"],
    chosen: true, selection_basis: "2026-06-09 — Phase-3 auditor panel (MiniMax), family variance",
    qualifying_runs: 0, correct_runs: 0, established: false, adala_record: []
  },

  "glm-5.1": {
    id: "glm-5.1", role: ["auditor"],
    chosen: true, selection_basis: "2026-06-09 — Phase-3 auditor panel (Z.ai), family variance",
    qualifying_runs: 0, correct_runs: 0, established: false, adala_record: []
  }
};

// ---------------------------------------------------------------------------
// selectSeat(role) — returns the seat with the strongest verdict-accuracy
// record for the given role.
//
// Ranking:
//   1. established seats first (rank by correct_runs DESC, then qualifying_runs DESC)
//   2. unestablished seats only as last resort (rank by qualifying_runs DESC)
//   Returns null if no seat matches the role at all.
// ---------------------------------------------------------------------------

export function selectSeat(role) {
  const candidates = Object.values(registry).filter(
    (seat) => Array.isArray(seat.role) && seat.role.includes(role)
  );
  if (candidates.length === 0) return null;

  // CHOSEN (today's active roster, current-evidence) DOMINATES established (old
  // track record): a chosen seat is NEVER overridden by an old local seat's
  // record — that is what keeps the day's roster. Among equal rank, more correct
  // verdicts ranks higher (so a cloud seat promotes as it earns ʿadāla).
  // Established-not-chosen seats are the fallback; unestablished-not-chosen last.
  const rank = (s) => (s.chosen ? 2 : 0) + (s.established ? 1 : 0);
  const sorted = [...candidates].sort((a, b) =>
    rank(b) !== rank(a) ? rank(b) - rank(a)
      : b.correct_runs !== a.correct_runs ? b.correct_runs - a.correct_runs
      : b.qualifying_runs - a.qualifying_runs
  );
  return sorted[0] ?? null;
}

// ---------------------------------------------------------------------------
// recordVerdict(modelId, {date, verdict, context, accurate}) — APPEND-ONLY.
//
// Pushes to adala_record, increments qualifying_runs (and correct_runs if
// accurate is truthy and not the string "partial"). Sets established=true
// once qualifying_runs >= 1.
//
// Throws if modelId is not in the registry (prevents silent misrouting).
// ---------------------------------------------------------------------------

export function recordVerdict(modelId, { date, verdict, context, accurate }) {
  const seat = registry[modelId];
  if (!seat) {
    throw new Error(
      `recordVerdict: unknown modelId "${modelId}" — add to registry before recording.`
    );
  }

  // Append-only: push the new record
  seat.adala_record.push({ date, verdict, context, accurate });

  // Increment run counters
  seat.qualifying_runs += 1;

  // accurate may be true (bool), false (bool), or "partial" (string).
  // Only full boolean true counts as correct.
  if (accurate === true) {
    seat.correct_runs += 1;
  }

  // Establish once any qualifying run is recorded
  if (seat.qualifying_runs >= 1) {
    seat.established = true;
  }
}

// ---------------------------------------------------------------------------
// selectSeatByChannel(role, channel) — channel-aware seat selection.
//
// channel === 'local' (default): delegates to selectSeat(role) — strongest
//   established local seat.
// channel === 'cloud': returns the best CLOUD candidate (established=false)
//   registered for the role. If the cloud candidate is ʿadāla-unestablished,
//   returns it wrapped with { established:false, unestablished_narrator:true }.
//   If no cloud candidate exists for the role, falls back to selectSeat(role)
//   and adds { fellback_to_local:true }.
//
// Return shape: { id, role, established, unestablished_narrator?, fellback_to_local? }
// ---------------------------------------------------------------------------

export function selectSeatByChannel(role, channel = 'local') {
  if (channel !== 'cloud') {
    // 'local' (and any unrecognised channel) — delegate to selectSeat
    const seat = selectSeat(role);
    if (!seat) return null;
    return { id: seat.id, role: seat.role, established: seat.established };
  }

  // cloud: pick from the CHOSEN cloud roster (today's active seats), ranked by
  // correct_runs DESC (so a cloud seat that has earned ʿadāla leads).
  const candidates = Object.values(registry).filter(
    (s) => Array.isArray(s.role) && s.role.includes(role)
  );

  const cloudCandidates = candidates
    .filter((s) => s.chosen)
    .sort((a, b) =>
      b.correct_runs !== a.correct_runs ? b.correct_runs - a.correct_runs
        : b.qualifying_runs - a.qualifying_runs
    );

  if (cloudCandidates.length > 0) {
    const best = cloudCandidates[0];
    return {
      id: best.id,
      role: best.role,
      established: best.established,
      unestablished_narrator: best.established === false,
    };
  }

  // No cloud candidate for this role — fall back to local best
  const seat = selectSeat(role);
  if (!seat) return null;
  return {
    id: seat.id,
    role: seat.role,
    established: seat.established,
    fellback_to_local: true,
  };
}

// ---------------------------------------------------------------------------
// Self-test — runs only when invoked directly: node model_rijal.mjs
// ---------------------------------------------------------------------------

if (process.argv[1]?.endsWith("model_rijal.mjs")) {
  let allPassed = true;

  function assert(label, condition) {
    if (condition) {
      console.log(`PASS: ${label}`);
    } else {
      console.log(`FAIL: ${label}`);
      allPassed = false;
    }
  }

  // ------------------------------------------------------------------
  // Test 1: the DAY'S CHOSEN cloud roster is PRIMARY — a chosen cloud seat
  //         outranks the old established local seats for the same role, so
  //         the day's work can NEVER be silently reverted to the old chain.
  // ------------------------------------------------------------------
  {
    const winner = selectSeat("architect");
    assert(
      "chosen cloud architect (kimi-k2.6) selected over old established gemma/qwen — day's roster is primary",
      winner?.chosen === true && winner?.id === "kimi-k2.6"
    );
  }

  // ------------------------------------------------------------------
  // Test 2: today's pick STANDS — nemotron-3-ultra (chosen) is the witness;
  //         super does NOT override it. AND the old record is PRESERVED as a
  //         fallback (selectSeat('final-verdict') still returns super).
  // ------------------------------------------------------------------
  {
    const witness = selectSeat("witness");
    const fallback = selectSeat("final-verdict");
    console.log(`INFO: witness seat = ${witness?.id} (chosen=${witness?.chosen}, established=${witness?.established})`);
    console.log(`INFO: old nemotron-3-super preserved as fallback = ${fallback?.id} (${fallback?.correct_runs}/${fallback?.qualifying_runs} correct)`);
    assert(
      "nemotron-3-ultra (today's chosen pick) is the witness — NOT reverted to super",
      witness?.id === "nemotron-3-ultra" && witness?.chosen === true
    );
    assert(
      "old nemotron-3-super record preserved as established fallback for 'final-verdict'",
      fallback?.id === "nemotron-3-super" && fallback?.established === true
    );
  }

  // ------------------------------------------------------------------
  // Test 3: recordVerdict appends a record AND flips an unestablished
  //         cloud model to established after one accurate run.
  // ------------------------------------------------------------------
  {
    const target = "kimi-k2.6";
    const before = {
      established: registry[target].established,
      qualifying_runs: registry[target].qualifying_runs,
      correct_runs: registry[target].correct_runs,
      records: registry[target].adala_record.length
    };

    recordVerdict(target, {
      date: "2026-06-09",
      verdict: "APPROVE",
      context: "Self-test qualifying run — governance gap X",
      accurate: true
    });

    const after = registry[target];

    assert(
      "recordVerdict appends adala_record entry",
      after.adala_record.length === before.records + 1
    );
    assert(
      "recordVerdict increments qualifying_runs",
      after.qualifying_runs === before.qualifying_runs + 1
    );
    assert(
      "recordVerdict increments correct_runs on accurate=true",
      after.correct_runs === before.correct_runs + 1
    );
    assert(
      "recordVerdict flips established=true after first qualifying run",
      before.established === false && after.established === true
    );
  }

  // ------------------------------------------------------------------
  // Test 4: selectSeat('governance-scanner') returns laguna-xs.2
  //         (the canon's proven governance scanner).
  // ------------------------------------------------------------------
  {
    const seat = selectSeat("governance-scanner");
    assert(
      "selectSeat('governance-scanner') returns deepseek-v4-pro (chosen — won the live scanner test 3/3); laguna = established fallback",
      seat?.id === "deepseek-v4-pro" && seat?.chosen === true
    );
  }

  // ------------------------------------------------------------------
  // Test 5: selectSeatByChannel('final-verdict', 'local') returns
  //         nemotron-3-super (the established local seat).
  // ------------------------------------------------------------------
  {
    const seat = selectSeatByChannel('final-verdict', 'local');
    assert(
      "selectSeatByChannel('final-verdict','local') returns nemotron-3-super (established)",
      seat?.id === 'nemotron-3-super' && seat?.established === true
    );
  }

  // ------------------------------------------------------------------
  // Test 6: selectSeatByChannel('witness', 'cloud') returns the chosen cloud
  //         seat (nemotron-3-ultra), flagged unestablished_narrator (earning).
  // ------------------------------------------------------------------
  {
    const seat = selectSeatByChannel('witness', 'cloud');
    assert(
      "selectSeatByChannel('witness','cloud') returns chosen cloud seat (nemotron-3-ultra), unestablished_narrator:true",
      seat?.id === 'nemotron-3-ultra' && seat.established === false && seat.unestablished_narrator === true
    );
    console.log(`INFO: cloud witness seat = ${seat?.id} (established=${seat?.established}, unestablished_narrator=${seat?.unestablished_narrator})`);
  }

  // ------------------------------------------------------------------
  // Exit code
  // ------------------------------------------------------------------
  if (allPassed) {
    console.log("\nAll self-tests PASSED.");
    process.exit(0);
  } else {
    console.log("\nOne or more self-tests FAILED.");
    process.exit(1);
  }
}
