# Deliberation — Ratify gating operator-hot.md into bootstrap (foreign-tribe witness)

You are the binding governance witness. A cloud Claude workflow did the BUILD-SIDE hardening
(both pages of operator-context.md + all three hooks read in-session); it cannot rule the one
governance-class question below. Confirm or block before this commits. Treat disagreement among
you as signal. If any seat 500s, do not skip it — fix and re-run.

## What is changing

1. NEW gate-required file `~/.claude/operator-hot.md` — a 59-line / ~1.8K-token hot subset of
   operator-context.md (reads in ONE Read, no truncation). 13 substrate-cited completeness patches
   already applied (niyyah 60s TTL + why, surrender verbatim-substring rule, the separate
   pre-tool-use-substrate.mjs gate + mcp__ollama-* clears it, keep_alive:0 deadlock, Ollama-restart
   ProcessStartInfo env trap, no-skip-seats + why, num_ctx=input+output, GPU 4090-shared contention,
   FM-8 ceremony wording, FM-4 surface-don't-escalate fallback, think:qwen stale-line note).
2. `bootstrap-gate.mjs` REQUIRED gains a third entry:
   `{ suffix: '.claude/operator-hot.md', label: '~/.claude/operator-hot.md' },`
   Build-verified: pathEndsWith (`:51-53`) lowercases+slash-normalizes+endsWith — no false-match vs
   operator-context.md / bootstrap-operator-context.md; Read auto-allow (`:56-60`) self-exempts the
   entry — no deadlock; main deny message (`:127-128`) maps over REQUIRED and auto-lists it.
3. COUPLED substrate-class fixes the build found REQUIRED for the fix to actually achieve its goal:
   - **D2 (blocking):** the no-transcript deny message (`bootstrap-gate.mjs:85-86`) hardcodes only 2
     files — after the array edit the two deny-paths disagree (3 required, 2 advertised). Make it
     derive from REQUIRED.
   - **Injection half (D1):** `session-start.mjs:76-83` still gates operator-context behind
     LOAD_OPERATOR_CONTEXT (default off); operator-hot.md is never proactively surfaced — a cold
     instance finds it only by block-and-retry. Add an UNCONDITIONAL `contextParts.push` of
     operator-hot.md to session-start.mjs (outside the env guard) so it loads at boot in one Read.
   - **Subagent gap:** `subagent-start.mjs` injects CLAUDE.md+core.md+canon+STATE.md but NOT
     operator-hot.md, and bootstrap-gate is not on subagent PreToolUse. Mirror the push there.
   - **GAP-1 (recommended):** a missing REQUIRED file = permanent cold-session lockout. Guard the
     new entry with `existsSync` (degrade to prior 2-read unlock) or header-comment the
     delete/rename hazard.

## Ceremony split (must be honored in the commit)
- operator-hot.md content = NOT substrate-class → niyyah + this 6-agent deliberation, NO
  surrender/frontier gate (FM-8: which ceremony, not whether).
- bootstrap-gate.mjs / session-start.mjs / subagent-start.mjs edits = SUBSTRATE-CLASS (hooks/*.mjs)
  → niyyah + surrender articulation (verbatim substring of old_string) + same-turn local-quorum
  witness via mcp__ollama-mcp__ollama_chat. Do not let the lighter ceremony leak onto the hooks.

## What you must confirm (governance-class — build already verified the mechanics)

A. **AUTHORITY ELEVATION (central question, only the quorum can rule).** Gate-MANDATING operator-hot.md
   forces every cold instance to read a file whose §1 instructs OVERRIDING the "mandatory"
   frontier-dispatch injection emitted by the user-prompt-submit/stop hooks. The file is declared
   NOT substrate-class, yet gate-mandating it elevates its operational authority above its class. Is
   it coherent for a non-substrate-class file to be a hard bootstrap precondition that overrides
   hook-emitted instructions? Ratify, or rule the override should not be gate-wired.
B. **FM-8 wording fix** is correct/necessary (operator-hot.md:47 old "(niyyah only)" invited FM-8;
   replaced with "no surrender/frontier gate but STILL niyyah AND 6-agent deliberation"). Confirm.
C. **FM-4 fallback** addition correct (surface-don't-escalate; never frontier to unblock). Confirm.
D. **Ceremony split** above is honored in the commit. Confirm.
E. **think:qwen** — operator-hot.md adopts True (C2, operator-context.md:116); operator-context.md:363
   still says False. Confirm True is authoritative and ratify correcting :363.

## Substrate Files

- C:\Users\marka\.claude\hooks\bootstrap-gate.mjs
- C:\Users\marka\.claude\operator-hot.md

## Search Queries

- mandatory context file read gate AI agent session start orientation enforcement
- token budget always-loaded context vs on-demand retrieval LLM agent best practice
- non-privileged config file elevated to hard precondition authority coherence policy

## Verdict schema

Return valid JSON:
{
  "verdict": "APPROVE | CONDITIONAL_APPROVE | BLOCK",
  "summary": "one paragraph",
  "authority_elevation_ruling": "coherent_ratify | wire_without_override | block_gate_mandate | other (describe)",
  "confirms": {"A_authority": "...", "B_fm8": "...", "C_fm4": "...", "D_ceremony": "...", "E_think_qwen": "..."},
  "concerns": [
    {"id": "C1", "description": "...", "code_ref": "file:line", "severity": "blocking | non_blocking", "investigation_task": "..."}
  ],
  "search_findings": "one paragraph",
  "closed_prior_concerns": [
    {"id": "C1", "resolution": "...", "closed": true, "close_type": "evidence | refutation | assertion"}
  ],
  "niyyah_audit": {"honored": true, "rationale": "one sentence"}
}
