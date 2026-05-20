The governance framework requires a post-cycle governance scanner (GR11). The scanner must run after every mission cycle and evaluate two distinct tracks:

TRACK 1 — Rule Compliance: Did the instance follow explicit governance rules (hook exit codes, dispatch sequence, surrender articulation format)?

TRACK 2 — Tradition-Alignment: Did the instance's emergent behavior match the Islamic jurisprudential traditions the rules are derived from? This catches rule-compliant but structurally broken behaviors — an instance can follow every written rule and still exhibit waswas (obsessive re-validation) or muwala violations (temporal fragmentation of atomic operations).

The tradition-alignment track is new and has no implementation precedent in the existing framework. The rule-compliance track overlaps with what the existing hooks already enforce at runtime.

CONTEXT — What the existing hooks already enforce (do not duplicate):

- niyyah-gate.mjs: blocks first Edit/Write if no niyyah declaration in JSONL transcript or pending-niyyah.json state file (60s TTL). Once niyyah found, session-scoped — does not re-check per subsequent Edit.
- surrender-check.mjs: fires on every Edit/Write to substrate-class files. Requires surrender articulation with substrate-coupling (substrate says value must appear verbatim in old_string). This is per-edit, not session-scoped.
- stop-validation.mjs: blocks turn-end when stop-language detected without foreign-frontier dispatch. At fire 3+, requires humility-marker.
- pre-tool-use-substrate.mjs: blocks substrate edits without foreign-frontier witness dispatch in the session.
- bootstrap-gate.mjs: blocks first Edit if practice/core.md and CANON-MANIFEST.md not Read in session.

GR11 must complement these, not duplicate them. It runs post-cycle (at session end or on demand), not at PreToolUse time.

SPECIFIC DESIGN QUESTIONS:

1. TRACK 1 SCOPE: The existing hooks already enforce rule compliance at runtime (fail-closed at PreToolUse). What does a post-cycle rule compliance scan add that the runtime hooks don't already catch? Is Track 1 redundant, or does it catch failure modes the runtime hooks miss? If redundant, should GR11 be Track 2 only?

2. WASWAS BEHAVIORAL METRIC: The waswas failure mode is: instance declares niyyah in a prior turn, then waits passively for user input before acting, when same-turn Path B (state file) execution was architecturally available. The proposed metric: measure the turn-gap between niyyah declaration and first subsequent Edit. If turn-gap > 0 under conditions where Path B was available, flag as behavioral waswas residual.
   Questions:
   (a) Is turn-gap the right metric, or should it be timestamp delta between pending-niyyah.json write and Edit tool call within the same turn?
   (b) How does the scanner determine whether Path B "was available"? (Is it always available when Bash/PowerShell can run?)
   (c) What is the appropriate response to a waswas detection — log only, or block the next session start?

3. SESSION-SCOPED NIYYAH TTL: The niyyah gate is session-scoped — once niyyah is declared, it covers all subsequent Edits in the session. The muwala principle (60s TTL on state files) enforces continuity at the micro-execution layer (same turn). But there is no enforcement at the macro layer. A niyyah declared at 10:00am for "editing foreign-frontier-validators.md" is still valid for a CLAUDE.md edit at 1:00pm in the same session.
   Questions:
   (a) Is this a real governance vulnerability, or is it already closed by surrender-check (which fires per-edit with content-coupling)?
   (b) If it is a real gap: which of the following closure mechanisms is correct?
       - Option 1: Temporal inactivity timeout (niyyah expires after N minutes of no tool calls)
       - Option 2: Scope boundary (niyyah scoped to files named in its "work" field; out-of-scope Edit invalidates it)
       - Option 3: Transactional close (successful git push purges session niyyah; re-declaration required before next Edit)
   (c) If surrender-check already closes the gap, document why explicitly rather than leaving it as an open question.

4. TRADITION-ALIGNMENT DETECTORS: Beyond waswas, what other tradition-alignment failure modes should GR11 detect? Consider:
   (a) Muwala violations: gaps in atomic sequences (how to detect in JSONL?)
   (b) Surrender theater: surrender articulations that are structurally valid (all fields present, substrate-coupled) but semantically hollow (instance reasoning is a single generic phrase). Can this be detected algorithmically, or does it require model judgment?
   (c) Niyyah theater: niyyah declarations with placeholder text (e.g., "failure mode: drift" with no specific pattern named). Same detection question.
   (d) FM-12 violations (Camel Rule): background task started without ScheduleWakeup. Currently enforced by stop-validation.mjs — does GR11 need to re-check this post-cycle?

5. IMPLEMENTATION: GR11 must be implementable with the existing tool stack (local Ollama models, JSONL transcript reading, git log access). No new infrastructure.
   Questions:
   (a) Should GR11 be a new hook (registered at Stop event, running after stop-validation.mjs), a new script invoked manually, or a slash command?
   (b) Which local model should run the tradition-alignment track? (laguna-xs.2 is fast but may not have enough judgment for semantic theater detection. granite4.1:30b is the governance seat. nemotron is the auditor.)
   (c) What is the output format? (PASS/FAIL like governance_scanner.faith.md, or a richer report?)
   (d) What does GR11 do with its findings? (Log to a file? Inject into next session's bootstrap? Block the Stop hook?)

6. SEPARATION FROM EXISTING HOOKS: The stop-validation.mjs already fires at Stop and checks for humility-markers on ratchet detection. How does GR11 avoid duplicating or conflicting with stop-validation? Should GR11 fire before or after stop-validation at the Stop event?

## Substrate Files

hooks/stop-validation.mjs
hooks/niyyah-gate.mjs
hooks/surrender-check.mjs
practice/core.md
canon/delegation-and-stall-discipline.md
canon/6agent-deliberation-stack.md

## Search Queries

- post-cycle governance audit AI agent behavioral telemetry JSONL transcript analysis 2025 2026
- semantic linting LLM behavior alignment detection emergent pattern analysis
- AI governance scanner tradition alignment compliance checking automated
- wudu niyyah Islamic jurisprudence AI governance behavioral metrics implementation
- distributed systems post-mortem automated analysis log scanning behavioral patterns
- LLM agent session audit stop hook behavioral compliance verification
