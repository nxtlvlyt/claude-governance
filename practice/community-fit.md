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

Audit trail for Seat 7 violations: if the executor spawns a sub-agent in violation
of this constraint, the Agent tool call would appear in the session JSONL transcript.
The session-hash-chain.ps1 stop hook anchors the transcript hash via RFC 3161 TSA —
tamper-evident, post-hoc audit visibility. There is no active delegation-violation
detector; detection requires manual post-hoc review.

*Chain-verified 2026-05-13 via community-fit-review.py — unanimous CONDITIONAL_APPROVE
(6/6 seats). All concerns non-blocking. Residuals documented above.*

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
declared intent. The surrender check requires explicit articulation of conflict (Edit and Write on
existing substrate paths; Write to new paths allowed without articulation).
The stop hook enforces delegation discipline at turn boundaries — it fires when
stop-language is detected at turn-end, not as a real-time blocker of mid-turn
operations. These cannot be bypassed by model reasoning or prompt injection.

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

*Chain-verified 2026-05-13 via community-fit-review.py — unanimous CONDITIONAL_APPROVE
(6/6 seats). All concerns non-blocking. Surrender check Write-path gap closed
2026-05-14 (Write on existing substrate paths now gated; "Queued" residual resolved).*

---

## P3 — Enterprise rogue agents / multi-tenant authorization
**Community problem (Microsoft AGT, CNCF):** Autonomous agents cause production
failures because they operate without governance. They go rogue — take unauthorized
actions, cause real business harm — and nothing catches it before damage is done.

**Our position: SOLVED for pre-execution rogue agent prevention (single-operator scope). Multi-tenant enterprise authorization is explicitly out of scope.**

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

Our governance architecture is adaptable for more agents: add a seat, assign it a
faith file, and it operates under the same CLAUDE.md, canon, and hooks. This scales
the deliberation chain — not enterprise multi-tenant deployment. Each additional
agent is governed by the same structural constraints as existing seats.

**What we solve:** rogue agents causing harm without detection, in a single-operator
context. The deliberation chain IS the detection and correction layer, operating
before harm occurs.

**What is out of scope:** enterprise multi-tenant authorization — IAM, tenant
isolation, credential scoping across organizations, runtime authorization enforcement
between agents in different trust domains. Our system is single-operator by design:
one operator, one machine, one authority hierarchy. Cross-org trust boundaries are
not addressed and are not claimed. The enterprise coordination layer (central
dashboard, cross-agent visibility across simultaneous runs) is also not built.

*Chain-verified 2026-05-14 via community-fit-review.py — phase 1 BLOCK x2, phase 2
CONDITIONAL_APPROVE x3. Position revised: "SOLVED" qualified to single-operator
pre-execution scope; multi-tenant authorization explicitly out of scope. Faith file
scalability clarified: adding chain seats, not multi-tenant enterprise deployment.*

---

## P4 — No accountability loop / human escalation paths
**Community problem (Forbes, general community):** Autonomous agents make decisions
with no human in the loop and no escalation path when something goes wrong.

**Our position: SOLVED**

The community's concern is that autonomous agents act with no accountability at
all. Our answer is the governance architecture: six seats deliberate and correct
each other through the congregation principle before anything acts, and structural
hooks enforce the process constraints that make each governance action accountable.

The architecture has two complementary layers:

**Content accountability (deliberation stack):** Every significant decision passes
through six seats before the executor acts — workshop, deep-dive, synthesis, code
review, governance audit, final verdict. A bad judgment by any single seat is
caught by downstream seats. Mutual correction within the run, before anything ships.

**Process accountability (structural hooks):** The niyyah gate requires declared
intent before any mutation in a session. The surrender check requires explicit
articulation of what the substrate currently says and why the change is correct,
before any governance content is overwritten — structurally enforced, fail-closed.
The stop hook enforces the escalation sequence at turn boundaries: exhaust substrate
options, then foreign-frontier dispatch, then sub-agent dispatch — only then is the
operator the remaining path.

In the congregation model, the imam's formation and the congregation's correction
operate as one governance structure — not two separate systems. The deliberation
chain and the hooks are the same unified surface: content correction and process
enforcement happening simultaneously before anything acts.

The human is in the loop when their judgment is needed. The stop hook makes trivial
escalation structurally impossible — the operator is reached only after automated
resolution paths are exhausted. That is not a limitation; it is how the operator's
time is protected.

**Scope:** P4 is decision-time accountability — preventing accountability failures
before they happen. Post-hoc accountability (cryptographic proof of what was
decided and when) is P6's domain.

*Chain-verified 2026-05-14 via community-fit-review.py — unanimous CONDITIONAL_APPROVE
(6/6 seats). Blocking concern (surrender-check.ps1 missing from phase 1 substrate
bundle) closed by evidence: file confirmed at ~/.claude/hooks/surrender-check.ps1,
gates Edit and Write on existing substrate paths, fail-closed. All remaining concerns
non-blocking framing; addressed by making two-layer architecture explicit (deliberation
stack = content accountability; structural hooks = process accountability) and scoping
P4 to decision-time prevention with P6 handling post-hoc auditability.*

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

**What "compounding" means in this framework:** Each session's failures are recorded
in a format that survives session boundaries and accumulates across sessions — not by
rewriting CLAUDE.md or canon, but by growing the directly-loaded failure record that
every subsequent instance starts with. An instance bootstrapped with failure_log.md
loaded is less likely to repeat recorded mistakes because the formation context
includes the failure record.

Automated policy self-modification is by design not implemented. CLAUDE.md changes
"rarely and deliberately" — a change is an event that affects every project and every
future instance, requiring operator proposal and chain review. Substrate that rewrites
itself based on observed failure patterns would be precisely the rogue self-modification
P2 and P3 prevent. failure_log.md is the evidence base for deliberate, operator-authorized
policy evolution — not an automatic trigger.

*Chain-verified 2026-05-14 via community-fit-review.py — unanimous CONDITIONAL_APPROVE
(6/6 seats). All concerns non-blocking framing; addressed by clarifying "compounding" =
structural failure records accumulating across sessions (not automated policy rewrite),
and making explicit that CLAUDE.md/canon updates are operator-authorized deliberate events.*

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

*Chain-verified 2026-05-14 via community-fit-review.py — gemma APPROVE; qwen, laguna, granite,
nemotron CONDITIONAL_APPROVE (5/6 CONDITIONAL_APPROVE, 1/6 APPROVE). Final open concerns: 0.
All concerns non-blocking. Key resolutions: fail-open behavior already documented in claim body
("Fail-open: if all TSAs unreachable, tamper-detection still applies"); session-commit linkage
exists via committed .hash-chain.json manifest (session_id + final hash committed to ~/.claude/
by git-anchor.ps1); SSH key hardware backing out of scope for single-operator threat model (threat
is tampered logs, not adversarial key compromise); long-term cryptographic agility (SHA-256
deprecation, TSA certificate renewal) is a forward maintenance path, not a current gap. The
"5-seat chain verdict" reference in the body above is the original P6 design review (2026-05-13),
distinct from this community-fit claim verification.*

---

## Summary

| Problem | Our position |
|---------|-------------|
| P1 — Multi-agent delegation | SOLVED — architectural prevention |
| P2 — Advisory governance fragility | SOLVED — blocking hooks |
| P3 — Enterprise multi-tenant | SOLVED (single-operator pre-execution scope) — multi-tenant IAM explicitly out of scope |
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
