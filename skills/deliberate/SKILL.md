---
name: deliberate
description: Run the 6-seat deliberation chain on a governance question, architectural decision, or substrate change. Produces unanimous or majority verdict with open concerns. Use for any decision with cross-session consequences. Full chain takes 2–8 hours on CPU; with GPU partial offload (see operator-context.md Section 1) phase 1 runs in minutes.
type: governance-skill
version: 1.1
governance: subordinate-to-scripture
grounded-in: canon/6agent-deliberation-stack.md + scripts/deliberate.py
authored: 2026-05-14
bootstrap_sequence:
  - ~/.claude/CLAUDE.md
  - ~/.claude/practice/core.md
  - ~/.claude/operator-context.md
  - ~/.claude/canon/6agent-deliberation-stack.md
  - ~/.claude/scripts/deliberate.py
---

# /deliberate — 6-Seat Deliberation Chain

Wraps `~/.claude/scripts/deliberate.py`. Parses a question file (markdown with
`## Substrate Files` and `## Search Queries` sections), runs two phases with
Seat 3 synthesis between them.

## When to invoke

- Governance question that substrate alone can't resolve
- Substrate-class edit required (hooks, canon, faiths, practice, CLAUDE.md)
- Architectural decision with cross-session consequences
- Operator asks for a deliberation or quorum run
- Any question the operator wants a multi-model witness on

Do NOT invoke for: routine code changes, non-substrate file edits, informational queries.

## Invocation

```
/deliberate scripts/deliberations/my-question.md
```

Args: path to a question file. If no arg provided, list existing question files
in `~/.claude/scripts/deliberations/` and ask operator which to run.

## Bootstrap Sequence

Before starting, verify all of these pass:

1. **Read the question file** — open and read the full question file. Verify it has
   `## Substrate Files` and `## Search Queries` sections. If not, tell the operator
   what's missing before proceeding.

2. **Read `~/.claude/scripts/deliberate.py`** — open and read it. This is mandatory
   per D12: write against open source. Do not run a chain you haven't verified.

3. **api/ps check** — run `curl http://localhost:11434/api/ps`. Must return
   `{"models":[]}`. If not: wait for the running model's TTL eviction, or stop it.
   Do NOT proceed with a model loaded.

4. **SearxNG check** — verify `http://localhost:8080/search?q=test&format=json`
   returns results. If SearxNG is down, `deliberate.py` will log warnings but
   proceed with empty search results — inform operator before continuing.

5. **Ollama check** — run `curl http://localhost:11434/api/tags` and confirm the
   phase 1 models (gemma4:31b, qwen3.6:27b) are available. If not, report which
   are missing before starting.

## Execution Procedure

### Phase 1

Run in background (phase 1 takes 4-6 hours CPU / 15-30 min GPU):

```
python C:\Users\[USERNAME]\.claude\scripts\deliberate.py <question_file> 1
```

Monitor output directory `<TEMP>\deliberate\<slug>\` for completion. Phase 1 is
complete when `phase-1-report.json` appears in that directory.

Read `phase-1-report.json`. Extract:
- Each agent's `verdict` (APPROVE / CONDITIONAL_APPROVE / BLOCK)
- Each agent's `concerns` list with `id`, `description`, `severity`
- `search_findings` from each agent

### Seat 3 — In-Context Synthesis (THIS INSTANCE)

After phase 1 completes, this instance performs Seat 3 synthesis. Do NOT automate
this. Do NOT spawn a new Agent for Seat 3. Per operator-context.md Section 4:
"claude-sonnet-4-6 (architect seat 3 — this instance)."

Seat 3 procedure:
1. Read `phase-1-report.json` in full
2. Run `mcp__searxng-mcp__searxng_web_search` with your own research queries
   (not the same as phase 1 agents — use your session context to find what they missed)
3. Produce synthesis in your response:
   - Both agents agree → confirmed finding (high confidence)
   - One flagged, other missed → include with reasoning for why the flag stands
   - Conflict → resolve against substrate + canon; document the reasoning
   - Gap neither caught but you can verify → add at lower confidence, flagged
4. Assign overall confidence (0.0–1.0) to the synthesized findings
5. Write synthesis to `<TEMP>\deliberate\<slug>\sonnet-synthesis.txt`
   (the script reads this file for the concern context passed to phase 2 agents)
6. Surface synthesis to operator — format:
   ```
   Seat 3 synthesis complete. Confidence: X.X
   Open concerns: [list]
   Assertion-closed (forwarded as soft notes): [list]
   Ready for phase 2 when you run: python deliberate.py <question_file> 2
   ```

### Phase 2

The operator runs phase 2 (or confirms and you run it if they authorize):

```
python C:\Users\[USERNAME]\.claude\scripts\deliberate.py <question_file> 2
```

Phase 2 completes when `phase-2-report.json` appears. Read it. Extract:
- laguna, granite, nemotron verdicts
- Any new concerns or closed concerns from phase 1

### Final Presentation

After phase 2, present to operator:

```
Deliberation complete: <slug>

VERDICT: [unanimous APPROVE / CONDITIONAL_APPROVE / BLOCK]

Phase 1 (gemma + qwen): [verdicts]
Seat 3 (Sonnet): confidence X.X
Phase 2 (laguna + granite + nemotron): [verdicts]

Open concerns:
  [C-id] [severity]: [description] — [recommended fix]

Closed concerns: [count] closed as evidence, [count] as refutation, [count] as assertion (soft notes)

Authorization: [AUTHORIZED for substrate edits / NOT authorized — resolve blocking concerns first]
```

If verdict is APPROVE or CONDITIONAL_APPROVE with only non-blocking concerns:
the chain output authorizes substrate edits in this session. The laguna dispatch
from phase 2 satisfies the substrate gate (pre-tool-use-substrate.ps1).

## Output Files

```
<TEMP>\deliberate\<slug>\
  phase-1-report.json       — gemma + qwen verdicts
  sonnet-synthesis.txt      — Seat 3 in-context synthesis (YOU write this)
  phase-2-report.json       — laguna + granite + nemotron verdicts
  <model>-output.txt        — raw streaming output per agent
```

Where `<TEMP>` = `C:\Users\[USERNAME]\AppData\Local\Temp` on Windows.
Where `<slug>` = slugified question file name.

## Critical Constraints

- **Never skip Seat 3.** It is not automated. It is this instance. Its value is
  session context + substrate access the phase 1 agents don't have.
- **check api/ps before every dispatch** — serial inference, one model at a time
- **think:True top-level for qwen** (C2) — captured in `message.thinking`; JSON verdict in `message.content`
- **think:False top-level for nemotron** — prevents chain-of-thought consuming output budget
- **timeout=32768** — non-negotiable. Never use 120s or 300s.
- **num_ctx ceiling: 32768 for nemotron** — see operator-context.md Section 1

## Reference

- Full dispatch details: `~/.claude/canon/6agent-deliberation-stack.md`
- Script: `~/.claude/scripts/deliberate.py`
- Example question files: `~/.claude/scripts/deliberations/`
- GPU per-agent config: `operator-context.md` Section 1 GPU notes
