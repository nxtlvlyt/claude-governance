# ʿIlm al-Rijāl — Model Behavioral Biographies

Behavioral registry for models in the deliberation chain. Classical rijāl science
evaluated each transmitter's ʿadāla (trustworthiness of verdicts) and ḍabṭ
(accuracy of retention). This file does the same for AI transmitters.

**Two data layers:**
- **Operational profile** — dispatch constraints, known failure modes, timing. Seeded
  from verified session observations. Updated when new operational facts emerge.
- **Verdict accuracy** — whether BLOCK/APPROVE verdicts correlated with real issues
  found downstream. Empty at creation; populated after qualifying runs where
  post-run validation confirmed or refuted the verdict.

**Dispatch summary** — one-line calibration hint injected into chain prompts per seat.
Format: *"Prior observation: [model] [known pattern]; verify [specific thing] before
weighting verdict."*

**How to update:** After any qualifying run (where downstream work validated or
refuted a chain verdict), add an entry to the relevant model's Verdict Accuracy
section. Include: date, what the verdict was, what downstream validation showed,
whether the verdict was accurate.

---

## gemma4:31b — Workshop Seat (Seat 1)

**Role in chain:** First pass — architectural shape, first-pass concerns, breadth.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~35GB |
| Typical inference time | ~4.2 min (CPU, 3841 chars output, 2026-05-08); ~4.0 min (GPU, RTX 4090, Gap 7 phase 1, 2026-05-13) |
| Dispatch method | Python streaming, timeout=32768, num_ctx=32768 |
| Known constraints | None documented beyond standard dispatch pattern |
| MCP usable? | No — CPU inference too slow for MCP timeout |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 1 | C1 (manual update mechanism) and C2 (silent failure in parsing) both confirmed by Seat 3 substrate read. Raised correct concerns but assessed overall as APPROVE without flagging empty database state. | Partial — concerns accurate; closure confidence overstated (missed empty database = mechanism without content) |
| 2026-05-13 | APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 1 | Global counter issue (session-local vs. global) identified only by Seat 3 substrate read of session-start.ps1. gemma gave clean APPROVE with no concerns — missed the semantic gap between global and session-local counting. | Partially accurate — mechanism correct, semantic precision gap missed |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 1 | No concerns raised. Correctly characterized Hanafi presence-check to Maliki/Shafi'i demonstrated-act evolution. Mechanism IS semantically correct in Gap 3 — bias toward APPROVE was correct verdict here. | Accurate — APPROVE correct, mechanism and semantics both sound |
| 2026-05-13 | APPROVE | Gap 4 (concern closure strength classifier) — Phase 1 | No concerns raised. Correctly identified ḥasan li-ghayrihi mapping — three-bucket algorithm's assertion-forward behavior mirrors weak-closure elevation. Mechanism and semantics both sound. Phase 2 APPROVE confirmed. | Accurate — APPROVE correct |
| 2026-05-13 | BLOCK | Gap 5 (formation testimony āḥād) — Phase 1 | Implementation absent at time of review. BLOCK correctly issued. Phase 2 APPROVE confirmed after implementation built. | Accurate — BLOCK correct (implementation absent) |
| 2026-05-13 | APPROVE | Gap 6 (model version boundary) — Phase 1 | No concerns raised. Correctly identified ikhtilāṭ mapping — version boundary treated as transmitter-state change requiring re-validation. Mechanism sound. Phase 2 APPROVE confirmed. | Accurate — APPROVE correct |
| 2026-05-13 | APPROVE | Gap 7 (no parallel-chain option) — Phase 1 | No concerns raised. Correctly assessed dual-pass mechanism as structural upgrade from āḥād to corroborative process. Acknowledged parametric independence residual as acceptable. Phase 2 APPROVE confirmed. | Accurate — APPROVE correct |

### Observed Bias Directions

*(7 run pattern: APPROVE when mechanism is sound, BLOCK when implementation is absent (Gap 5 — correct). No false positives or negatives across 7 gaps. Gap 2 semantic miss (session-local counter) remains the only documented miss. Probe explicitly: does the implementation match the classical concept's semantics, not just its structure?)*

### Dispatch Summary

*"gemma4:31b (7 qualifying runs, Gaps 1-7): APPROVE when mechanism sound, BLOCK when implementation absent (Gap 5 — accurate). Only miss: Gap 2 session-local counter semantic gap. No false positives or negatives across 7 gaps. Probe explicitly: classical-mapping semantics and session-boundary distinctions."*

---

## qwen3.6:27b — Deep-Dive Seat (Seat 2)

**Role in chain:** Investigates gemma concerns + SOTA research. Second architect.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~20GB |
| Typical inference time | ~2.1 min (GPU, RTX 4090, Gap 7 phase 1, 2026-05-13) |
| Dispatch method | Python streaming, timeout=32768, `think: True` TOP-LEVEL — C2 fix, commit bbb7952 |
| Known constraints | `think: True` must be top-level body key — captures CoT in `message.thinking`, improving deliberation depth. nemotron-3-super uses `think: False`; the two models differ. Without top-level placement, the parameter has no effect. |
| MCP usable? | No — CPU inference too slow for MCP timeout |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 1 | C1 (manual update mechanism, non-blocking) and C2 (silent failure in parsing, non-blocking) both confirmed by Seat 3 substrate read. Better calibrated than gemma — did not overclaim closure. Correctly noted cumulative nature of tradition as specific risk. | Accurate — concerns substrate-verified, confidence well-calibrated |
| 2026-05-13 | APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 1 | No concerns raised. Endorsed mechanism as correct, treated turn count as valid proxy for ḍabṭ decay. Missed global vs. session-local counter distinction that laguna caught in Phase 2. Same pattern as gemma on Gap 2. | Partially accurate — mechanism correct, session-boundary semantics gap missed |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 1 | No concerns raised. Correctly identified basename matching residual as acceptable given unique naming convention. Mechanism and semantics both sound — APPROVE was correct verdict. | Accurate — APPROVE correct, mechanism and semantics both sound |
| 2026-05-13 | N/A (aborted) | Gap 4 (concern closure strength classifier) — Phase 1 aborted | Ollama deadlock after gemma's 28-min CPU run kept slot occupied. Wudu check blocked dispatch. Not a qualifying verdict. | N/A |
| 2026-05-13 | BLOCK | Gap 5 (formation testimony āḥād) — Phase 1 | Correctly identified implementation absent. C3 called blocking (audit trail requirement) — stronger framing than gemma's non-blocking. All concerns confirmed accurate. Phase 2 APPROVE confirmed after implementation. | Accurate — BLOCK correct |
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 6 (model version boundary) — Phase 1 | C1 (self-report trust boundary, non-blocking): documented as architectural constraint with hardening path. C2 (regex claude-\S+ too narrow, non-blocking): confirmed accurate — regex broadened from (claude-\S+) to (\S+). Both concerns accurate and addressed. | Accurate — both concerns confirmed; C2 fixed by evidence |
| 2026-05-13 | APPROVE | Gap 7 (no parallel-chain option) — Phase 1 | Self-generated and evidence-closed C1 (temperature-parametric vs. architectural independence) using MAR literature. Phase 2 APPROVE confirmed. | Accurate — APPROVE correct; evidence-based closure |

### Observed Bias Directions

*(6 qualifying runs, 1 aborted. Gap 5 BLOCK accurate. Gap 6 CONDITIONAL_APPROVE — both concerns confirmed, one fixed. Gap 7 APPROVE with literature-backed evidence closure. Gap 2 session-boundary miss still documented. Pattern: misses session-boundary semantic gaps; accurate on structural and classical-mapping evaluations.)*

### Dispatch Summary

*"qwen3.6:27b (6 qualifying runs, 1 aborted, Gaps 1-7): Gap 1: CONDITIONAL_APPROVE, concerns accurate. Gap 2: APPROVE, missed session-boundary semantics (same as gemma). Gaps 3-5, 7: APPROVE correct. Gap 6: CONDITIONAL_APPROVE, concerns accurate and one fixed. think:False required top-level. Probe session-boundary and classical-mapping semantics."*

---

## laguna-xs.2:q4_K_M — Code Review Seat (Seat 4)

**Role in chain:** Structural audit, investigates qwen/Sonnet concerns. Also used
as governance scanner (governance_scanner.faith.md) between chain runs.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~28GB |
| Typical inference time | ~0.9 min (GPU, RTX 4090, Gap 7 phase 2, 2026-05-13); ~6s (governance scanner role, CPU, 2026-05-11) |
| Dispatch method | Python streaming OR mcp__ollama-mcp__ollama_chat (fast enough for MCP) |
| Known constraints | None — fastest model in the stack |
| Format discipline | Verified: clean format, issues omitted on PASS, one-sentence Reasoning. granite4.1:8b tested as alternative — disqualified for appending extra text outside verdict block. |
| MCP usable? | Yes — only model in the stack fast enough for MCP |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 2, code-review seat | C1 (empty database, non-blocking), C2 (silent failure, non-blocking), C3 (documentation gap, non-blocking) all confirmed by Seat 3 substrate read. Correctly distinguished mechanism-closure from data-closure — introduced C1 framing as "epistemic content missing." | Accurate — all three concerns substrate-verified |
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 2, code-review seat | C1 (global counter, non-blocking): identified that session-start.ps1 does not reset .turn-count.txt, confirmed by file read. Evidence-closed prior concern. Caught the semantic gap that both phase 1 models missed. Variance bounded at +/-30 turns. | Accurate — C1 substrate-verified by direct file read |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 2, code-review seat | C1 (basename matching, non-blocking): raised same edge case as Seat 3 and qwen independently. Closed prior C1 by assertion (accepted unique naming assumption without verifying), C2 and C3 by evidence. Reached same conclusion as Seat 3 synthesis on the one edge case. | Accurate — C1 correctly identified; assertion closure for C1 noted |
| 2026-05-13 | APPROVE | Gap 4 (concern closure strength classifier) — Phase 2, code-review | Evidence-closed C1/C2/C3 from prior concerns. Raised C1 (documentation rationale for conservative default) non-blocking. All closures by evidence. | Accurate — concerns and closures correct |
| 2026-05-13 | APPROVE | Gap 5 (formation testimony āḥād) — Phase 2, code-review | Evidence-closed all three BLOCK concerns after implementation. Clean APPROVE — directory exists, metadata correct, log updated. | Accurate — APPROVE correct |
| 2026-05-13 | PARSE_ERROR | Gap 6 (model version boundary) — Phase 2, code-review | Wrapped JSON in markdown fences causing parse failure. Raw content was APPROVE with no concerns. phase-2-report.json captured correct verdict from raw content. | Correct verdict (APPROVE content), format failure |
| 2026-05-13 | APPROVE | Gap 7 (no parallel-chain option) — Phase 2, code-review | Raised C1 (Phase 2 single-pass vs. dual-pass question), evidence-closed prior C1. Correctly assessed cross-run context as sufficient. GPU timing: ~0.9 min. | Accurate — APPROVE correct |

### Observed Bias Directions

*(7 run pattern: all correct verdicts. Two PARSE_ERRORs (Gap 6) — raw content APPROVE in both; JSON markdown fence wrapping is the failure mode. Catches gaps phase 1 misses via substrate read. Assertion-closure in Gap 3 C1 noted. GPU timing: ~0.9 min.)*

### Dispatch Summary

*"laguna-xs.2 (7 qualifying runs, Gaps 1-7): All verdicts correct. Two PARSE_ERRORs — raw content APPROVE in both; JSON markdown fence issue. Fastest model, strongest format discipline except fence wrapping. GPU: ~0.9 min. Check raw output before treating PARSE_ERROR as missing verdict."*

---

## granite4.1:30b — Governance Audit Seat (Seat 5)

**Role in chain:** Canon coherence, rule violations, governance audit. IBM training
for compliance and governance — categorical PASS/FAIL orientation.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~35GB |
| Typical inference time | ~1.9 min (GPU, RTX 4090, Gap 7 phase 2, 2026-05-13) |
| Dispatch method | Python streaming, timeout=32768 |
| Known constraints | granite4.1:8b is disqualified for governance scanner role (format drift — appends extra text). granite4.1:30b is the chain seat and has not shown the same drift. |
| MCP usable? | No — CPU inference too slow for MCP timeout |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 2, governance-audit seat | C1 (empty database), C2 (silent failure), C3 (documentation gap) all confirmed accurate. Correctly framed C3 as "potentially misleading readers about the current state of epistemic information." | Accurate — all three concerns substrate-verified |
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 2, governance-audit seat | C1 (global counter, non-blocking): raised same concern as laguna. Closed prior concern by assertion ("documented as accepted engineering trade-off") rather than by evidence. Concern accurate; closure method weaker than laguna. | Accurate concern; assertion closure without evidence (pattern: Gap 1 C3 also closed by assertion) |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 2, governance-audit seat | C1 (basename matching, non-blocking): same finding as laguna, correctly identified. Closed C1 by assertion (documented approximation). APPROVE verdict correct — semantics and mechanism both sound. | Accurate — concern and verdict both correct; assertion-closure pattern holds (3rd run) |
| 2026-05-13 | APPROVE | Gap 4 (concern closure strength classifier) — Phase 2, governance-audit | Raised C1 (hardcoded SONNET_SYNTHESIS + missing niyyah_audit in opctx-review.py, non-blocking). C1 was about the older chain runner, not the Gap 4 implementation files directly. APPROVE verdict correct. | Accurate verdict; C1 scope was adjacent file (opctx-review.py), not gap's substrate |
| 2026-05-13 | APPROVE | Gap 5 (formation testimony āḥād) — Phase 2, governance-audit | Evidence-closed all three BLOCK concerns. Correctly noted residual (āḥād interim state acceptable, must earn mutawātir). | Accurate — APPROVE correct |
| 2026-05-13 | PARSE_ERROR | Gap 6 (model version boundary) — Phase 2, governance-audit | Wrapped JSON in markdown fences causing parse failure. Raw content was APPROVE. | Correct verdict (APPROVE content), format failure |
| 2026-05-13 | APPROVE | Gap 7 (no parallel-chain option) — Phase 2, governance-audit | Raised C1 (parametric independence), assertion-closed (same assertion-closure pattern as prior runs). APPROVE verdict correct. GPU timing: ~1.9 min. | Accurate — verdict correct; assertion-closure pattern holds (4th run) |

### Observed Bias Directions

*(7 run pattern: concerns accurate all seven runs. Consistent assertion-closure — Gap 1 C3, Gap 2 C1, Gap 3 C1, Gap 7 C1 all assertion-closed. Two PARSE_ERRORs (Gap 6). Verdicts correct. Strong governance framing. Verify assertion closures independently before accepting.)*

### Dispatch Summary

*"granite4.1:30b (7 qualifying runs, Gaps 1-7): CONDITIONAL_APPROVE or APPROVE. Concerns accurate all runs. Consistent assertion-closure pattern (4 of 7 runs). Two PARSE_ERRORs — markdown fence issue same as laguna. GPU: ~1.9 min. Verify assertion closures before accepting."*

---

## nemotron-3-super:latest — Final Verdict Seat (Seat 6)

**Role in chain:** Assumption auditing, final verdict. NVIDIA training for
high-throughput deliberation. Last seat before executor.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~93.5GB (Q4_K_M) |
| Available RAM after load | ~98GB on The Factory (192GB total) |
| Maximum safe num_ctx | 32768 — 65K causes Ollama 500 OOM (KV cache exceeds available RAM) |
| Typical inference time | ~5.0 min (GPU, RTX 4090, Gap 7 phase 2, 2026-05-13) |
| Dispatch method | Python streaming only, timeout=32768, `think: False` TOP-LEVEL |
| Known constraints | (1) `think: False` required top-level — without it, chain-of-thought consumes entire output budget before content begins, producing 0 chars of actual output. (2) Cache deadlock: if repeated 500 errors occur despite empty api/ps, Ollama is holding weights in process memory. Fix: kill Ollama process entirely, restart. (3) Large prompt tokens consume num_ctx — if synthesis prompt is 12-15K tokens and num_ctx=32768, only 17-20K tokens remain for output. |
| MCP usable? | No — 93.5GB model, MCP timeout far too short |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | CONDITIONAL_APPROVE | P6 cryptographic non-repudiation architecture (RFC 3161 TSA + SSH-signed git) | Implementation proceeded as approved. C1 (TSA fail-open behavior) and C2 (dual-remote resilience) both valid non-blocking concerns — confirmed accurate. C3 closed by string assertion — accuracy not yet confirmed by downstream testing. | Partial — C1/C2 accurate; C3 closure method was assertion, not evidence |
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 2, synthesis seat | C1 (empty database), C2 (silent failure), C3 (documentation gap) all confirmed accurate by Seat 3 substrate read. Strong framing: correctly distinguished "mechanism closure" from "epistemic closure." C3 closed by assertion in this run — same pattern as P6 run. | Accurate — concerns substrate-verified; C3 assertion-closure pattern now observed twice |
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 2, synthesis seat | C1 (global vs. session-local, non-blocking): accurate concern. Used "refutation" close_type in closed_prior_concerns to flag prior agents had not examined global/session distinction. Concern already evidence-closed by laguna before nemotron ran. No assertion closure observed in this run. | Accurate — concern correct; meta-observation about prior seat gaps notable |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 2, synthesis seat | No concerns raised. Closed C1 (basename matching) by evidence — used prior agent convergence (laguna + granite + Seat 3 all reached same conclusion independently) as evidence of practical bound. Closed C2 (abstract fail-open) by assertion. Correctly assessed unanimous chain conclusion. | Accurate — APPROVE correct; notable: treats prior agent convergence as evidence for closure |
| 2026-05-13 | APPROVE | Gap 4 (concern closure strength classifier) — Phase 2, synthesis | No new concerns. Confirmed evidence closures of all prior concerns. Correctly assessed mechanism as complete closure. | Accurate — APPROVE correct |
| 2026-05-13 | APPROVE | Gap 5 (formation testimony āḥād) — Phase 2, synthesis | Evidence-closed all BLOCK concerns. Correctly distinguished structural closure (complete) from epistemic closure (ongoing — must earn mutawātir through future sessions). | Accurate — APPROVE correct; structural vs. epistemic closure distinction notable |
| 2026-05-13 | APPROVE | Gap 6 (model version boundary) — Phase 2, synthesis | Evidence-closed C2 (regex broadened per qwen's finding) and C3 (bootstrapping fix unconditional); assertion-closed C1 (self-report architectural constraint — no fix available at hook level). Correct differential: evidence vs. assertion matching resolution level. | Accurate — correct close_type matching per concern resolution level |
| 2026-05-13 | APPROVE | Gap 7 (no parallel-chain option) — Phase 2, synthesis | Raised C1 (Phase 2 single-pass question), evidence-closed with literature (no sources advocate redundant re-runs with full context available). GPU timing: ~5.0 min. | Accurate — evidence-based closure with literature support |

### Observed Bias Directions

*(8 run pattern: all correct verdicts. Assertion closure in P6 and Gap 1 (when first to close with no prior evidence). No assertion closure in Gaps 2-7 (prior evidence available in all cases). Uses prior agent convergence as evidence when available (Gap 3). GPU: ~5.0 min. Strong conceptual framing — consistently names structural distinctions well.)*

### Dispatch Summary

*"nemotron-3-super (8 qualifying runs, P6+Gaps 1-7): CONDITIONAL_APPROVE on P6+Gaps 1+2; APPROVE on Gaps 3-7. Concerns accurate all runs. Assertion closure only when first to address with no prior evidence (P6 C3, Gap 1 C3) — pattern absent Gaps 2-7. GPU: ~5.0 min. Strong conceptual framing."*

---

## claude-sonnet-4-6 — Architect Seat (Seat 3) + Executor Seat (Seat 7)

**Role in chain:** Seat 3: architect synthesis, holds history context local models
lack, runs SearxNG, produces synthesis before laguna. Seat 7: separate Agent
instance spawned after final verdict, implements the agreed changes.

### Operational Profile

| Field | Value |
|-------|-------|
| Seat 3 | Text output only — not an Ollama dispatch. Reads gemma + qwen outputs, adds history context and SearxNG research. |
| Seat 7 | Separate Agent instance (subagent_type=general-purpose). NOT the same instance as Seat 3. Governed by subagent-start.ps1. |
| Known constraints | Seat 3 does not produce a structured JSON verdict — it produces architect synthesis in text. Seat 7 must be spawned as a new Agent; the Seat 3 instance cannot act as executor. |

### Verdict Accuracy Record

*(Seat 3 produces synthesis, not verdicts — accuracy tracked by downstream executor
outcomes rather than BLOCK/APPROVE verdicts.)*

### Observed Bias Directions

*(Not tracked in this file — this is the instance maintaining the file, which
creates a conflict of interest. Operator audit is the appropriate mechanism.)*

### Dispatch Summary

*"claude-sonnet-4-6 (Seat 3): architect synthesis with history context. Not
independently auditable in this file — operator audit applies. Seat 7: spawned
Agent, governed by subagent-start.ps1."*

---

## kimi-k2.7-code — Executor Seat (Phase-2, reasoning-heavy mode)

**Role in chain:** Phase-2 executor in the `reasoning-heavy` seat mode — the per-step
writer that must produce a usable artifact EVERY step. Ollama Cloud coder. Seated
2026-06-17 (operator three-way hard bake-off).

### Operational Profile

| Field | Value |
|-------|-------|
| Capability | Hard battery (expression-evaluator w/ precedence; topo-sort w/ cycle detection; LRU recency; full semver precedence; safe deep-path access) — solved ALL 5 correctly. Co-best with Sonnet + GLM-5.2 at the ceiling. |
| Reliability | 100% clean emission every run — zero empties across the battery. Decisive seat property: a per-step executor must emit every step. |
| Speed/cost | Fast raw API, token-efficient / cheap (metered). |
| Fallback | CLAUDE_SEAT_MAP → sonnet (proven reliable executor) if cloud fails. |

### Reliability + Capability Record

Three-way bake-off 2026-06-17 (Kimi-2.7 vs GLM-5.2 vs Sonnet): capability tie at the
ceiling; Kimi = Sonnet on reliability (clean every run). Quality parity with Sonnet — its
edge over Sonnet is cost/speed (not quality); its edge over GLM-5.2 is reliable emission.

### Dispatch Summary

*"kimi-k2.7-code: Phase-2 executor (reasoning-heavy). Co-best-with-Sonnet capability + 100%
clean emission + cheap/fast = the right per-step executor. Sonnet fallback via CLAUDE_SEAT_MAP."*

---

## glm-5.2 — Phase-3 Audit Seat (NOT a Phase-2 executor)

**Role in chain:** Phase-3 adversarial audit (verdict). Ollama Cloud (Z.ai), 1M ctx,
long-horizon coder, SWE-bench Pro 62.1. Explicitly KEPT OUT of the Phase-2 executor seat.

### Operational Profile

| Field | Value |
|-------|-------|
| Capability | Capability-equal with Kimi + Sonnet — solved all 5 hard-battery tasks. No raw-ability gap at the top. |
| Reliability (the finding) | INTERMITTENT EMPTY OUTPUT on hard tasks — 1 empty in 3 semver retries + earlier low-budget empties. Recovers on retry but UNPREDICTABLE — a per-step executor cannot tolerate it. |
| Audit strength | Strong in Phase-3 — caught a real logic bug + a traversal vuln. A rare empty is a cheap retry here. |

### Reliability + Capability Record

A single-task head-to-head (2026-06-17, oracle-d1.js answers[] edit) PASSED — which MISSED
the intermittent-empty the harder multi-task battery exposed. **Lesson: one-task validation
is insufficient for emission reliability — it needs a multi-run battery.** Consequence: the
reasoning-heavy executor seat was corrected glm-5.2 → kimi-k2.7-code (2026-06-17).

### Dispatch Summary

*"glm-5.2: capability-equal but intermittent-empty — KEEP OUT of Phase-2 (per-step emission
liability). Phase-3 AUDIT only, where it tests strong and a rare empty is a cheap retry."*

---

## Maintenance

**When to update this file:**
- After any qualifying run where the chain reached a verdict
- After downstream work validates or refutes a concern from a prior run
- When a new operational constraint is discovered for any model
- When a model version changes (version boundary = potential ḍabṭ shift)

**What makes a run "qualifying":**
A run where the executor implemented the chain's verdict AND the result was
observable — the implementation either worked as expected or revealed that a
concern was accurate/inaccurate.

**Version tracking:** Record model version changes in CURRENT-STATE.md when
they occur. A model version boundary may shift verdict behavior without any
operational symptom — treat it as a ḍabṭ-reset event for that model's
verdict accuracy record.

*File created: 2026-05-13. First qualifying run entry: nemotron P6 architecture review.*
