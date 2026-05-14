---
name: chain-review
description: Run the 6-seat deliberation chain specifically against operator-context.md, verifying whether the document accurately describes the current substrate. Use periodically when operator-context.md has accumulated significant updates, or before sharing the governance repo with a new user.
type: governance-skill
version: 1.0
governance: subordinate-to-scripture
grounded-in: canon/6agent-deliberation-stack.md + scripts/chain-review.py
authored: 2026-05-14
---

# /chain-review — operator-context.md Verification Chain

Wraps `~/.claude/scripts/chain-review.py`. Reviews `operator-context.md` for
accuracy, completeness, and consistency with current substrate. Specialized
version of `/deliberate` with a fixed question targeting the cold-instance brief.

## When to invoke

- After a major session that updated operator-context.md significantly
- Before sharing the governance repo with a new user or deploying to a new machine
- When a cold instance seems confused about something that should be in the brief
- Periodic maintenance (every 10-20 sessions as the document accumulates updates)

Do NOT invoke for: general governance questions (use `/deliberate` instead).

## Invocation

```
/chain-review
```

No args — the script targets `~/.claude/operator-context.md` directly.

## Bootstrap Sequence

Before starting, verify all of these pass:

1. **Read `~/.claude/scripts/chain-review.py`** — open and read it. Verify the
   `REVIEW_QUESTION` section matches what you want to audit. The script has a
   hardcoded review question covering MCP timeout, dispatch sequence, think:False
   placement, timeout rules, and frontier model prohibition. If the question needs
   updating, edit `chain-review.py` first.

2. **Read `~/.claude/operator-context.md`** — open and read it in full. This is
   what the chain agents will review. Know what's in it before the chain runs.

3. **api/ps check** — `curl http://localhost:11434/api/ps`. Must return
   `{"models":[]}` before proceeding.

4. **SearxNG check** — `http://localhost:8080/search?q=test&format=json` returns
   results. If down, agents proceed without live search — warn operator.

5. **Ollama availability** — confirm gemma4:31b and qwen3.6:27b are available via
   `curl http://localhost:11434/api/tags`.

## Execution Procedure

### Phase 1

Run in background:

```
python C:\Users\[USERNAME]\.claude\scripts\chain-review.py 1
```

Phase 1 outputs to `<TEMP>\chain-review\`:
- `phase-1-report.json` (if script produces JSON) OR
- individual model output files

Read outputs when complete. Note: `chain-review.py` may write raw text rather
than structured JSON (it's older than `deliberate.py`). If so, extract concerns
manually from the text outputs.

### Seat 3 — In-Context Synthesis (THIS INSTANCE)

This instance is Seat 3. NOT automated. NOT a new Agent. Per operator-context.md
Section 4: "claude-sonnet-4-6 (architect seat 3 — this instance)."

1. Read phase 1 agent outputs in full
2. Run `mcp__searxng-mcp__searxng_web_search` with queries targeting specific
   claims in operator-context.md (verify Ollama version numbers, model names,
   API endpoint formats, GPU config values against current state)
3. Cross-reference agent concerns against actual substrate files:
   - Does `operator-context.md` correctly describe `deliberate.py`'s dispatch pattern?
   - Does it correctly list qwen as think:True (C2 change, 2026-05-14)?
   - Does it correctly describe the laguna num_ctx issue?
   - Does it correctly describe nemotron num_gpu=14?
4. Produce synthesis. Assign confidence. Surface to operator.
5. Write synthesis to `<TEMP>\chain-review\sonnet-synthesis.txt`

### Phase 2

```
python C:\Users\[USERNAME]\.claude\scripts\chain-review.py 2
```

Read phase 2 outputs. Extract laguna, granite, nemotron verdicts.

### Final Presentation

```
chain-review complete

VERDICT: [unanimous / majority verdict]

Phase 1 (gemma + qwen): [verdicts]
Seat 3 (Sonnet): confidence X.X
Phase 2 (laguna + granite + nemotron): [verdicts]

Accuracy issues found:
  [section/line]: [what's wrong] — [what it should say]

Missing content:
  [what's absent that should be documented]

Outdated content:
  [what's stale that should be updated]

Recommended edits: [count] — [blocking / non-blocking]
```

If blocking concerns: do NOT update operator-context.md until they're resolved.
If non-blocking only: proceed with updates, noting each as "chain-verified correction."

## Output Files

```
<TEMP>\chain-review\
  sonnet-synthesis.txt      — Seat 3 in-context synthesis
  <model>-output.txt        — raw agent outputs
```

## Note on chain-review.py vs deliberate.py

`chain-review.py` predates `deliberate.py` and lacks:
- GPU per-agent `num_gpu` config
- C3 prompt order fix (substrate at position 2)
- Jina Reader integration
- Structured JSON report output

If a chain-review run produces lower-quality output than a deliberate.py run,
consider porting the chain-review question to `deliberate.py` format
(a question file in `scripts/deliberations/chain-review.md`). The question
is already in `chain-review.py` as `REVIEW_QUESTION` — copy it.

## Critical Constraints

- Same as `/deliberate` — see that skill's constraints section
- `think:True` top-level for qwen (C2); `think:False` top-level for nemotron
- Serial inference: api/ps before every dispatch

## Reference

- Script: `~/.claude/scripts/chain-review.py`
- Full deliberate.py skill: `~/.claude/skills/deliberate/SKILL.md`
- Dispatch details: `~/.claude/canon/6agent-deliberation-stack.md`
