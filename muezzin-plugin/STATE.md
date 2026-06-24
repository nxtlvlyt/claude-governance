# STATE.md — muezzin-plugin (this project's contextualization of CLAUDE.md)

## ⛔ THE FIRST TOOL CALL OF EVERY CONDUCTOR TURN

```
cd ~/.claude/muezzin-plugin && node conduct-cycle.mjs
```

**This is non-negotiable**. The previous instance (2026-06-23) missed this script
for 7 hours and re-derived its output by hand from `status.json` / `result.json` /
heartbeat tails — wasting your weekly Claude budget on what the script delivers
deterministically. Operator pushed back 4+ times before the instance ran it.

The script is `conduct-cycle.mjs` (frozen-into-code judgment per operator ruling
2026-06-10: *"this process needs to be so good a LOCAL model could be in your seat.
Judgment drains out of the seat into this script"*). It produces a board-format
report + REQUIRED ACTIONS with thresholds:
- status heartbeat >5 min stale → daemon DEAD/HUNG → emit restart command
- no dispatch heartbeat >20 min while lanes run → STALL flag
- FAILED missions → diagnose action with retro + result paths named
- claude-tier heartbeat lines with no 429 in window → investigate flag
- 3+ EMPTY_CONTENT_THINKING fails → known quota-burn class

Reading status.json before running this script IS a drift signal — record it via
`conductor_driftlog.mjs`. The script reads everything you need.

## Other deterministic conductor scripts (run when relevant, never re-derive by hand)

| Script | Purpose |
|---|---|
| `node conduct-cycle.mjs` | The proactive sweep (see above) — every turn |
| `node conduct-cycle.mjs --json` | Same data, JSON for tooling |
| `node conduct-cycle.mjs --selftest` | Offline fixture tests |
| `node conduct-cycle.mjs --record cls=<class> fix=<text> requeue=a,b,c` | Record a landed fix → triggers requeue-on-fix-landed for the named missions |
| `node doctor.mjs` | Health check on env + creds + governance + Ollama Cloud ping |
| `node muezzin-daemon.mjs --selftest` | Daemon module self-test |
| `node orchestrate-cli.mjs "<mission Maqsad+niyyah>"` | One-shot mission via /muezzin |
| `node run-mission.mjs <mission-file> <cwd>` | Detached single-mission launcher |

## Required reads (in order, after conduct-cycle.mjs first run)

Per `~/.claude/CLAUDE.md`: *"STATE.md contextualizes the directives here for a specific
project. It is written at session end, read at session start, and updated throughout."*

This is the canonical project-context file. Any conductor session bootstrapping into
`~/.claude/muezzin-plugin/` reads THIS first, then follows the routing below.

---

## ⚠️ REQUIRED READS BEFORE ANY NON-TRIVIAL ACTION (in order)

-1. **`~/.claude/state/hermes-status-2026-06-24-EOD.md`** — END-OF-DAY 2026-06-24 status.
   Hermes work-in-flight: hallucinated-path hook BUILT + registered in `%LOCALAPPDATA%\hermes\`
   (needs --accept-hooks on first launch to allowlist). Default model switched granite4.1:30b.
   Brief at `~/.claude/state/hermes-brief-2026-06-24-v2.md`. Tomorrow's job: test `hermes chat`
   invocation (NOT `-z` mode which proved broken). CRITICAL: DO NOT restart muezzin daemon —
   it burned 27,456 claude-* dispatches today for zero output, ~70-80% of today's budget burn.

0. **`NEXT-INSTANCE-WARNINGS-2026-06-24.md`** — NEWEST. 5 documented failure patterns from
   the 2026-06-23 evening → 2026-06-24 morning session: "chain producing big plans" is not
   productivity (steps>0 is); workflow-synthesized patch + active firing = APPLY NOW (don't
   defer); ledger DONE can be deceptive (check steps column); sleeping with unfixed engine
   bugs is the conductor's failure; conductor-direct authorized when chain false-fails x2.

1. **`NEXT-INSTANCE-WARNINGS-2026-06-23.md`** (sha `a06c690`) — 6 documented failure
   patterns the previous instance fell into 2026-06-23, with receipts + correctives.
   The structural counter-substrate. Read this BEFORE any plugin edit.

2. **`ENGINE-UPGRADE-PLAN.md`** (authored 2026-06-18) — THE canonical roadmap.
   6 BUILDS for the self-healing gap, with current status:
   - #1 deterministic-first QC — PENDING
   - #2 windowed-edit — PARTIAL (sha `2561abb` exists, doesn't fully engage)
   - #3 cloud-seat-hang watchdog — PENDING
   - #4 preflight module — PENDING (PREFLIGHT-CHECKLIST.md is the spec doc, not code)
   - #5 panel quality — PENDING
   - #6 commit uncommitted engine pile — PARTIAL (some committed sha `59fcc06`)

3. **`HANDOFF-2026-06-23-EVENING.md`** (sha `6e3e91f`, banner-updated `983a91c`) —
   v0.4 work-in-flight at session-end.

4. **`PLUGIN_SUMMARY.md`** — canonical inventory of every primitive the plugin
   already has. Read this BEFORE you write a new primitive — it may already exist.

5. **`missions/CONDUCTOR-HANDOFF.md`** (2026-06-18) — previous conductor's resume
   point. The pattern of "engine got it 99% right, conductor finished by hand"
   documented here.

---

## STANDING DISCIPLINE

**The conductor's 5 verbs** (per `conductor-core.md`): construct missions, fire them,
judge receipts, report, write state. **No engineering of plugin internals during
session**. If you find yourself editing engine code (executor.mjs, seat_dispatch.mjs,
muezzin-daemon.mjs, deconstructor.mjs), stop and queue a mission instead.

**FIRST tool call of any conductor turn**: read latest receipt.
```
cat missions/_logs/daemon-status.json
tail -10 missions/_logs/MISSION-LEDGER.md
ls -lat missions/*.result.json | head -3 | awk '{print $NF}' | xargs -I{} sh -c 'echo {}; cat {}'
```
NOT just status.json — that reports claims. The result.json + receipt files report deeds.

**Canon edits are governance EVENTS**, not session edits. Per
`ENGINE-UPGRADE-PLAN.md`'s propagation section, the proposed canon ruling for
deliverable-type-aware QC + faith file edits must be ratified in a FRESH oriented
governance session that has read `~/.claude/practice/extended/` first. NOT in a
long drifted feature-build session.

---

## CURRENT STATE (2026-06-24T05:10Z, session-end)

**Daemon:** PID 47968 (restarted 04:13Z after SearXNG endpoint fix). Lanes still
on b13-sitemap parent + S1 — but the chain has REGENERATED S1/S2 with fresh
content because:
- 04:25Z conductor switched repo to `feat/b13-sitemap-prune-2026-06-23` (the
  TARGET-BRANCH the mission spec specified but the engine ignored)
- 04:30Z+ chain saw `workers/sitemap-prune/index.js` for the first time → real
  micro_queue produced → auto-splitter regenerated S1 (5 steps) + S2 (4 steps)
  overwriting the `# BLOCKED` markers the conductor had placed

**Fixes landed this session:**
1. `seat_dispatch.mjs:30` + `searxng_preflight.mjs:20` + `conduct-cycle.mjs:93`
   — SEARXNG_URL env-var default `http://nxtbeast:8080` (chain seats grounded;
   confirmed plans went from 57-char garbage to 14-17KB substantive)
2. `ollama_vision_verdict.mjs` (new) — Ollama Cloud gemini-3-flash-preview
   multimodal verdict path; **agy --print is dead** (returns empty for
   everything, substrate-verified 04:55Z)
3. `mt-qc-worktree/scripts/e2e-runner.mjs` — swapped agy → ollamaVisionVerdict;
   end-to-end proof: vehicle picker bug verdict came back as `concern` with
   structured per-gate findings, naming the missing `#mt-pd-gear` selector
4. AUTORUN.md — 37 stale annotations replaced with workflow-driven
   FIX:/SUPERSEDED:/BLOCKED: keywords; conduct-cycle DIAGNOSE count 66 → 29
5. 5 mission files (vanlife-editor-A-proofzoom + 4 engine-*) got Done means
   clauses appended → MIQAT lint no longer refuses

**Two diagnostic workflows fired this session** (2.5M Claude tokens; should
have routed to Ollama for the read-and-classify shape):
- `wf_98e34934-dcf` — 40 FAILED missions diagnosed (45% misspec, not engine bugs)
- `wf_8d6fff25-16c` — TARGET-BRANCH bug spec'd; patch ready for `orchestrate.mjs:457`
  with dirty-tree HALT + missing-branch HALT + post-checkout baseline re-capture.
  Also requires `mission_class.mjs` to extract `TARGET-BRANCH` (currently doesn't).
  **NOT YET APPLIED** — would kill current b13 in-flight cycle; do between-soak.

**Open blockers** (prioritized):
1. ~29 missions still need diagnose-and-annotate (workflow missed them in initial scan)
2. 5 damm entries open (damm-west-corrections×2, engine-windowed-edit-large-file×2,
   mt-auth-session-schema-fix-1) — need dispositions
3. mt-cutover-fuel-chip-fix queued in AUTORUN; runs when a lane frees
4. TARGET-BRANCH engine patch needs application (workflow already designed it)
5. Hook-encode the proactive-conductor enforcement (governance event; next clean session)

**Production state of muddytires.ca:**
- `github/master` still at sha `00ca348` (untouched)
- `integration/apex-2026-06-22` still 290 commits ahead, undeployed
- Live site bugs all still present; visual proof captured this session
  (e2e-shots/vehicle-profile-picker-final.png) confirms vehicle picker bug

---

## PRIORITY ORDER FOR NEXT SESSION

Per the plan's own discipline (BUILDS in fresh focused sessions):

1. **Build #1** (deterministic-first QC) — biggest leverage, attacks false-reject rate
2. **Build #3** (cloud-seat-hang watchdog) — addresses the cycle this session paid for
3. **Build #4** (preflight module) — makes proactive checks mechanical
4. **Build #5** (panel quality)
5. **Build #2** (finish windowed-edit engagement)
6. **Build #6** (commit uncommitted engine pile)
7. PRODUCT: merge `feat/trip-carbon-calc-2026-06-23` (sha `7d77271`) into integration
   + deploy integration to muddytires.ca production via `wrangler pages deploy`

Each Build is a SEPARATE focused unit. Do not batch into one long context (this
session's exemplar of why not).
