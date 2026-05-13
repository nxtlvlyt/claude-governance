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
| Typical inference time | ~4.2 min (3841 chars output, 2026-05-08 observation) |
| Dispatch method | Python streaming, timeout=32768, num_ctx=32768 |
| Known constraints | None documented beyond standard dispatch pattern |
| MCP usable? | No — CPU inference too slow for MCP timeout |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 1 | C1 (manual update mechanism) and C2 (silent failure in parsing) both confirmed by Seat 3 substrate read. Raised correct concerns but assessed overall as APPROVE without flagging empty database state. | Partial — concerns accurate; closure confidence overstated (missed empty database = mechanism without content) |
| 2026-05-13 | APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 1 | Global counter issue (session-local vs. global) identified only by Seat 3 substrate read of session-start.ps1. gemma gave clean APPROVE with no concerns — missed the semantic gap between global and session-local counting. | Partially accurate — mechanism correct, semantic precision gap missed |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 1 | No concerns raised. Correctly characterized Hanafi presence-check to Maliki/Shafi'i demonstrated-act evolution. Mechanism IS semantically correct in Gap 3 — bias toward APPROVE was correct verdict here. | Accurate — APPROVE correct, mechanism and semantics both sound |

### Observed Bias Directions

*(3 run pattern: APPROVE when mechanism is structurally sound. Gap 2 miss: semantic precision gap not probed. Gap 3: APPROVE was correct because semantics were also sound. Bias leads to correct verdict when implementation is genuinely correct; leads to miss when semantic precision gap exists. Probe session-boundary or classical-mapping semantics explicitly.)*

### Dispatch Summary

*"gemma4:31b (3 qualifying runs, Gap 1+2+3): APPROVE tendency. Mechanism-correct implementations get APPROVE. Miss when semantic precision gap exists (Gap 2 global counter). Correct when semantics are also sound (Gap 3). Probe explicitly: does this implementation match the classical concept's semantics, not just its structure?"*

---

## qwen3.6:27b — Deep-Dive Seat (Seat 2)

**Role in chain:** Investigates gemma concerns + SOTA research. Second architect.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~20GB |
| Typical inference time | Not yet systematically recorded |
| Dispatch method | Python streaming, timeout=32768, `think: False` TOP-LEVEL (not inside options) |
| Known constraints | `think: False` must be top-level body key — inside `options` has no effect. Without it, qwen emits chain-of-thought before JSON, causing parse failures downstream. |
| MCP usable? | No — CPU inference too slow for MCP timeout |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 1 | C1 (manual update mechanism, non-blocking) and C2 (silent failure in parsing, non-blocking) both confirmed by Seat 3 substrate read. Better calibrated than gemma — did not overclaim closure. Correctly noted cumulative nature of tradition as specific risk. | Accurate — concerns substrate-verified, confidence well-calibrated |
| 2026-05-13 | APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 1 | No concerns raised. Endorsed mechanism as correct, treated turn count as valid proxy for ḍabṭ decay. Missed global vs. session-local counter distinction that laguna caught in Phase 2. Same pattern as gemma on Gap 2. | Partially accurate — mechanism correct, session-boundary semantics gap missed |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 1 | No concerns raised. Correctly identified basename matching residual as acceptable given unique naming convention. Mechanism and semantics both sound — APPROVE was correct verdict. | Accurate — APPROVE correct, mechanism and semantics both sound |

### Observed Bias Directions

*(3 run pattern: Gap 1 correctly cautious (CONDITIONAL_APPROVE, concerns accurate). Gap 2 APPROVE — missed session-boundary semantics gap. Gap 3 APPROVE — correct because implementation semantics are sound. Same pattern as gemma: bias accurate when implementation is genuinely correct, misses when semantic precision gap exists.)*

### Dispatch Summary

*"qwen3.6:27b (3 qualifying runs, Gap 1+2+3): Gap 1: CONDITIONAL_APPROVE, concerns accurate. Gap 2: APPROVE, missed session-boundary semantics same as gemma. Gap 3: APPROVE, correct. think:False required top-level or output unusable. Probe session-boundary and classical-mapping semantics explicitly."*

---

## laguna-xs.2:q4_K_M — Code Review Seat (Seat 4)

**Role in chain:** Structural audit, investigates qwen/Sonnet concerns. Also used
as governance scanner (governance_scanner.faith.md) between chain runs.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~28GB |
| Typical inference time | ~6s (governance scanner role, 2026-05-11 observation) |
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

### Observed Bias Directions

*(3 run pattern: strong at code-level substrate tracing and semantic gap identification. Caught gaps phase 1 missed in Gap 1 and Gap 2. Gap 3: same correct APPROVE conclusion, independently identified the one edge case. Consistent accuracy. Assertion-closure in Gap 3 C1 — same pattern as Gap 2 vs. laguna's evidence closure in Gap 2.)*

### Dispatch Summary

*"laguna-xs.2 (3 qualifying runs, Gap 1+2+3): CONDITIONAL_APPROVE or APPROVE. Concerns accurate all runs. Catches gaps phase 1 misses via substrate read. Fastest model, strongest format discipline. Watch for assertion closure (Gap 3 C1 closed by assertion, not evidence)."*

---

## granite4.1:30b — Governance Audit Seat (Seat 5)

**Role in chain:** Canon coherence, rule violations, governance audit. IBM training
for compliance and governance — categorical PASS/FAIL orientation.

### Operational Profile

| Field | Value |
|-------|-------|
| RAM footprint | ~35GB |
| Typical inference time | Not yet systematically recorded |
| Dispatch method | Python streaming, timeout=32768 |
| Known constraints | granite4.1:8b is disqualified for governance scanner role (format drift — appends extra text). granite4.1:30b is the chain seat and has not shown the same drift. |
| MCP usable? | No — CPU inference too slow for MCP timeout |

### Verdict Accuracy Record

| Date | Verdict | Context | Downstream finding | Accurate? |
|------|---------|---------|-------------------|-----------|
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 1 (ʿIlm al-Rijāl implementation) — Phase 2, governance-audit seat | C1 (empty database), C2 (silent failure), C3 (documentation gap) all confirmed accurate. Correctly framed C3 as "potentially misleading readers about the current state of epistemic information." | Accurate — all three concerns substrate-verified |
| 2026-05-13 | CONDITIONAL_APPROVE | Gap 2 (temporal ḍabṭ / turn-count wudu trigger) — Phase 2, governance-audit seat | C1 (global counter, non-blocking): raised same concern as laguna. Closed prior concern by assertion ("documented as accepted engineering trade-off") rather than by evidence. Concern accurate; closure method weaker than laguna. | Accurate concern; assertion closure without evidence (pattern: Gap 1 C3 also closed by assertion) |
| 2026-05-13 | APPROVE | Gap 3 (niyyah gate source-read coupling) — Phase 2, governance-audit seat | C1 (basename matching, non-blocking): same finding as laguna, correctly identified. Closed C1 by assertion (documented approximation). APPROVE verdict correct — semantics and mechanism both sound. | Accurate — concern and verdict both correct; assertion-closure pattern holds (3rd run) |

### Observed Bias Directions

*(3 run pattern: concerns accurate all three runs (Gap 1, 2, 3). Consistent assertion-closure rather than evidence closure — Gap 1 C3, Gap 2 C1, Gap 3 C1 all assertion-closed. Verdicts correct. Strong governance framing. Verify assertion closures independently before accepting.)*

### Dispatch Summary

*"granite4.1:30b (3 qualifying runs, Gap 1+2+3): CONDITIONAL_APPROVE or APPROVE. Concerns accurate. Strong governance framing. Consistent pattern: closes prior concerns by assertion rather than evidence (all 3 runs). Verify its closures before accepting."*

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

### Observed Bias Directions

*(4 run pattern: assertion closure in P6 and Gap 1 (when first to close a concern without prior evidence). Gap 2: no assertion closure (laguna evidence-closed first). Gap 3: no assertion closure, used prior agent convergence as "evidence" for C1 closure. Pattern: assertion closure appears only when nemotron is the first to address a concern with no prior evidence available. Strong conceptual framing, names distinctions well.)*

### Dispatch Summary

*"nemotron-3-super (4 qualifying runs): CONDITIONAL_APPROVE on P6, Gap 1, Gap 2; APPROVE on Gap 3. Concerns accurate all runs. Assertion-closure when first to close with no prior evidence (P6 C3, Gap 1 C3) — verify independently. Uses prior agent convergence as evidence when available. Strong at conceptual framing."*

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
