# OPERATOR'S ORIGINAL SEAT PLAN — the governing spec for the mission engine's seats
Captured verbatim from the operator, 2026-06-10 ~13:55, after he caught the shipped
engine running a reduced version ("look i know this is wrong, my original plan looked
something like this — look at the seats"). THIS FILE OUTRANKS the shipped roster and
MISSION_ARCHITECTURE's single-architect reading. The engine is audited AGAINST this;
deviations need his sign-off, recorded here, or they are drift.

## VERBATIM (as pasted — garbles preserved, see normalized reading below)

### Global API Waterfall Order
1. Ollama Cloud ( ollama )
5. Local GPU ( ollama_local  - strictly offline fallback)

### Phase 1: Planning
- Nemotron (architech) — Primary: Ollama Cloud ( nemotron-3-ultra ) · Backup 4: local ( qwen/ 3.5 27b )
- (architech) — Primary: [garbled] · Backup 1: LOCAL ( Gemma 4/35b )
- Qwen (architech) — Backup 2: local ( nemotron/ 3 super 120b )
- Integrator (Bridge/Synthesizer) — Primary: Ollama Cloud ( nemotron-3-ultra ) · Backup 4: local ( nemotron/ 3 super 120b )

### Phase 2: Implementation
- Executor (Nemotron Ultra) — Primary: Ollama Cloud ( nemotron-3-ultra ) · Backup 5: Local GPU ( laguna-xs-2.1:q8_0 (v-swap 2026-07-02, was xs.2) )
- Validator (DeepSeek v4 Pro) — Primary: Ollama Cloud ( deepseek-v4-pro:cloud ) · Backup 4: LOCAL ( qwen 3.6/ 35b )
- Auditor — Primary: ollama cloud ( minimax-m3 ) · Backup 1: local ( nemotron-cascade-2 )

### Phase 3: Verification
- Laguna Auditor — Primary: [blank] · Backup 1: Local GPU ( laguna-xs-2.1:q8_0 (v-swap 2026-07-02, was xs.2) ) (No cloud API fallbacks)
- Granite Auditor — Primary: Local GPU ( granite4.1:30b ) (No cloud API fallbacks)
- Nemotron Super (Final Auditor) — Primary: Ollama Cloud ( nemotron-3-super ) · Backup 3: Local GPU ( nemotron-3-super )

## NORMALIZED READING (conductor's interpretation — operator corrects here if wrong)

**PHASE 1 — PLANNING PANEL (4 model seats):** THREE architects (Nemotron-Ultra, a
Gemma-backed seat, a Qwen seat) plan INDEPENDENTLY; an INTEGRATOR (Nemotron-Ultra)
synthesizes their plans into the micro_queue. This matches the editor chain's ratified
shape (breadth/depth/synthesis) and ACCEPTANCE criterion 1's "blind-eval + peer-rank".
**vs SHIPPED: one architect (kimi-k2.6), no panel, no integrator — the reduction the
operator caught.**

**PHASE 2 — IMPLEMENTATION TRIAD (3 model seats):** Executor (Nemotron-Ultra — NOT
qwen-coder), with a per-phase VALIDATOR (deepseek-v4-pro) and AUDITOR (minimax-m3)
reviewing the implementation inline — judgment DURING implementation, not only after.
**vs SHIPPED: one executor (qwen3-coder-next), deterministic-only step checks; the
validator/auditor seats sat unused until today's phase-3 wiring (and that wiring put
deepseek in phase 3, not phase 2).**

**PHASE 3 — VERIFICATION PANEL (3 auditors, INDEPENDENCE BY LOCALITY):** Laguna and
Granite run LOCAL-ONLY by design — no cloud fallback EVER, so the final witnesses can
never be served by the same remote infrastructure that produced the work. Nemotron-
Super is the final auditor (cloud, local fallback). **vs SHIPPED: 2 cloud seats
(kimi validator + deepseek auditor) with CLAUDE fallback — which inverts the
operator's locality principle: during outages, Anthropic models currently judge work
Anthropic models produced. The original plan makes that structurally impossible.**

**GLOBAL WATERFALL:** Ollama Cloud first, local as the strictly-offline fallback.
(The Claude tier and routing windows post-date this plan — operator-ratified 2026-06-10
as additions: Claude as quota-relief tier + use-it-or-lose-it routing. Those COMPOSE
with this plan rather than replace it; but Claude must NEVER serve the local-only
verification seats.)

## PHASE 1 — RECOVERED FROM SOURCE + OPERATOR RULINGS (corrected 2026-06-10 ~13:55)
Source: the hours-long phased build's config (C:\Users\marka\.gemini\antigravity-cli\
pipelines\3phase-consensus.json) — sequential deliberation, each seat reading the prior.
OPERATOR CORRECTIONS this hour: (a) Opus sits INSIDE Phase 1 as an architect;
(b) the INTEGRATOR is NOT a phase seat — it is the cross-phase BRIDGE that carries
the synthesis from phase to phase (matches the original code: it runs after Phase 1
AND after Phase 2, writing phase-N-master.md).

**PHASE 1 — THREE EQUAL, BLIND ARCHITECTS (operator ruling 2026-06-10 ~14:00: "all 3
seats are equal and blind" — NO sequence, NO seat reads another's output; independence
IS the design; the old config's drafter→critic→synthesizer chain does NOT apply):**
- **Architect A** — **kimi-k2.6** (cloud) — SEATED BY OPERATOR 2026-06-14 (reversible).
  Supersedes the provisional claude-opus seating: Opus moved to Integrator-only per the
  15:10 ruling below (Opus-as-architect-AND-integrator = independence break). Kimi adds a
  clean 4th lab (Moonshot) and fits the reasoning/breadth architect role. Anthropic-tier
  fallback: Sonnet (per the outage panel) → qwen3.6:27b (local). Grounds plans in SOTA search.
- **Architect B** — deepseek-v4-pro. Local fallback qwen3.6:27b.
- **Architect C** — minimax-m3. Local fallback qwen3.6:27b.
Each receives the IDENTICAL mission framing, plans independently and blind. The
INTEGRATOR (below) reads all three plans and synthesizes the master micro_queue —
the blind-eval/peer-rank of ACCEPTANCE criterion 1 happens at that synthesis.
**OLLAMA-OUTAGE SEATING (operator ruling 2026-06-10 ~14:05: "if ollama usage fails,
then phase one 3 seats are opus, sonnet, and haiku"):** when Ollama Cloud is
rate-limited/down, the panel does NOT collapse — all three blind seats run on the
Claude family: **Architect A = opus, B = sonnet, C = haiku** (diversity by model tier
when diversity by lab is unavailable; still 3 independent blind plans, identical
framing, integrator synthesizes). Haiku reachable via the same claude CLI transport
(--model haiku).
**SOTA-SEARCH MANDATE (operator ruling 2026-06-10 ~14:07: "they must all use our sota
search"):** EVERY phase-1 seat, both seatings, grounds its plan in LIVE search — the
systemAnchor's search-before-SOTA-claims is a panel REQUIREMENT, not advice.
Transports: Ollama seats → the engine's SearXNG tool loop (searxng_preflight refuses
to start a search mission on a blind backend); Claude seats → WebSearch/WebFetch via
--allowedTools (wired + live-proven 2026-06-10). FAIL-CLOSED: a seat whose search
transport is down does not silently plan from training memory — it is skipped and the
panel runs on the seats whose search works (minimum 2 of 3, else the mission HOLDS
per the REQUIRES convention).

**INTEGRATOR — cross-phase bridge (outside all phases), OPERATOR RULING 2026-06-10 ~15:10:
= OPUS, with fallbacks.** Stack: **Opus → nemotron-3-ultra (Ollama) → qwen3.6:27b (local)**.
Opus PRIMARY (heaviest-context synthesis job → flat-rate carries it, the "Opus manages
Ollama usage" intent); nemotron-3-ultra is the Ollama backup (operator's original paste);
local floor under it. Carries phase-1-master into Phase 2, phase-2 synthesis into Phase 3;
ends each handoff with [DECLARED NIYYAH]. Opus is the integrator ONLY — NOT also a blind
phase-1 architect (it would synthesize its own blind plan = independence break). So
Phase-1 Architect A (was provisionally Opus) — SEATED 2026-06-14 = kimi-k2.6 (operator
decision, reversible; candidates considered: qwen3.6:27b, nemotron-3-ultra, glm-5.1, kimi-k2.6).

All architect seats wear architect.faith; the bridge wears integrator.faith — all 8
faiths verified present at C:\Users\marka\.agents\faiths\ (2026-06-10; the new engine
already loads from this exact directory).
RESOLVES AMBIGUITY 1 below (the garbled second architect = the Critic seat, minimax-m3).
Phases 2 + 3 recovery from the same source: next conductor block.

## PHASE 2 — LOCKED (operator, 2026-06-10 ~14:30: "we need to fix phase 2 so we can
## get some work done" after in-thread correction of the executor layering)

**EXECUTOR (writes each step's file):**
- 1st: **claude-sonnet** — STANDING-FIRST per the operator's usage ruling (the executor
  is the input-heavy seat; flat-rate Claude carries it, metered Ollama protected).
- 2nd: **qwen3-coder-next** (Ollama Cloud) — NOT redundant with Sonnet: independent
  budget/infrastructure/failure-axis (operator probed this; ratified: a Claude limit
  error falls here per-call while the daemon — plain node, no Claude session — keeps
  running; proven live in the mirror direction all afternoon).
- 3rd: **qwen3.6:27b** (local — operator ruling 2026-06-10 ~14:45: laguna is a review
  specialist, too small for full-file emission; qwen3.6:27b is the stronger local
  writer, matching the original config. laguna stays the WITNESS — one body per skill).
The route file (muezzin-route.json standing_prefer) is the operator's dial between
1st and 2nd — policy, not code.

**WITNESS (per-step smell test — implicit assumptions, logical leaps, undocumented
variables):** CLOUD-FIRST (operator ruling 2026-06-10 ~14:50, option 2: "the witness
should be a cloud model — opus with ollama fallback and local"; laguna ruled too weak +
its MCP returns canned greetings, proven this session). Stack: **Opus → nemotron-3-super
(Ollama) → qwen3.6:27b (local floor)**. Runs EVERY step. COST FLAG ON RECORD: Opus per
step is the heaviest seat on the scarcest pool (6-step mission = 6 Opus calls) — operator
chose strongest-eyes-every-step knowingly; the route dial throttles it if the week pinches.

**VALIDATOR (per-mission — executor output vs the Integrator blueprint, Hasan
li-Ghayrihi 3-bucket, feeds mergeVerdicts):** **deepseek-v4-pro** (operator's paste;
fixes the old config's minimax double-seat). Local fallback qwen3.6:27b. Outage: Sonnet.

**AUDITOR (per-mission — security rules + hard exclusions sweep):** **minimax-m3**
(operator's paste; drops unverified mistral-large-3:675b). Local fallback
nemotron-cascade-2 (operator's paste). Outage: **Haiku**.

CADENCE/COST: witness per-step (local, free); validator + auditor once per mission
(2 cloud calls). Producer≠verifier: no judging seat shares a lab with the producer in
either seating. Deterministic layer (integrity guard, pwsh witnesses, commit/rollback)
unchanged underneath. AUDITION NOTE: the operator's verbatim paste had nemotron-3-ultra
as executor; receipts seated qwen-coder instead (cleanest seat on record) with the
operator's awareness — audition #9 settles it with data if ever contested.

## PHASE 3 — VERIFICATION — LOCKED (operator rulings 2026-06-10 ~14:35–15:00).
## The UNIVERSAL waterfall, same as phases 1+2: Ollama Cloud → CLAUDE → local GPU.
## (Earlier "no Claude in phase 3" was the CONDUCTOR's invention of a producer≠verifier
## rule the operator never made — corrected: Claude IS the middle fallback everywhere.
## A same-provider "Ollama→Ollama" fallback was nonsense (one account, one limit) and is
## struck.) Claude fallback tier = a DIFFERENT Claude model PER SEAT (operator catch 2026-06-10
## ~15:05: all-Sonnet = one model casting three "independent" votes = fake independence
## exactly during an outage; same fix as his phase-1 outage panel opus/sonnet/haiku).
Three boundary auditors (cloud models SOTA-picked from the auditor faith = security/
boundary/rule-compliance checkers, + lab diversity; sources: Kilo + Sonar leaderboards):
- **Boundary Auditor 1** — deepseek-v4-pro (Ollama) → **Sonnet** → laguna-xs.2 (local)
- **Boundary Auditor 2** — glm-5.1 (Ollama) → **Haiku** → granite4.1:30b (local)
- **Final / Consensus Auditor** — nemotron-3-super (Ollama) → **Opus** → qwen3.6:27b (local).
  Reads the other two verdicts (heaviest job → strongest fallback); consensus APPROVE →
  done, any BLOCK → escalation.
Independence holds at BOTH tiers: three labs at the primary (DeepSeek/Zhipu/NVIDIA),
three distinct Claude models at the fallback (Sonnet/Haiku/Opus) — no single model ever
holds the panel.
MAP NOTE (build): CLAUDE_SEAT_MAP already has deepseek-v4-pro→sonnet, glm-5.1→sonnet;
nemotron-3-super is currently mapped →opus for its phase-2 WITNESS role. Same model name,
two roles, two desired Claude fallbacks (witness=Opus, phase-3=Sonnet) → needs ROLE-AWARE
fallback, not a bare model map. Small real engine change, flagged not faked.

## AMBIGUITIES for the operator (answer whenever — the build flags these, never guesses)
1. The second architect's cloud primary is garbled in the paste — which cloud model?
   (gemma has no Ollama Cloud seat; local Gemma 4 is its named backup.)
2. Phase-2 Validator/Auditor: review EVERY step, or once per mission after the steps?
   (Per-step triples implementation cost; per-mission is what today's phase 3 approximates.)
3. Executor = nemotron-3-ultra in this plan; the running roster uses qwen3-coder-next
   (hand-locked 2026-06-09, unaudited). Keep nemotron as specced, or audition both?

## STATUS
- 2026-06-10: captured; shipped engine DIVERGES (single architect, no integrator, no
  inline phase-2 judges, phase-3 not local-anchored). REBUILD-TO-SPEC = the engine
  batch headline. Acceptance-table line-by-line audit rides the same batch.
