# Muezzin Engine Upgrade — fire-ready build charter (the STRUCTURAL support for future instances)

Written 2026-06-18 by the Opus conductor, from the failure classes lived this session (not memory).
This converts the scattered INBOX specs into ONE prioritized, executable plan so a fresh instance BUILDS the
support systems instead of re-discovering them. Each fix is a witnessed engine edit (guardian granite4.1-guardian:8b
+ laguna laguna-xs.2 via mcp__ollama) OR a mission. Build in a FRESH focused session — NOT a long drifted context.
Read first: FAILURE-CLASSES.md, missions/CONDUCTOR-HANDOFF.md, missions/INBOX.md, missions/_logs/*.receipt.md.

## THE SELF-HEALING GAP — this is the point (operator, 2026-06-18: "we are supposed to be self-healing")
The muezzin is SUPPOSED to self-heal — the engine catches and repairs its own failures autonomously. TODAY IT DID NOT.
The CONDUCTOR was the self-healing mechanism: a human-shaped prosthetic doing by hand what the engine should do itself.
Nearly EVERY conductor intervention this session maps to a missing self-heal — and each maps to a build below:
  - account-ui / add-spot-ui-5 / reviews-ui-2 / confidence-badge / security: engine BUILT+COMMITTED correct code, then
    false-rejected it; conductor judged the committed code and DONE-WITH-RECEIPT. -> SELF-HEAL = BUILD #1 (deterministic
    validation: the engine validates its own output deterministically and accepts correct work).
  - reviews-ui-2 final commit: engine emitted the verified change but stuck before committing; conductor finalized it.
    -> SELF-HEAL = BUILD #1 (it would have committed itself if validation hadn't false-failed).
  - add-spot (5 attempts, emit limit, map.html 358KB): conductor diagnosed + forced the additive workaround.
    -> SELF-HEAL = BUILD #2 (windowed-edit: the engine edits large files itself, no conductor workaround).
  - minimax-m3 13-min hang: conductor caught it via liveness + kill+relaunched. -> SELF-HEAL = BUILD #3 (watchdog:
    the daemon recovers from a hung seat itself).
  - reachability-gate false-fails / panel divergence: conductor re-fired with corrected Context. -> SELF-HEAL = BUILD #5
    (panel quality: the engine doesn't emit self-defeating gates or divergent plans).
So the measure of success is NOT "the features shipped" (they did, via the prosthetic). It is: **the conductor's
intervention count drops to ~zero** because the ENGINE heals itself. Today the conductor intervened dozens of times.
A self-healed engine needs the conductor only to construct + fire missions and read final receipts. Build #1 and #3 are
the load-bearing self-heal; #2 removes the biggest class of work the engine currently can't do unaided.

## #1 — DELIVERABLE-TYPE-AWARE, DETERMINISTIC-FIRST QC (highest leverage)
CORE PRINCIPLE (operator, 2026-06-18): **QC must match what is being built.** Today the engine runs ONE form of QC for
everything — an LLM reads the artifact SOURCE TEXT and gives an opinion (defaultVerdictPhase, orchestrate.mjs:186-242). That is the
right check for a text doc; it is the WRONG check for a visual interface. The QC should branch on the deliverable type, which the
mission's Done-means already declares:
  - VISUAL INTERFACE (app/website/page — Done-means says "renders / visible / the page shows / a user can see"): SEE it. Render
    headless (Chrome installed) -> screenshot -> deterministic DOM/console gate + a VLM seat (nemotron3:33b / qwen3-vl:235b — already
    in the chain) judging the screenshot. You don't sign off a website by reading its source; you look at it.
  - DATA / BACKEND (Done-means says "rows / endpoint returns / table has"): QUERY it (the engine already has the exec-receipt bodies,
    orchestrate.mjs:223 — judge the OUTPUT rows, not just exit-0).
  - TEXT / CODE-CONTRACT (doc, card, module): the current content-judge is appropriate — but deterministic checks (node --check, grep
    for required symbols) gate BEFORE the LLM opinion.
The bug today was applying the TEXT judge to VISUAL and BACKEND deliverables alike — so it false-rejected correct source AND never
saw the rendered result. Make QC pick the verification that actually proves the thing.
PROBLEM: LLM-judgment (per-step witness, PHASE-3 verdict, groundedness-flag, runtime-verify) FALSE-REJECTS correct,
committed code. 4 features today were built+committed correctly then over-rejected; the conductor had to judge the
committed code deterministically and DONE-WITH-RECEIPT. runtime-verify even false-fails browser scripts (no window
in Node).
BUILD: where the acceptance criterion is MECHANICAL, replace the LLM check with a deterministic one; reserve
LLM-judges for genuinely qualitative goals.
  - "is the file wired?" -> grep for the <script> tag + init call (not an LLM reading a truncated emission)
  - "does it POST /spot?" -> grep the URL + `node --check` (not a witness opinion)
  - "is the endpoint live?" -> a READ probe (GET /?count) that treats structured {ok:false} as LIVE (NEVER a synthetic write)
  - "did it commit?" -> git diff --stat (already deterministic)
  - runtime-verify: skip/guard for browser scripts, or run in jsdom, never bare Node.
  - UI deliverables — the GOLD-STANDARD deterministic check is a HEADLESS RENDER, not a code grep. Serve the worktree (python
    -m http.server) + drive Chrome headless (chrome --headless=new --screenshot=... / --dump-dom; Chrome AND Edge are installed at
    "C:\Program Files\Google\Chrome\Application\chrome.exe" — NO Playwright needed) -> capture screenshot + executed DOM. Then TWO
    layers: (1) DETERMINISTIC gate — non-trivial screenshot, scripts loaded, key elements in DOM (#add button, profile session-gate),
    no console errors; (2) VISION judge — feed the SCREENSHOT to a VLM seat to assert it LOOKS right (layout not broken, no error
    overlay, the feature's UI is visible). THE CHAIN ALREADY HAS THE VISION MODELS — nemotron3:33b (proven #1 VLM), qwen3-vl:235b
    (Ollama Cloud vision), gemma4:e2b (fast) — from the editor/vanlife work. So this is a WIRING gap, NOT a capability gap: the chain
    can render+screenshot+vision-judge its own UI; no QC step assembles those pieces. Keep deterministic-FIRST: layer (1) gates;
    layer (2) is the supplementary "looks right" (VLM judgment is the same over-reject-prone LLM class — don't let it false-fail a
    deterministically-valid render). GAP FOUND 2026-06-18 (operator-prompted): the conductor verified CODE all day (git+node--check
    +grep) but NEVER rendered until asked, and the chain's QC has no render+vision step despite having the VLMs. LIMIT: logged-IN flows
    (auth'd add-spot/profile/review) need the preview DEPLOYED + a real session — localhost is CORS-blocked by the auth worker's Origin
    allowlist; render-check covers load+structure+logged-out states only.
WHERE: orchestrate.mjs (the witness + verdict path), the gate/validation_command construction.
ACCEPTANCE: re-run a mission of the add-spot/reviews class — it reaches DONE WITHOUT the conductor hand-judging
committed code. Measure: conductor DONE-WITH-RECEIPT interventions drop to ~0.

## #2 — WINDOWED-EDIT FOR LARGE FILES (the context-overflow / emit limit)
PROBLEM: map.html is 358KB (~265K tokens) > every seat's 262K context -> HTTP 400 "prompt too long"; in-place dense
edits also can't emit. add-spot needed 5 attempts; the workaround was forced ADDITIVE (new file + tiny tag).
BUILD: make `windowedLargeFileForEdit` (exists, commit 2561abb) ACTUALLY engage for any target over ~N tokens —
send only the anchor region(s) (edit site + surrounding context), never the whole file; the apply step stitches back.
ACCEPTANCE: an in-place edit to map.html's reviewSpot() emits + applies successfully (today it could not).

## #3 — CLOUD-SEAT-HANG WATCHDOG
PROBLEM: minimax-m3 hung the daemon 13 min PAST its 360s timeout (timeout-abort didn't fire); only the conductor's
liveness check caught it.
BUILD: (a) HARD dispatch-timeout abort (kill the cloud HTTP call when elapsed); (b) a daemon watchdog — if
dispatch-heartbeat is stuck > N min while state=running, self-abort the dispatch / self-restart; (c) a circuit-breaker
that routes the panel off a seat after K consecutive timeouts.
ACCEPTANCE: a simulated hung seat self-recovers with no conductor intervention.

## #4 — PREFLIGHT MODULE (make the conductor's proactive checks MECHANICAL)
PROBLEM: the 8 liveness/health checks live in PREFLIGHT-CHECKLIST.md (a doc) + the conductor's discipline — not code.
BUILD: a daemon module that runs the 8 checks (PREFLIGHT-CHECKLIST.md is the spec) at startup / before firing, and
refuses-or-warns on a non-GREEN.
ACCEPTANCE: the daemon will not fire a mission into a RED chain (e.g. SearXNG down, a required model missing).

## #5 — PANEL QUALITY (divergence + bad gates)
PROBLEM: architects diverged into 2 approaches for one file (add-spot-ui-2); and the panel keeps emitting
side-effecting-WRITE liveness gates that fail referentially (killed reviews-ui-1, add-spot-ui-3.S1).
BUILD: (a) when a mission's freedom-of-approach is ambiguous, force a single canonical approach OR a convergence/merge
step before step-execution; (b) forbid side-effecting-write liveness gates in architect.faith — a reachability check is
READ-only or interprets {ok:false} as live. Also: the split tartib gate must not fire a child after its predecessor FAILED.
ACCEPTANCE: no two-approach divergence; no reachability-gate-does-a-real-write; no child running after a failed predecessor.

## #6 — COMMIT THE UNCOMMITTED ENGINE PILE (durability)
executor.mjs, muezzin-daemon.mjs, seat_modes.mjs, seat_dispatch.mjs, git_steps.mjs, runtime_verify.mjs — review each
diff, then commit (the witness-cap/command-class work is already committed 59fcc06). Don't blind-commit.

## PROPAGATION — how the deliverable-type-aware-QC standard reaches ALL future instances/chains
(operator, 2026-06-18: "how do we build this in so all future instances in all future chains KNOW they must live up to it?")
A standard reaches every instance through the SUBSTRATE they read at bootstrap AND the STRUCTURE that enforces it — BOTH, because
today proved AWARENESS alone fails: the conductor KNEW to verify deliverables and still skipped render-QC until prompted. Knowledge
drifts; gates don't. This uses the SAME mechanism that already governs every instance (the hooks/canon/faith that caught the
conductor's drift today are the proof it works).
AWARENESS (read by every instance, every chain):
  1. CANON (~/.claude/canon/, loaded at EVERY bootstrap on EVERY project — the broadest reach). PROPOSED RULING:
     "QC must match the deliverable type, declared by the mission's Done-means. A VISUAL interface (app/site/page) is verified by
      RENDERING it and SEEING it — headless render -> screenshot -> deterministic DOM/console gate + a VLM judging the screenshot —
      NEVER by an LLM reading its source. A DATA/BACKEND deliverable is verified by running it and judging its OUTPUT (rows/response),
      not exit-0. A DOCUMENT by reading it. The single-form text-judge applied to everything is the defect."
  2. QC-SEAT FAITH (~/.claude/faiths/ auditor/validator/witness): the seat's IDENTITY is a deliverable-type-aware verifier, so every
     instantiation of that seat in any chain carries the standard.
  3. MISSION_CONSTRUCTION: a mission's Done-means MUST declare the verification type; a visual deliverable's Done-means REQUIRES render-QC.
ENFORCEMENT (the load-bearing half — forces compliance even on an instance that didn't internalize the canon):
  4. ENGINE (defaultVerdictPhase): branch on deliverable type; for visual, run render+VLM QC (build #1).
  5. A GATE/HOOK: a UI mission CANNOT reach DONE without a render-QC receipt — same shape as the niyyah/bootstrap gates that redirected
     the conductor today. Canon makes them KNOW; the gate makes them COMPLY.
GOVERNANCE-DEPTH NOTE: authoring the CANON ruling + the faith edit affects EVERY project/instance — it is an EVENT, not an edit
(CLAUDE.md). Author it in a FRESH, oriented governance session (read practice/extended/ first), NOT a 7h-drifted context like this one.
This section is the PROPOSAL; a governance session ratifies + authors it.

## Order
#1 first (biggest tax). Then #2 (unblocks all map.html / large-file work). #3 + #4 make unattended runs safe. #5 raises
plan quality. #6 anytime. Each is a SEPARATE focused unit — do not batch into one long context.
