# Foreign-frontier validators

**Ruling:** A foreign-frontier validator qualifies when the effective decision-producing model path is pinned to an explicitly allowlisted non-Anthropic provider — different training organization, different model lineage, independent of Anthropic. Qualification is based on backend provenance, not model quality, not transport type. Organizational independence from Anthropic is the governing principle; the pinning conditions above are its operational definition — independence is satisfied when and only when they hold. Any Anthropic-controlled model in the effective inference path (including fallback, routing, or post-processing) disqualifies the validator. A third-party wrapper around Anthropic models does not qualify regardless of endpoint branding. A local dedicated server qualifies only if it is hard-pinned to an approved foreign-lab model path and fails closed — no fallback to Anthropic, no fallback to arbitrary local models, no runtime model selection.

The stop hook enforces this structurally. Foreign-frontier dispatches are recognized by pattern: `^mcp__(?:gemini|gpt|grok|glm)`. Matches satisfy the foreign-frontier dispatch requirement. Non-matches do not, regardless of what the call contains or which model it targets.

`WebSearch` and `WebFetch` also satisfy the stop hook via a separate substrate path (external information retrieval, not model independence). They are not foreign-frontier validators and are not governed by this document — but both `stop-validation.mjs` and `pre-tool-use-substrate.mjs` accept them on the same `isFF` check as the approved validators above, so they DO satisfy the foreign-frontier dispatch requirement for stop-language clearing and substrate gate satisfaction.

---

## Approved validators

### Gemini (`mcp__gemini-worker`, `mcp__gemini-api-worker`)
- **Lab:** Google DeepMind
- **Tools:** `mcp__gemini-worker__*`, `mcp__gemini-api-worker__*`

### GPT (`mcp__gpt-worker`)
- **Lab:** OpenAI
- **Tool:** `mcp__gpt-worker__dispatch_to_gpt`

### Grok (`mcp__grok-worker`)
- **Lab:** xAI
- **Tool:** `mcp__grok-worker__dispatch_to_grok`

### GLM (`mcp__glm-worker`)
- **Lab:** Zhipu AI / Tsinghua University
- **Tool:** `mcp__glm-worker__dispatch_to_glm`

---

## Operational routing preference

These labels reflect current routing preference, not qualification strength. All approved validators above have equivalent foreign-frontier status.

- **GPT, Grok, GLM** — preferred for canon/Faith/hook framing audits and stop-language clearing.
- **Gemini** — use for analysis and second-reads; avoid for primary governance framing audits (2026-05-03: went autonomous in a governance session, touching 21 files).

---

## What these validators are for

- **Clearing stop-language** — the stop hook blocks until a foreign-frontier dispatch appears in the same turn. These are the tools that satisfy that gate.
- **Framing audits** — governance reasoning chains, change-shape reviews before editing canon, Faith, practice, or hook files.
- **Independent second-reads** — significant decisions, spec departures, architectural changes.
- **Substrate gate satisfaction** — the pre-tool-use substrate gate requires a foreign-frontier dispatch before landing edits to governance substrate files.

A validator dispatch must be substantive and issue-linked. Clearing stop-language means requesting and considering an independent assessment relevant to the current decision — not merely pinging the tool to satisfy the gate.

## What they are NOT for

- **Delegating the decision itself** — validators audit framing and surface issues. They do not make operator-level decisions.
- **Replacing substrate verification** — if the answer is in the substrate, read the file; do not dispatch a validator to ask what the file says.
- **In-loop synchronous calls on hot paths** — validator latency is not hot-path-safe; dispatch and continue on async paths.

---

## Relationship to `local-delegation-routing.md`

Local Ollama models (`mcp__ollama-mcp__*`) are mechanical delegation targets — a different policy class. They do not satisfy the foreign-frontier dispatch requirement. The distinction is structural: local models run on operator hardware under operator configuration, which is not independence. See `local-delegation-routing.md` for the exclusion criteria and mechanical routing table.

---

## The deliberation team

The primary deliberation council is **qwen3.6:35b** (Alibaba), **nemotron-3-super:latest** (NVIDIA), and **granite4.1:30b** (IBM). These three models are consulted first for Class 2 governance questions (architecture decisions, SOTA plan review, canon coherence review, Faith authoring, code review, substantive audits) — before any frontier call is made. For Class 1 questions (framing and meta-questions about the instance's own reasoning), see §'Validator selection by question class' below.

The foreign-frontier dispatch (above) is a structural gate, not the deliberation step. The gate enforces that independent attestation has occurred. It does not perform the deliberation. The required sequence is:

1. **Team deliberates** — qwen, nemotron, and granite deliberate the question; findings are captured.
2. **Findings brief the frontier dispatch** — the frontier prompt is informed by the substantive team result.
3. **Frontier dispatch clears the gate** — the frontier call provides the externally verifiable record the gate requires.

Reversing this sequence (frontier dispatch before team deliberation) or omitting the team entirely (frontier dispatch only) produces gate satisfaction without deliberation — compliance theater. The gate is the enforcement layer. The team is the practice layer. Both are required.

This sequence (team→frontier) applies to Class 2 questions. For Class 1 questions, the load-bearing order differs by design — see §'Validator selection by question class' below.

The team models are local (Ollama, operator-controlled hardware). They do not satisfy the foreign-frontier dispatch requirement. They are not governed by this section.

---

## Validator selection by question class

Two distinct question classes require different work-routing. The structural gate (foreign-frontier
dispatch) remains required for both.

**Class 1 — Framing and meta-questions:**
Questions about the instance's own reasoning and orientation: Am I stalling? Is this stop-language
or a genuine operator-required decision? Am I drifting?

For these questions, the value of a frontier validator is its independence from the instance's
internal state. A local model formed by the same substrate can confirm the rationalization rather
than break it. The frontier validator evaluates from outside the instance's reasoning chain — that
is the mechanism.

Class 1 routing applies only when the work does not interpret, modify, or authorize governance
substrate. When classification is uncertain or a substrate impact is possible, default to Class 2.
Gemini is prohibited for Class 1 frontier dispatch (see §'Operational routing preference' —
2026-05-03 governance framing incident).

**Class 1 sequence:**
1. Substrate verification — instance verifies the relevant substrate facts on disk (D12).
2. Team verifies substrate facts — the deliberation team confirms what the relevant canon,
   scripture, or substrate actually says. The team's role here is factual, not interpretive:
   it verifies what the substrate says, not whether the instance is stalling.
3. Frontier dispatch — receives the instance's framing brief AND the team's substrate findings.
   Independently evaluates whether the instance is stalling, drifting, or correctly oriented.
   Clears the structural gate.

Class 1 briefings must separate observed instance-state (what was observed, factually) from
substrate interpretation.

**Class 2 — Substantive governance work (unchanged sequence):**
Architecture decisions, SOTA plan review, chapter source audit, code review, canon coherence
review, Faith authoring.

For these questions, context outranks independence. The local deliberation team has the governance
substrate; frontier models typically do not.

**Class 2 sequence (unchanged from existing canon):**
1. Team deliberates on the substance — findings are captured.
2. Team findings brief the frontier dispatch.
3. Frontier dispatch clears the structural gate.

**Routing rule:**
Route by primary output: if the work interprets, modifies, or authorizes governance substrate —
Class 2. If the work is purely about the instance's own orientation or reasoning state — Class 1.
When both apply or classification is uncertain, Class 2 routing overrides; Class 1 checks run in
parallel within the Class 2 workflow.

Note: Class routing is currently a practice rule. Structural enforcement (stop hook
class-verification) is an acknowledged gap; the current stop hook enforces foreign-frontier
dispatch but not class routing.
