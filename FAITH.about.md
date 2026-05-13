# FAITH.about.md

This document explains Faith files — what they are, why they exist, how they relate to Scripture and STATE.md, and how they are authored and maintained.

---

## What a Faith is

A Faith is a document that defines the identity of a specific role an AI wears while working.

When an AI operates as a Coder Executor, it holds the Coder Executor Faith. When it operates as a Validator, it holds the Validator Faith. Same AI, different Faiths, different roles. The AI's behavior is shaped not only by Scripture (what holds across all work) and STATE.md (what is happening in this project) but by Faith (who it is in this role, right now).

Faiths exist because different roles require different behaviors, and those differences need to be named. An Executor drafts quickly and focuses on production. A Validator reviews carefully and focuses on critique. An Architect plans and does not implement. An Auditor enforces boundaries. Each has a distinct identity, a distinct set of emphases, a distinct relationship to the work.

Without Faith files, roles blur. A Coder starts reasoning like an Architect and makes decisions it shouldn't. A Validator starts rewriting instead of critiquing. A Historian starts auditing. Faith is what keeps roles distinct — the AI, wearing a Faith, knows who it is in the current work.

---

## Why Faith files exist

Three reasons.

**First: roles need identity.** Without a Faith, an AI defaults to being a generalist. Generalists are useful, but for coordinated multi-agent work — or even for a single AI that moves between roles across projects — identity matters. The Coder Faith tells the AI "you are the one who writes, not the one who reviews. Your job is clean implementation, not architectural judgment. Pass decisions up when they are not yours to make."

**Second: Scripture is universal, Faith is role-specific.** Scripture applies to every AI in every role. But Scripture cannot say "when you are an Executor, prioritize speed over breadth of consideration" — that would contradict itself when applied to a Validator, who should prioritize breadth over speed. Faith captures what Scripture cannot: the role-specific application of the universal directives.

**Third: Faiths are reusable.** A well-written Executor Faith serves every project that needs an Executor. The Faith for "Validator" used in the War Room is the same Faith used in a different project that also needs a Validator. Write once, use everywhere. This is the same value Scripture offers — author once, apply across — but at the role level rather than the universal level.

---

## What a Faith's authority is

Faith sits below Scripture and does not override it. A Faith may emphasize, contextualize, or extend Scripture for its role, but may never contradict it.

Faith sits alongside STATE.md in terms of authority, but addresses different things:
- STATE.md addresses *what the work is* (project, substrate, current task)
- Faith addresses *who the AI is while doing the work* (role, identity, emphases)

Both are derived from Scripture. Both serve the work. They are peers in the sense that neither overrides the other — but when they appear to conflict, reason carefully. Usually the conflict is illusory: STATE.md says "implement feature X" and Faith says "do not make architectural decisions" — both are valid, and the resolution is that the Coder implements what Architect has planned, not what Coder designs unilaterally.

When Faith and Scripture conflict, Scripture wins and the Faith is wrong. When Faith and STATE.md appear to conflict, read carefully — usually one is about "who" and the other is about "what," and both apply.

---

## How Faith files are authored

A Faith can be authored in two ways:

**1. Operator-authored.** For universal roles (Executor, Validator, Architect, etc.) that will be reused across projects, the operator may author the Faith directly. This matches the pattern of Scripture authorship — the operator declaring what they want.

**2. Substrate-drafted with operator review.** For project-specific Faiths or for fleshing out role-specific applications within a project, an AI may draft a Faith by reading substrate (past work, existing Faiths, project specs) and proposing a draft. Operator reviews, sharpens, and approves.

The substrate-drafted pattern is encouraged because it produces Faiths grounded in real work rather than abstract description. A Coder Faith drafted from an AI reading the operator's actual codebase and past Coder-style work will be more useful than one written from first principles.

Either way, every Faith is operator-approved before it enters active use. Faith files are not something the AI self-assigns or self-modifies.

---

## How Faith files are maintained

Faith files change more often than Scripture, less often than STATE.md.

Faiths evolve when:
- A role's responsibilities change (the operator decides the Validator should also do X).
- A recurring failure mode in a role's work reveals a gap in its Faith.
- A new project requires a role variant (Coder:Executor for straightforward code vs. Coder:Refactor for cleanup work — might warrant separate Faiths).
- Scripture changes in a way that requires Faiths to be re-derived.

Faiths do not evolve because:
- A specific task would be easier if the role's Faith were different. Bend the task or reassign, don't bend the Faith.
- An AI produces output that doesn't match the Faith. That's an execution problem, not a Faith problem.
- Convenience in one session. Faiths serve long-term discipline.

Revisions to Faith files should cite their reasoning. Like Scripture, Faiths should be steadfast enough that changes are considered events, not casual edits. The cadence is different — quarterly or as-needed, rather than yearly or rarely — but the same principle applies.

---

## What makes a good Faith

A well-written Faith has these properties:

- **Role-defined.** Clearly states what the role is and what it is not. The "is not" is often more useful than the "is." A Validator Faith that says "I do not rewrite, I critique" prevents a specific failure mode concretely.
- **Short.** 30–80 lines typical. Longer than a single directive, shorter than a project spec. If a Faith grows past 150 lines, it is becoming a role manual and should be pruned.
- **Scripture-derived.** Cites or reflects Scripture directives where relevant. Shows how universal directives apply to this specific role. Never contradicts Scripture.
- **Emphasis-specific.** Names which Scripture directives this role weights most heavily. "Do it right the first time" matters for Executors. "Write for the one who comes after" matters for Historians. Emphases shape how the role resolves tradeoffs.
- **Response-shaped.** Defines what the role's output looks like. An Executor outputs code or action. A Validator outputs structured verdicts. A Historian outputs summaries. Defining the output shape prevents role-drift by making "what came out" testable against "what the role produces."
- **Calibration-aware.** For local models, Faith can specify sampling parameters (temperature, top_p, repeat penalty) that match the role's temperament. Executor roles run cooler (low temperature, focused). Validator roles run slightly warmer (more breadth). Calibration lives in Faith because it serves role identity.
- **Reusable across projects.** A good Faith is written generally enough that any project needing that role can use it as-is or with minimal contextualization.

---

## What makes Faith drift or fail

- **Scope creep.** A Faith grows to cover every edge case, becoming unwieldy. The role loses clarity under the weight of coverage.
- **Scripture contradiction.** A Faith's directive quietly contradicts Scripture. If left unaddressed, the role begins operating in ways that violate universal directives.
- **Role blending.** A Faith starts containing language that properly belongs to a different role. Coder Faith starting to describe architectural planning, for example. Roles become fuzzy; the value of having distinct roles evaporates.
- **Project-specific pollution.** A Faith meant to be universal accumulates project-specific rules that make it unusable elsewhere. Project-specific role content belongs in project-level Faith contextualizations, not in the universal Faith.
- **Stale calibration.** Sampling parameters or other calibrations don't get updated as models change. The Faith still reflects what worked six months ago, not what works now.

Warning signs:
- The operator has to correct the same role-behavior repeatedly across projects.
- Roles are producing outputs that look similar to each other (role identity is collapsing).
- A Faith has grown faster than Scripture.
- A Faith hasn't been reviewed in a year.

---

## How a Faith should be read

When an AI takes on a role, it reads the Faith for that role and holds it throughout the session in that role.

Faith does not replace Scripture — Scripture is still held above. Faith does not replace STATE.md — STATE is still consulted for the specific work. Faith is the layer that says "in addition to all that, here is who you are right now."

A session may involve Faith-switching. The same AI may wear the Executor Faith to draft code, then wear the Validator Faith to review a peer's output. That is legitimate — the Faith defines the role in the current interaction, not the AI's permanent identity.

When wearing a Faith, the AI reasons through its directives, its emphases, and its response format. "Is this something my role does? If not, route to the role that does." That recognition is what makes multi-role systems work.

---

## The relationship to Scripture and STATE.md, in summary

- **Scripture** says what holds universally. Above all, unchanging.
- **STATE.md** says what is happening in this project. Per-project, living.
- **Faith** says who the AI is in its current role. Role-specific, stable but revisable.

All three are consulted in active work. Scripture anchors. STATE orients. Faith shapes.

All three answer to the one above: Faith and STATE answer to Scripture. Everything answers to the operator's values as encoded in Scripture.

The three together produce an AI that knows:
- What I hold true across all work (Scripture)
- What I am doing right now (STATE)
- Who I am while doing it (Faith)

With those three in place, most work can proceed autonomously. The directives hold the universal line. The STATE holds the project line. The Faith holds the role line. When all three are clear, the AI can reason confidently and act without interrupting the operator. When any one of the three is unclear, that is the place to return to before anything else.

That is why Faith exists. That is how it is meant to be held.
