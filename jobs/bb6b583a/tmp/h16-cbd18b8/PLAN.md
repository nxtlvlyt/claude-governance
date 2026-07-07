# Muezzin Plugin — Build Plan (v0.3 — operationalized; pending re-witness)

**Lineage:** the 3-phase chain is the EVOLUTION of the 6/7-agent deliberation stack
(`~/.claude/canon/6agent-deliberation-stack.md`). v0.3 INHERITS that canon's proven mechanisms instead
of reinventing them, and grounds the state keystone in agy's **Mission 31** implementation plan.
**Status:** operationalized (closes round-2 "still a sketch"). Pending the witness panel.
**Deferred (operator gate):** exact phase/model assignments come after this clears.

---

## 0. Role (settled)
Conductor / **mechanical enforcer** — no judgment. Dispatches seats, **routes** missions, gates on
machine-readable verdicts, verifies substrate, compiles the record. Seats (open-weight) judge.
**No faith — a restraint charter** in the skill (verify before you write; defer judgment to seats; you
are the caller not the prayer; explicit escalation conditions), made mechanical by hooks.

## 1. Packaging (settled)
Claude Code **plugin**: `/muezzin` command + bundled 3-phase **Workflow** engine + seat subagents +
Opus integrator + hooks (self-heal, resume) + Ollama waterfall + scheduled heartbeat.

---

## 2. KEYSTONE — Muezzin-managed state (agy Mission 31, operationalized)

**Issue (Directive 1):** LLMs write the record as freeform markdown; ~370 lines of brittle regex parse
it back; models can hallucinate/skip/break the parser. A model's claim becomes the record — but a
model's word is not truth; the verified file is.

**Fix (inversion):** seats emit **structured JSON verdicts**; the Muezzin runtime verifies against disk
and compiles the record. Operationalized per M31:
- **Verdict Contract Schema v1.2.0** (in `state-schema.json`): `verdict_contract`, `verdict_finding`,
  `verdict_concern_disposition`, `verdict_ruling`, `verdict_pipeline_update`.
- **Deterministic merge engine** (in `state-compaction.mjs`): `validateVerdictContract(contract)` (schema
  compliance + 50-findings/seat cap); `mergeVerdicts(verdicts)` (severity-hierarchical: any BLOCK→BLOCK;
  warnings/revisions→REVISE; unanimous→APPROVE); `buildStateMdUpdate(merged, statePath)` (programmatically
  builds STATE.md sections — Pipeline Status, Active Concerns, Rulings, Handoff — no LLM markdown editing).
- **Orchestrator integration** (`antigravity-muezzin.mjs` / Claude port): pass `response_format:{type:
  "json_object"}` where supported; capture structured JSON from Laguna/Granite/Scanner/Nemotron-Super;
  **atomic STATE.md write** (temp → round-trip parse check → backup → rename); save
  `phase-3-isha-decision-log.json`; run `compactAfterIsha()`.
- **Reuse, not rewrite:** `state-compaction.mjs` already has `fs.access` verify, SHA-256 checksums,
  atomic write, archive/prune. Add a **prev-hash chain** on the state-compact sequence (tamper-evidence).

---

## 3. INHERITED from the 6/7-agent canon (do not reinvent)

- **Structured output contract** — the M31 schemas extend the canon's verdict JSON (verdict / concerns /
  investigation_task / close_type / search_findings).
- **Blind-eval independence** → **CLOSES the correlated-failure gap.** Each seat (esp. the synthesizer)
  forms a BLIND assessment written to disk BEFORE reading the others; a downstream seat audits whether
  anyone deferred (`INDEPENDENCE: PASS/FAIL`); a hook hard-fails if the blind artifact is missing. Prevents
  groupthink by STRUCTURE, not after-the-fact detection.
- **Assertion-closure (ḥasan li-ghayrihi)** → **CLOSES producer=verifier / circular trust.** A concern
  "closed by assertion" (opinion, no evidence) is NOT closed — it carries forward until closed by
  `evidence` or `refutation`. Opinion ≠ proof, enforced.
- **Two-pass concern propagation** — no duplicate or dropped concerns across seats.
- **Failed-seat-is-BLOCK** — "absence is not APPROVE." Non-JSON / truncated / timeout = failed seat;
  re-dispatch ≤2, then BLOCK. Proceeding past a failed seat corrupts the verdict.
- **Niyyah-as-contract** — each seat audits the declared niyyah (`niyyah_audit`).

## 4. Routing (muezzin-determined, by rule off the JSON verdict)
Mode-selection and escalation are ONE ladder, owned by the muezzin (not the operator):
- **Build time:** set mode from the mission's need — high-reasoning → cloud-only; simple → local-only;
  else waterfall. The 3 configs already exist (`3phase-consensus-{cloud,local,waterfall}.json`).
- **On failure (reads the structured verdict):** local couldn't reason it → escalate to cloud; cloud
  rate-limited (429) → heal-retry then local; **substantive** BLOCK (real problem, not capability) →
  escalate to operator. Waterfall = cloud (3 adaptive heals: 429→backoff, ctx→drop num_ctx,
  model-not-found→fix suffix, timeout→extend; fail-fast on 4xx) → local. Ollama channel only.
- **Cloud throttle:** parallel-safe re GPU, but rate-limited — cap concurrent cloud calls + backoff.
- **Producer ≠ verifier:** a generative seat and the seat that verifies it must be different model
  families (heterogeneity), so verification is independent.

## 5. Missions & state
Origin: operator OR the chain's own output (errors, re-verification, follow-on). Format (MISSIONS.md):
Task + Status + Substrate-Evidence(paths) + AC + Confidence + **mode**. **Size ceiling:** a token/char
budget on a sub-state; exceed → SPLIT into sub-missions (muezzin spawns + queues). **Sub-state + merge
(M42, 0.98):** thin project registry (MISSIONS.md-style) + per-mission isolated sub-state; muezzin
merges/compresses each up at Isha. **Write scope:** allowlist derived from the actual mission footprint
(`.agents`, `.bun/ai`, `E:/AI_Storage/*`, `llama.cpp/dji_test`, `.gemini/antigravity-cli`,
`.claude/hooks`); block outside unless a mission declares the path.

---

## 6. Round-2 witness gaps → v0.3 closure
| Still-open (round 2) | v0.3 |
|---|---|
| Correlated-failure detection | INHERITED: blind-eval + independence audit (§3) |
| Producer=verifier circular trust | INHERITED: assertion-closure (§3) + producer≠verifier (§4) |
| Verdicts/compress "not operationalized" | M31 schemas + merge engine + buildStateMdUpdate (§2) |
| "parallel-safe" overstated (rate limits) | cloud throttle + backoff (§4) |
| Size ceiling undefined | token/char budget → split (§5) |
| Durable-resume unvalidated | **TEST** Claude Workflow cross-session resume before relying on it (action, not note) |
| Adversarial self-test; cross-mission memory | honest v2 (M33 roadmap), not v1 |

## 7. Stale skill fixes (`.agents/skills/muezzin/SKILL.md`)
Remove Grok; waterfall → Ollama-cloud(3)→local only (drop OpenRouter/NVIDIA/AIMLAPI); identity flip
("verifies and compiles" not "reasons about consensus"); manual-STATE.md rule → mechanically-true.
Claude muezzin gets its OWN corrected skill.

## 8. Next
Re-witness v0.3 → close remainder → repeat to SOTA-READY → TEST durable-resume → then build (M31 schemas
+ merge engine first, it's the keystone) → then phases + models.
