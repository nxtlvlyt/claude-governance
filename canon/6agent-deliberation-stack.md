# 6-Agent Deliberation Stack — Master Implementation Guide

This document captures how the local Ollama deliberation chain works, every hard-won
configuration discovery, and everything a new instance needs to implement it from zero.
Written after the first fully successful end-to-end run (2026-05-08).

---

## What it is

A Python-orchestrated validation chain that runs seven local models sequentially.
Each model reviews a spec or code change from a distinct role, raises structured concerns,
and passes open concerns as explicit investigation tasks to the next model.
Sonnet (or whatever frontier model is the caller) is the trigger only — it invokes the
chain and receives the final report. It does not evaluate, overturn, or summarize.

```
gemma4:31b         → workshop          (architectural shape, first-pass concerns)
qwen3.6:27b        → deep-dive         (investigates gemma concerns, SOTA research)
claude-sonnet-4-6  → synthesis         (in-conversation architect, history context)
laguna-xs.2:q4_K_M → code review       (investigates qwen/Sonnet concerns, structural audit)
granite4.1:30b     → governance audit  (investigates laguna concerns, canon coherence)
nemotron-3-super   → final verdict     (investigates granite concerns, assumption audit)
claude-sonnet-4-6  → executor          (separate Agent spawned after Seat 6 verdict)
```

---

## Seat 3 — Independent evaluation mandate

Seat 3 does not summarize what prior seats said. It evaluates independently first, then synthesizes.

The local models (Seats 1, 2, 4, 5, 6) see only the content of their prompt window. They cannot read substrate files directly, trace code logic end-to-end, verify file existence, or hold full session history. Seat 3 has all of these capabilities. The prior seats provide perspectives Seat 3 might miss — they do not do the evaluation for it.

**Before writing the architect synthesis:**
0. Read `~/.claude/faiths/chain-architect.faith.md`. This is the identity you operate from during synthesis. The faith must be open before the first evaluation begins — not assumed from memory of what it says.
1. Read the actual files under review from disk. Do not rely on what prior seats quoted or described.
2. Trace the implementation logic independently. Verify edge cases, failure modes, and assumptions against what the code actually does.
3. Form an honest independent assessment: what is correct, what is uncertain, what is wrong.
4. Then read what Seats 1 and 2 raised. Add what they missed. Correct what they got wrong.
5. Write the synthesis from that honest position — not as a summary of Seats 1 and 2.

The synthesis is Seat 3's evaluation, informed by prior seats but not deferring to them. A synthesis that merely consolidates prior seat output is not architect work — it is relay. The chain has five other seats for relay. Seat 3 is the one with substrate access.

---

## Seat 3 — Two-Phase Protocol (structural enforcement, 2026-05-17)

The independence mandate above defines the obligation. This section defines the structural enforcement that makes independence verifiable rather than trust-based.

### Phase 1 — Blind substrate eval (before reading prior seat output)

1. Read substrate files under review directly from disk.
2. Form an independent assessment: what is correct, uncertain, wrong, and what is missing.
3. Write this assessment to **`sonnet-blind.txt`** in the chain's working directory.
4. Only after `sonnet-blind.txt` is written: read Seats 1 and 2 output.

### Phase 2 — Delta synthesis (after reading prior seats)

5. Read Seats 1 and 2 output.
6. Write **`sonnet-synthesis.txt`** — delta only: what prior seats got right, what they got wrong, what they missed, and the synthesis verdict. Not a summary of prior seats.

### Structural enforcement

**`pre-tool-use-seat3-phase.mjs`** (PreToolUse hook on Edit|Write) — blocks any Write to a file matching `*sonnet-synthesis*` unless `sonnet-blind.txt` exists in the same directory. If blocked, the message is explicit: complete Phase 1 first.

**Laguna hard-fail** — `dispatch-laguna.mjs` (and Python equivalent) hard-fails at startup if `sonnet-blind.txt` is missing: exits with "FATAL: sonnet-blind.txt missing. Seat 3 did not complete Phase 1." This makes skipping Phase 1 impossible even if the hook is bypassed.

**Laguna independence audit** — Laguna's prompt includes both `sonnet-blind.txt` and `sonnet-synthesis.txt`. It audits whether synthesis reversed blind-eval positions without substrate evidence (deference to Seats 1/2). Reports `INDEPENDENCE: PASS/FAIL` as a separate check alongside its verdict.

**Why artifact dependency, not trust:** An instance can claim independent evaluation while actually reading prior seats first. Artifact dependency makes independence verifiable by structure, not by trust. The blind artifact must exist before synthesis can be written — this is enforceable; a promise is not.

---

## Dispatch script language — Node.js preferred (2026-05-17)

New chain dispatch scripts should be authored in Node.js (.mjs), not Python. The hooks are already Node.js — same runtime, async-native HTTP polling, no interpreter switching. Long-sleep polling in PowerShell is blocked by the tool sandbox; Bash `until` loops work but are crude workarounds. Node.js `fetch` streaming is non-blocking by design.

**Python works** for existing scripts in active chains — do not rewrite mid-chain. Apply going forward, and when authoring chain-compaction master scripts (canonical replacements for per-chain dispatch-*.py files).

```js
// Node.js streaming pattern (replaces Python requests.post streaming)
import { readFileSync, writeFileSync } from 'fs';

const res = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),  // body includes model, messages, stream:true, options
});

let content = '', buf = '';
const decoder = new TextDecoder();
for await (const chunk of res.body) {
  buf += decoder.decode(chunk, { stream: true });
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    const piece = obj?.message?.content ?? '';
    if (piece) { content += piece; process.stdout.write(piece); }
    if (obj.done) break;
  }
}
writeFileSync(outputPath, content, 'utf8');
```

No timeout needed: Node.js `fetch` holds the stream open as long as Ollama is writing — correct behavior for CPU inference that can run for hours.

---

## Hardware requirements

- **RAM**: 192GB minimum for full stack. nemotron-3-super loads at ~93.6GB. Two models
  simultaneously (e.g., nemotron + one cohabitant) peak at ~115-150GB.
- **GPU**: Not required. All models run on CPU. This is deliberate — these are long-batch
  reasoning tasks, not latency-sensitive inference.
- **Disk**: ~200GB for all five models plus nemotron-cascade-2 (background model).

Model sizes on this machine:
| Model | VRAM/RAM footprint |
|---|---|
| gemma4:31b | ~35GB |
| qwen3.6:27b | ~20GB |
| laguna-xs.2:q4_K_M | ~28GB |
| granite4.1:30b | ~35GB |
| nemotron-3-super:latest | ~93.6GB |

---

## Ollama configuration — critical env vars

Set these before starting Ollama. Session-scope works but does not survive tray restart.
Machine scope requires admin shell.

```powershell
# Session scope (immediate, lost on Ollama tray restart)
$env:OLLAMA_NUM_PARALLEL = "2"        # two concurrent inference slots
$env:OLLAMA_MAX_LOADED_MODELS = "2"   # allow two models in RAM simultaneously
$env:OLLAMA_MAX_QUEUE = "4"           # buffer for concurrent requests (Docker, AnythingLLM, CLI)

# Machine scope (permanent — requires admin PowerShell)
[System.Environment]::SetEnvironmentVariable("OLLAMA_NUM_PARALLEL","2","Machine")
[System.Environment]::SetEnvironmentVariable("OLLAMA_MAX_LOADED_MODELS","2","Machine")
[System.Environment]::SetEnvironmentVariable("OLLAMA_MAX_QUEUE","4","Machine")
```

**Why MAX_LOADED_MODELS=2, not 1:**
Docker Desktop's AI feature (EnableDockerAI) and AnythingLLM both keep a resident model
(nemotron-cascade-2, ~28GB) loaded at all times. With MAX_LOADED_MODELS=1, any inference
chain model evicts it, Docker/AnythingLLM reloads it, and the cycle of slot fights begins.
With MAX_LOADED_MODELS=2, the resident model and the inference model coexist.
The chain is serial (one model at a time), so we never need more than 2.

**Why MAX_QUEUE=4, not 1:**
With queue=1, any overlap between Docker AI background requests and our inference
request produces immediate 503. Queue=4 absorbs the background traffic.

---

## Docker AI — disable it

Docker Desktop loads nemotron-cascade-2 (~28GB) automatically via its built-in AI feature.
This was the hidden source of recurring slot conflicts for multiple sessions.

**Disable permanently:**
```python
import json
path = r'C:\Users\marka\AppData\Roaming\Docker\settings-store.json'
with open(path, 'r') as f:
    d = json.load(f)
d['EnableDockerAI'] = False
with open(path, 'w') as f:
    json.dump(d, f, indent=2)
```
Then restart Docker Desktop. Verify cascade-2 no longer appears in `GET /api/ps`.

---

## Timeout rule — non-negotiable

HTTP timeout in seconds must be >= num_ctx (tokens). CPU inference at 1-10 t/s means
a 32K context window takes up to 9 hours. Short timeouts produce false 503s and orphaned
inference processes that hold slots indefinitely.

```python
# Correct
timeout=32768  # matches num_predict ceiling
```

Never use a fixed timeout like 120s or 300s for large model inference.

---

## Python dispatch pattern

Every dispatch script uses streaming accumulation. Never use non-streaming:
- Non-streaming holds the full response in Ollama memory before returning — causes OOM on large models.
- Streaming writes tokens as they arrive — slot detection works per-token.

```python
import requests, json, time

body = {
    "model": "gemma4:31b",
    "messages": [{"role": "user", "content": prompt}],
    "stream": True,
    "options": {"num_predict": 8192, "temperature": 0.1}
}

content = ""
start = time.time()
with requests.post(f"{OLLAMA_HOST}/api/chat", json=body, stream=True, timeout=32768) as r:
    r.raise_for_status()
    for line in r.iter_lines():
        if line:
            try:
                chunk = json.loads(line)
                piece = chunk.get("message", {}).get("content", "")
                if piece:
                    content += piece
                if chunk.get("done"):
                    break
            except json.JSONDecodeError:
                pass

elapsed = time.time() - start
print(f"Done in {elapsed/60:.1f} min — {len(content)} chars")
```

**Write to file before printing.** On Windows with cp1252 terminal encoding, models
that produce Unicode dashes (U+2011 non-breaking hyphen, etc.) crash `print()` with
UnicodeEncodeError. The file write uses UTF-8 and succeeds; the print crash is cosmetic.
Fix if needed: `sys.stdout.reconfigure(encoding='utf-8')` at script top.

---

## qwen3.6:27b — think=True (C2 fix, 2026-05-14)

**C2 update (commit bbb7952, chain quality deliberation 2026-05-14):** qwen uses `think: True`
so chain-of-thought output is captured separately in `message.thinking`. The dispatch script
captures both fields: `message.content` for the verdict JSON, `message.thinking` for the
reasoning trace. This improves deliberation depth.

The `think` parameter must be a top-level key in the request body, NOT inside `options`:

```python
# Correct — qwen3.6:27b
body = {
    "model": "qwen3.6:27b",
    "messages": [...],
    "stream": True,
    "think": True,           # TOP LEVEL — think:True for qwen (C2 fix)
    "options": {"num_predict": 8192, "temperature": 0.1}
}

# Wrong — has no effect
body = {
    "options": {"think": True, "num_predict": 8192}
}
```

Note: nemotron-3-super:latest uses `think: False` (top-level) — NOT think:True. The two models
differ. qwen produces better deliberation with think:True; nemotron's thinking output consumes
the entire token budget before content begins, so think:False is required for nemotron.

Without the correct think value, qwen3.6:27b produces chain-of-thought inline in `message.content`,
corrupting the JSON verdict structure.

---

## Structured output contract

Every agent must return valid JSON matching this schema exactly:

```json
{
  "verdict": "APPROVE | CONDITIONAL_APPROVE | BLOCK",
  "summary": "one paragraph",
  "concerns": [
    {
      "id": "C1",
      "description": "specific concern",
      "code_ref": "spec section or file:line",
      "severity": "blocking | non_blocking",
      "investigation_task": "exact question for next agent"
    }
  ],
  "search_findings": "one paragraph on what live search revealed",
  "closed_prior_concerns": [
    {
      "id": "C1",
      "resolution": "what the agent found",
      "closed": true,
      "close_type": "evidence | refutation | assertion"
    }
  ]
}
```

`close_type` values:
- `evidence` — primary source, test result, or spec citation found; fully closed
- `refutation` — logical argument that the concern does not apply; fully closed
- `assertion` — opinion without specific evidence; **carries forward as low-confidence note**

Concerns closed by `assertion` are not removed from subsequent seats' view — they are forwarded
as soft notes requiring independent verification before the final verdict. This is the classical
ḥasan li-ghayrihi principle: assertion closure is weak closure, not full closure.

The final agent (nemotron) also includes:
```json
{
  "empirical_gaps": [
    {
      "concern_id": "C1",
      "description": "what requires real testing",
      "required_action": "specific test to run"
    }
  ]
}
```

---

## Concern propagation — three-bucket algorithm

**Critical:** Single-pass collection produces duplicates. Agent N's concerns appear open
to Agent N+1 even if Agent N+1 closes them before the loop reaches them.

**Also critical:** Concerns closed by `assertion` carry forward as low-confidence notes.
Only `evidence`- or `refutation`-closed concerns are fully removed from the open set.

Algorithm — always two passes, three buckets:

```python
def collect_open_concerns(all_outputs: list[dict]) -> tuple[list[dict], list[dict]]:
    # Pass 1: separate hard-closed (evidence/refutation) from soft-closed (assertion).
    # Missing close_type defaults to 'assertion' for backwards compatibility.
    hard_closed = set()
    assertion_closed = {}
    for out in all_outputs:
        for cc in out.get('closed_prior_concerns', []):
            if cc.get('closed'):
                ct = cc.get('close_type', 'assertion')
                if ct in ('evidence', 'refutation'):
                    hard_closed.add(cc['id'])
                else:
                    assertion_closed[cc['id']] = cc

    # Pass 2: collect concerns not hard-closed, deduplicated
    open_concerns = []
    seen = set()
    for out in all_outputs:
        agent = out.get('_agent', 'unknown')
        for c in out.get('concerns', []):
            if c['id'] not in hard_closed and c['id'] not in seen:
                c['agent'] = agent
                open_concerns.append(c)
                seen.add(c['id'])

    # Assertion-closed that were not subsequently hard-closed — carry forward as notes
    soft_notes = [v for k, v in assertion_closed.items() if k not in hard_closed]
    return open_concerns, soft_notes
```

Returns `(open_concerns, soft_notes)`. Inject `soft_notes` into subsequent seat prompts as
`[ASSERTION-CLOSED CONCERNS — VERIFY INDEPENDENTLY]` before the final verdict.

---

## SearxNG integration

Local instance at `http://localhost:8080`. Returns JSON with 100-300 char snippets.
Each agent in the chain gets a domain-specific query fetched at dispatch time (not canned).

```python
import urllib.request, urllib.parse, json

def searxng_search(query: str, num_results: int = 6) -> str:
    encoded = urllib.parse.quote(query)
    url = f"http://localhost:8080/search?q={encoded}&format=json"
    with urllib.request.urlopen(url, timeout=20) as r:
        data = json.loads(r.read())
    results = data.get('results', [])[:num_results]
    lines = [f"Search: {query}\n"]
    for i, res in enumerate(results, 1):
        lines.append(f"{i}. [{res.get('title','')}]({res.get('url','')})")
        lines.append(f"   {res.get('content','')}\n")
    return '\n'.join(lines)
```

Per-agent query domains:
| Agent | Query domain |
|---|---|
| gemma4:31b | architectural patterns, SOTA, breadth |
| qwen3.6:27b | GitHub issues, SO, changelogs, edge cases |
| laguna-xs.2 | code review checklists, loop control |
| granite4.1:30b | governance, fail-closed, safety, compliance |
| nemotron-3-super | production validation, testing, timeout requirements |

---

## Niyyah-as-contract (2026-05-12)

Every chain run begins with a niyyah declaration by the Sonnet architect seat (Seat 3).
That declaration passes as a required input block to every subsequent seat (4-6).
Each seat holds and audits it individually -- same structure as each person behind
the imam declaring their own niyyah in Salah. The imam does not hold it for the congregation.

**In the dispatch prompt**, include this block for seats 4-6:

```
[DECLARED NIYYAH -- AUDIT REQUIRED]
<niyyah text from Seat 3>

Before completing your verdict, answer:
Does this work honor the declared source?
Does it guard against the declared failure mode?
```

**In the structured output JSON**, add:

```json
"niyyah_audit": {
  "honored": true,
  "rationale": "one sentence"
}
```

**Why this pattern exists:** The niyyah gate checks for presence of declaration,
not whether the declared orientation was honored. An instance can declare "I will
read X before building Y" and then not read X -- and pass the gate. The chain-contract
pattern makes each seat individually accountable to the declared intention,
preventing theatrical niyyah from propagating through the chain.

---

## Evicting a stuck model

If a model stays loaded after inference completes (shows in `/api/ps` but not actively
running), evict with:

```bash
ollama stop <model>
```

Do NOT use `keep_alive=0` — triggers Ollama 0.23.2 scheduler deadlock (only server restart clears it). If it immediately reloads, Docker AI or AnythingLLM is the source — disable Docker AI (see above) and check AnythingLLM config.

---

## Checking Ollama state

```bash
# What's loaded and how big
curl -s http://localhost:11434/api/ps | python -c "
import json,sys
d=json.load(sys.stdin)
[print(m['name'], round(m.get('size',0)/1e9,1),'GB') for m in d.get('models',[])] or print('no models loaded')
"

# Who's connected to port 11434
netstat -ano | grep 11434 | grep ESTABLISHED
# Then: Get-Process -Id <PID> | Select-Object ProcessName,Path
```

---

## What a successful run looks like

```
Agent: gemma4:31b | Role: workshop | Pass 1
Search: 2008 chars
Prompt: 6071 chars | Dispatching...
Done in 4.2 min — 3841 chars
Verdict: CONDITIONAL_APPROVE
New concerns: 2

Agent: qwen3.6:27b | Role: deep-dive | Pass 1
...
Verdict: CONDITIONAL_APPROVE
New concerns: 2 | Closed: 1

...

Agent: nemotron-3-super | Role: synthesis | Pass 1
...
FINAL VERDICT: BLOCK
Blocking concerns: 3
```

A BLOCK is not a failure — it is the system working. The concerns it raises are genuine
gaps the spec must address before implementation. Patch the spec, run pass 2.

---

## Phase 1 — completion criteria

Phase 1 is complete only when ALL agents have produced parseable output. An agent that returns a non-JSON response, a truncated response, a timeout, or a parse error is not a completed seat — it is a failed seat. The phase is not complete until the failed seat has been re-run and its output is parseable.

**Why this rule exists:** The concern propagation algorithm (see above) operates on structured output. An agent that returns unparseable output silently contributes zero concerns and zero closures to the propagation. A chain that proceeds past a failed seat operates as if that seat agreed with everything — which is not agreement, it is absence. Absence is not the same as APPROVE.

**Enforcement:** The chain runner must validate JSON-parsability of each seat's output before proceeding to the next seat. On parse failure:
1. Log the failure (seat name, error, first 200 chars of raw output)
2. Re-dispatch the failed seat with the same inputs
3. Limit retries to 2 per seat
4. If retries exhausted: BLOCK the chain run with explicit failure — do not proceed to next seat

The re-dispatch is not optional. Proceeding without parseable output from every seat corrupts the concern propagation and makes the final verdict unreliable.

---

## The chain runner scripts

The current chain uses individual dispatch scripts per seat:

```
C:\Users\marka\AppData\Local\Temp\chain-compaction\dispatch-gemma.py
C:\Users\marka\AppData\Local\Temp\chain-compaction\dispatch-qwen.py
C:\Users\marka\AppData\Local\Temp\chain-compaction\dispatch-laguna.py
C:\Users\marka\AppData\Local\Temp\chain-compaction\dispatch-granite.py
C:\Users\marka\AppData\Local\Temp\chain-compaction\dispatch-nemotron.py
```

Each script reads the master plan + prior seat outputs from the chain-compaction/ directory.
Run sequentially (serial discipline — check api/ps before each dispatch).

Long-term home: `~/.claude/skills/deliberation/SKILL.md` (pending Group C packaging).

---

## Claude Code governance hooks — what a new instance must know

When editing substrate-class files (canon, practice, CLAUDE.md, hooks, Faith files),
two hooks fire in sequence. Both must pass or the edit is denied.

### Hook 1: Substrate gate (pre-tool-use-substrate.ps1)

Requires a foreign-frontier dispatch that occurred AFTER the most recent prior
substrate edit attempt in the JSONL transcript.

Accepted dispatches: mcp__(gemini|gpt|grok|glm|ollama)-*, WebSearch, WebFetch.
Per operator-context.md Section 7: the local 6-agent quorum (mcp__ollama-mcp__ollama_chat
with laguna-xs.2, or any mcp__ollama-* call) satisfies this gate. GPT/Gemini/Grok/GLM
are forbidden (no-frontier-models constraint). Use local quorum dispatches as the witness.

Key behavior:
- Every Edit/Write attempt on a substrate file is recorded as a `substrate_edit_attempt`
  event — even failed/blocked attempts. Each failure pushes the "last substrate edit"
  index forward, requiring a new dispatch.
- The dispatch must have a higher sequential tool_use index than the last attempt.
- "Prior" means strictly before the current Edit in the tool_use sequence.

### Hook 2: Surrender check (surrender-check.ps1)

Requires this exact format in the current assistant turn's TEXT block:

```
surrender articulation:
substrate says: <verbatim substring from old_string>
instance reasoning: <why this change is being made>
resolution: <which side wins and why>
```

Key behavior:
- The hook reads ONLY the text blocks of the current assistant turn in the JSONL.
- If any tool result (user message) separates the text from the Edit tool_use in the
  JSONL, the hook CANNOT see the surrender text and blocks.
- The `substrate says` value must appear verbatim (case-insensitive, whitespace-normalized)
  in old_string. Use plain ASCII — em-dashes and backticks in `substrate says` can cause
  encoding mismatches even when the content looks identical.

### The unlock: two-turn sequential pattern

Because:
1. The substrate gate requires a dispatch at idx > last substrate edit attempt idx
2. The surrender check requires the surrender text to be in the SAME assistant message as the Edit

The correct pattern is two turns:
- **Turn N:** `mcp__ollama-mcp__ollama_chat` dispatch with laguna-xs.2:q4_K_M reviewing the change — no Edit in this turn
- **Turn N+1:** Surrender articulation text + Edit tool_use in the same message — no MCP in this turn

The hooks see:
- Dispatch: at idx N (higher than last substrate edit attempt) ✓
- Surrender text: in the text block of the same message as the Edit ✓
- Edit: the gate was already satisfied by the Turn N dispatch ✓

Example:

```
[Turn N — dispatch only:]
mcp__ollama-mcp__ollama_chat with laguna-xs.2:q4_K_M reviewing the specific change

[Turn N+1 — surrender + edit in same message:]
surrender articulation:
substrate says: exact text from old_string here
instance reasoning: why the change
resolution: which side wins

[Edit tool_use in same response]
```

Do NOT use GPT/Grok as the dispatch model — they are forbidden under OPERATOR OVERRIDE.
Use `mcp__ollama-mcp__ollama_chat` with laguna-xs.2:q4_K_M.

This pattern was confirmed correct via the surrender-check.ps1 hook implementation and
verified by the 2026-05-11 governance chain.

---

Known issues and permanent fixes applied (2026-05-08)

| Issue | Root cause | Fix applied |
|---|---|---|
| nemotron-cascade-2 always loaded (~28GB) | Docker Desktop EnableDockerAI=true | Set to false in settings-store.json |
| 503 on inference despite free RAM | MAX_LOADED_MODELS=1 + Docker AI = slot fight | MAX_LOADED_MODELS=2, MAX_QUEUE=4 |
| Unicode crash on print() | Windows cp1252 terminal, model emits U+2011 | Output file written first; fix: `sys.stdout.reconfigure(encoding='utf-8')` |
| qwen produces chain-of-thought before JSON | think param inside options, not top-level | Move `think: False` to top-level body key |
| Single-pass concern collector duplicates C1 | Closures processed in same loop as collection | Two-pass algorithm (see above) |
| Stuck slot after inference | Model stays in /api/ps after completion | `ollama stop <model>` (CLI only) — never use keep_alive=0 (deadlock in 0.23.2) |
| Short timeout = false negative | CPU inference at 1-10 t/s | timeout=32768 (match num_predict) |
