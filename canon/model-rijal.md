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

### Observed Bias Directions

*(2 run pattern: gives APPROVE when mechanism is structurally sound, regardless of semantic precision of the implementation relative to classical concept. Does not probe whether counter semantics match the classical model. Probe semantic fidelity explicitly.)*

### Dispatch Summary

*"gemma4:31b (2 qualifying runs, Gap 1+2): APPROVE tendency. Mechanism-correct implementations get APPROVE even when semantic precision is low. Probe explicitly: does this implementation match the classical concept's semantics, not just its structure?"*

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

### Observed Bias Directions

*(1 run observation: appropriately cautious. Did not miss the structural/content distinction as gemma did.)*

### Dispatch Summary

*"qwen3.6:27b (1 qualifying run, Gap 1): CONDITIONAL_APPROVE. Concerns accurate, well-calibrated. No known overstatement tendency. think:False required top-level or output unusable."*

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

### Observed Bias Directions

*(1 run observation: strong at code-level precision (correctly traced get_rijal_summary() failure mode). Introduced "epistemic content missing" framing that other seats echoed.)*

### Dispatch Summary

*"laguna-xs.2 (1 qualifying run, Gap 1): CONDITIONAL_APPROVE. Concerns accurate. Strongest format discipline in stack. Good at code-level tracing. Use for structural/code concerns."*

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

### Observed Bias Directions

*(1 run observation: strong governance framing, good at documentation/misleading-reader concerns. No overreach observed.)*

### Dispatch Summary

*"granite4.1:30b (1 qualifying run, Gap 1): CONDITIONAL_APPROVE. Concerns accurate. Strong governance/documentation framing. Expects canon-grounded rationale."*

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

### Observed Bias Directions

*(2 run pattern emerging: accepts assertion closure in final synthesis seat (P6 C3, Gap 1 C3 both closed by assertion without evidence). Strong at naming conceptual distinctions (mechanism vs. epistemic closure). Monitor for assertion-closure tendency.)*

### Dispatch Summary

*"nemotron-3-super (2 qualifying runs): CONDITIONAL_APPROVE on P6 and Gap 1. Concerns accurate both runs. Pattern: accepts assertion-closed concerns as sufficient for final verdict — verify assertion-closed concerns independently. Strong at conceptual framing."*

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
