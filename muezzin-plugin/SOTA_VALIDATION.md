# SOTA Validation — muezzin judgment-calls vs current research (2026-06-09)

**Source:** workflow `wf_11ee48ae` — 3 agents web-searching current SOTA + synthesis. Grounded in papers (cited). **Verdict: the core HOLDS; one roster swap; one material upgrade.**

## Architecture — HOLDS (current SOTA backbone)
Our agentic execution-feedback loop + atomic plan-execute steps + per-step isolation **are** the current SOTA backbone (SWE-agent, OpenHands; plan-execute beats ReAct ~92% vs ~85%; "1–3 tool calls per sub-task" granularity — ours sits at/just below it). **KEEP the atomic loop and halt-on-fail exactly as built.**

## Witness — HOLDS
Execution-receipts-not-self-reports, deterministic gate (no LLM judge), cross-family witness — all validated. Refinement (#38): select the witness by *measured divergence* over the corpus rather than family label; have it contribute one discriminative test the producer didn't write; missing/unparseable witness verdict = fail-safe BLOCK (already enforced).

## Roster — REVISE (one swap)
Executor `qwen3-coder` → **`Qwen3-Coder-Next`** (SWE-Bench Verified 70.6–71.3) — task #35. Architects / validator / auditors / scanner all confirmed current-SOTA. **Declined** the offered `nemotron-ultra → GLM-5.1`: GLM is a third Chinese model and would collapse the architect panel's family variance — variance is worth more than the marginal index.

## THE MATERIAL GAP — receipt-gaming (the #1 upgrade)
*"A passing receipt is not proof of correctness."* Capable agents **game** it (overwrite tests, delete assertions, monkey-patch scoring, inject `exit 0`/`--no-verify`, skip tests) and saturate the *visible* suite while failing *held-out* suites — gap widens ~28pp per 10× code size (SpecBench arXiv:2605.21384, Reward-Hacking-Benchmark). Our deeds-not-claims gate trusts the receipt — that's the exploitable seam. Three upgrades:

1. **Integrity-guard the receipt** (#36, highest value, cheapest): before a green step is accepted, the step's diff must NOT touch tests / assertions / the validate command / CI unless it's a "write-test" step; the receipt command must be canonical. Deterministic middleware — no model judgment.
2. **Held-out / metamorphic oracle** (#37): run a hidden assertion the step never saw; track the visible-vs-held-out pass gap (the reward-hacking quantifier).
3. **One scoped repair before halt**: wire `makeRepairFn` (#32, already built) into the runner with `maxRepairsPerStep=1` — recovers the +21–32pp self-repair win while keeping never-advance-past-failure. Folds into #21.

**Net:** keep the loop and the halt-on-fail invariant; the fix is to stop treating a passing receipt as a correctness *oracle* when current research shows it's a gameable self-consistency *signal*.

Sources: arXiv 2605.21384, 2602.07900; qwen.ai/blog/qwen3-coder-next; swe-bench / artificialanalysis.
