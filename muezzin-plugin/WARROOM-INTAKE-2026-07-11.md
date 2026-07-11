# WARROOM INTAKE — audit results, gap matrix, parity plan (2026-07-11)

Produced by the 16-agent reader/skeptic workflow (run wf_a7fb1bdb-ce5; 7 subsystem
reader/auditor pairs + 2 synthesizers; 1.31M subagent tokens; 0 agent errors; auditors
Read/Grep/Glob-only). Per-agent raw returns:
~/.claude/projects/C--Users-marka/bb6b583a-.../subagents/workflows/wf_a7fb1bdb-ce5/journal.jsonl
Audited repo: C:\Users\marka\projects\warroom (byte-identical to nxtbeast C:\warroom;
last real work 2026-05-15). Companion dynamic receipt: full test suite ON NXTBEAST =
5 failed / 976 passed / 7 skipped in 10:45 — all 5 failures one root cause (tests
hardcode gemma3:1b, no longer installed; the {model,channel}-pinning lesson).

## Verdict counts (per-component, receipts in journal)
- **adopt 67** — design AND implementation sound by receipts-era standards
- **redesign 27** — idea earned its place, implementation did not
- **discard 12** — superseded or inert
Caveat the parity plan itself states: every adopt is only as trustworthy as S0 (no
dependency manifest exists; the environment must be restored before trusting anything).

## Star verdicts
ADOPT (verified genuinely built AND running): faith_builder (fail-closed assembly,
real SHA-256 provenance on disk), hierarchy_enforcer (redact-before-store, wired into
every executor/validator output), router (structural single-writer, two-phase shutdown
drain), guardrails AS A MODULE (fail-closed instantiation, ambiguous=excluded, truthy
approval object), watchdog (live-kill hash detector + forensic n-gram classifier,
tested), cli.py REPL (real, non-trivial), secrets.py (fail-loud, receipted denylist fix).
REDESIGN (the two structural wounds):
1. **THE WRITE-PATH BYPASS (top risk):** missions/coding/executor.py — the ONLY module
   performing real autonomous writes — never calls guardrails; it reimplements a weaker
   check with NO approval gate (executor.py:236-256, 292-294; facilitator.py:8-10 admits
   it). Two resolution doors; the one guarding real writes is the broken one.
2. **THE UNPROPAGATED FIX:** a DST timezone bug was diagnosed + fixed with receipts in
   faith_builder.py (2026-04-28), then CONSCIOUSLY reproduced (logger.py's own comment)
   in logger, substrate_reasoning, facilitator, discovery/scanner — mis-dating the audit
   trail of a system whose premise is dated evidence.
DISCARD (pure built-not-running): config/tool_tiers.yaml (zero code references
anywhere), budget _check_cap (orphaned — enforcement advisory-only, "Never raises" per a
2026-04-21 operator directive; unpriced models silently cost $0), ResourceWatchdog's
service-health.json (no reader exists; the `warroom status` command was "NEXT TASK" for
9 days across 5+ session entries and never landed).

## Gap matrix — muezzin should borrow (19 items; receipts per item in journal)
Headliners: faith-assembly provenance + fail-closed build; redact-before-store for
guard excerpts; router's structural serialization + two-phase drain; guardrails' three
fail-closed properties for the containment kernel; retry.py's three-strike policy with
persistent abort latch (mechanizes FAILED-x2-diagnose); re-derive-don't-trust-caller-flag
(substrate_reasoning); dual-source doc-vs-code drift checker (eligibility.py); lineage-
diversity warning for verdict panels (gauntlet — checks our ornith+guardian pair class);
read-only-by-construction scanners; staged-repair stages 1-4 gating (NOT stage 5);
num_gpu=0 mechanical override (THE mechanism the NO-OLLAMA-CLOUD ruling needs at client
layer); planted-assumption calibration tasks for auditions; full-purge-over-flag for
corrupted governance data; triage-ledger schema WITH mandatory independent second
dispatch; "Calibrated?" honesty column AS A GATE not a column.

## Gap matrix — warroom needs from muezzin (12 items)
One resolution door for writes (containment kernel); mandatory second-dispatch before
dismissing findings (sixth law — warroom's ledger violates its own stated principle
repeatedly); mechanical fail-closed budget enforcement; commit-verify-revert loop
(repair stage 5 has 2 of 6 spec sub-steps); graduation ladder gating LIVE status;
mission substrate with retro/preflight/requeue; GAP-PRIORITY-HOLD (the 9-day status
task is its exact specimen); queue/log compaction; dated module-inventory census (the
audit's own reference doc was stale in 5 places); fix-propagation checking; git-versioned
governance landing; daemon-rendered status artifact with a verified reader.

## Surprises (all 8 preserved; the deepest)
- Warroom independently arrived at fail-closed practices (full-purge-over-flag,
  2026-04-21) BEFORE the standards existed — and independently committed muezzin's
  named failure modes (self-triage without recheck = sixth law; the 9-day deferred
  status task = GAP-PRIORITY-HOLD's exact pattern) with no cross-pollination. Both
  systems' laws validated from outside.
- Within ONE codebase: the caller-cannot-override safety pattern done perfectly once
  (ollama.py num_gpu=0) and failed structurally on the sibling problem (budget caps,
  advisory). A correct fix does not propagate without a mechanism. AUDIT MUEZZIN FOR
  THE SAME ASYMMETRY (NO-CLOUD enforcement vs budget-dial enforcement).
- STATE.md contradicts itself: diagrams claim every stage "LIVE" across 7+ entries
  while the roster table in the SAME FILE honestly marks 9/11 seats uncalibrated.
- The audit's own reference inventory was months-stale in 5 places and had to be
  corrected mid-audit.

## Parity plan (10 stages, ~15-20 evenings; full text in journal + this doc's source run)
S0 restore runnable baseline (deps manifest, venv, re-verify claims) — 1
S1 FIX THE WRITE-PATH BYPASS (guardrails as the only door + tests) — 1-2 — GATES ALL WRITES
S2 propagate the TZ fix repo-wide — 1 (parallel with S1)
S3 budget-cap enforcement (GATED ON OPERATOR DECISION) — 1
S4 complete repair stage 5 (the missing 4 of 6 sub-steps) — 2
S5 wire-or-discard the built-not-running pieces (incl. the 9-day `warroom status`) — 1-2
S6 add Ollama Cloud client (GATED ON JURISDICTION DECISION; from scratch — no cloud code
   exists despite being 1 of the 3 named channels) — 2
S7 3-tier resilience cascade (cloud → nxtbeast 4090 → laptop 4070; failover.py today has
   only Claude-absence triggers) — 2
S8 RUN the tryouts against 9/11 uncalibrated seats (harness exists, ~12k lines; results
   operator-reviewed, never auto-promoted) — 3-4
S9 mission substrate + muezzin continuity (from scratch: no queue files exist; shape
   GATED ON ARCHITECTURE DECISION relay-vs-daemon) — 3-5
   S9 HARD REQUIREMENT (enrolled 2026-07-11, QUEUE item 20 — paid twice in one day on
   BOTH engine forks): if warroom's mission layer carries ANY checkpoint/resume
   mechanism, resumability MUST be keyed to a content hash of the mission text
   (mission_sha256), invalidating on mismatch OR absence — an amended mission text
   always outranks banked steps, and a sha-validity check alone cannot detect a changed
   step SPEC. Reference implementation + selftests: muezzin-plugin orchestrate.mjs
   235d94f / agy-muezzin 4bd6e40 (AMENDED-MISSION + LEGACY-HASHLESS cases). Do not
   build resume without porting these two test cases.
S10 governance hygiene: independent second dispatch before dismissing findings — 1

## Blockers (6 — full text in run output)
No dependency manifest; no Ollama Cloud client at all; no mission substrate at all;
the S1 write-path bypass gates everything that writes; budget enforcement mechanically
disabled by a prior operator directive; the 3-tier cascade is new logic (and nxtbeast
reachability from the van was not re-verified against warroom's code).

## THE FOUR OPERATOR DECISIONS — ALL DECIDED 2026-07-11 (operator, via tap + two
## clarifying exchanges; his words preserved)
1. CLOUD: YES — warroom is its own jurisdiction permitting Ollama Cloud (agy pattern).
2. BUDGET: HARD CAPS — fail-closed; his framing: the cap IS what trips "used up ->
   drops to local" in the waterfall. Reverses the 2026-04-21 advisory-only directive
   for warroom.
3. WIRING: STANDALONE DAEMON — decided on a NEW REQUIREMENT he surfaced: warroom must
   be SHAREABLE ("if I share the war room with a friend to use on their own projects")
   — self-contained, no dependency on his engine or machines. This makes shareability
   a first-class design constraint for S9 and packaging generally.
4. SEATS: OPERATOR REVIEWS tryout scores before any promotion (his product-taste rule).
Still gated: the BUILD ITSELF awaits his go-word + the agy-100% + N5 sequence.

## The four decisions as originally posed (context preserved)
1. **Ollama Cloud jurisdiction:** does the 2026-07-02 blanket NO-CLOUD ruling bind
   warroom, or is warroom its own jurisdiction with cloud permitted (agy pattern)?
   Gates S6.
2. **Budget caps:** re-enable mechanical fail-closed enforcement, or re-ratify the
   2026-04-21 advisory-only directive? A prior operator directive — not a session's to
   silently flip. Gates S3.
3. **Mission-continuity shape:** warroom as a subprocess relay seat of the Node engine
   (smaller, reuses the proven N5 rails), or its own independent Python daemon (full
   jurisdiction independence, 2-3x larger)? Sizes S9.
4. **Seat assignments:** S8 tryout scores get operator review before roster.yaml flips
   best-guess → calibrated (product-taste is operator-bound per standing ruling).

## Standing constraints this intake respects
Warroom work sequences AFTER agy-100% + N5 per the 2026-07-11 rulings (and N5's rails
are S9's core). The operator has more context to give — this intake is input to his
design conversation, not a build authorization.

S6-ADJACENT (enrolled 2026-07-11, operator word): STITCH MCP AS THE UNIVERSAL DESIGN
SEAT — the same Stitch MCP server (14 tools, currently nxtbeast Claude CLI only) gets
registered in Claude CLI (laptop), agy (gemini-CLI MCP config), and warroom (MCP client
as CONFIG, never hardcoded — the SHAREABLE decision-3 constraint: warroom works without
our key, design seat optional). Stitch supplies BOTH design origination and image
generation — the two capability gaps receipted 2026-07-11 (no designer in the design
loop; Gemini vision reads but cannot generate). Full work order + sequencing:
agy-muezzin/missions/INBOX.md GAP-CLASS 2026-07-11 entry + addenda.
