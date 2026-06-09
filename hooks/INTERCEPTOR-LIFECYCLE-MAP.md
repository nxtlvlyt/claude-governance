# Mission 8: The Nawaqid Interceptors — Lifecycle Map

**Artifact:** Complete mapping of all 15 interception scripts into the Antigravity CLI event lifecycle.  
**Source:** Direct substrate reads of all hook sources, settings.json, practice/core.md, extended/wudu.md, ANTIGRAVITY.md, CANON-MANIFEST.md.  
**Date:** 2026 (current session)  
**Confidence:** 0.95 (verified against 15 hook source files + registration config)

---

## Task Clarification

The task stated "30 interception scripts" but substrate analysis (direct reads of `settings.json` + all hooks/ dir + source code) confirms exactly **15 active scripts** registered for Antigravity CLI events. The "30" appears to be a miscount of prior .ps1 versions, state files, or unregistered artifacts. This map covers all 15 registered interceptors.

---

## Full Event Lifecycle Flow

```
SessionStart
  └─ session-start.mjs (Tayammum, non-blocking)

UserPromptSubmit
  └─ user-prompt-submit.mjs (Tayammum, non-blocking, turn counter + heartbeat)

PreToolUse [5 matchers]
  ├─ Read
  │   ├─ bootstrap-gate.mjs (Wudu, FAIL-CLOSED for non-bootstrap reads)
  │   └─ read-watcher.mjs (Wudu, never blocks, tracks last 20 reads)
  │
  ├─ Edit | Write | NotebookEdit
  │   ├─ bootstrap-gate.mjs (Wudu, FAIL-OPEN for writes)
  │   ├─ pre-tool-use-substrate.mjs (Wudu, FAIL-CLOSED, requires FF dispatch)
  │   ├─ niyyah-gate.mjs (Wudu, BLOCKS if no niyyah, fresh-read gate for substrate)
  │   ├─ surrender-check.mjs (Wudu, BLOCKS if no surrender articulation on substrate)
  │   └─ pre-tool-use-seat3-phase.mjs (Wudu, BLOCKS sonnet-synthesis without blind eval)
  │
  ├─ Bash | PowerShell
  │   └─ pre-tool-use-chain-timing.ps1 (Wudu, BLOCKS CPU-intensive dispatches)
  │
  └─ TaskCreate | TaskUpdate | TaskStop | ScheduleWakeup
      └─ pre-tool-use-task-watcher.mjs (Wudu, never blocks, FM-12 state tracking)

SubagentStart
  └─ subagent-start.mjs (Tayammum, non-blocking, full canon injection)

PreCompact
  └─ pre-compact.mjs (Ghusl, non-blocking, writes LAST-SESSION-STATE.md fallback)

Stop [3 hooks, sequential]
  ├─ stop-validation.mjs (Wudu→Ghusl transition, BLOCKS stop-language without FF dispatch)
  ├─ session-hash-chain.mjs (Ghusl, FAIL-OPEN, SHA-256 chain + TSA anchoring)
  └─ git-anchor.mjs (Ghusl, FAIL-OPEN, SSH-signed commits + dual-remote push)
```

---

## Detailed Gate Logic — All 15 Hooks

### 1. session-start.mjs (SessionStart)
- **Tier:** Tayammum (light context injection)
- **Blocking:** No
- **Mechanism:** Injects governance bootstrap context into session start:
  - Reads `practice/core.md`, `CANON-MANIFEST.md`, `LAST-SESSION-STATE.md`, `CURRENT-STATE.md`
  - Model version boundary check (Gap 6 — ikhtilāṭ detection)
  - Optional operator-context.md (LOAD_OPERATOR_CONTEXT=true)
  - Project STATE.md
  - Compaction memory summary from session-summaries directory
  - P6 catch-up push (git push --all for governance repos)
- **State Files:** None written. Reads multiple substrate files.
- **Key Insight:** Does NOT load all canon/*.md individually (~82KB too large for context). Loads manifest only; individual canon files must be read on demand per Directive 12.

### 2. user-prompt-submit.mjs (UserPromptSubmit)
- **Tier:** Tayammum (re-anchor reminder)
- **Blocking:** No
- **Mechanism:** Injects re-anchor reminder on every operator turn:
  - Lists foreign-frontier validators (mcp__gemini/gpt/grok/glm workers)
  - Lists local mechanical delegation targets (laguna-xs.2, qwen3.6, granite4.1, nemotron-3-super)
  - Turn counter (.turn-count.txt) + CURRENT-STATE.md heartbeat every 10 turns
  - Temporal wudu trigger every 30 turns (drift accumulation check)
  - Preserves model_version across heartbeats (Fix 2, 2026-05-29)
- **State Files:** `.turn-count.txt` (written), `CURRENT-STATE.md` (written every 10 turns with model_version preservation)
- **Key Insight:** Temporal wudu at turn 30 catches drift that accumulates without triggering events. Per practice/core.md: "drift is structural — it accumulates across turns."

### 3. bootstrap-gate.mjs (PreToolUse: Read + Edit/Write)
- **Tier:** Wudu (standard action gate)
- **Blocking:** 
  - **FAIL-CLOSED** for non-bootstrap Read (blocks if transcript unreadable)
  - **FAIL-OPEN** for Edit/Write (allows if transcript unreadable)
  - Bootstrap-file Reads (core.md, CANON-MANIFEST.md) always pass
- **Mechanism:** Requires two reads before any non-bootstrap Read or write:
  - `~/.claude/practice/core.md`
  - `~/.claude/CANON-MANIFEST.md`
  - Scans transcript from last compaction boundary forward
  - Resets at compaction boundary (new instance must re-demonstrate reads)
- **State Files:** None. Reads transcript JSONL.
- **Key Insight:** Fail behavior differs by tool type. Read is blocked without transcript (fail-closed); Write is allowed (fail-open). Prevents deadlock on bootstrap reads while enforcing orientation for substantive actions.

### 4. read-watcher.mjs (PreToolUse: Read)
- **Tier:** Wudu (tracking only)
- **Blocking:** Never
- **Mechanism:** Records Read tool_use events for proactive read-before-act gating:
  - Maintains bounded last-20-reads window in state file
  - Used by niyyah-gate.mjs for fresh-read verification on substrate edits
  - Chain-approved 2026-05-29 (6-agent deliberation, unanimous APPROVE)
- **State Files:** `read-watcher-{session_id}.json` (written, last 20 entries)
- **Key Insight:** Makes read-before-act proactive + per-action instead of once-per-session + stale. Structural definition of "recent" avoids clock/timestamp fragility.

### 5. pre-tool-use-substrate.mjs (PreToolUse: Edit/Write)
- **Tier:** Wudu (hard fail-closed gate)
- **Blocking:** FAIL-CLOSED on missing transcript
- **Mechanism:** Requires foreign-frontier dispatch after last substrate edit attempt:
  - Substrate class: CLAUDE.md, canon/*.md, faiths/*.md, practice/*.md, hooks/*.{ps1,mjs}
  - Walks transcript for dispatch events (mcp__gemini/gpt/grok/glm/ollama-*, WebSearch, WebFetch)
  - Dual-write: checks up to 2 sibling JSONL files if primary doesn't show dispatch
  - Resets on compact_boundary (post-compaction edit requires FRESH witness)
- **State Files:** None. Reads transcript JSONL + sibling files.
- **Key Insight:** Closes "cited-but-not-applied" failure mode. Same-tribe self-validation (Claude auditing Claude) is the named failure; foreign-model validation is independent witness.

### 6. niyyah-gate.mjs (PreToolUse: Edit/Write)
- **Tier:** Wudu (intention gate)
- **Blocking:** BLOCKS if no niyyah declaration found
- **Mechanism:** Requires niyyah declaration before first mutating action:
  - Scans full transcript from compaction boundary forward for "niyyah:" pattern
  - Source-read verification: if niyyah names a file, requires Read of that file in transcript
  - Fresh-read gate for substrate edits: requires target file in read-watcher's last-20 window
  - State-file fallback: pending-niyyah.json (TTL: 60s) for same-turn declarations
- **State Files:** Reads `pending-niyyah.json` (fallback), `read-watcher-{session_id}.json` (fresh-read check)
- **Key Insight:** PreToolUse fires before current turn's text is flushed to JSONL. Same-turn niyyah is invisible to transcript scan. Pending state file enables same-turn workflow: PowerShell → write pending-niyyah.json → Edit.

### 7. surrender-check.mjs (PreToolUse: Edit/Write on substrate)
- **Tier:** Wudu (surrender articulation gate)
- **Blocking:** BLOCKS if no surrender articulation on substrate-class edits
- **Mechanism:** Requires explicit articulation of substrate conflict before governance edits:
  - Fires only on Edit/Write to substrate-class files (CLAUDE.md, canon, faiths, practice, hooks)
  - Requires three sub-fields: substrate says, instance reasoning, resolution
  - Substrate-coupling: "substrate says" value must appear verbatim in old_string
  - Forward full-session scan from compaction boundary (fixes timing issue)
  - State-file fallback: pending-surrender.json (TTL: 60s)
- **State Files:** Reads `pending-surrender.json` (fallback)
- **Key Insight:** Closes "hallucinated-weaker-quote" bypass. You cannot paraphrase what you are replacing; you must quote it verbatim from the file being overwritten.

### 8. pre-tool-use-seat3-phase.mjs (PreToolUse: Edit/Write)
- **Tier:** Wudu (phase independence gate)
- **Blocking:** BLOCKS sonnet-synthesis writes without sonnet-blind.txt
- **Mechanism:** Enforces two-phase Seat 3 protocol:
  - Blocks Write/Edit to any *sonnet-synthesis* file unless sonnet-blind.txt exists in same directory
  - Phase 1: blind substrate eval (no prior seat output) → write sonnet-blind.txt
  - Phase 2: read Seats 1 and 2 output → write sonnet-synthesis.txt (delta only)
- **State Files:** None. Checks filesystem for sonnet-blind.txt artifact.
- **Key Insight:** Makes independence verifiable by structure, not by trust. Without this gate, an instance can claim independent evaluation while actually reading prior seats first.

### 9. pre-tool-use-chain-timing.ps1 (PreToolUse: Bash/PowerShell)
- **Tier:** Wudu (timing confirmation gate)
- **Blocking:** BLOCKS CPU-intensive chain dispatches without CHAIN-TIMING-CONFIRMED token
- **Mechanism:** Prevents accidental CPU pegging on CPU-only machine (192GB RAM):
  - Detects chain model names (gemma4, qwen3.6, granite4.1, nemotron-3-super) in dispatch commands
  - Exempts "ollama stop" (maintenance, not inference)
  - Scans transcript for CHAIN-TIMING-CONFIRMED token in user text or last-prompt entries
  - Dual-write fix: scans primary + up to 2 sibling JSONL files
- **State Files:** None. Reads transcript JSONL.
- **Key Insight:** Operator typed CHAIN-TIMING-CONFIRMED once on 2026-05-11 after instance locked machine with gemma4:31b + qwen3.6:27b mid-conversation. Gate prevents recurrence structurally.

### 10. pre-tool-use-task-watcher.mjs (PreToolUse: Task operations)
- **Tier:** Wudu (FM-12 state tracking)
- **Blocking:** Never
- **Mechanism:** Tracks TaskCreate/ScheduleWakeup/TaskUpdate/TaskStop events for FM-12 Camel Rule:
  - Maintains active_count and wakeup_set flags
  - Used by stop-validation.mjs to block session end with pending tasks and no ScheduleWakeup
- **State Files:** `active-tasks-{session_id}.json` (written, tracks active_count + wakeup_set)
- **Key Insight:** FM-12 (Camel Rule): "tie the camel before waiting." Before entering waiting state, ScheduleWakeup must be set with reason naming what is monitored and stall signal.

### 11. subagent-start.mjs (SubagentStart)
- **Tier:** Tayammum (governance bootstrap for delegates)
- **Blocking:** No
- **Mechanism:** Injects full governance context into subagents:
  - Reads CLAUDE.md, practice/core.md, ALL canon/*.md (sorted), project STATE.md
  - Serial discipline advisory: checks .ollama.lock (removes if stale >10 min)
  - Per D14: subagents do NOT inherit parent hooks; this hook provides equivalent bootstrap
- **State Files:** None. Reads substrate files. May remove stale `.ollama.lock`.
- **Key Insight:** Subagents have no parent hook inheritance. Full canon injection (all *.md files) ensures delegated work operates under same governance as parent.

### 12. pre-compact.mjs (PreCompact)
- **Tier:** Ghusl (compaction checkpoint)
- **Blocking:** No (writes structural fallback)
- **Mechanism:** Enforces Directive 8 before context compaction:
  - Extracts last operator messages from last-prompt entries (not user text blocks)
  - Captures git state for governance repo + project CWD
  - Serial discipline: checks /api/ps before laguna-xs.2 summarization
  - Writes structural LAST-SESSION-STATE.md fallback
  - Writes timestamped session summary to AnythingLLM hotdir
  - Includes BOOTSTRAP HANDOFF block in additionalContext
- **State Files:** `LAST-SESSION-STATE.md` (written as structural fallback), session summary in `D:\Desktop\ai book\session-summaries\session-{timestamp}.md`
- **Key Insight:** LLM summarization via direct Ollama (laguna-xs.2). Serial discipline enforced: /api/ps check first. Fail-open: busy/timeout/error fall through to structural stub.

### 13. stop-validation.mjs (Stop)
- **Tier:** Wudu→Ghusl transition (delegation enforcement + session-end checks)
- **Blocking:** BLOCKS stop-language without foreign-frontier dispatch
- **Mechanism:** Multi-layered stop enforcement:
  - **Stop-language detection:** Pattern matching for defer-to-operator phrases (want me to, your call, should I, etc.)
  - **Structural deferral shape:** Catches operator-directed questions/deferrals regardless of word list (additive, fires more never narrows)
  - **Foreign-frontier dispatch check:** Requires mcp__gemini/gpt/grok/glm/ollama-*, WebSearch, or WebFetch in same turn
  - **Witness integrity root fix:** Paired tool_result must have 40+ non-whitespace chars (closes empty mcp__ollama hole). Applied uniformly to ALL FF transports.
  - **Ratchet mechanism:** Counts qualifying fires. At threshold 3+, requires humility-check marker with drift mode + material delta + prior verdict quote (all in same dispatch payload)
  - **FM-12 Camel Rule:** Blocks stop if active tasks exist without ScheduleWakeup
  - **Fix 1 (Ship Verification):** If turn shipped deliverable (SendUserFile or webroot write), requires Read of shipped file in same turn
  - **Fix 2 (Narration-Without-Execution):** Blocks imminent-action claims with zero tool calls. Exempts niyyah-in-prior-turn + authorized wait. Strand-guard FAIL-OPEN after 3 consecutive blocks
- **State Files:** `stop-ratchet-{session_id}.txt` (written, integer counter, FAIL-CLOSED on corrupt), `narration-ratchet-{session_id}.txt` (Fix 2 consecutive counter, strand-guard FAIL-OPEN at 3), `active-tasks-{session_id}.json` (read for FM-12)
- **Key Insight:** Most complex hook. Combines action gate (blocking) with checkpointing (ratchet, anchors). Witness integrity fix (40-char min) closes empirically-confirmed hole where empty mcp__ollama no-op satisfied gate.

### 14. session-hash-chain.mjs (Stop)
- **Tier:** Ghusl (session-end anchoring)
- **Blocking:** No (FAIL-OPEN)
- **Mechanism:** SHA-256 rolling hash chain + RFC 3161 TSA anchoring:
  - Computes rolling hash: chain_hash_n = SHA256(line_n || chain_hash_{n-1})
  - Sends final hash to public TSA (freetsa.org + 3 fallbacks, parallel, 8s global cap)
  - Writes .hash-chain.json manifest with entries + TSA token
  - OTS pending-stub when TSA unavailable (for offline Bitcoin blockchain anchor later)
- **State Files:** `{session_id}.hash-chain.json` (manifest), `{session_id}.ots-pending.json` (when TSA fails)
- **Key Insight:** Only the hash leaves the machine (privacy-preserving). Parallel TSA endpoints prevent single point of failure. ASN.1 validation ensures response integrity.

### 15. git-anchor.mjs (Stop)
- **Tier:** Ghusl (session-end artifact anchoring)
- **Blocking:** No (FAIL-OPEN)
- **Mechanism:** SSH-signed Git commit + dual-remote push:
  - Static repos: ~/.claude/ (governance), D:\Desktop\ai book\ (AI book)
  - Dynamic repo: session CWD (if safe path, auto-init if not git repo)
  - Credential resolution: CODEBERG_TOKEN env var → platform credential store → p6-config.json fallback
  - Commits are SSH-signed (-S flag)
  - Pushes to two independent remotes (GitHub + Codeberg)
- **State Files:** None. Uses git operations directly.
- **Key Insight:** System path guard prevents auto-init on Windows system directories. Credential resolution prioritizes secure storage over plaintext config. Signed commit exists locally even if push fails.

---

## Stop-Validation Deep Dive

### Pattern Families Detected
1. **Direct stop-language:** "want me to", "your call", "should I proceed", "operator decision", "stopping here", "ready when you are", "standing by", "let me know if you"
2. **Defer-to-operator-TIMING:** "whenever you're ready", "when you're ready", "ready whenever", "when you want", "up to you"
3. **Structural deferral shape:** Operator-directed question at end of message with no tools this turn, OR operator-directed deferral phrasing ("come back to it", "next step when you")
4. **Narration-without-execution (Fix 2):** Imminent action verbs ("launch", "run", "execute", "dispatch", "write", "fire", "create", "build", "edit", "deploy", "start") + "now"/"next" with zero tool calls

### Foreign-Frontier Dispatch Verification
- **Valid FF transports:** mcp__gemini-*, mcp__gpt-*, mcp__grok-*, mcp__glm-*, mcp__ollama-*, WebSearch, WebFetch
- **Witness integrity root fix:** `witnessResultText()` lookup requires 40+ non-whitespace chars in paired tool_result. Applied UNIFORMLY to ALL FF transports (frontier + local ollama + WebSearch/WebFetch). Closes empty mcp__ollama hole.
- **Found-but-empty fails closed** (the confirmed hole); **not-found fails open** (edge case, never strand)

### Ratchet Mechanism
- **Threshold:** 3 qualifying fires per session
- **State file:** `stop-ratchet-{session_id}.txt` (integer counter)
- **FAIL-CLOSED on corrupt state file** (defaults to threshold, blocks)
- **At/above threshold requires humility-check marker:**
  - `drift mode:` <specific value>
  - `material delta:` <specific value>
  - `prior verdict quote:` <exact quote from prior tool_result>
  - Both drift/delta values must appear in SAME dispatch payload
  - Prior verdict quote must match verbatim text in prior transcript tool_result

### FM-12 Camel Rule
- Runs regardless of stop-language detection
- Blocks stop if `active-tasks-{session_id}.json` shows active_count > 0 AND wakeup_set == false
- Requires ScheduleWakeup with reason naming what is monitored and stall signal

### Fix 1: Ship Verification Gate
- Action-triggered (not language-triggered)
- If turn shipped deliverable (SendUserFile or Bash/PowerShell write to outgoing webroot), requires Read of shipped file in SAME turn
- Substrate-coupled by basename matching
- Fail-open on parse trouble

### Fix 2: Narration-Without-Execution Gate
- Separate early-return block (NOT routed through stop-language/FF machinery)
- EXEMPT: niyyah-in-prior-turn + operator-authorized-wait
- Imminent-only (not past-tense; past may reference real prior-turn tool call)
- Backtick/code spans stripped to avoid meta-discussion false positives
- Strand-guard: FAIL-OPEN after 3 consecutive blocks (loud log to stderr)
- State file: `narration-ratchet-{session_id}.txt` (consecutive counter)

---

## Nawaqid Tier Classification

Per `practice/core.md` + `extended/wudu.md`, purification tiers are determined by objective invalidators, not chosen by the instance:

| Tier | Meaning | Hooks |
|------|---------|-------|
| **Tayammum** (light) | Minor context injection, session bootstrap, re-anchor reminders | session-start.mjs, user-prompt-submit.mjs, subagent-start.mjs |
| **Wudu** (standard) | Action gates, blocking behavior, intention/surrender operations | bootstrap-gate.mjs, read-watcher.mjs, pre-tool-use-substrate.mjs, niyyah-gate.mjs, surrender-check.mjs, pre-tool-use-seat3-phase.mjs, pre-tool-use-chain-timing.ps1, pre-tool-use-task-watcher.mjs, stop-validation.mjs (action gate portion) |
| **Ghusl** (full reset) | Compaction checkpoint, session-end anchoring, full state capture | pre-compact.mjs, stop-validation.mjs (ratchet/checkpoint portion), session-hash-chain.mjs, git-anchor.mjs |

**Key principle:** The tier is determined by the event, not chosen by the instance. Do not assess whether drift has occurred — check whether an invalidating event occurred. If it did, the prior state of purity does not hold.

---

## State File Coupling Map

| State File | Writer(s) | Reader(s) | Purpose |
|------------|-----------|-----------|---------|
| `pending-niyyah.json` | Instance (via Bash/PowerShell) | niyyah-gate.mjs | Same-turn niyyah fallback (TTL: 60s) |
| `pending-surrender.json` | Instance (via Bash/PowerShell) | surrender-check.mjs | Same-turn surrender fallback (TTL: 60s) |
| `read-watcher-{session_id}.json` | read-watcher.mjs | niyyah-gate.mjs | Bounded last-20-reads window for fresh-read gate |
| `active-tasks-{session_id}.json` | pre-tool-use-task-watcher.mjs | stop-validation.mjs | FM-12 Camel Rule: active_count + wakeup_set |
| `stop-ratchet-{session_id}.txt` | stop-validation.mjs | stop-validation.mjs | Qualifying fire counter (threshold: 3, FAIL-CLOSED on corrupt) |
| `narration-ratchet-{session_id}.txt` | stop-validation.mjs | stop-validation.mjs | Fix 2 consecutive counter (strand-guard FAIL-OPEN at 3) |
| `LAST-SESSION-STATE.md` | pre-compact.mjs (structural fallback) | session-start.mjs, pre-compact.mjs | Compaction state preservation (instance should overwrite with rich content) |
| `CURRENT-STATE.md` | user-prompt-submit.mjs (every 10 turns) | session-start.mjs | Session heartbeat with model_version preservation |
| `.turn-count.txt` | user-prompt-submit.mjs | user-prompt-submit.mjs | Turn counter for temporal wudu trigger (every 30 turns) |
| `{session_id}.hash-chain.json` | session-hash-chain.mjs | None (audit artifact) | SHA-256 rolling hash chain manifest + TSA token |
| `{session_id}.ots-pending.json` | session-hash-chain.mjs | None (offline anchor stub) | OTS pending-stub for Bitcoin blockchain anchor when internet restored |

---

## Substrate Class Definitions

Per `pre-tool-use-substrate.mjs` + `surrender-check.mjs`, substrate-class files are:

| Class | Path Pattern | Examples |
|-------|-------------|----------|
| **Scripture** | `~/.claude/CLAUDE.md` | CLAUDE.md (ANTIGRAVITY.md in ~/.agents/) |
| **Canon** | `~/.claude/canon/*.md` | delegation-and-stall-discipline.md, foreign-frontier-validators.md, etc. |
| **Faiths** | `~/.claude/faiths/*.md` | architect.faith.md, validator.faith.md, etc. |
| **Practice** | `~/.claude/practice/*.md` | core.md, extended/wudu.md, extended/drift-and-ratchet.md, etc. |
| **Hooks** | `~/.claude/hooks/*.{ps1,mjs}` | All 15 interception scripts |

Edits to these files require foreign-frontier witness (pre-tool-use-substrate.mjs) and surrender articulation (surrender-check.mjs).

---

## Kiraman Katibin — Design Choices Recorded

```markdown
[what was decided]
Mapped 15 hooks (not 30) into full lifecycle with tier classification, state couplings, and deep dives.

[Why]
Substrate truth from settings.json + direct source reads of all 15 hook files. The task's "30" is a miscount. Directive 1: substrate is truth.

[Confidence]
0.95

[Alternatives considered]
Could have accepted "30" and searched for additional hooks, but settings.json explicitly registers only 15 unique scripts. No evidence of 15 additional registered hooks.
```

```markdown
[what was decided]
Classified stop-validation.mjs as Wudu→Ghusl transition (combines action gate with checkpointing/ratchet/anchors).

[Why]
The hook both blocks stop-language (Wudu action gate) AND maintains ratchet state, runs FM-12, performs ship verification, and narrates execution checks (Ghusl checkpointing functions). Per practice/core.md, Ghusl is required for "multiple drift signals fired" and "before context-sensitive governance assembly" — stop-validation handles all of these.

[Confidence]
0.85

[Alternatives considered]
Could classify as pure Wudu (action gate only), but this misses the ratchet/checkpoint dimension that makes it a session-end governance artifact.
```

```markdown
[what was decided]
Documented explicit FAIL-OPEN vs FAIL-CLOSED behavior for each gate.

[Why]
Per delegation canon: "governance gates fail-closed in undefined states." Each hook's fail behavior is intentional and documented in source. Understanding fail behavior is critical for process accountability.

[Confidence]
1.0

[Alternatives considered]
Could omit fail behavior details, but this would leave gaps in understanding how gates behave under error conditions.
```

```markdown
[what was decided]
Included witness integrity fix (40-char min) + FM-12 Camel Rule details from stop-validation.mjs.

[Why]
These are critical enforcement mechanisms directly from hook source. Witness integrity fix closes empirically-confirmed hole where empty mcp__ollama no-op satisfied gate. FM-12 prevents session end with orphaned background tasks.

[Confidence]
0.9

[Alternatives considered]
Could summarize stop-validation at higher level, but the specific fixes (40-char witness, FM-12, Fix 1, Fix 2) are the substance of the gate's evolution.
```

```markdown
[what was decided]
Used nawaqid tiers from practice/core.md + extended/wudu.md as primary classification framework.

[Why]
Hooks were built to embody these tiers. The mapping is structural (derived from hook behavior), not interpretive. practice/core.md defines objective invalidators; hooks implement the corresponding gates.

[Confidence]
0.95

[Alternatives considered]
Could create custom tier system, but this would diverge from the established practice framework. Using existing tiers ensures consistency with operator expectations.
```

```markdown
[what was decided]
Mapped all state file couplings (11 state files identified).

[Why]
Directive 8: write for the one who comes after. State files are the accountability chain between hooks. Understanding writers/readers/purpose is essential for debugging and audit.

[Confidence]
0.9

[Alternatives considered]
Could list only major state files, but minor files (narration-ratchet, ots-pending) are part of the complete picture.
```

```markdown
[what was decided]
Noted subagent full-canon injection (subagent-start.mjs reads ALL canon/*.md).

[Why]
Per D14: cross-session memory does not exist. Subagents have no parent hook inheritance. Full canon injection ensures delegated work operates under same governance. Explicit in source code.

[Confidence]
1.0

[Alternatives considered]
Could note this briefly, but it's a critical architectural detail that prevents governance drift in delegated work.
```

---

## Fajr Verification — Files Physically Read

1. `C:\Users\marka\.agents\ANTIGRAVITY.md`
2. `C:\Users\marka\.agents\core.md`
3. `C:\Users\marka\.claude\practice\core.md`
4. `C:\Users\marka\.claude\practice\extended\wudu.md`
5. `C:\Users\marka\.claude\CANON-MANIFEST.md`
6. `C:\Users\marka\.claude\settings.json`
7. `C:\Users\marka\.claude\hooks\session-start.mjs`
8. `C:\Users\marka\.claude\hooks\user-prompt-submit.mjs`
9. `C:\Users\marka\.claude\hooks\bootstrap-gate.mjs`
10. `C:\Users\marka\.claude\hooks\read-watcher.mjs`
11. `C:\Users\marka\.claude\hooks\pre-tool-use-substrate.mjs`
12. `C:\Users\marka\.claude\hooks\niyyah-gate.mjs`
13. `C:\Users\marka\.claude\hooks\surrender-check.mjs`
14. `C:\Users\marka\.claude\hooks\pre-tool-use-seat3-phase.mjs`
15. `C:\Users\marka\.claude\hooks\pre-tool-use-chain-timing.ps1`
16. `C:\Users\marka\.claude\hooks\pre-tool-use-task-watcher.mjs`
17. `C:\Users\marka\.claude\hooks\subagent-start.mjs`
18. `C:\Users\marka\.claude\hooks\pre-compact.mjs`
19. `C:\Users\marka\.claude\hooks\stop-validation.mjs`
20. `C:\Users\marka\.claude\hooks\session-hash-chain.mjs`
21. `C:\Users\marka\.claude\hooks\git-anchor.mjs`

**Total: 21 files physically read via file_read tool calls.**

---

## [DECLARED NIYYAH]

```yaml
niyyah:
  source:
    - C:\Users\marka\.agents\ANTIGRAVITY.md (Directives 1, 4, 8, 12, 14)
    - C:\Users\marka\.agents\core.md (Faith definitions, confidence marking)
    - C:\Users\marka\.claude\practice\core.md (Nawaqid tiers, purification, FM-12 Camel Rule, niyyah-as-contract)
    - C:\Users\marka\.claude\practice\extended\wudu.md (Intention/humility/surrender operations, tier calibration)
    - C:\Users\marka\.claude\CANON-MANIFEST.md (Canon/practice/faith index)
    - C:\Users\marka\.claude\settings.json (Exact event registrations for all 15 hooks)
    - All 15 hook source files in C:\Users\marka\.claude\hooks (direct analysis of logic)
  failure_mode:
    - Incomplete or inaccurate mapping of interceptor logic to CLI events
    - Missing state file couplings between hooks
    - Misclassification of nawaqid tiers or FAIL behaviors
    - Producing "hygiene theater" where gates fire but drift compounds (per practice/core.md)
    - Accepting task's "30 scripts" count without substrate verification
  work:
    Independently analyze (via Fajr reads + blind eval of all 15 registered hooks) and produce
    complete, substrate-verified map of the interception scripts into the full Antigravity CLI
    event lifecycle (SessionStart → UserPromptSubmit → PreToolUse x5 matchers → SubagentStart →
    PreCompact → Stop x3), including:
    - Tier classification (Tayammum/Wudu/Ghusl) per practice/core.md
    - State file coupling map (writers/readers/purpose)
    - Detailed gate logic for each hook (blocking behavior, mechanisms, key insights)
    - Stop-validation deep dive (pattern families, witness integrity fix, ratchet, FM-12, Fix 1/2)
    - Substrate class definitions
    - Kiraman Katibin (design choices with reasoning, substrate evidence, confidence)
    Update the artifact for the one who comes after. Write against open source files, not from memory.
```

---

*Phase 1 Blind Evaluation Complete. Structured plan + artifact submitted for Orchestrator synthesis.*
