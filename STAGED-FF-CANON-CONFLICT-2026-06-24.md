# STAGED PATCH — Foreign-Frontier Canon/Ruling Conflict (2026-06-24)

**Class:** ceremony / governance-event (per operator-rulings.md "STALE-TEXT CLEANUP OWED, fresh context")
**Status:** STAGED — not yet applied. Awaits a fresh-oriented governance session that has read `~/.claude/practice/extended/` first.
**Surfaced by:** 2026-06-24 conductor session, prompted by operator's question "how do we fix this bypass you found?"

---

## The conflict (substrate-verbatim)

### File A: `~/.claude/canon/foreign-frontier-validators.md`

> "A foreign-frontier validator qualifies when the effective decision-producing model path is pinned to an explicitly allowlisted non-Anthropic provider… Qualification is based on backend provenance, not model quality, not transport type. Organizational independence from Anthropic is the governing principle."
>
> "**Approved validators:**
>   - Gemini (`mcp__gemini-worker`, `mcp__gemini-api-worker`) — Google DeepMind
>   - GPT (`mcp__gpt-worker`) — OpenAI
>   - Grok (`mcp__grok-worker`) — xAI
>   - GLM (`mcp__glm-worker`) — Zhipu AI / Tsinghua University"
>
> "The stop hook enforces this structurally. Foreign-frontier dispatches are recognized by pattern: `^mcp__(?:gemini|gpt|grok|glm)`. Matches satisfy the foreign-frontier dispatch requirement."

### File B: `~/.claude/rules/operator-rulings.md`

> "**NEVER dispatch mcp gpt/grok/gemini/glm workers or any closed-frontier API outside Ollama** (2026-06-09; violated 2026-06-10 because hook text still mandates them — that text is STALE). When a gate demands a 'foreign-frontier dispatch': the compliant channels are mcp__ollama-* (laguna) and WebFetch for live docs. Never the workers."

### File C: `~/.claude/hooks/stop-validation.mjs:123` (the enforcement code)

```javascript
const isFF = (name) => /^mcp__(gemini|gpt|grok|glm|ollama)/i.test(name) ||
```

Aligns with canon (file A), forbidden by operator-rulings (file B).

### File D: `~/.claude/hooks/user-prompt-submit.mjs:17-18` (the re-anchor text)

```
[FOREIGN-FRONTIER VALIDATORS] - mandatory for clearing stop-language / stalls:
- mcp__gemini-worker, mcp__gpt-worker, mcp__grok-worker, mcp__glm-worker - independent second reads, framing audits, governance validation.
```

Same — aligns with canon, forbidden by operator-rulings.

---

## The two possible resolutions

This staging document deliberately does NOT pick a side. The choice has architectural consequences. Operator's call.

### Resolution P (operator-rulings wins; canon updated)

**Rationale:** Operator stated the rule on 2026-06-09 + reiterated 2026-06-10 after observing a violation. The rule reflects a values position (sovereignty / token budgeting / vendor independence) that the canon's "organizational independence" framing doesn't capture.

**Edits required** (all atomic, ratify together):

1. **`canon/foreign-frontier-validators.md`** — rewrite "Approved validators" section to name ONLY ollama-routed models + WebSearch/WebFetch. Add a "Why-not workers" section citing operator-rulings 2026-06-09. Keep the substrate-coherence framing (provenance, organizational independence) but apply it to the ollama tier.
2. **`hooks/stop-validation.mjs:123`** — change regex from `/^mcp__(gemini|gpt|grok|glm|ollama)/i` to `/^mcp__ollama/i` (drop the four forbidden workers).
3. **`hooks/stop-validation.mjs:376`** — drop `mcp__gemini-worker / mcp__gpt-worker / mcp__grok-worker / mcp__glm-worker /` from the reason string.
4. **`hooks/user-prompt-submit.mjs:17-18`** — rewrite re-anchor text to remove the forbidden workers from the "mandatory" list. Replace with `mcp__ollama-* / WebSearch / WebFetch` as the only compliant channels.
5. **`hooks/user-prompt-submit.mjs:36`** — drop the worker references from the delegation rule.
6. **`hooks/pre-tool-use-substrate.mjs`** — same regex audit if it carries the same allowlist.

**Risk:** existing scripts/workflows that dispatch via `mcp__gemini-worker` etc. would suddenly fail the stop hook. Audit + migrate before the cutover.

### Resolution C (canon wins; operator-rulings updated)

**Rationale:** The canon was authored with a substantive principle ("organizational independence from Anthropic") that's load-bearing. Operator-rulings.md may have been written quickly under a different concern (cost, latency, vendor neutrality) that doesn't actually contradict the canon's principle — they're describing different dimensions.

**Edits required:**

1. **`rules/operator-rulings.md`** — replace "NEVER dispatch... outside Ollama" with a more precise rule: "Default to ollama-routed dispatch for cost reasons; foreign-frontier workers (gemini/gpt/grok/glm) ARE allowed per canon when ollama lacks the required capability (e.g. multimodal) OR when independent-witness is structurally required (governance ratification, canon edits)."
2. Re-affirm canon as-is. No hook edits.

**Risk:** future cost surprises if workers get used liberally; mitigated by the "default to ollama" clause.

### A third path (R): rule of recency

Operator-rulings is dated 2026-06-09 (with reaffirmation 2026-06-10). The canon's foreign-frontier-validators.md may predate that. **Whichever is more recent in git log SHOULD win by default**, per the principle that operator's latest stated intent governs. The fresh-context session should check `git log -- ~/.claude/canon/foreign-frontier-validators.md ~/.claude/rules/operator-rulings.md` and use that as the tiebreaker if no other principle applies.

---

## Open questions for the operator's ceremony

1. **Which resolution (P, C, or R)?** This document explicitly does not assume.
2. **What about Ollama Cloud routed-Gemini (`gemini-3-flash-preview`)?** It's served BY ollama.com but is a Google model. Resolution P keeps it in scope (mcp__ollama prefix); Resolution C would too. Resolution P + a sub-rule "no closed-frontier even through ollama-cloud" would forbid it. Worth being explicit since this conductor session built `ollama_vision_verdict.mjs` on top of `gemini-3-flash-preview`.
3. **What about the `mcp__gemini-api-worker`?** Listed in canon as separate from `mcp__gemini-worker`. Same call shape as the others, same forbid-list under operator-rulings, but the canon names it as the "alternate Gemini transport when worker hangs" — implying it's a fallback. If Resolution P, this also goes.

---

## What this conductor session DID NOT touch

Per the ceremony-class designation: zero edits to any of the conflict files were made. This document only NAMES the conflict + the resolution options. Application is deferred to a fresh-context session that has read `~/.claude/practice/extended/` first.

## Until ratified

Both rules are technically still in effect. Per the operator-rulings meta-clause ("until cleaned, this file is the override"), conductors should default to Resolution P behavior (Ollama + WebSearch/WebFetch only) but should NOT assume canon has been retracted — substrate has not been updated. When in doubt, surface to operator rather than dispatching one of the worker classes.
