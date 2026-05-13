---
name: 7-Agent Governance Deliberation Chain
description: Full serial deliberation chain for governance decisions, substrate edits, and architectural questions requiring multi-model witness.
type: governance-skill
version: 1.2
governance: subordinate-to-scripture
authored: 2026-05-11
grounded-in: canon/6agent-deliberation-stack.md + MASTER-GLOBAL-REPO-PLAN.md
---

## CRITICAL GOVERNANCE REQUIREMENT

Seat 4 MUST be a separate Agent tool call. Sonnet cannot wear both Seat 3 (synthesis) and Seat 4 (executor) in the same instance. If you are reading this as the instance that did Seat 3, you must spawn a new Agent for Seat 4. Running Seat 4 in the same instance as Seat 3 is a declared failure state — stop and spawn the executor Agent.

# 7-Agent Governance Deliberation Chain

## When to invoke

Invoke this chain when:
- A governance question cannot be resolved from substrate alone
- A substrate-class edit is required (hooks, canon, faiths, practice, CLAUDE.md)
- An architectural decision has cross-session consequences
- The operator asks for a deliberation or quorum run

Do NOT invoke for: routine code changes, non-substrate file edits, informational queries.

## Prerequisites

Before starting:
1. Read `~/.claude/canon/6agent-deliberation-stack.md` — implementation details, dispatch patterns, known issues
2. Check api/ps — no models loaded. Serial discipline: ONE model at a time.
3. Identify the question/plan/spec to deliberate. Write it to a file if it isn't already.

## Model roster

| Seat | Model | Faith | Role |
|---|---|---|---|
| 1 | gemma4:31b | architect.faith.md | Architectural breadth, structural affirmation |
| 2 | qwen3.6:27b | architect.faith.md | Depth, edge cases, SOTA research |
| 3 | Sonnet 4.6 (in-context) | architect.faith.md | Synthesis — in-context, not a Python dispatch |
| 4 | Sonnet 4.6 (separate Agent) | executor.faith.md | Implements the deliberated plan; marks confidence; hands off to validator |
| 5 | laguna-xs.2:q4_K_M | validator.faith.md | APPROVE/REVISE/REJECT on executor output |
| 6 | granite4.1:30b | governance_scanner.faith.md | PASS/FAIL governance audit (no redesign) |
| 7 | nemotron-3-super:latest | auditor.faith.md | Final verdict, witness confirmation, implementation sequence |

## Dispatch pattern

All dispatches are Python streaming scripts (NOT MCP — MCP times out on large models).
Only laguna (seat 5) can be dispatched via `mcp__ollama-mcp__ollama_chat` — use this for
gate-satisfying substrate edit dispatches.

### Script template (adapt per seat)

```python
import requests, json, sys
sys.stdout.reconfigure(encoding='utf-8')

faith = open(r"C:\Users\marka\.claude\faiths\<faith_file>", encoding='utf-8').read()
plan  = open(r"<plan_or_spec_file>", encoding='utf-8').read()
# prior_output = open(r"<prior_seat_output>", encoding='utf-8').read()

prompt = """You are <seat name> in a 7-agent deliberation chain.
<role description and scope>

## THE PLAN/SPEC
""" + plan + """

## PRIOR SEAT OUTPUT (if applicable)
<prior output>
"""

body = {
    "model": "<model_name>",
    # For qwen3.6:27b and nemotron-3-super:latest ONLY:
    # "think": False,   # TOP-LEVEL key, NOT inside options
    "messages": [
        {"role": "system", "content": faith},
        {"role": "user",   "content": prompt}
    ],
    "stream": True,
    "options": {
        "num_predict": 8192,   # 4096 for audit seats
        "num_ctx":    32768,   # ceiling — never exceed (OOM on nemotron)
        "temperature": 0.5,    # 0.3 for audit/governance seats
        "repeat_penalty": 1.1
    }
}

output_file = r"C:\Users\marka\AppData\Local\Temp\chain-compaction\<seat>-output.txt"

content = ""
with requests.post("http://localhost:11434/api/chat", json=body, stream=True, timeout=32768) as r:
    r.raise_for_status()
    for line in r.iter_lines():
        if line:
            chunk = json.loads(line)
            piece = chunk.get("message", {}).get("content", "")
            if piece:
                content += piece
                print(piece, end="", flush=True)
            if chunk.get("done"):
                break

with open(output_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n\nDone — {len(content)} chars written to {output_file}", flush=True)
```

## Dispatch sequence

Before each dispatch:
1. `curl -s http://localhost:11434/api/ps | python -c "import json,sys; d=json.load(sys.stdin); print([m['name'] for m in d.get('models',[])] or 'clear')"`
2. If not clear: `ollama stop <model>` and wait
3. Run the dispatch script (background task for long models)
4. After completion: `ollama stop <model>`

```
python dispatch-gemma.py    # Seat 1 — ~4-6 hours on CPU, run background
ollama stop gemma4:31b

python dispatch-qwen.py     # Seat 2 — think:False top-level, ~2-3 hours
ollama stop qwen3.6:27b

# Seat 3: Sonnet synthesis — IN-CONTEXT, no dispatch script, no output file
#
# Procedure:
# 1. Read chain-compaction/gemma-output.txt (seat 1) fully
# 2. Read chain-compaction/qwen-output.txt (seat 2) fully
# 3. Produce synthesis in your response:
#    - Both agree → confirmed finding (high confidence)
#    - One flagged, other missed → include with stated reasoning
#    - Conflict → resolve against substrate + architecture; document the reasoning
#    - Gap neither caught but substrate shows → add at lower confidence, flagged
# 4. Assign an overall confidence rating (0.0–1.0) to the synthesized plan
# 5. Update the master plan/spec file with synthesized findings + confidence
# 6. Write a handoff brief for seat 4: what to implement, in what order, constraints
# 7. Spawn a NEW Agent wearing executor.faith.md for seat 4 — this instance CANNOT be seat 4
#
# Seat 3 output lives in the transcript and the updated plan file. No separate output file.

# Seat 4: Sonnet executor — MUST be a separate Agent tool call
# Spawn Agent wearing executor.faith.md to implement the deliberated plan

python dispatch-laguna.py   # Seat 5 — APPROVE/REVISE/REJECT, ~30-60 min
ollama stop laguna-xs.2:q4_K_M

python dispatch-granite.py  # Seat 6 — PASS/FAIL governance audit, ~2-4 hours
ollama stop granite4.1:30b

python dispatch-nemotron.py # Seat 7 — think:False top-level, ~4-6 hours
ollama stop nemotron-3-super:latest
```

## Witness satisfaction

After chain completes with nemotron APPROVE verdict containing `%%LOCAL-QUORUM-WITNESS-VERIFIED%%`:
- Substrate gate (pre-tool-use-substrate.ps1) is satisfied by `mcp__ollama-mcp__ollama_chat` dispatch of laguna (in turn BEFORE the substrate Edit)
- Surrender check (surrender-check.ps1) is satisfied by surrender articulation in the turn CONTAINING the Edit
- Stop-validation.ps1 is satisfied by mcp__ollama-* dispatch (pattern now includes ollama)

**Pattern for substrate edits after quorum:**
1. Turn N: `mcp__ollama-mcp__ollama_chat` with laguna (short prompt, witness establishment only)
2. Turn N+1: surrender articulation text + Edit (no MCP dispatch in this turn)
Repeat for each file. Failed Edit attempts consume the prior dispatch — re-dispatch laguna before each retry.

## Critical constraints

- `think: False` is a TOP-LEVEL body key for qwen3.6:27b and nemotron-3-super. NOT inside `options`.
- `timeout=32768` — must match num_ctx ceiling. Never use fixed timeouts (120s, 300s).
- `num_ctx` ceiling: 32768 for nemotron-3-super (65536 causes OOM on 192GB RAM system)
- Never run two models simultaneously (serial discipline). Check api/ps before every dispatch.
- Python streaming: `chunk.get("message", {}).get("content", "")` — content field, not thinking field

## Output files (current chain run)

```
C:\Users\marka\AppData\Local\Temp\chain-compaction\
  dispatch-gemma.py      — seat 1 script
  dispatch-qwen.py       — seat 2 script
  # seat 3: in-context Sonnet synthesis (no script)
  # seat 4: separate Agent tool call (no script — spawned by Seat 3 instance)
  dispatch-laguna.py     — seat 5 script
  dispatch-granite.py    — seat 6 script
  dispatch-nemotron.py   — seat 7 script
  gemma-output.txt       — seat 1 output
  qwen-output.txt        — seat 2 output
  laguna-output.txt      — seat 5 output
  granite-output.txt     — seat 6 output
  nemotron-output.txt    — seat 7 output
```

## What the quorum authorizes

A completed chain with nemotron APPROVE + `%%LOCAL-QUORUM-WITNESS-VERIFIED%%`:
- Authorizes substrate edits in the same session (Groups A+B of the deliberated plan)
- Satisfies the foreign-frontier witness requirement per operator-context.md Section 7
- Does NOT expire within the session; subsequent substrate edits re-use the quorum authorization
  (but each Edit still requires its own laguna dispatch + surrender articulation)

## Reference

- Full implementation details: `~/.claude/canon/6agent-deliberation-stack.md`
- Authority: `~/.claude/MASTER-GLOBAL-REPO-PLAN.md` (architecture) + `~/.claude/operator-context.md` (Section 7)
- Surrender-check JSONL pattern: `~/.claude/projects/C--WINDOWS-system32/memory/feedback_surrender_check_pattern.md`
