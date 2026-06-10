# GOVERNANCE-EVENTS.md — Substrate Event Ledger

Durable record of detected governance events: substrate corruption, substrate-vs-substrate
contradiction, silent enforcement failure, and their resolutions. Per CLAUDE.md D14, an
incomplete or contradictory substrate is a governance event to be named, not silently
worked around. This file is where the naming lands so it survives the session that did
the noticing.

Entry format: date, event class, evidence (verifiable in current substrate), resolution
state, confidence. Newest first.

---

## 2026-06-09 — EVENT-001: Python-repr corruption of 9 governance artifacts (June 5 event, detected June 9)

**Class:** Substrate corruption + 4-day silent enforcement failure (fail-open).

**What happened:** During a session window on 2026-06-05 between 17:28 and 18:13 (file
mtimes), nine governance artifacts were written to disk as Python-repr fragment dumps
instead of source code. Signature: file begins `[{'fs': 'import ...'}`, Python `True`/`False`
booleans, regex backslashes stripped (`ollamas+` where `ollama\s+` intended). Root cause
session not yet identified; the AnythingLLM hotdir shows test activity in the same window
(test.txt 17:17, __temp_list.txt 16:53).

**Affected — overwritten (good versions existed in git):**
- `hooks/session-start.mjs` — the session bootstrap (athan). Dead June 5–9: every session
  in that window booted with NO governance bootstrap, no core.md injection, no
  model-version check.
- `hooks/session-hash-chain.mjs` — P6 hash chain. Dead June 5–9: 4-day hole in the
  integrity chain.

**Affected — born corrupted (no good version ever committed):**
- `hooks/purification-state.mjs` (registered 3× in settings.json — errored on every
  Read/Edit/Write/Bash/PowerShell call in every session since creation)
- `hooks/fm11-assertion-guard.mjs`
- `hooks/gr10-concurrency.mjs` (serial-inference guard — the machine-freeze protection —
  never functional)
- `skills/chain-review`, `skills/deliberate`, `skills/deliberation`, `skills/governance-audit`

**Aggravating:** all hook failures surfaced as "non-blocking status code" = fail-open;
no session noticed for 4 days. Anchor commit `e9616e1` (2026-06-09 19:13Z) swept the
corrupted working tree into git and pushed to all three remotes — the corruption is now
permanently in history (acceptable; history is history).

**Resolution (partial):**
- `session-start.mjs` restored from `438998f`; post-restore SHA-256
  `54C8D73063AA72DDB03D109FDB7D783B5F1ED07DDDA2EB3361EC97AE7317359F`; `node --check` exit 0.
- `session-hash-chain.mjs` restored from `33ed5dd`; post-restore SHA-256
  `27F7865DB95BD6AC0458D8E967C0369B0AD6A0CC2E40CCEC40E1DD7C969FC1B5`; `node --check` exit 0.
- Restoration commit: `b56f994`. Witness: laguna-xs.2:q4_K_M via MCP — Q1 APPROVE
  (restore-from-git correct), Q2 APPROVE (defer born-corrupted rebuilds to chain),
  Q3 REVISE (document timeline + hashes durably — this entry is that fix).

**THE WUDU-LAYER FINDING (2026-06-09 late session, operator-driven):** the two corrupted
HOOKS — `fm11-assertion-guard.mjs` (forbids asserting from memory without a current-session
Read) and `purification-state.mjs` (wudu-tier gate before governance acts) — are precisely
the PURIFICATION layer. They were dead all session. CONSEQUENCE, observed: the Fable-5
conductor asserted-from-memory ~12 times unchecked (e.g. "direct API fine", "3 bugs",
"MCP has no waterfall") — caught only by the operator, by hand. The gates that would have
caught these structurally were the dead ones. ROOT-OF-ROOT: nothing monitored hook
liveness, so the purification layer's death was invisible for days while the system
reported healthy.

**CORRECTION to the earlier "rebuild via muezzin mission" note:** WRONG for these.
Governance-substrate hooks (hooks/*) require ceremony (wudu/niyyah/surrender + foreign
witness) which the muezzin (commits --no-verify, cloud seats) CANNOT perform. These are
GOVERNANCE ACTS for a CLEAN, ORIENTED Claude instance — not daemon missions. (The 4
corrupted SKILLS may still route to muezzin/deprecation; the HOOKS do not.)

**RESOLUTION SPEC (for a fresh instance, full ceremony, foreign witness via laguna direct
API — the working path):**
1. Rebuild `fm11-assertion-guard.mjs` from the legible logic in its corrupted dump
   (memory-assertion regex + read-watcher current-session-Read evidence + deny); re-register
   on UserPromptSubmit + ollama dispatch; self-test (assert-without-read→deny, with-read→allow).
2. Rebuild `purification-state.mjs` (wudu-tier gate) likewise.
3. Build `hook-health-check.mjs` (detector for the root-of-root — a drifted instance was
   correctly BLOCKED by the niyyah gate from writing it mid-session 2026-06-09; that block
   IS the system working). Wire as SessionStart advisory so corruption is never again invisible.
4. Each: self-test green + laguna foreign-witness APPROVE + hook-health census green.

**Open (other):**
- 5 born-corrupted artifacts (the SKILLS): rebuild or deprecate — the 4 are OLD CHAIN
  skills, likely deprecated; decide per-artifact. gr10-concurrency logic recoverable.
- UPDATE 2026-06-09: the 3 dead hook registrations were removed from settings.json
  (commit b081584) — per-call errors silenced; re-register only what gets rebuilt.
- Root-cause hypothesis (confidence ~0.5): a Python orchestrator session in the muezzin
  build line serialized file contents on June 5 (Python-repr signature + the affected
  skills being the chain artifacts under migration). Find and fix the writer before any
  rebuild, or the rebuilds may be re-corrupted.
- `lefthook` not in PATH — laguna-pre-commit git gate is NOT executing on commits
  (observed during b56f994).

**Confidence:** corruption facts and restoration verified directly (high); root-cause
hypothesis (low — window correlation only).

---

## 2026-06-09 — EVENT-002: Frontier-validator contradiction across live substrate (standing since ~May 20)

**Class:** Substrate-vs-substrate contradiction on a load-bearing rule.

**Evidence:** `operator-context.md` §OPERATOR OVERRIDE (2026-05-20 13:03): frontier models
FORBIDDEN under any circumstances. Versus, all postdating it: memory
`feedback_local_deliberation_first.md` (05-27, frontier first for Class 1),
`user-prompt-submit.mjs` (05-29, injects "frontier validators — mandatory" every turn),
`delegation-and-stall-discipline.md` (06-01, Gemini as stall-breaker). The contradiction
is also encoded hook-vs-hook: `pre-compact.mjs` writes "No frontier models: forbidden"
into LAST-SESSION-STATE as an always-true constant while `user-prompt-submit.mjs` writes
"frontier validators available" into CURRENT-STATE.

**Resolution state:** RESOLVED 2026-06-09 — operator ruling (Mark, in session, verbatim:
"the ollama cloud api is an exceptance to the rule"): **the frontier ban STANDS** —
GPT/Gemini/Grok/GLM workers forbidden for all dispatch classes; the exception is the
**Ollama Cloud API** — open-weight models served via Ollama (local or cloud) are the
authorized validator/witness/deliberation path. The post-May-20 frontier-mandating texts
are the drifted side.

**AMENDED 2026-06-09 (later same day, operator-confirmed):** The operator identified the
original ban's root cause: frontier dispatches went out COLD — no governance context — and
underperformed governance-briefed local models. The ban targeted the symptom (frontier
labs) rather than the condition (cold dispatch), which is why instances kept eroding it —
the unmet need (independent second reads) was real. Successor ruling, condition-form per
CLAUDE.md D7:

> **No cold dispatch, any model.** Governance work reaches a model only through a
> briefed, receipted path — a muezzin mission or roster-seated dispatch carrying context.
> Validation/witness seats draw from Ollama-served models, **cloud or local**. Foreign-tribe
> (different lab than the audited seat) REQUIRED for witness seats. Open-weight PREFERRED
> for verdict-bearing seats (proprietary entries lack digest-pinning; their rijal records
> decay invisibly). The frontier MCP workers (gemini/gpt/grok/glm) remain dead — not by
> lab, but because they are cold-dispatch transports.

This supersedes the morning phrasing "the frontier ban stands." Memory entries and
ROSTER_AND_SEATING_SPEC.md updated same day to the condition-form rule.

**Cleanup queued (substrate-class, chain-ratified):** remove/rewrite frontier-worker
references in `user-prompt-submit.mjs` (re-anchor block), `foreign-frontier-validators.md`,
`delegation-and-stall-discipline.md` (Gemini-as-stall-breaker), `stop-validation.mjs`
(reason strings; isFF regex already accepts mcp__ollama — functional path unchanged),
`pre-compact.mjs`/`user-prompt-submit.mjs` state-file constants (make them agree). Memory
entries corrected this session (2026-06-09). Until cleanup lands, THIS RULING OVERRIDES
the frontier-mandating text.

---

## 2026-06-09 — EVENT-003: lefthook shims clobbered global git hooks (May 20 event, detected and fixed June 9)

**Class:** Silent enforcement failure (pre-commit review gate).

**What happened:** On 2026-05-20 ~11:57, lefthook shims were installed over
`~/.git-hooks/pre-commit` (original saved as `pre-commit.old`) and `commit-msg` (no
original existed). The lefthook binary was never installed (not in PATH, npm -g empty) and
no lefthook.yml exists in any active repo — so since May 20, NO pre-commit gate ran on any
repo (core.hooksPath is global): laguna commit review silently dead ~3 weeks, every commit
emitting "Can't find lefthook in PATH" as a non-blocking warning.

**Resolution:** original laguna pre-commit restored from `pre-commit.old` (dispatches
`hooks/laguna-pre-commit.mjs`; BLOCK aborts commit, WARN/PASS allow). Both lefthook shims
parked as `*.lefthook-shim.bak`. Root-cause session of the May 20 lefthook install not
identified — same open question class as EVENT-001's writer.

---
