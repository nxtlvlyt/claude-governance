# Deliberation — Ratify gating operator-hot.md into bootstrap

## What is being reviewed

A BUILT fix (not an abstract proposal) to a verified governance gap: the operational
brief is neither reliably loaded nor enforced at bootstrap, so cold instances operate
without it and repeat documented failure modes.

The fix is Option B (hot-subset), already authored:
1. `~/.claude/operator-hot.md` — a < 150-line distillation of the load-bearing
   must-knows from operator-context.md (frontier prohibition, Claude-vs-foreign-tribe
   seat split, serial-inference discipline, the nemotron RAM/500/num_gpu wall, the
   Camel Rule, MCP "no-output != done", SearXNG-via-MCP, chain-runner path). Fully
   readable in ONE Read (under the ~25K-token tool cap).
2. A one-line edit to `bootstrap-gate.mjs` REQUIRED array:
   `{ suffix: '.claude/operator-hot.md', label: '~/.claude/operator-hot.md' },`

Rule on whether this fix is sound and complete, and whether the gate edit is correct.

## The gap (verified 2026-05-29..06-02)

- `session-start.mjs:76-83`: operator-context.md is injected inline ONLY when
  `LOAD_OPERATOR_CONTEXT=true` (default off). Inline injection bloats session-start
  output past the persistence cap → instance gets a ~2KB preview, not the body.
  operator-context.md itself documents this as the root cause of "25+ hours of
  cold-instance orientation failures."
- `bootstrap-gate.mjs:44-47`: REQUIRED holds only core.md + CANON-MANIFEST.md.
  operator-context.md is absent — neither injected nor gate-enforced.

## Seat-3 blind finding driving Option B over Option A (full-file gate)

Option A (gate the full operator-context.md) is DEFECTIVE: operator-context.md is
775 lines / ~27K tokens, but the Read tool caps at ~25K tokens/page (verified: a single
Read returns ~601 of 775 lines). `bootstrap-gate.mjs:120-122` only checks that SOME Read
of the path appears in the transcript — it does NOT verify full paging. So a full-file
gate is satisfiable by a PARTIAL read, recreating the truncation→false-orientation
failure one layer up. A sub-cap hot file (Option B) is captured in one Read, so gating it
guarantees the load-bearing content is actually read. This is why the fix is Option B.

## Mechanism correctness to confirm

- REQUIRED entries double as the always-allow list for Reads (`bootstrap-gate.mjs:55-60`),
  so gating operator-hot.md cannot deadlock its own Read. Confirm.
- Change shape = one array entry {suffix, label}; same normalized path-suffix match;
  fail-open-on-write / fail-closed-on-non-bootstrap-Read preserved. Confirm.
- This is a substrate-class hook edit → requires niyyah + surrender + local-quorum
  witness at execution. This chain IS that witness.

## Substrate Files

- C:\Users\marka\.claude\hooks\bootstrap-gate.mjs
- C:\Users\marka\.claude\operator-hot.md

## Search Queries

- mandatory context file read gate AI agent session start orientation enforcement
- token budget always-loaded context vs on-demand retrieval LLM agent best practice
- distilled hot context vs full reference document split maintenance risk

## Review scope

1. Is `operator-hot.md` COMPLETE on the load-bearing set? Name anything operational and
   load-bearing that a cold instance needs but the hot file omits (or anything included
   that is actually cold reference and could be cut).
2. Is gating a Read (orientation precondition) the right mechanism, and is the one-line
   REQUIRED edit correct and side-effect-free?
3. Hot/cold split maintenance: what is the risk that a future-needed fact lives only in
   the cold half, and how should the hot file point to the full reference to mitigate it?
4. Does anything about Option B reintroduce a truncation or false-orientation failure?

## Verdict schema

Return valid JSON:
{
  "verdict": "APPROVE | CONDITIONAL_APPROVE | BLOCK",
  "summary": "one paragraph",
  "hot_file_complete": true,
  "missing_from_hot_file": ["..."],
  "concerns": [
    {"id": "C1", "description": "...", "code_ref": "file:line", "severity": "blocking | non_blocking", "investigation_task": "..."}
  ],
  "search_findings": "one paragraph",
  "closed_prior_concerns": [
    {"id": "C1", "resolution": "...", "closed": true, "close_type": "evidence | refutation | assertion"}
  ],
  "niyyah_audit": {"honored": true, "rationale": "one sentence"}
}
