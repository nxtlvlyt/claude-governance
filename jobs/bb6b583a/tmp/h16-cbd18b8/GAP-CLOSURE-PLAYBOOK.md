# GAP-CLOSURE PLAYBOOK — authored by Fable at the operator's word (2026-07-03, last-4%-budget)
Operator directives, verbatim intent: (1) "the last of Fable's usage should make sure these
gaps are closed in the most state-of-the-art way possible in accordance with our governance
and framework and tools"; (2) "close them with our chain like we have been doing — it's been
saving a lot of your usage." This document is the Fable spend: design judgment, unit grouping,
sequencing, acceptance bars — so the CHAIN closes the gaps and any conductor (Sonnet-class or
smaller) only authors, fires, judges, and strikes. Work items: missions/QUEUE.md ledger
(#7–#11) + missions/_logs/GAP-HUNT-2026-07-03.json (per-item evidence, refute-verified —
READ THE ITEM'S EVIDENCE BEFORE FIXING; never fix from this summary alone).

## EXECUTION MODEL — CHAIN-FIRST (operator ruling 2026-07-03 ~20:1x)
DEFAULT: every unit below becomes a LINT-PASSING ENGINE MISSION the daemon runs:
  MISSION-CLASS: code-repo, REPO-ROOT: C:\Users\marka\.claude\muezzin-plugin,
  ALLOW-FILES: exactly the engine files the unit names,
  outcome check: run the touched modules' --selftest suites + the full sweep (the pre-commit
  muezzin-gate is the hard rail — a failing suite cannot commit).
  Use the engine-* mission namespace (gapHoldSkips holds only product namespaces — engine
  missions fire even under a gap hold, which is correct: they ARE the gap work).
ENGINE-EDIT SEQUENCING: engine missions run SERIAL, one per reload window — mission commits
its edit -> conductor requests reload at the lane boundary -> respawn observed in
daemon-events -> next engine mission plans against fresh code. Never two engine missions in
flight; never fire the next before the previous reload lands.
CONDUCTOR-DIRECT EXCEPTIONS (small, each with its reason — everything else goes to the chain):
  1. UNIT A's cwd-derivation change — a mission cannot safely edit the path logic the daemon
     is using to RUN that very mission (bootstrap hazard). Conductor-direct at a lane boundary.
  2. ~/.claude/hooks/* — outside mission repo scope AND they gate the conductor itself.
  3. daemon-supervisor.ps1 / preview-supervisor.ps1 — the respawn layer (same bootstrap class).
CONDUCTOR AUTHORING RULE: mission texts are authored FROM this playbook's unit specs, carry
the hunt item's evidence pointer (GAP-HUNT-2026-07-03.json + item title), pass lintMission(),
and pin acceptance with the marker-anchor pattern.

## Proven fix patterns (today's receipts — the house style; deviations need a receipted reason)
- PURE FUNCTION + SELFTEST BOTH POLARITIES (execTimeoutMs, insertQueueLineAfter, gapHoldSkips).
- BASELINE-RELATIVE, NEVER ABSOLUTE (containment-drift, runtime-verify browser-global class).
- FAIL-OPEN only when a defect CANNOT be proven; FAIL-CLOSED on proven defects (runtime_verify's
  comment block is the canonical statement).
- MARKER-PINNED ACCEPTANCE (# LONG-RUN, MT_PLANMODE_STATE_HOOK, mt-fs-dedupe): edit and verify
  anchor on the same literal so they cannot disagree.
- CENSUS METRICS, not narratives (CUDA crash census; parity marker counts).
- CONDITION-BASED ESCALATION written at fix time (gemma: 2nd crash -> restart, 3rd -> demote).

## UNIT SEQUENCE (dependency-ordered — records first: every later fix is judged by them)

### UNIT C — TRUTH OF RECORD (chain missions; first)
C1. Daemon UNRESOLVED-as-RESOLVED regex inversion: apply conduct-cycle closed()'s proven \b
    fix (2026-07-02) to the daemon's copy; port the closed() selftest pair.
C2. RESOLVED-LANDED stamp validation: consumers (queuedDepsHold, pickPromotion) verify the
    stamp mechanically via missionLandedState (the ONE identity core) — ALLOW-FILES present
    at HEAD or named-sha patch in tree; failure logs STAMP-DISPUTED, never retires.
C3. fix-ledger partial-requeue: per-stem requeued flags replacing the .some() whole-entry
    consume; migrate legacy array entries on read.

### UNIT A — MISSION IDENTITY / SANDBOX (CONDUCTOR-DIRECT — bootstrap exception; the hunt's
top find, live-verified: parents/siblings share cwd + events; retros hollow; RECURRING-HALT
counts other missions' failures). ONE exported canonical-sandbox-path function (full dotted
stem, no second dot-strip); daemon cwd, orchestrate countPriorOccurrences, and writeRetro all
import it. Selftest = the geocode S1/S1.S1 collision fixture from the hunt evidence. Old
colliding dirs remain as history. THEN two chain missions: split-emit read-back verification
(appendQueue swallow + write-only manifest) and QUEUE-DUP exemption for split-inserted lines
(SPLIT-CHILD comment token the guard recognizes).

### UNIT B — DISPATCH HEAL SYMMETRY (chain missions)
B1. localOnly branch gains the waterfall's exact bounded heals: TIMEOUT -> one extend-retry,
    NETWORK/5xx -> one short-delay retry (mirror healDispatch caps; no new policy).
B2. Heartbeat failure-class flags become a TABLE (regex -> flag text + threshold): CUDA and
    EMPTY_CONTENT_THINKING become rows; add TIMEOUT-local + NETWORK-local rows. Selftest/row.

### UNIT D — WITNESS QUALITY (chain missions)
D1. self_witness maxArt/maxCtx raised toward the proven 48K fix, bounded by the ACTUAL witness
    model's num_ctx (read it first — receipts, not guesses).
D2. Witness receipts record the ACTUAL dispatched model (the hardcoded 'laguna' label violates
    the honest-name ruling).
D3. The no-verdict re-ask REQUIRES the one-line concern (it currently forbids it) — every
    recovered verdict becomes adjudicable (this is also gap #3's recorded fix direction).
D4. Wire the built-but-unused divergence selector to LOG for 48h; then seat by receipts.

### UNIT E — CONDUCTOR ENFORCEMENT (mixed: E1 hooks + E4 supervisor = conductor-direct; rest chain)
E1. LANE-EXCLUSION mechanical guard (hooks): block conductor writes into a RUNNING lane's
    REPO-ROOT unless the heartbeat shows plan-phase (the receipted exception).
E2. GAP-HOLD namespace: explicit product-prefix list (b13-*, card-*, cgsports-*, quirky-*, ...)
    beside gapHoldSkips' mt-* test.
E3. Deploy truth: fix the STATE.md --commit-dirty keystroke contradiction; divergence guard
    fails CLOSED on git error; MT-repo pre-commit marker guard (parity markers never DECREASE
    without an ALLOW-DECREASE token — the 44da372 class, founding receipt in QUEUE 19:0x).
E4. Supervisor halt surfacing: halt writes a marker the SWEEP reads (new flag) + a push via a
    mechanism OUTSIDE the dead process; also fix the STUCK-TASK kill-scope bug the supervisor
    header names (taskkill hits the daemon's own pid).
E5. PRE-FLIGHT gate content-awareness: the gate's receipt line names WHICH killed class the
    preflight file covers (grep addendum headers) so a stale preflight cannot satisfy a new one.

### THEN (order after units): #7 bulk passes (false-death 26 / parked 13 / amend-on-surface 17)
— judged AFTER C+A so the records being judged are honest; conductor beats with Read-tool
receipts (verdict gates demand them); survey half may be a sonnet-agent workflow, stamp half
never. #8 deploy-gate mission (E3 is its core) + main/master reconcile (surface branch-deletion
to the operator ONCE, with receipts). #9 identity hygiene at a clear lane. #10 gemma experiment
(ARM 1 num_gpu partial-offload into the 192GB RAM; census is the metric; escalation conditions
already recorded).

## Acceptance bar for EVERY unit (the definition of closed)
Selftests both polarities green; full suite sweep ALL PASS; committed with receipts (chain
missions: panel-signed DONE); reload requested AND respawn observed; QUEUE ledger struck with
sha; where behavior is observable, one live receipt within 24h (census delta, flag firing, or
a mission passing the previously-killing class).

## Governance wiring (non-negotiable, enforced by hooks)
Niyyah with OPEN source per edit batch; lintMission() for anything mission-shaped; the AUTORUN
verdict gate demands Read-tool receipts of a mission's OWN diagnostics before judgment
annotations; the beat-complete bar governs every beat; gap work outranks product (standing
ruling); the gap-dry push (QUEUE condition, #7–#11 all struck) opens the operator's big project.
