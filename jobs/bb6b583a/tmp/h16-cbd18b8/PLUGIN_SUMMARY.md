# The Muezzin Plugin — Summary (read this cold)

**One line:** The muezzin is a mechanical *conductor* that runs a software mission to **witnessed** completion — it decomposes the mission into atomic steps, has open-weight cloud "seats" implement and verify each, and trusts only a real **execution receipt** (a deed), never a model's claim.

**Location:** `C:\Users\marka\.claude\muezzin-plugin\` — a git repo (`git log` is the history). Every `.mjs` module has an argv-guarded self-test: run `node <module>.mjs` to witness it. As of 2026-06-09 the offline-deterministic module suite is green (orchestrate 11/11 incl. the searxng gate + fail-safe cases); the live-dispatch modules (deconstructor/executor/repair/seat_dispatch) are proven by real missions, not offline self-tests.

## Why it exists
It evolved from a prior 6/7-agent deliberation chain ("agy") that FAILED because **the chain judged CLAIMS (self-asserted markdown) instead of DEEDS (running the artifact)** — broken/unbuilt code passed APPROVE, and the same defects recurred mission after mission. The muezzin's core fix is **deeds-not-claims**: nothing passes without an execution receipt the muezzin produced itself. (Full grounded diagnosis: `DIAGNOSIS.md`.)

## The pipeline — how a mission runs
Entry point: `orchestrate(mission, cwd, opts)` in `orchestrate.mjs`.
1. **PLAN** — `deconstructor.mjs`: an architect seat decomposes the mission (stated as **Maqsad/objective + niyyah/intention**, *never* step-by-step) into a validated `micro_queue` of atomic micro-actions — exactly **1 file edit OR 1 command OR 1 verify** per step, size-capped to one implementation file, each carrying its own `validation_command`.
2. **IMPLEMENT + VERIFY** (per step; never advances past a failure):
   - `executor.mjs` — the executor seat writes the target file.
   - `integrity_guard.mjs` — blocks a green that **gamed the verifier** (deleted an assertion, touched a test file, `--no-verify`, injected `exit 0`).
   - `seat_dispatch.execReceipt` — the muezzin runs the step's `validation_command` *itself* (the witness). `held_out_oracle.mjs` can run a hidden assertion the step never saw (reward-hacking check).
   - `repair.mjs` — on a failing receipt, a repair seat reads the captured error + rewrites the file; re-witnessed (one scoped attempt before halt).
   - `git_steps.mjs` — commit on a passing receipt; `git checkout` rollback + HALT on fail.
3. **RECORD** — `verdict_merge.mjs` merges seat verdicts deterministically (severity hierarchy, fail-safes, **no LLM judge**; an APPROVE with no receipt → BLOCK). `keystone_flow.mjs` + `render_state.mjs` render STATE programmatically from verified substrate (no LLM hand-writes the record — Directive 1). `substrate_guard.mjs` blocks a verdict citing a path that doesn't exist. `substate.mjs` keeps per-mission state thin (Fajr load one / Isha merge-up).

## The roster (the seats)
Open-weight models via **Ollama Cloud**, chosen by **rijāl** = earned verdict-accuracy record, NOT benchmark (`model_rijal.mjs`):
- **Architects (Plan):** kimi-k2.6 · deepseek-v4-pro · nemotron-3-ultra
- **Executor:** `qwen3-coder-next` (SOTA-validated)  ·  **Witness:** nemotron-3-ultra  ·  **Validator:** kimi-k2.6
- **Auditors:** deepseek-v4-pro · minimax-m3 · glm-5.1  ·  **Scanner:** deepseek-v4-pro (won a live format+correctness test)
- **Integrator/conductor:** Opus. The cloud seats do the grind (free, parallel-safe); Opus only integrates — the token-arbitrage that keeps the Claude account from burning out. Cloud seats are flagged `unestablished` until they earn a rijāl record.

## Key principles (read before changing anything)
- **Deeds-not-claims** — the receipt is the only proof, and the receipt is integrity-guarded + cross-checked by a held-out oracle (the one material gap current SOTA found; `SOTA_VALIDATION.md`).
- **Mission construction** (`MISSION_CONSTRUCTION.md`) — a mission is Maqsad + niyyah + unbiased context, *never* mechanics (the Muʿādh-ibn-Jabal delegation: give the destination, trust the reasoning).
- **The conductor is NOT exempt** (`LESSONS_FROM_THIS_SESSION.md`, `conductor_driftlog.mjs`) — the structural gates that catch a seat (the task board, the narration-gate, wudu) catch the *conductor* too. A frontier conductor on willpower is as untrustworthy as any seat. This is empirical: the conductor exhibited every failure class during the build and was corrected only by the gates.
- **SOTA-validated** (`SOTA_VALIDATION.md`) — the architecture (agentic execution-feedback loop, atomic plan-execute, per-step isolation) and the witness design HOLD as current SOTA; keep the atomic loop + halt-on-fail invariant.

## How to invoke
- **`muezzin-daemon.mjs` — the STANDING muezzin (added 2026-06-09, the root fix):**
  `node muezzin-daemon.mjs` drains `missions/AUTORUN.md` serially — one mission-file
  path per line; the daemon marks DONE/FAILED in place (one retry), and writes
  `missions/_logs/daemon-status.json` + `daemon-events.log` as the status surface.
  Conductors/operators APPEND to the queue and READ status; the daemon executes
  regardless of who's awake. Closed the failure mode where queued work waited on a
  sleeping conversation (the adhan-pattern's warning, embodied as a process).
- `run-mission.mjs <mission-file> <cwd>` — one detached mission (missions are FILES;
  multi-line mission text does not survive argv).
- `commands/muezzin.md` — the `/muezzin` slash command: give it a mission as Maqsad+niyyah; it drives `orchestrate()` in a git sandbox.
- `skills/muezzin/SKILL.md` — the restraint charter: the muezzin's identity (the caller, not the prayer; no judgment of its own; gates on receipts; escalates only what the chain genuinely can't resolve).
- `.claude-plugin/plugin.json` — the manifest (valid, loadable).

## Current state (2026-06-09) — build tasks 21/21 done; code-complete + adversarially verified
- **Done + proven:** the spine, all gates, the SOTA receipt-hardening, the roster, the plugin package, and the `#25` searxng daruriyyah pre-gate (wired into `orchestrate`, 11/11 self-test cases). Offline module suite green. **Proven on a real mission**: a fizzbuzz mission self-healed end-to-end (step 1 failed its receipt → repair seat fixed it → passed + committed).
- **SearxNG is UP** (`#33` resolved): it serves ~17 results; the earlier "down" was a false-negative in the probe (8s timeout < SearxNG's 15s, and an over-strict block-on-any-degraded-engine rule). `searxng_preflight.mjs` fixed: 20s timeout, BLOCK only on zero results (blind), OK when degraded-but-answering.
- **Critical hang fixed:** every muezzin commit had inherited the global `~/.gitconfig` laguna pre-commit hook (a per-commit 33B Ollama review, ~36h timeout) which would freeze every autonomous mission at its first commit. All 5 commit sites now `--no-verify` (hermetic machine commits witnessed by execReceipt + integrity_guard). Two further hang vectors closed after an adversarial audit: the seat search GET fetch and `git_steps` execSync now have timeouts (+ `GIT_TERMINAL_PROMPT=0`); the gate now fails safe on a throwing preflight and treats zero-results as BLIND.
- **Adversarially verified:** a 3-auditor workflow (governance / completeness / gate-logic) reviewed the fix — all CONCERN, core SOUND; it found 4 real gaps (incl. a claims-not-deeds comment in our own code) — **all 4 fixed + re-witnessed.**
- **#43 RESOLVED** (deterministic source gate): the plugin's own source commits are now gated by `.githooks/pre-commit` (`core.hooksPath=.githooks`) — an **Ollama-free** hook that runs `node --check` on every staged `.mjs` plus the self-test for changed **offline** modules (network/cloud seats are syntax-checked only; scratch `_*.mjs` syntax-only). It turns "I tested it" into a captured exit code, **can't hang** (no laguna), and is self-witnessed: passes clean, BLOCKS on a syntax error or a failing self-test. Bypass: `git commit --no-verify`.
- **Not yet done — the real proof:** a full autonomous SOAK run (the operator's 8h+ no-human mandate). Individual live missions pass (incl. a real LRU-cache mission, independently re-tested 4/4); a long unattended end-to-end run is the remaining acceptance test.
- **Small enhancements:** bundle the wudu/niyyah/narration gates as plugin-native hooks (they exist globally, not yet in the plugin's `hooks.json`).

## Deeper docs
`DIAGNOSIS.md` · `MISSION_CONSTRUCTION.md` · `MISSION_ARCHITECTURE.md` · `ACCEPTANCE.md` (the 11 definition-of-done criteria) · `SOTA_VALIDATION.md` · `LESSONS_FROM_THIS_SESSION.md` · `BUILD_STATE.md`.
