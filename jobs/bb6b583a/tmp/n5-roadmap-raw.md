# N5 BEAT-HARNESS BUILD ROADMAP (working plan)

Synthesized 2026-07-15 from four substrate readers. Sources: QUEUE.md "2026-07-11 ENGINE ITEM" (lines 2233-2315, items 1-14 + owner/sequence block), operator-rulings.md SUCCESSION SEQUENCE (lines 74-107), conductor-core.md (all 9 laws + 3 practices, read in full), 07-14/15 session lesson classes (AUTORUN 962-1125, GAP-REGISTER 35-41, QUEUE ITEMS 23-27), CONDUCTOR-PORT-PLAYBOOK.md + agy-muezzin/conduct-beat-local.mjs (281 lines, read in full) + senior-ladder.jsonl.

**Sourcing convention, used on every claim:**
- `[SPEC:n]` — verbatim/direct from QUEUE item n or its owner block
- `[RULING]` — verbatim/direct from operator-rulings SUCCESSION SEQUENCE
- `[LAWS:n]` / `[LAWS:Pn]` — from conductor-core law n / practice n
- `[LC:n]` — from 07-14/15 lesson class n, with its receipt
- `[SUB]` — from the substrate reader (playbook / conduct-beat-local.mjs / ladder, read directly)
- `[INF]` — my inference/derivation; not in any input verbatim

**Standing mandates on the build itself:** the N5 builder READS CONDUCTOR-PORT-PLAYBOOK.md FIRST and re-opens the QUEUE entry before building `[SPEC owner block, RULING]`; the playbook is updated in the same session any new port lesson is paid for `[SPEC owner block]`; every gate in this plan lands with a paired selftest — refuses the real bad shape AND passes a good shape lifted from a live mission file — and any gate-LOOSENING takes the drift-and-ratchet bar (adversarial slip attempt that fails) `[LC:9, receipts GAP-REGISTER 35/37, QUEUE ITEM 25]`.

**Architectural spine (governs every placement below):** rails live in the SCRIPT, not the harness; the model seat only relays sweep-computed REQUIRED ACTIONS as one strict-JSON allowlisted verb `[SUB, playbook §5(a) "= N5", "binds ANY model — Claude, Gemini, local — identically"]`. Lesson-mechanization therefore lands in conduct-cycle.mjs (the sweep), not the beat relay — the relay only echoes sweep-ordered actions `[SUB]`.

---

## 1. PER-ITEM DESIGN SKETCHES (spec items 1-14)

Effort key: S = single-wake sweep/lint addition + selftest; M = new verb or cross-file, multi-wake; L = multi-session.

### Item 1 — CLEAR-PROCEDURE completeness — S
- **File/verb:** conduct-cycle.mjs, requeue-prep path (the surface the harness `record` verb already shells with `--requeue` `[SUB]`). Clear three artifacts: `<mission>.result.json`, `_sandbox`, mission-dir `_checkpoint.json`; DIAGNOSE sweep items PRINT the three paths with exists/cleared state `[SPEC:1]`.
- **Reuse vs new:** extends existing sweep + record plumbing; new clear function + printed triple `[INF]`.
- **Deps:** none. Later composed into PA-14 (atomic re-bare verb) `[INF]`.
- **Selftest:** fixture mission dir with stale checkpoint → requeue clears all three `[INF per LC:9 policy]`.

### Item 2 — VERIFY-THE-FLIP + line-grammar ADDENDUM — S
- **File:** conduct-cycle.mjs sweep. Check: any line containing "re-queued" whose leading token is still FAILED → REQUIRED ACTION "flip or explain" `[SPEC:2]`. ADDENDUM: lead token must be in STATUS_RE or a bare missions/ path; all annotations inside a single well-formed `<!-- -->` comment `[SPEC:2 addendum, scope note]`.
- **Reuse vs new:** pure sweep addition — owner block calls items 2+3 "pure conduct-cycle sweep additions (cheapest, highest value)" `[SPEC owner block]`.
- **Deps:** none. The ADDENDUM grammar is the prerequisite for PA-1 (stamp verb lint) and PA-5 (REFUSED token joins STATUS_RE) `[INF]`. Directly mechanizes LC:1's "unknown leading token" receipt (AUTORUN 1013: hand-written RESOLVED token unknown to a parser that accepts only DONE/FAILED/RUNNING/SPLIT/PARKED) `[LC:1]`.

### Item 3 — Preflight COVERS class = newest retro failure class — S
- **File:** conduct-cycle.mjs sweep — compute both, name mismatches `[SPEC:3]`. Receipt basis: weather attempt-4 refusal `[SPEC:3]`.
- **Deps:** none. Composed into PA-14 `[INF]`.

### Item 4 — RULE-11 first-line-verb contract in DIAGNOSE hint text — S
- **File:** conduct-cycle.mjs DIAGNOSE hint text: "verbs must be on step FIRST lines" (near-me MIQAT-refused twice with verbs in continuation lines) `[SPEC:4]`. Deps: none.

### Item 5 — mission_lint file-verdict honesty — S/M
- **File:** mission_lint.mjs — a real file-lint mode with output DISTINCT from the SELFTEST's ALL PASS (a conductor read selftest output as a file verdict, repeatedly `[SPEC:5]`); and/or conduct-cycle runs the lint itself in-sweep `[SPEC:5]`.
- **Priority note:** "the honesty fix a local conductor needs most" `[SPEC owner block]`.
- **Deps:** none; it is the enforcement SURFACE for item 12, PA-4-lint-extensions, and PA-12 `[INF]`.

### Item 6 — Safe AUTORUN append verb `--queue <mission>` — S
- **File:** conduct-cycle.mjs new verb: trailing-newline check before Add-Content-class appends (atv-11 invisible-line receipt) `[SPEC:6]`; then re-parse with parseAutorun and assert the new line is visible `[INF, pattern lifted from LC:1's prevention]`.
- **Deps:** none.

### Item 7 — Autosplit-inherited validation scoping — M
- **File:** engine deconstructor (emitSubMissions) — copied multi-page loop validations scoped to the child step's OWN targets (atv-11.S1 step-6 receipt: earlier step forced to satisfy S2's work) `[SPEC:7]`.
- **Reuse vs new:** builds directly on the landed STEP-CARRIAGE work (commit 6088ed1, validation_command + context_dependencies carried verbatim, 13 selftests) — LC:6 is CLOSED for byte-carriage; item 7 is the complementary scoping half `[LC:6, INF on the halves framing]`.
- **Selftest:** extend the STEP-CARRIAGE suite with a scoping fixture `[INF]`.

### Item 8 — Hook-semantics port (rails in the substrate, not the harness) — M
- **Files:** (a) conduct-cycle.mjs: refuse a judgment annotation lacking a receipt reference — enforced at every annotation-writing verb (PA-1 stamp, record, PA-14 re-bare) `[SPEC:8; verb placement INF]`. (b) N5 harness: the rijal beat record gains a required source-citation field that the SCRIPT validates before executing the verb `[SPEC:8]`; rijal record shape to extend is `{ts, backend, model, verb, args, why, gate, gateReason, execResult, rawModelText}` `[SUB]`.
- **Deps:** N5 harness skeleton (Track C); annotation verbs from Track A `[INF]`.

### Item 9 — Single versioned CONDUCTOR-PROTOCOL — M
- **File:** new muezzin-plugin/CONDUCTOR-PROTOCOL.md (engine repo, versioned), loaded by both jurisdictions; replaces the two hand-synced rulebooks (conductor-core.md vs ~/.agents/rules/muezzin-conductor.md — manual law-porting needed twice in one session, drifted before) `[SPEC:9]`.
- **Design:** the harness LAWS system prompt (today ~8 hardcoded lines `[SUB]`) sources from this file; agy's FRAMEWORK_INJECT refresh (item 13c) sources from it too `[INF]`. Add a sweep drift-check comparing derived copies' hash vs protocol version `[INF]`.
- **Boundary:** whether ~/.claude/rules/conductor-core.md becomes a generated artifact/pointer touches the guaranteed-delivery layer — operator-gated, see section 4 `[INF; operator-rulings Meta: rulings layer changes only by his word]`.
- **Deps:** none to draft; wiring folds into the N5 build per owner block `[SPEC owner block]`.

### Item 10 — AUTORUN compaction verb — M
- **File:** conduct-cycle.mjs `--compact-autorun`: archive resolved/retired lines to _logs/ (fork precedent: 78-line purge to a dated backup; Claude-side AUTORUN ~1060 mixed lines, real double-fire receipt: money-competitor 3 lines) `[SPEC:10]`.
- **Critical constraint `[INF from LC:2/3/4]`:** queuedDepsHold resolves deps by reading AUTORUN — compaction must never archive a terminal line that still satisfies a queued line's dep, or must materialize dep-satisfaction first. Therefore ordered AFTER PA-2 (hollow-DONE reconcile), PA-3 (SPLIT propagation), and item 2's grammar.
- **Selftest:** fixture where a live line depends on an archivable DONE — dep still resolves post-compaction `[INF]`.

### Item 11 — Universal conductor ladder — M/L
- **Files:** port SENIOR-QUALIFICATION.md instrument + senior-ladder.jsonl record format (`{ts, beat, gates{G1..G7: pass|n/a}, violations[], streak, lesson}` `[SUB, verbatim shape]`) into muezzin-plugin; a grader that consumes conductor-rijal.jsonl beats and writes ladder records.
- **Gate content:** derive the G-gates from the nine laws + three practices using the mechanical check formulations the LAWS reader produced (e.g. L1: Read-evidence precedes memory-assertion, fm11-advisory non-blocking; L2: same-wake landing receipt per diagnosis; L4: humble-validation artifact before any witness verdict is acted on; L7: FAILED-debt vs diagnosis-receipt count per wake; L8: PARK owner resolves to live tracked work; L9: in-session dry-run receipt at FAILED>=2) `[LAWS:1-9, P1-P3 — the check formulations are that reader's derivations, not quotes]`.
- **Bar:** same instrument, same bar as agy — streak 10 clean + 2 real G2 diagnosis beats + 1 REAL G3 gate-recovery, independently verified `[SPEC:11, SUB]`. This ladder IS the acceptance harness for the local-conductor test `[SPEC:11]` — the instrument is fixed now; the test FORMAT stays operator-gated (section 4).
- **Deps:** N5 harness (beats must exist to grade).

### Item 12 — Explicit-validation mission format, standard both sides — M
- **Files:** mission_lint.mjs rule, both jurisdictions: new/amended missions carry literal per-step validation_command lines — never planner-improvised prose ("today's single biggest failure source") `[SPEC:12]`.
- **Extended by PA-4-lint (LC:5):** refuse empty `[command]` tags and prose-only bodies on deploy/witness/commit steps; discovery-class values (URLs/ArcGIS ids) are pinned at authoring, never seat work `[LC:5, receipts AUTORUN 970/1119/1012]`.
- **Priority:** items 11 and 12 are "the highest-leverage" ports `[SPEC owner block]`. **Deps:** item 5 (file-lint mode as enforcement surface) `[INF]`.

### Item 13 — agy guaranteed-delivery layer: REVIVE, don't build — L
- **Files:** C:\Users\marka\.gemini\config\plugins\muezzin\muezzin_hook.py + hooks.json (live harness exists; PreInvocation fires per-turn, live-tested 2026-07-11 00:24) `[SPEC:13]`.
- **The five gaps, verbatim scope:** (a) un-defang Stop hook (L411 hardcodes has_marker=True); (b) bootstrap gate; (c) inject content-refresh vs current rulings — source from CONDUCTOR-PROTOCOL once item 9 drafts `[INF on sourcing]`; (d) computed board-derived DIAGNOSIS-DEBT; (e) PostToolUse last-response writer receipt (payload-shape drift suspected — needs its own receipt before trusting --post/--stop paths) `[SPEC:13]`.
- **Sequencing note `[INF, surfaced]`:** item 13 is simultaneously N5-spec and agy-100% gate 2.5(a) `[RULING]` — it sits on the agy critical path and should NOT wait for the N5 phase; each sub-item live-tested in the planted-file style.

### Item 14 — Per-project deploy parity — M
- **File:** conduct-cycle.mjs --record-deploy → per-project config (repo/URL/parity command per site; config shape `[INF]`); the fork gets a parity/record verb for androidtv (currently none) `[SPEC:14]`.
- **Deps:** none. Feeds agy-100% gate 2.5(e) `[RULING]`.

---

## 2. PROPOSED ADDITIONS (07-14/15 lesson classes NOT covered by items 1-14)

Each carries its receipt. None of these are in the original 14; all follow the rails-in-the-sweep spine `[SUB]`.

- **PA-1 — Stamp-writer verb** (`--stamp <stem> --disposition <keyword>`): writes the annotation inside the FAILED line's own comment in daemon-readable format, re-parses via the daemon's OWN parseAutorun, asserts the dep/state actually changed; lint refuses unknown leading tokens. Receipt: five 07-15T04:4x RESOLVED-LANDED stamps each hand-translating "daemon-invisible" comments (AUTORUN 1121-1125); hand-written RESOLVED token unknown to the parser (1013) `[LC:1]`. Deps: item 2 addendum. Effort S/M.
- **PA-2 — Hollow-DONE detector + false-death reversal verb:** sweep flags DONE tokens whose result.json still says ok:false; reversal verb atomically writes token + daemon-readable stamp (or reconciles result.json); board renders hollow-DONEs as a named count. Receipt: AUTORUN 1123 (mt-money-affiliate-programs), 1124 (weather-aware S1) `[LC:2]`. Effort S/M. Prerequisite for item 10.
- **PA-3 — SPLIT-parent dep propagation:** engine rule in queuedDepsHold — SPLIT parent auto-satisfies when all children are terminally complete; selftest with a split fixture. Receipt: AUTORUN 1125 (near-me S1: both children complete, parent never satisfiable; engine note in ITEM 27) `[LC:3]`. Effort M. Prerequisite for item 10.
- **PA-4 — Fireable-vs-dep-waiting board truth:** candidate loop continues past dep-blocked lines; STATUS splits "fireable" from "dep-waiting" counts; zero-fireable queue is itself an alert condition. Receipt: QUEUE ITEM 27 — "24 queued" while 100% silently dep-blocked, zero fires 00:06Z-04:2xZ `[LC:4]`. Effort S/M. This is also the sweep half of Law 7's named FAILED-STREAK-HOLD escalation `[LAWS:7, INF on the mapping]`.
- **PA-5 — REFUSED(<rule>) miqat token:** gate refusals never write FAILED, never consume attempts; routed to a lint-debt queue separate from the diagnosis-debt stream. Receipt: AUTORUN 1112/1114 (zero-run FAILEDs from stale-RULE-15 + RETRO-REPEAT refusals), 1013, 1002/1014 `[LC:7]`. Deps: item 2 addendum (token joins STATUS_RE). Effort M. Keeps Law 7 debt accounting honest `[INF]`.
- **PA-6 — Daemon loaded-SHA staleness self-flag:** daemon records loaded-code SHA at start; each fire compares engine-file HEAD vs loaded SHA; mismatch → STALE flag, hold fires / auto-restart at zero-lane boundary. Receipt: AUTORUN 1112 (pid 45012's in-memory lint refused the CORRECT commit shape its own fire loop had landed at 14:36) `[LC:8]`; mechanizes the existing static-import-staleness memory. Effort M.
- **PA-7 — Paired-selftest gate policy (meta, applies to every item here):** every gate lands refusing the real bad shape AND passing a good shape lifted from a live mission file; gate-loosening takes the drift-and-ratchet bar. Receipts: RULE 15 regex rewarding the runtime-broken shape (GAP-REGISTER 35); size ceiling blind to action type (GAP-REGISTER 37); RULE 8 refusing witness-only preview deploys (QUEUE ITEM 25) `[LC:9]`. Effort: policy + S per gate.
- **PA-8 — Register per-id grammar:** register-append verb refuses an existing id (forcing edit-in-place), or the reducer gains per-id last-entry-wins; mechanical pre-append dedupe. Receipts: GAP-REGISTER 38-39, 41 `[LC:10]`. Effort S.
- **PA-9 — LITERAL-MISSION witness exemption:** when plan steps byte-match the mission's own Run-exactly commands, the verbatim-copy REVISE class auto-acks (logged, non-blocking); the comparison is plan-to-mission-text, NEVER blanket — the 16:36Z REVISE on genuinely degraded split text was RIGHT and stays caught. Receipts: self-witness.jsonl 07-14T19:37Z/21:50Z/07-15T04:47Z; witness-plan-read-ack 22:11Z `[LC:11]`. Deps: item 12 (literal missions are the designed trigger). Effort M.
- **PA-10 — verdict_merge severity floor:** consensus REJECT/REVISE requires >=1 wajib/arkan finding; sunnah/low-only merges to APPROVE-with-notes. Receipt: qc-fix-aurora-export-syntax result.json ok:false on all-low sunnah findings against committed+deployed+live-verified work; the 7e0a011 downgrade is truncation-keyed so the class is NOT mechanically closed (reader confidence 0.7 on that last claim) `[LC:12]`. Gate-LOOSENING → takes PA-7's ratchet bar with the camping-pass arkan-REJECT as the must-still-reject fixture `[INF]`. Effort S/M.
- **PA-11 — Wiring witness + authoring baseline probe:** validations assert the new symbol is REFERENCED beyond its definition + a render witness asserts user-visible change; authoring-time grep of the target repo for the charter's markers. Receipt: AUTORUN 1120 (camping-pass hollow-green: mtPassBadge called nowhere, layer duplicated 06-23 work) `[LC:13]`. **Corrective owner already exists: QUEUE ITEM 23 — N5 coordinates, does not duplicate** `[LC:13; non-duplication per LC:10's own lesson, INF]`.
- **PA-12 — Idempotency-guard lint:** existence/ALREADY-PRESENT guards exit 0, never exit 1; pick-finalize steps carry the empty-cherry-pick --skip contingency. Receipts: AUTORUN 1118 ("the FAILED mark IS the success receipt"), 1040 `[LC:14]`. Lands inside item 12's rule set. Effort S.
- **PA-13 — Witness-infra determinism codification:** waits keyed to deterministic selectors (never networkidle), CI retries/median (numberOfRuns>=3) before alerting, protected-region selectors selftested against the real DOM, signals into the ITEM 19 poller. Receipts: QUEUE ITEM 24 (fixed 80d4c0e, regression pair proven), ITEM 26, dead aurora-chip guard `[LC:15]` — partially landed/owned; N5 adds the selftest + policy. Effort S/M.
- **PA-14 — Atomic re-bare verb:** one tool sequencing write-receipt → verify mtime > newest retro → only then append the bare line; composes item 1 (clear) + item 2 (flip) + item 3 (COVERS) `[composition INF]`. Receipt: AUTORUN 1114/1115 (third re-bare succeeded only after receipt-on-disk-FIRST) `[LC:16]`. Deps: items 1, 2, 3. Effort M.
- **PA-15 — Law-named escalations, folded in:** conductor-core pre-names each: Law 4's humble-validation-recorded gate, Law 5's report-linter (causal sentences need EXECUTED-receipt or HYPOTHESIS tag), Law 7's FAILED-STREAK-HOLD daemon hold, Law 8's ownerless-PARKED verdict gate (sweep spec owned by QUEUE item 22) `[LAWS:4,5,7,8]`. These are conditional escalations ("if a future instance still...") — but Law 7's and Law 8's trigger conditions HAVE recurred with receipts (zero-DONE window 07-15; the parked-designer month), so those two are build-now; Laws 4/5 linters build as capacity allows `[INF on the build-now split]`.

---

## 3. BUILD ORDER

**Priority frame:** the 14-item spec inherits system-fixes-first — conductor beat capacity to this before new product work; daemon product lanes keep running in parallel `[RULING]`. Bite-class gaps retain absolute priority (GAP-PRIORITY-HOLD mechanism) per standing ruling.

**Gating reading, surfaced (do not silently resolve `[LAWS:5 precedence rider]`):** the operator-ratified sequence gates "N5 beat-harness build" on agy G3 → graduation `[RULING]`. The owner block assigns the WHOLE set to "next engine batch" while saying only "items 8-9 fold into the N5 build" `[SPEC owner block]`. This plan reads: harness port + items 8, 9, 11-grading + self-waking = the gated N5 build; items 1-7, 10, 12, 14 + the PA sweep/engine fixes = engine-batch work startable now; item 13 = agy critical path, startable now. If the operator intended all 14 to wait, Track A shrinks to the PA gap-fixes (which keep bite-class priority regardless) `[INF, both layers cited]`.

### TRACK A — start NOW (engine batch, Claude jurisdiction)
Ordering rationale: grammar → queue truth → verbs that write → lints that refuse → compaction that archives `[INF]`.
1. Item 2 + ADDENDUM (grammar underpins everything that reads/writes AUTORUN lines)
2. Items 3, 4, 1, 6 (sweep additions + clear-procedure + safe append)
3. Item 5 (file-lint honesty mode — enforcement surface)
4. PA-2, PA-3, PA-4 (the queue-truth trio; closes QUEUE ITEM 27's feeder classes — fresh bite-class receipts)
5. PA-1, PA-5 (annotation/token layer; needs step 1's grammar)
6. PA-14 (re-bare verb, composes 1+2+3)
7. Item 12 + PA-12 (mission-format lint rules, on item 5's surface)
8. Item 7 (deconstructor scoping, extends landed 6088ed1)
9. Item 10 (compaction — ONLY after step 4's dep-truth fixes)
10. Item 14 (deploy parity; feeds agy gate 2.5(e))
11. PA-6, PA-8, PA-9, PA-10 (with ratchet bar), PA-13, PA-15 as capacity allows
12. Item 9 DRAFT (protocol authoring can be prepped; wiring waits for Track C) `[INF]`

### TRACK B — agy critical path (parallel, agy jurisdiction)
1. G3: route the NEXT NATURAL agy-side gate block through an agy conductor beat — not manufacturable, wait for natural occurrence `[RULING]`. Ladder at filing: streak 10/10, G2 2/2, G3 0/1.
2. Item 13 sub-items (a), (b), (d), (e) now; (c) inject-refresh after item 9 drafts `[INF on ordering]`. Each live-tested. Feeds gate 2.5(a).
3. Remaining agy-100% receipts: (b) self-waking agy beats, (c) unsupervised-apply streak, (d) atv visitor-ready chain live-witnessed, (f) zero undiagnosed FAILED on the agy board `[RULING]` — agy-side work outside this item list but gate-listed.

### TRACK C — N5 build proper (STARTS after agy graduation `[RULING]`)
0. Read CONDUCTOR-PORT-PLAYBOOK.md FIRST; re-open the QUEUE entry `[SPEC, RULING — both mandate it]`.
1. Item 9 v1 lands (protocol file + both loaders + drift check).
2. Harness port: copy agy-muezzin/conduct-beat-local.mjs into muezzin-plugin — HERE-relative paths repoint rijal/STATUS/conduct-cycle automatically `[SUB]`. Reuse VERBATIM: gateAction, parseModelAction, liveLanesFromStatus + STATUS_DEAD_MS mirror, condenseSweep, parseBeatCliArgs, runBeat injection, rijal record shape, LAWS prompt pattern (now sourced from item 9), fail-closed CLI semantics (0/1/2), full 7-polarity selftest, ollamaBackend (nxtbeast — compliant with the Claude-side NO-cloud ruling) `[SUB]`. Swap: drop the agy backend row — provider rows are the only intended engine-layer swap `[SUB]`; jurisdiction roster per playbook §4 `[SUB]`.
3. Item 8 rails (source-citation field in the beat log, script-validated; receipt-reference refusal in conduct-cycle).
4. Item 11 ladder + grader (law-derived gates per section 1).
5. Self-waking wiring (scheduled beats) — named upstream + format-independent, explicitly authorized pre-spec `[RULING]`.
6. Guaranteed-delivery pointer for the jurisdiction, day one `[SUB, playbook §5 closing]`.
7. Selftest parity: port the 7 polarities, extend one polarity per new rail `[INF]`.

### GATE before the local-conductor test
agy-100%: all six receipts (a)-(f), each with its receipt — "A board label alone NEVER satisfies this gate" `[RULING, verbatim]`. Then WAIT (Track D-1).

**Adjacent scope, not in this plan:** ENGINE BATCH 2 W-items trigger mechanically "the wake after the design-pipeline fix set closes," order W2→W1→W3→W4/W5/W6; items 15-19 and the WARROOM-BORROW block share the QUEUE heading but sit outside the items-1-14 span the succession ruling points at `[SPEC scope note]`.

---

## 4. OPERATOR-GATED (decisions only he can make)

1. **The local-conductor test format.** His word verbatim: "I haven't told you how I want the qwen test done yet." The 2026-07-07 qwen 5/5 relay audition is a SCREENING receipt, not the test design. Build N5 + self-waking wiring, then WAIT for his spec — do not run on an inferred format `[RULING]`. The ladder (item 11) is the acceptance INSTRUMENT he already ratified; only the test's format/scenario/duration awaits him `[SPEC:11 + RULING, split is INF]`.
2. **Item 9's touch on the guaranteed-delivery layer.** If CONDUCTOR-PROTOCOL becomes the single source, ~/.claude/rules/conductor-core.md becomes a derived/pointer artifact — the rulings layer changes only by his word, so that restructuring needs his sign-off; until then the protocol file syncs TO the rules file, never replaces it `[INF; operator-rulings Meta]`.
3. **Nothing else in this plan is identity-bound** `[INF]`. PA-10's gate-loosening is conductor-authorized under the drift-and-ratchet bar `[LC:9]`; deploy-parity rollout rides his standing conductor-called-deploys ruling; batch-2 timing is mechanical.

---

## 5. CONFIDENCE

- Per-item file/verb placements: 0.85 — anchored to the substrate reader's direct read of conduct-beat-local.mjs and the playbook, but conduct-cycle.mjs internals were not read this pass; verb names and exact insertion points are inferences to verify at build time against the open file (D12).
- PA list completeness vs lesson classes: 0.9 (classes 1-16 each mapped; class 12's "not closed" carries the reader's own 0.7).
- Gating reading (Track A startable now): 0.8 — the owner block's wording supports it; surfaced in section 3 rather than silently resolved.
- Reuse-verbatim list: 0.9, inherited from the substrate reader's direct read.

Key paths: C:\Users\marka\.claude\muezzin-plugin\missions\QUEUE.md (spec at line 2229ff), C:\Users\marka\.claude\muezzin-plugin\CONDUCTOR-PORT-PLAYBOOK.md, C:\Users\marka\agy-muezzin\conduct-beat-local.mjs, C:\Users\marka\.claude\rules\conductor-core.md, C:\Users\marka\.gemini\config\plugins\muezzin\muezzin_hook.py, C:\Users\marka\.claude\muezzin-plugin\missions\AUTORUN.md, C:\Users\marka\.claude\muezzin-plugin\missions\_logs\GAP-REGISTER.jsonl.