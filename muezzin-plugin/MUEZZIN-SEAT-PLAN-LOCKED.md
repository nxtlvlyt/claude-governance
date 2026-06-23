# MUEZZIN SEAT PLAN — LOCKED 2026-06-10 (operator: Mark)

The governing spec for the muezzin mission engine's seats. Built phase-by-phase with the
operator this session; supersedes the shipped roster, MISSION_ARCHITECTURE, and the old
3phase-consensus.json config (all drifted). Engine is audited AGAINST this; deviations
need operator sign-off recorded here.

## Universal waterfall (every seat unless noted)
**Ollama Cloud → Claude → local GPU.** Three real failure domains. (A same-provider
Ollama→Ollama fallback is nonsense — one account, one limit.) Claude tier is also the
use-it-or-lose-it budget lever (route file `~/.claude/state/muezzin-route.json`).

---

## PHASE 1 — PLANNING: three EQUAL, BLIND architects (no sequence, identical framing,
## none reads another's output) + an integrator that synthesizes them.
| Seat | Ollama (1st) | Claude (2nd) | Local (3rd) |
|---|---|---|---|
| Architect A | **glm-5.1** | Opus | qwen3.6:27b |
| Architect B | deepseek-v4-pro | Sonnet | qwen3.6:27b |
| Architect C | minimax-m3 | Haiku | qwen3.6:27b |

Three distinct labs (Zhipu / DeepSeek / MiniMax); distinct Claude models on outage
(Opus/Sonnet/Haiku) so the panel never collapses to one model. **Every architect MUST
use SOTA search** (Ollama: SearXNG loop; Claude: WebSearch/WebFetch), fail-closed:
min 2 of 3 search-grounded or the mission HOLDS.

## INTEGRATOR — cross-phase bridge (outside all phases): carries the synthesis 1→2 and
## 2→3. NOT a blind architect (would synthesize its own plan).
| Seat | 1st | 2nd | 3rd |
|---|---|---|---|
| Integrator | **Opus** | nemotron-3-ultra (Ollama) | qwen3.6:27b |
Opus PRIMARY — heaviest-context job rides flat-rate (the "Opus manages Ollama usage" intent).

## PHASE 2 — IMPLEMENTATION
| Seat | 1st | 2nd | 3rd | Cadence |
|---|---|---|---|---|
| Executor | **Sonnet** (standing-first, usage rule) | qwen3-coder-next (Ollama) | qwen3.6:27b | per step |
| Witness (assumptions/leaps/fakery) | **Opus** | nemotron-3-super (Ollama) | qwen3.6:27b | per step |
| Validator (vs blueprint) | deepseek-v4-pro (Ollama) | Sonnet | qwen3.6:27b | per mission |
| Auditor (security/hard-rules) | minimax-m3 (Ollama) | Haiku | nemotron-cascade-2 | per mission |
COST FLAG: the per-step Opus witness is the only seat scaling with mission length —
the one dial that can run hot; throttle via route file if a Claude week pinches.

## PHASE 3 — VERIFICATION: three independent boundary auditors, distinct lab + distinct
## Claude per seat (no single model holds the panel at either tier).
| Seat | Ollama (1st) | Claude (2nd) | Local (3rd) |
|---|---|---|---|
| Auditor 1 | deepseek-v4-pro | Sonnet | laguna-xs.2 |
| Auditor 2 | glm-5.1 | Haiku | granite4.1:30b |
| Final/Consensus (reads both verdicts) | nemotron-3-super | Opus | qwen3.6:27b |

---

## Standing principles (operator rulings this session)
- Producer ≠ verifier at every layer; lab diversity preserved at BOTH cloud and Claude tiers.
- No closed-frontier APIs outside Ollama (no gpt/grok/gemini/glm *workers*); Claude family allowed.
- Two budgets used together: flat-rate Claude carries input-heavy seats; Ollama carries the rest; local floor catches total outage.
- 2 parallel mission lanes max. Missions carry REQUIRES; never fire into a known wall.

## BUILD STATUS (honest)
- LOCKED here = the full design, all seats + fallbacks.
- LIVE in engine = Phases 1+2 partial (planner, executor, per-step witness, a 2-seat verdict pass).
- NOT yet wired = 3 blind architects + Opus integrator; 3-auditor Phase 3; ROLE-AWARE Claude
  fallback (nemotron-3-super needs Opus as witness but Sonnet/other as auditor — same model,
  two roles — a flat model→Claude map can't express it). These are the engine-batch build,
  deliberately not rushed at marathon session-depth.

---

## PENDING REVISION — Phase-2 Executor primary lane (2026-06-23, awaiting operator lock)

**Proposal:** Add agy (Google Antigravity CLI) routing Anthropic Claude Sonnet 4.6 via Vertex
AI as the Phase-2 Executor 1st-position primary, demoting the current direct-API Sonnet to
2nd (fallback) position. Rationale: agy has a SEPARATE 4-hour rolling quota window from the
operator's weekly Claude budget. Phase-2 (the heaviest token phase by 10-100x vs phases 1+3)
shifts off the metered weekly Claude budget and onto agy's separate quota. Operator's stated
goal this session — "make Claude usage last the week" — is structurally served by this routing.

**Substrate-verified evidence (do not re-research; this is the receipt)**:

1. **Multi-provider confirmed** via SearXNG search 2026-06-23 + Google Antigravity blog
   (antigravity.google/blog/introducing-google-antigravity): "Access to Google's Gemini 3,
   Anthropic's Claude Sonnet 4.5 models, and OpenAI's GPT-OSS within the agent, offering
   developers model optionality with generous rate limits." Despite the bundled cli.md
   describing it as Gemini-only, agy DOES route Claude + GPT-OSS.

2. **CLI dispatch syntax confirmed via live test 2026-06-23T15:08Z**:
   ```
   agy --model "claude-sonnet-4-6" --print --print-timeout 90s --dangerously-skip-permissions \
       "What is 7 times 8? Reply with just the number and nothing else."
   ```
   Result: exit code 0, wall time 9.2s. Log trace shows:
   - `Resolving model claude-sonnet-4-6`
   - `Propagating selected model override to backend: label="Claude Sonnet 4.6 (Thinking)"`
   - `streamGenerateContent` to `daily-cloudcode-pa.googleapis.com` with trace
     `req_vrtx_011CcLiYPqrCmCudbt2Z7wHe` — **vrtx prefix = Vertex AI routing**, confirming
     Antigravity proxies Anthropic via Google Vertex.
   - Auth via Windows keyring (silent — no operator action needed).
   - Quota healthy, no 429.

3. **Stdout-emission caveat** (DOES NOT block executor use): `--print` mode returns exit 0
   with empty stdout for trivial prompts (planner-loop swallow). The model IS running
   (9s of compute, real Vertex API calls in log) but the final answer doesn't reliably
   emit to stdout. For Phase-2 executor work, this is acceptable because the executor's
   deliverable is FILES + COMMITS on disk, not stdout text. The execReceipt
   (`held_out_oracle.mjs` + `integrity_guard.mjs` + the runner's own `validation_command`)
   reads the deed from disk. Stdout silence + file written + node --check passes =
   successful execution per deeds-not-claims. (For seats where text output IS the deliverable
   — judge / auditor / scanner — this WOULD be a problem; only the executor role is
   resilient to it.)

4. **Model-identity fidelity caveat** (operator awareness): Multiple discuss.ai.google.dev
   forum threads (2025-2026) report that Antigravity's "Claude Sonnet 4.5" identifies with
   the April 2024 knowledge cutoff, while real Anthropic Sonnet 4.5 reports Jan 2025; Opus
   4.5 self-identifies as "Sonnet 4". Antigravity has a routing layer between the user
   prompt and the underlying provider; behavior may not be 100% identical to direct-API
   Sonnet 4.6. Acceptable for executor (substrate = the deed). Risky for governance/judge
   seats; this proposal does NOT extend to those.

**Proposed Phase-2 row revision** (clean diff, not yet applied):

| Seat | 1st | 2nd | 3rd | 4th | Cadence |
|---|---|---|---|---|---|
| Executor | **agy `--model claude-sonnet-4-6`** (4-hour quota) | Sonnet via direct Anthropic API (weekly budget) | qwen3-coder-next (Ollama Cloud) | qwen3.6:27b (local floor) | per step |

Other Phase-2 rows (Witness, Validator, Auditor) UNCHANGED. Only the Executor row revises.

**Why operator sign-off required (per this file's own rule)**:

The file's preamble says "deviations need operator sign-off recorded here." This proposal
adds an external dependency (Google Antigravity service + its 4-hour quota mechanic) into
the engine's hot path. If agy ever changes its quota model, drops Claude routing, or
deprecates `claude-sonnet-4-6`, the executor seat's primary lane breaks. The fallback
(direct-API Sonnet) is the regression-safe net, but a structurally-load-bearing external
service joining the locked plan is the kind of change the lock exists to gate.

**Integration cost** (when sign-off lands, captured here for the next instance):

- New function `dispatchAgy(prompt, opts)` in `executor.mjs`: `child_process.spawn` of
  `agy --model claude-sonnet-4-6 --add-dir <cwd> --dangerously-skip-permissions --print
  --print-timeout 5m <prompt>`. Trust the disk, not stdout — execReceipt verifies the deed.
- Quota-tap detection: a 30s sentinel call before dispatch (`agy --model claude-sonnet-4-6
  --print "Status: OK"` with short timeout); if it hangs or returns non-zero, suspect
  quota; route to 2nd-position direct-API Sonnet.
- ~30 LOC in `executor.mjs` + matching prompt-shape adjustments in `deconstructor.mjs`
  (since agy expects substantive prompts, not trivial-question prompts).

**Rollback plan** (if the agy lane proves unreliable in practice):

- The locked Phase-2 table remains the canonical fallback structure — Sonnet stays as the
  2nd-position lane and IS the safety net for the agy lane's failure modes.
- One config-flip (`USE_AGY_EXECUTOR=false` env) reverts to the current Sonnet-1st behavior.
- The proposal mutation is additive; it does NOT delete the Sonnet lane.

**Status:** PENDING — awaiting operator lock. When locked, modify the live PHASE 2 table
above and remove this pending-revision section to the resolved-history record.
