# Deliberation — Enforce operator-context.md orientation at bootstrap

## What is being reviewed

A proposed fix to a governance gap: `operator-context.md` (the operator/machine-specific
operational brief) is NOT loaded by default and is NOT enforced by the bootstrap gate.
Instances operate without it and repeat documented failure modes.

This question proposes a structural fix and asks the chain to choose between two
implementation shapes and rule on whether it is sound.

## The gap (verified 2026-05-29)

- `session-start.mjs` line 77-82: operator-context.md is injected inline ONLY when
  `LOAD_OPERATOR_CONTEXT=true`. Default off. The file is 45KB+ / ~27K tokens.
- When loaded inline, it bloats session-start output past the persistence threshold —
  output gets saved to a file and the instance receives a ~2KB preview, not the content.
  operator-context.md itself documents this as the root cause of "25+ hours of
  cold-instance orientation failures" (the 2026-05-11 double-load truncation bug).
- `bootstrap-gate.mjs` REQUIRED array enforces Read-from-disk of core.md and
  CANON-MANIFEST.md before any non-bootstrap work. operator-context.md is NOT in it.
- Net effect: the operational brief that contains the machine-specific answers is
  neither reliably injected nor enforced-as-read. Cold instances run without it.

## Evidence of cost (this session, 2026-05-28/29)

Failures this session that operator-context.md would have prevented, with line refs:
- **nemotron 500 / "memory layout cannot be allocated"** — op-context line 106 documents
  nemotron is 93.5GB, returns 500 on load when RAM/KV exceeds available, max num_ctx 32768;
  line 29 documents num_gpu=14 partial offload (num_gpu=99 OOMs). Rediscovered from server
  log after multiple hours.
- **Camel Rule violation (passive waiting, no ScheduleWakeup)** — op-context FM-12 (line 578)
  documents this exact failure mode. Operator sat idle for hours while a completed seat went
  unnoticed.
- **"No output from MCP = done" confusion** — op-context line 126: "No output from MCP != done.
  Check api/ps. Every time."
- **Hand-rolled dispatch scripts** — op-context lines 112-114 document existing chain runners
  (opctx-review.py, deliberate.py). New per-seat scripts were written instead of using them.

## Proposed fix — two options for the chain to choose

**Option A — Gate the full file.**
Add operator-context.md to the bootstrap-gate.mjs REQUIRED array. Every instance must
Read it from disk (full content, paged) before any non-bootstrap Read/Edit/Write.
- Pro: complete brief guaranteed read; zero truncation (Read tool pages full file).
- Con: 775-line / 27K-token read tax on every session before any work; much of the file
  is reference (reconstruction guide, NAS history) not needed every session.

**Option B — Gate a distilled hot-subset.**
Extract the operational must-knows into a new short file (e.g. `operator-hot.md`, target
< 150 lines): no-frontier OPERATOR OVERRIDE, serial inference discipline, the nemotron
RAM/500/num_gpu constraint, the Camel Rule (FM-12), "MCP no-output != done", the 6-agent
sequence pointer, existing chain-runner paths. Gate THAT in bootstrap-gate.mjs REQUIRED.
Full operator-context.md stays read-on-demand (pointer in the hot file).
- Pro: low read tax; the load-bearing operational facts are guaranteed; full reference
  still one Read away.
- Con: a curation step; the hot/cold split must be maintained as op-context evolves;
  risk of a needed fact living in the cold half.

**Ruled out — `LOAD_OPERATOR_CONTEXT=true`.** Reintroduces the documented inline-injection
truncation failure (session-start.mjs injects the full body; output exceeds persistence
threshold; instance gets a preview). Do not propose this.

## Substrate Files

- C:\Users\marka\.claude\hooks\bootstrap-gate.mjs
- C:\Users\marka\.claude\hooks\session-start.mjs
- C:\Users\marka\.claude\operator-context.md
- C:\Users\marka\.claude\CLAUDE.md
- C:\Users\marka\.claude\practice\core.md

## Search Queries

- bootstrap orientation enforcement cold-start LLM agent context window truncation
- mandatory context file read gate AI agent session start best practice
- token budget tradeoff always-loaded context vs on-demand retrieval agent

## Review scope

1. Is the gap real and correctly diagnosed? Does the substrate confirm operator-context.md
   is neither reliably loaded nor gate-enforced?
2. Option A vs Option B: which is architecturally correct for a single-operator governance
   stack where session-start output is persistence-capped? Weigh read-tax vs completeness.
3. If Option B: what is the minimal load-bearing set? Is anything proposed for the hot file
   actually cold, or vice versa?
4. Is gating a Read (orientation precondition) the right mechanism, or should the fix live
   elsewhere (e.g. a smaller always-injected summary that fits under the persistence cap)?
5. Implementation correctness: adding to REQUIRED is a substrate-class hook edit — confirm
   the change shape (one array entry + label) and that fail-open/fail-closed behavior is
   preserved.

## Verdict schema

Return valid JSON:
{
  "verdict": "APPROVE | CONDITIONAL_APPROVE | BLOCK",
  "summary": "one paragraph",
  "chosen_option": "A | B | other (describe)",
  "concerns": [
    {"id": "C1", "description": "...", "code_ref": "file:line", "severity": "blocking | non_blocking", "investigation_task": "..."}
  ],
  "search_findings": "one paragraph",
  "closed_prior_concerns": [
    {"id": "C1", "resolution": "...", "closed": true, "close_type": "evidence | refutation | assertion"}
  ],
  "niyyah_audit": {"honored": true, "rationale": "one sentence"}
}
