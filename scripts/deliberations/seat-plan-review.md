Review the LOCKED SEAT PLAN below for fidelity and coherence. It was produced today by a long-running (drifted) conductor instance from the operator's design, after the conductor mis-stated the operator's plan three times during the session. Verify: (1) internal coherence — do the phases, fallback ladders, and principles contradict each other anywhere? (2) fidelity risks — given the stated operator rulings quoted inside it, does any seat assignment or fallback contradict a quoted ruling? (3) buildability — is anything underspecified for an engineer to wire without guessing? Name every defect concretely with the line it comes from. Verdict: APPROVE / REVISE / REJECT with findings.

SUBSTRATE — C:\Users\marka\.claude\muezzin-plugin\MUEZZIN-SEAT-PLAN-LOCKED.md follows verbatim:
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

