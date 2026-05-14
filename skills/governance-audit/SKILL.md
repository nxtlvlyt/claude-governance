---
name: governance-audit
description: Quick 2-seat governance scan (laguna code review + granite governance audit) against a specific file, diff, or session output. Faster than /deliberate — use for spot checks, pre-commit validation, or verifying a single change before substrate edit. Runs in 3-15 minutes on GPU. Also satisfies the substrate gate (pre-tool-use-substrate.ps1) for the session.
type: governance-skill
version: 1.0
governance: subordinate-to-scripture
grounded-in: canon/6agent-deliberation-stack.md + faiths/governance_scanner.faith.md
authored: 2026-05-14
---

# /governance-audit — Quick 2-Seat Governance Scan

A targeted, fast governance check using laguna (code review / structural audit)
and granite (governance compliance). Does not run the full 6-seat chain.
Use when you need a quick witness before an edit, not a full architectural review.

## When to invoke

- Pre-substrate-edit: need the substrate gate (pre-tool-use-substrate.ps1) satisfied
- Quick spot-check on a recent change or draft before committing
- Verifying a single file against canon rules
- Operator asks "does this look right" and the full chain is overkill

Use `/deliberate` instead when:
- The question has architectural consequences
- Multiple files are changing
- You want unanimous quorum with all 5 local models
- The change is to CLAUDE.md, canon, or faiths

## Invocation

```
/governance-audit [file-path or description]
```

Examples:
- `/governance-audit ~/.claude/operator-context.md`  — scan the cold-instance brief
- `/governance-audit` (no arg) — scan the most recent Edit/Write in this session
- `/governance-audit "is this dispatch pattern correct: ..."` — inline question

## Bootstrap Sequence

1. **api/ps check** — `curl http://localhost:11434/api/ps` must return `{"models":[]}`.

2. **Read the target** — if a file path: Read the file. If no arg: identify the most
   recent mutating action in this session and describe the change to be audited.

3. **Read `~/.claude/faiths/governance_scanner.faith.md`** — the laguna seat uses
   this faith. Read it before constructing the prompt. Write against open source.

4. **Confirm availability** — `curl http://localhost:11434/api/tags` confirms
   `laguna-xs.2:q4_K_M` is available. If not available: use `granite4.1:3b`
   as fallback (NOT granite4.1:8b — it fails format discipline).

## Execution Procedure

### Seat 1 — laguna (code review / structural audit)

Dispatch via Python streaming (MCP is acceptable for laguna — it's small enough):

```python
import requests, json, sys
sys.stdout.reconfigure(encoding='utf-8')

faith = open(r"C:\Users\[USERNAME]\.claude\faiths\governance_scanner.faith.md", encoding='utf-8').read()

prompt = """You are the code review seat in a governance audit.

## TARGET
[file content or change description]

## AUDIT QUESTION
[specific question about this file/change]

Review against:
1. Structural correctness — does this do what it says?
2. Canon compliance — does this contradict any governance rulings?
3. Security — any injection, exposure, or unsafe operation?
4. Serial inference discipline — if this is a dispatch script, does it check api/ps?

Return ONLY valid JSON:
{
  "verdict": "PASS|WARN|BLOCK",
  "issues": [{"id": "L1", "description": "...", "severity": "blocking|non_blocking", "line": "..."}],
  "notes": "one paragraph summary"
}"""

body = {
    "model": "laguna-xs.2:q4_K_M",
    "messages": [
        {"role": "system", "content": faith},
        {"role": "user",   "content": prompt}
    ],
    "stream": True,
    "options": {"num_predict": 2048, "temperature": 0.3, "num_gpu": 99}
}

content = ""
with requests.post("http://localhost:11434/api/chat", json=body, stream=True, timeout=32768) as r:
    r.raise_for_status()
    for line in r.iter_lines():
        if line:
            chunk = json.loads(line)
            piece = chunk.get("message", {}).get("content", "")
            if piece:
                content += piece
            if chunk.get("done"):
                break

with open("laguna-audit.txt", "w", encoding="utf-8") as f:
    f.write(content)
```

Check api/ps after laguna completes. Parse the JSON verdict.

**If laguna verdict is BLOCK**: stop. Do not proceed to granite. Surface the blocking
issue to the operator with the exact text from laguna's `issues` field.

### Seat 2 — granite (governance compliance audit)

Only run if laguna passed or returned WARN (non-blocking only):

Use `mcp__ollama-mcp__ollama_chat` with granite4.1:30b (or granite4.1:3b if the
full model is unavailable). Prompt:

```
You are the governance audit seat. Review this [file/change] for:
1. Does it comply with CLAUDE.md directives?
2. Does it comply with canon rulings in ~/.claude/canon/?
3. Does it contain any forbidden operations (frontier model dispatch, keep_alive:0,
   simultaneous inference, etc.)?

[file content or change]

Return ONLY valid JSON:
{
  "verdict": "PASS|WARN|BLOCK",
  "violations": [{"rule": "...", "description": "...", "severity": "blocking|non_blocking"}],
  "notes": "one paragraph"
}
```

Check api/ps after granite completes.

### Final Presentation

```
governance-audit complete

Laguna (code review): [PASS / WARN / BLOCK]
  Issues: [count] — [list if any]

Granite (governance compliance): [PASS / WARN / BLOCK]
  Violations: [count] — [list if any]

Overall: [PASS / WARN — proceed with noted caveats / BLOCK — do not proceed]

Substrate gate: [SATISFIED — laguna dispatch occurred in this session / NOT SATISFIED]
```

The laguna dispatch via MCP satisfies `pre-tool-use-substrate.ps1` for subsequent
substrate edits in this session (the gate matches `mcp__ollama-mcp__*`). If you
used Python streaming instead of MCP for laguna, the gate is NOT satisfied — you
would need a separate MCP dispatch (even a minimal one) before the substrate edit.

## Gate Satisfaction Pattern

For substrate edits after a governance-audit:

- Turn N: `/governance-audit` (runs laguna via MCP — satisfies substrate gate)
- Turn N+1: surrender articulation + Edit (no MCP dispatch needed in this turn)

If the Edit fails and you need to retry:
- Re-dispatch laguna via `mcp__ollama-mcp__ollama_chat` before each retry
  (failed Edit attempts consume the prior dispatch)

## Critical Constraints

- **api/ps before every dispatch** — serial discipline
- **laguna via MCP is acceptable** — it is small enough to not timeout
- **granite4.1:8b is disqualified** — format drift, appends extra text outside verdict block
- **granite4.1:3b is the fallback** if granite4.1:30b is unavailable (not granite4.1:8b)
- **num_gpu: 99 for laguna** — at 16384 ctx fits 24GB VRAM (see operator-context.md Section 1)

## Reference

- Faith: `~/.claude/faiths/governance_scanner.faith.md`
- Canon: `~/.claude/canon/6agent-deliberation-stack.md`
- Full chain skill: `~/.claude/skills/deliberate/SKILL.md`
- Laguna seat memory: `~/.claude/projects/C--WINDOWS-system32/memory/feedback_governance_scanner_model.md`
