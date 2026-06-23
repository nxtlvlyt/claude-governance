# STATE.md — muezzin-plugin (this project's contextualization of CLAUDE.md)

Per `~/.claude/CLAUDE.md`: *"STATE.md contextualizes the directives here for a specific
project. It is written at session end, read at session start, and updated throughout."*

This is the canonical project-context file. Any conductor session bootstrapping into
`~/.claude/muezzin-plugin/` reads THIS first, then follows the routing below.

---

## ⚠️ REQUIRED READS BEFORE ANY NON-TRIVIAL ACTION (in order)

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

## CURRENT STATE (2026-06-23T23:30Z, session-end)

**Daemon:** PID 44836 running v0.4 with the executor-only agy lane (sha `d85c3ea`).
First valid `micro_queue` produced at 23:11Z after sha `d85c3ea` corrected a regression
the previous instance introduced earlier this session.

**Queue:** 10+ missions queued including:
- b13-* sub-missions (S1 → S2 with REQUIRES chain)
- qc-feature-catalog-fill-2026-06-23.mission.txt (overnight catalog completion)
- engine-cycle-detector-2026-06-23.mission.txt — RETIRED as superseded by Build #3

**Acceptance bar:** the 8h+ unsupervised soak per `BUILD_STATE.md`. Started
2026-06-23T23:05Z (last clean restart). Target 2026-06-24T07:05Z.

**Production state of muddytires.ca:**
- `github/master` at sha `00ca348` (pre-everything baseline, 2 commits total)
- `integration/apex-2026-06-22` is 290 commits ahead of master, NOT YET DEPLOYED
- Live site serves whatever was deployed before this session
- Bugs operator reported 2026-06-23 still present on live (vehicle picker UX,
  fuel-chip suppression, carbon-chip missing because unmerged branch)

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
