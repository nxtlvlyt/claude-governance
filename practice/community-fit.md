# Community Problem-Fit Statement
# Last updated: 2026-05-13
# Source: 7-seat deliberation chain (problem-fit) + operator review

This document states what the AI agent governance community is trying to solve,
and our honest position on each problem. It is a positioning statement, not a
marketing document. Do not optimize it for favorable conclusions.

---

## P1 — Multi-agent delegation trust
**Community problem (SAGA, NDSS 2026):** In multi-agent systems, agent A delegates
to agent B which delegates to agent C. The user authorized agent A but never
explicitly authorized B or C. Who authorized each step? How do you prove it after
the fact?

**Our position: SOLVED — architectural prevention for seats 1-6; formation-constrained for Seat 7**

The deliberation seats (gemma, qwen, granite, nemotron, laguna) are Ollama HTTP
calls invoked via Python scripts. They receive a prompt and return text. They
cannot spawn anything, take no actions, and have no Claude Code context. This is
structural — they are API calls, not agents. Delegation is a structural impossibility.

The executor (Seat 7) is a Claude Code Agent spawned at the end of an explicitly
operator-authorized chain run. It is governed by subagent-start.ps1 (governance
bootstrap) and executor.faith.md, which explicitly prohibits sub-agent spawning:
"I do not spawn sub-agents. My work returns to the parent session. If a task
requires autonomous delegation beyond what I can execute directly, I surface that
to the operator rather than delegating without explicit authorization."

The SAGA delegation chain problem does not arise because either (a) the seat
cannot take any action (seats 1-6, structural) or (b) the seat's faith file
explicitly prohibits re-delegation (Seat 7, formation-constrained). There is one
decision-maker (Claude), one operator (the human), one authorization relationship.

SAGA builds an authorization registry for autonomous delegation chains that already
exist. We don't create autonomous delegation chains — the architecture prevents it
at the seat level and the executor faith file closes the remaining surface.

---

## P2 — Policy-as-guideline fragility
**Community problem (Aegis, arXiv:2603.16938):** Behavioral alignment and advisory
governance become fragile as agents gain speed and autonomy. When an agent can act
faster than a human can review, "guidelines" stop being enforcement.

**Our position: SOLVED**

Our enforcement is split across two classes of operation:

**Governance-class operations (fully enforced):** Edit/Write/NotebookEdit on
substrate-class files (canon, faith, practice, hooks, CLAUDE.md) are hard-gated.
The substrate gate requires foreign-frontier witness. The niyyah gate requires
declared intent. The surrender check requires explicit articulation of conflict.
The stop hook blocks stalling without dispatch. These cannot be bypassed by model
reasoning or prompt injection.

**Operational-class operations (formation-governed):** Bash tool, non-substrate
file writes, API calls have no hook enforcement. The substrate gate's own comment
block names this explicitly: "It does not gate Bash." For operational actions,
governance works through formation — CLAUDE.md, canon, faith files, and practice
shape who Claude is and how Claude reasons, so Claude operating from that formation
does not act against policy through Bash because the formation holds, not because
a lock prevents it.

This is different from Aegis's advisory framing. A prompt guideline is advisory —
the model reads it and may reason past it. Formation is load-bearing judgment — the
model has internalized the constraint as part of operating correctly. The failure
mode is formation breaking under adversarial pressure or context manipulation, not
the model simply reasoning past a guideline.

The advisory gap is fully closed for governance self-modification (structural lock).
It is formation-closed for operational actions — robust but not cryptographically
guaranteed. The Bash bypass surface (Set-Content, Out-File, redirects, subprocess
execution) cannot be robustly closed via pattern-matching hooks — trivial bypasses
exist through encoding, path traversal, and subprocess execution. (Laguna analysis
2026-05-13.) Robust closure requires OS-level ACLs on ~/.claude/ or process
isolation. Formation is the actual mitigation for operational-class Bash operations.

---

## P3 — Enterprise rogue agents / multi-tenant authorization
**Community problem (Microsoft AGT, CNCF):** Autonomous agents cause production
failures because they operate without governance. They go rogue — take unauthorized
actions, cause real business harm — and nothing catches it before damage is done.

**Our position: SOLVED — architectural prevention via the deliberation stack**

The core P3 threat is an agent acting on bad judgment without anyone catching it.
Our answer is the deliberation stack: every significant decision passes through
workshop, deep-dive, synthesis, code review, governance audit, and final verdict
before the executor acts. A rogue seat gets caught by the downstream auditor seats.
Nothing ships on a single agent's bad judgment.

The architectural principle: no single seat needs to be perfect. Gemma can miss
something — qwen catches it. Qwen can miss something — laguna catches it. Each
seat is accountable to the ones behind it. The strength is in the chain, not in
any individual model. Errors are corrected immediately, in the same run, before
anything acts. Not after damage is done.

This is the congregation principle: an imam leads prayer but is only as strong as
his congregation. If he makes a mistake, someone behind him corrects him immediately.
Our stack works the same way — mutual correction within the run, not post-hoc audit.

Our system scales to multiple agents, each with their own faith file, each
operating under the same CLAUDE.md, canon, and hooks. The stack can govern any
number of agents because the governance is baked into each agent's formation and
the chain provides the review loop.

The enterprise coordination layer (central dashboard, cross-agent visibility across
simultaneous runs) is not built. But the core problem — rogue agents causing harm
without detection — is solved. The deliberation chain IS the detection and
correction layer, operating before harm occurs.

---

## P4 — No accountability loop / human escalation paths
**Community problem (Forbes, general community):** Autonomous agents make decisions
with no human in the loop and no escalation path when something goes wrong.

**Our position: SOLVED**

The community's concern is that autonomous agents act with no accountability at
all. Our answer is the deliberation stack — six seats deliberate, correct each
other through the congregation principle, and only when the chain reaches a clean
verdict does anything act.

The human does not need to be in every loop. That is the point. The stack IS the
accountability layer. It protects the operator's time — the operator is not pulled
in for every operational step, only when the chain surfaces a decision that
genuinely requires operator judgment.

The accountability loop is: every governance decision is deliberated by six
independent seats, each correcting the ones before it, before the executor acts.
The niyyah gate requires declared intent. The surrender check requires explicit
articulation of conflict. The stop hook prevents stalling without dispatch. These
gates escalate to the operator by design when something requires human judgment.

The human is in the loop when their judgment is needed. The stack handles
everything else. That is a complete accountability architecture, not a partial one.

---

## P5 — Static policy / no compounding memory from failures
**Community problem (pro-workflow):** Static governance cannot adapt. When an agent
encounters a new failure mode, the policy doesn't update. The same mistake can
recur because the system has no memory of what went wrong.

**Our position: SOLVED**

Implemented 2026-05-12 via 6-seat deliberation chain (unanimous CONDITIONAL_APPROVE, Option C).

**Two-layer compounding memory:**

Layer 1 — Episodic (session-level, RAG-queryable): pre-compact.ps1 now enforces
content verification before writing to AnythingLLM hotdir. If LAST-SESSION-STATE.md
is ≤500 bytes (stub), a visible WARNING is written instead of silently propagating
empty content. Enriched summaries include required sections: failures_this_session,
corrections_applied, patterns_confirmed, open_carries.

Layer 2 — Procedural (cross-session, direct-load): failure_log.md in project memory
records corrected mistakes with WHY reasoning. Loaded directly at session start via
MEMORY.md — NOT via RAG. Bypasses the RAG architectural mismatch for failure policy:
must be available regardless of semantic query similarity.

**Why Option C over D (SQLite):** The pipeline existed — the failure was content
absence inside working infrastructure. Option C fixes what the infrastructure carries.

---

## P6 — Auditability and cryptographic non-repudiation
**Community problem (Aegis, wshobson/agents):** After something goes wrong, you
need to prove what happened. Logs that can be tampered with are not proof.
Cryptographic sealing of audit artifacts provides non-repudiation.

**Our position: IMPLEMENTATION COMPLETE — pending push verification**

We produce JSONL transcripts that record every tool call, every model output, every
hook decision. These are app-written records — meaningful content, not opaque logs.

Cryptographic non-repudiation is implemented via hybrid anchoring (5-seat chain
verdict CONDITIONAL_APPROVE unanimous, 2026-05-13):

Layer 1 — Session transcripts: session-hash-chain.ps1 (Stop hook) computes SHA-256
rolling hash chain and requests an RFC 3161 TSA token for the final hash. Only the
hash leaves the machine. The signed token proves existence at a specific time,
independent of the operator. Fail-open: if all TSAs unreachable, tamper-detection
still applies. TSA endpoints (verified 2026-05-13): freetsa.org/tsr (primary) +
digicert, microsoft, globalsign fallbacks.

Layer 2 — Governance artifacts and book: git-anchor.ps1 (Stop hook) SSH-signs
commits in ~/.claude/ and D:\Desktop\ai book and pushes to two independent remotes
(GitHub and Codeberg.org). Independent witnesses: neither remote is
operator-controlled infrastructure. Signed push log cannot be retroactively altered.

Layer 3 — Infrastructure: ~/.claude/ initialized as git repo with SSH commit
signing (id_ed25519). Same key used for auth and signing — no separate GPG keyring.

Pending verification: first push to GitHub/Codeberg requires operator to create
remote repos and confirm SSH key is uploaded. TSA anchoring works immediately.

IETF draft-sharif-agent-audit-trail (2025): SHA-256 per RFC 8785 + optional ECDSA
per-entry signing. EU AI Act mandates tamper-resistant logging from August 2026.

---

## Summary

| Problem | Our position |
|---------|-------------|
| P1 — Multi-agent delegation | SOLVED — architectural prevention |
| P2 — Advisory governance fragility | SOLVED — blocking hooks |
| P3 — Enterprise multi-tenant | SOLVED — rogue agents prevented by deliberation stack |
| P4 — Accountability loop | SOLVED — deliberation stack is the accountability layer |
| P5 — Static policy / no learning | SOLVED — two-layer memory (2026-05-12) |
| P6 — Cryptographic auditability | IMPLEMENTATION COMPLETE — TSA token + SSH-signed git; push verification pending |

**What we can honestly claim:**
Blocking enforcement of governance policies for a single-operator, local-first AI
agent. The advisory gap is closed. The delegation chain problem does not arise.
Cryptographic non-repudiation via RFC 3161 TSA (transcripts) and SSH-signed git
commits to independent external witnesses (governance artifacts and book).

**What we cannot claim:**
Enterprise multi-agent governance.
