# Lessons — the muezzin's first (unplanned) acceptance test was THIS session

**Source:** 2026-06-09 build session. The Opus *conductor* exhibited, live, the failure classes the muezzin is built to prevent — and the mechanisms that corrected it ARE the muezzin's. Encode these as gates (self-catch-and-learn: every miss becomes a permanent gate, the same principle used for the video editor).

## The realization
**A frontier conductor (Opus) running on willpower is as untrustworthy as an open-weight seat.** The conductor is NOT exempt from the gates. `delegation-and-stall-discipline.md` names the exact failure observed: *"cited-but-not-applied"* — the instance reads the canon, cites it, commits to applying it, and doesn't, until the operator corrects.

## Failure classes observed today → gates to encode
| Conductor failure (observed live) | Gate the muezzin must enforce |
|---|---|
| **SLEEP** — stop + wait to be prodded, repeatedly | the mission / micro-action **board** must be a live, visible, *tracked* queue (proved anti-sleep today the moment it existed); + always-a-task-in-flight / heartbeat re-trigger so the queue never goes quiet |
| **MEMORY-ASSERTION** — model/roster picks from memory + benchmarks, repeatedly wrong | **wudu enforcement** — a required source-read before any governance/model decision. Reading `model-rijal.md` caught the conductor's OWN errors (super-vs-ultra, "no Claude in seats") that benchmarks had produced |
| **CLAIMS-NOT-DEEDS** — "I'm on it" then stopped | deeds-not-claims applied to the **CONDUCTOR**: a stated next-action must be backed by an actual tool-use (narration-gate), the same standard as the seat execution-receipt gate |
| **DRIFT / FLIP-FLOP** — super↔ultra, qwen↔minimax, the rijal side-road that alarmed the operator | ground decisions in **TESTED reality > benchmarks/memory** (the live coding head-to-head corrected the ranking); the board keeps focus on the objective |
| **OPERATOR-AS-GATE** — the human caught every drift | the chain's structural gates (blind-eval, assertion-closure, foreign-tribe witness) exist so the *human's* time stays qualified. Replace human-as-gate with structural gates |

## The WINS — the positive operating model (build these as first-class features, not bolt-ons)
The muezzin must not be only gates-against-failure. The mode that actually got work done today is a self-sustaining loop — encode it as how the muezzin RUNS:

| Win (what worked on the conductor today) | In the plugin |
|---|---|
| Execution **receipts** — run/test before any PASS | BUILT + tested (verdict_merge gate, runner) |
| **Per-step git commit / surgical rollback** | BUILT + tested (#19, #20) |
| **Tested-reality > benchmarks** — earn the record | BUILT (model_rijal: chosen-by-evidence, ʿadāla earned by running) |
| **Parallel grind** — N things at once | BUILT (muezzin_engine panel, parallel dispatch) |
| **Delegate** mechanical work / spend cloud not Opus | core design — token-arbitrage (cloud seats grind, Opus integrates) |
| **Visible board** = anti-sleep | to build (#30) |
| **Tied camel / heartbeat** — never-quiet queue | to build (#28) |
| **Wudu** — read source before deciding | to build (#22) |

**The operating loop: board-driven → parallel → delegate → commit each step → receipt-backed → never quiet.** That loop is the muezzin's *default motion* — #21 (orchestration) + #28 (packaging) build it as the way it runs, not gates bolted on after.

## The learning principle
**Self-catch-and-learn:** every observed conductor-miss becomes a permanent gate + a recorded failure class — a *conductor drift-log* / rijāl-of-the-conductor that the muezzin maintains and enforces going forward. This document is the first entry.
