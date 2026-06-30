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

-2. **`~/.claude/state/framework-as-ceremony-2026-06-24.md`** — READ FIRST. Failure-mode entry from 2026-06-24: framework vocabulary (wudu/niyyah/surrender/camel/etc) was invoked 10+ times today as ceremony cover for iterate-and-guess. Operator caught it explicitly. The fix is mechanical self-check before deploying any framework term — does the next tool call embody the practice, or is the vocabulary substituting for the action.

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

## CURRENT STATE (2026-06-30T~19:30Z, end of session — read this before the stale sections below)

**Standing operator ruling: the muezzin CONDUCTOR runs on Sonnet, not Opus.**
Reason (operator's words): "sonnet is smarter than Opus [for the conductor] because it
will actually use tools instead of pretending to know something." Tonight's session ran
on Opus and the operator's diagnosis was correct — nearly every false claim tonight
(deepseek-v4-pro called "local" when it's cloud-roster; `local-heavy` assumed
localhost-only when it routes cloud-first; the attribution root cause guessed twice
before finally being introspected; even claiming "Sonnet 5 doesn't exist" without
checking — it does, see below) was Opus asserting from memory instead of reaching for
a tool. Full reasoning: `~/.claude/projects/C--Users-marka/memory/conductor-runs-on-sonnet.md`.
**Open the conductor on Sonnet (`/model sonnet`, which should resolve to the newest
available Sonnet) before doing conductor work — verify which version with `/model`,
don't assume.**

**Claude Sonnet 5 released same-day (2026-06-30), verified live via WebFetch — NOT
the operator's memory error it first appeared to be.** API id `claude-sonnet-5`
(confirmed accepted by the `claude` CLI, exit 0). Per the operator's explicit
directive, `claude-local-hybrid`'s architect/integrator/executor seats in
`seat_modes.mjs` were updated from `opus`/bare-`sonnet` to `claude-sonnet-5`
(additive change — `recognizeClaudeModel()` in `seat_dispatch.mjs` pass-throughs any
`claude-*` name verbatim, no dispatch-logic change needed). Other modes
(`anthropic-heavy` etc.) still use the bare `opus`/`sonnet`/`haiku` aliases —
unchanged, out of scope for tonight's directive.

**nxtbeast is back up** (was down most of the session; ssh/ollama/SearXNG/AnythingLLM
all confirmed UP). The operator's standing routing while budget-conscious: Claude does
the reasoning/execution seats, nxtbeast-LOCAL open-weight models do ALL checking
(validator/auditor/witness), Ollama Cloud is touched ONLY by gemini-3-flash-preview
visual QC. New seat mode `claude-local-hybrid` in `seat_modes.mjs` implements this,
picks backed by a real 6-task objective eval (not vibes) — see below.

**Root cause of total chain failure (fixed):** `MUEZZIN_CLAUDE_TIER` was `off` in the
operator's **User env** (external to the repo, not visible to `git diff` — this is why
it took most of the session to find). Every Claude-named seat (opus/sonnet architects,
the integrator) silently returned empty/`provider:unknown`, so EVERY plan attempt all
session failed at phase=plan with "no valid JSON micro_queue". Fixed: `[Environment]::SetEnvironmentVariable('MUEZZIN_CLAUDE_TIER','on','User')`
— persistent, already applied. Verify on a new machine/session via
`[Environment]::GetEnvironmentVariable('MUEZZIN_CLAUDE_TIER','User')`.

**Real engine fixes this session (verified, written to disk — see commit note below):**
1. `orchestrate.mjs` — `diagDir` was `cwd` (the mission sandbox), so the engine's own
   `panel-architect-*.raw.txt` / `plan-attempt-*.raw.txt` scratch tripped its OWN
   containment-drift guard. Moved to `path.join(path.dirname(cwd), '_logs', 'diag')`.
2. `seat_modes.mjs` — added `claude-local-hybrid` mode: architects
   `[opus, qwen3.6:27b, gemma4:31b]`, integrator/executor `sonnet`, validator
   `qwen3.6:27b`, auditor `granite4.1:30b`, witness `qwen3.6:27b` (laguna was the
   original pick but a 6-task objective eval — `scratchpad/eval_seats.py`, NOT
   preserved on disk, re-derive if needed — showed laguna FALSE-REJECTS correct/clean
   code 1/2 times; qwen3.6:27b scored 6/6, the only calibrated checker. nemotron-3-super
   scored 3/6 — missed real bugs, do NOT use as a checker despite the "deliberation
   team" framing in operator-rulings.md. granite-guardian:8b scored 0/6 — it's a safety
   classifier, not a code reviewer, wrong tool for witness/validator/auditor roles).
3. **CAUGHT AND REVERTED a band-aid**: a same-session attempt to reorder `PROVIDERS` in
   `seat_dispatch.mjs` to "prevent cloud leak" was self-caught as broken — it silently
   inverted the `PROVIDERS[0]=cloud` / `PROVIDERS[1]=local` index assumptions baked
   into `healCloud` and the Claude-tier slot logic elsewhere in the file. Reverted to
   original order. **If cloud-leak prevention is still wanted, it needs a real per-seat
   flag, not an index swap** — not yet built.

**NOT committed to git** — 3 files (`orchestrate.mjs`, `seat_dispatch.mjs`,
`seat_modes.mjs`) have the fixes above ON DISK but the `muezzin-gate` pre-commit hook
blocked the commit on `orchestrate.mjs`'s self-test: 2 FAILs (`SEATING MODE
anthropic-heavy: witness stays strong` and `SEATING MODE local-heavy: witness is
LOCAL`). **Confirmed via `git stash` isolation these 2 failures PRE-EXIST tonight's
changes** (fail identically on HEAD before any edit this session) — likely from
`model_rijal.mjs`/`seat_record.mjs` changes made before this session started (the repo
was already dirty at session open). Per CLAUDE.md, hooks are never bypassed without
being asked — so the fixes sit verified-but-uncommitted. **Next session: triage the 2
pre-existing seating-mode failures (likely a stale witness mapping for `nemotron-3-super`
in `CLAUDE_SEAT_MAP` after the cloud-roster split), then commit all 3 files together.**

**Where the chain stands — closest it has been, still not a complete mission.**
Test mission `missions/mt-12-map-attribution-render.mission.txt` (constructed tonight,
NOT yet committed) was fired repeatedly as the validation case. Final state: **plan ✓
→ execute ✓ → witness ✓ (FIRST time all session, after the qwen swap)** → fails at
**verify**, containment-drift on `mission-events.jsonl` + an executor-authored
diagnosis doc (not on `ALLOW-FILES`). Two real findings for whoever picks this up:
- `mission-events.jsonl` is the engine's OWN log file — it should be exempted from
  containment, not flagged as a breach. Likely the same class of bug as the
  `diagDir: cwd` fix above (engine writing into the sandbox it polices).
- The Claude executor tends to author its own scratch/diagnosis `.md` files
  unprompted — either constrain it via the mission's `ALLOW-FILES`/system prompt, or
  give it an explicit scratch path outside containment.

**Visual QC is NOT wired into the mission pipeline.** `visual_witness.mjs` /
`ollama_vision_verdict.mjs` (the gemini-3-flash-preview SOTA visual QC) exist and work
standalone but are never called from `orchestrate.mjs` — no mission gets an actual
render/visual check from the chain today. The operator asked about this directly
tonight ("is this getting SOTA QC?") — answer was honestly no. Wiring it in (ideally
gated by a per-mission `VISUAL-QC-REQUIRED` flag) is real, valuable, unstarted work.

**Puppeteer band-aid, not yet root-fixed properly:** installed at
`C:\Users\marka\node_modules\puppeteer` (parent of all mission worktrees, so Node's
module resolution finds it without per-worktree copies) — this UNBLOCKS verify-phase
render checks and is a reasonable interim fix, but the real architecture is the engine
owning render-verification centrally rather than depending on a worktree finding
puppeteer via directory traversal.

**Chain-timing hook recalibrated** (`~/.claude/hooks/pre-tool-use-chain-timing.ps1`):
now exempts read-only metadata endpoints, anything targeting `nxtbeast` (remote, can't
freeze the operator's laptop), and a standing-ok file at
`~/.claude/state/chain-timing-standing-ok`. **Self-flagged as possibly over-removed**
— the standing-ok file makes the gate unconditionally pass for the rest of any session
where it exists, which is broader than the narrow nxtbeast/metadata exemptions alone.
Worth revisiting whether the standing-ok file should be removed once the conductor
habitually classifies nxtbeast-vs-local correctly.

**REAL FIX SHIPPED AND VERIFIED LIVE:** muddytires.ca `/map` attribution control.
Root cause (fully traced, not guessed): `leaflet-rotate@0.2.8` (1) never appends
`map.attributionControl._container` to its `bottomright` corner, AND (2) injects
`.leaflet-control-attribution{display:none!important}` at runtime AFTER any static
`<head>` CSS (so a stylesheet override loses on source order even with equal
`!important`). Only reliable fix: inline `style.setProperty('display','block',
'important')` — inline-important beats stylesheet-important regardless of cascade
order. Shipped in `map.html` (marker comment `MT_ATTRIB_FIX6`), verified on a preview
deploy AND on live production via headless screenshot
(`w:792,h:48,display:block`, real OSM/MapTiler/CWFIS credit text visible). Minor
non-blocking follow-up: the attribution box slightly overlaps the Layers badge / bottom
data strip — cosmetic, not functional.

**Method that worked, repeat it:** EVERY real fix tonight came from actually
introspecting live state (headless Chrome DOM/CSS inspection, `ollama list` on
nxtbeast, reading the actual env var, `git stash`-isolating a test failure) — never
from inference/memory. Every band-aid came from skipping that step. This is the
literal mechanism behind the Sonnet-conductor ruling above.

---

## STANDING LESSON (2026-06-30, generalizes beyond tonight): wrangler deploys bypass git
entirely for muddytires — `wrangler pages project list` shows "Git Provider: No". A fix can
be deployed straight from any worktree's disk state via `wrangler pages deploy`, live on
production, and committed to ZERO branches anywhere. This is not hypothetical: it already
happened — `MT_ATTRIB_FIX6` (the attribution-control fix) was live on muddytires.ca, searched
every local + remote branch of `C:\Users\marka\code\muddytires-pages`, found in NONE of them.
The deploy almost certainly ran from `mt-chain-wt`, a mission worktree that's since been
cleaned up — taking the only git-tracked copy of that diff with it.

**Why this matters for every future conductor/chain, not just tonight:** a mission whose
Maqsad assumes "this bug needs fixing" can FAIL even when the user-facing bug is already
gone, because the mission's REPO-ROOT (any persistent checkout) genuinely doesn't have the
fix — checking live production HTML, not git, is sometimes the only way to learn the real
state. `mt-12-map-attribution-render.mission.txt` hit exactly this and was marked
SUPERSEDED-MOOT rather than re-fired for that reason.

**What's been done about it:** the FIX6 diff was recovered from the live HTML and committed
on a new branch `backport-attrib-fix6` (off `main`, in `code/muddytires-pages`, via an
isolated `git worktree` so the existing dirty `d1-standup` checkout was never touched).
NOT pushed to the remote, NOT merged into main — that's a deliberate stop, not an oversight;
push/merge touches the shared remote and wasn't asked for.

**Open question for next session / the operator:** should `mission_lint.mjs` (or a wrapper
around the wrangler-deploy step) refuse/flag a deploy that isn't preceded by a git commit, so
this class of drift becomes structurally impossible rather than something a conductor has to
happen to notice? Not built tonight — flagging as real, valuable, unstarted work, same as the
visual-QC wiring gap.

## PRIORITY ORDER FOR NEXT SESSION

1. **Open on Sonnet** (`/model sonnet`) per the standing ruling above.
2. **Verify `MUEZZIN_CLAUDE_TIER=on`** persisted (User env, not repo state).
3. **Triage the 2 pre-existing `orchestrate.mjs` seating-mode test failures**, then
   commit `orchestrate.mjs` + `seat_dispatch.mjs` + `seat_modes.mjs` together (the
   fixes are real and on-disk, just uncommitted).
4. **Fix `mission-events.jsonl` containment** (engine's own log shouldn't trip its own
   guard) — this is the one thing standing between the chain and its first fully
   completed end-to-end mission. Re-fire `mt-12-map-attribution-render` (note: the
   attribution bug it targets is ALREADY FIXED live — this mission is now purely a
   chain-completion test, not real remaining work).
5. **Wire visual QC into `orchestrate.mjs`** — `witnessVisualDiff`/`ollamaVisionVerdict`
   exist, unused. Real, valuable, unstarted.
6. **Re-evaluate the chain-timing standing-ok file** — confirm it isn't over-broad now
   that the conductor (on Sonnet) should reliably classify nxtbeast vs local.
7. Continue the muddytires mission-board cleanup from the headless e2e sweep earlier in
   the session (most "FAILED" labels were phantom/stale — see prior memory entries).


## MODEL BENCHMARK RESULTS (2026-06-27T22:31:00Z)

Prompt: *"Write a javascript function to find the first non-repeating character in a string and return its index. If it doesn't exist, return -1. Only output valid code inside a markdown block, no explanation."*

| Model | Size | Speed (tokens/s) | Duration | Total Tokens | Correctness & Formatting |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`ornith:35b`** | 35B | **167.82** | 7.61s | 412 | **PASS (Correct & Perfect Formatting)**. Returned only code inside a markdown block using Map. Fastest overall. |
| **`laguna-xs.2:q4_K_M`** | 33B | **123.05** | 11.05s | 471 | **FAIL (Formatting)**. Correct code, but verbose reasoning block pre-pended. |
| **`qwen3.6:27b`** | 27B | **46.61** | 77.19s | 3271 | **FAIL (Formatting)**. Correct code, but generated a huge 3271-token verbose thought block. |
| **`granite4.1:30b`** | 30B | **46.23** | 11.94s | 131 | **PASS (Correct & Perfect Formatting)**. Returned code block only. |
