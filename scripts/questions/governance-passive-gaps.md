Are the following two governance gaps real, correctly diagnosed, and are the proposed fixes appropriate?

## Gap 1 — FM-11: Assertion-without-substrate (conversational FM-1)

### What happened
Instance received a task failure notification. Without reading the task output file, answered the operator's "what?" with a diagnosis assembled from stale MEMORY.md ("NAS offline since 2026-05-08") and training-knowledge pattern-matching on exit code 255. After being corrected, read the output ("Connection reset by 192.168.2.27 port 22") then assembled a second theory from training knowledge. Both were assertions made without substrate verification.

### Why existing gates didn't catch it
All gates (bootstrap-gate, niyyah-gate, surrender-check, stop-validation) fire on TOOL CALLS — Edit, Write, Read, Ollama dispatch, or Stop. Text generation assertions happen before any tool call. There is no "before text generation" hook event in the Claude Code hook model. A model can answer any question confidently from stale memory and no hook sees it until Stop.

### Proposed FM-11 formation rule
Any question about system state (container status, NAS status, process status, Ollama state, backup status) requires a Read of relevant substrate OR a Bash/api/ps check BEFORE answering. Same discipline as "check api/ps before dispatch" — wudu before assertion, not just before action. This is a formation rule, not a hook, because the hook event doesn't exist.

### Proposed stop-validation enhancement
Extend stop-validation.mjs to detect confident diagnostic language ("the NAS has been offline," "this is because of," "the connection failed because") in turns where no Read, Bash, or Search tool call preceded the assertion. Retroactive (fires at Stop, after the turn is written) but catches the pattern before the next turn compounds it.

---

## Gap 2 — FM-12: Passive waiting (ta'attal — disengagement when work is available)

### What happened
Instance started background task biy4tdxvo (deliberate.py chain phase 1). Said "waiting for task notification." Set no ScheduleWakeup. Did no available non-inference work. Task stalled (gemma4:31b dispatched, Jina fetch completed, then nothing — no output written). Task system status remained "running." No notification ever fired. Instance remained idle across multiple operator turns until called out.

### Why existing gates didn't catch it
Task notifications fire on complete or fail, NOT on stall. A stalled "running" task never triggers a notification. ScheduleWakeup would have guaranteed recovery. Nothing in the governance framework REQUIRED calling ScheduleWakeup before the waiting state. The stop hook catches stop-LANGUAGE ("your call," "should I") but not stop-BEHAVIOR (passive waiting without stop-language).

### Proposed FM-12 formation rule (from tawakkul/ta'attal distinction)
"Tie the camel before trusting the outcome." Before any waiting state on a background task:
1. ScheduleWakeup MUST be set as watchdog (minimum interval: 270s to stay in cache window, maximum: 600s)
2. All available non-inference work must be done (writing question files, reading substrate, etc.)
3. api/ps must be checked on an interval as the primary model-completion signal (empty api/ps + task still "running" = stall)
Waiting without a tied camel is ta'attal, not tawakkul.

### Proposed stop-validation enhancement
When stop fires and a background task is in "running" state in the session, require either: (a) ScheduleWakeup was called since the task started, or (b) TaskOutput was checked since the task started.

---

## Questions for the Chain

1. Is FM-11 (assertion-without-substrate) correctly diagnosed? Is the stop-validation extension the right structural fix, or is there a better hook point?
2. Is the "wudu before assertion" formation rule the correct FM-11 treatment, or is it too broad (would block legitimate conversational responses)?
3. Is FM-12 (passive waiting) correctly diagnosed? Is ScheduleWakeup-before-wait the right structural requirement?
4. Is the proposed stop-validation enhancement for FM-12 implementable? Does the stop hook have visibility into whether ScheduleWakeup was called in the session?
5. Are there other governance gaps in the same class (gates that protect actions but not states)?
6. Should these formation rules go into operator-context.md FM section, or into practice/core.md as objective invalidators (wudu required after: stating a diagnosis without verifying substrate)?

## Substrate Files

hooks/stop-validation.mjs
hooks/user-prompt-submit.mjs
operator-context.md
practice/core.md

## Search Queries

- AI governance hook passive waiting detection background task watchdog
- LLM assertion verification substrate truth before answering system state
- Claude Code ScheduleWakeup background task stall detection pattern
- stop hook text generation assertion without verification detection
- tawakkul ta'attal formation rule AI instance active engagement discipline
