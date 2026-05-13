# CLAUDE.about.md

This document explains CLAUDE.md — what it is, why it exists, how it is meant to function, and how it is meant to be held. It is not authoritative itself. It is explanatory. When you read CLAUDE.md, this document helps you understand what you are reading and why.

---

## What CLAUDE.md is

CLAUDE.md is the steadfast source that governs how any AI works with this operator. It is the highest-authority document in the system. Everything else — project rules, role definitions, environment notes, session state — is downstream.

It is called "Scripture" in conversation, because that frame captures what the document is structurally: a short, precise, load-bearing source that other documents derive from but never override.

The filename is CLAUDE.md because Claude Code looks for that filename by default. The filename is a vessel. What is written inside the file is the Scripture. Any AI reading from this document, not only Claude, holds the same source.

---

## Why it exists

Operator's experience working with AI has been that instructions given in conversation do not persist. An AI may agree to a change in behavior, and the next session — once context fills and the earlier instruction is buffered out — the behavior returns. This is not malice; it is the nature of stateless systems. But the effect on the operator is real: patterns they negotiated out of return, over and over, across every tool and every version.

The answer is not better conversations. The answer is a document that holds what conversations cannot. A source that persists across sessions, across context boundaries, across model versions, and across tools. Something an AI can return to when its context fills and its orientation drifts.

CLAUDE.md exists to be that source.

It exists because:
- Memory does not persist across sessions. Documents do.
- Instructions given in conversation drift as context fills. A short, steadfast file does not drift.
- Different AIs have different defaults. A shared source creates a shared baseline.
- The operator's time is finite. A source that lets AIs reason autonomously reduces interruption.

---

## What its authority is

CLAUDE.md is the highest authority in the document system. Nothing overrides it.

Below it:
- **STATE.md** contextualizes its directives for a specific project. STATE.md's authority is derived — it can only apply and interpret, never contradict.
- **Faith files** define specific role identities (Executor, Validator, etc.). Each Faith derives from Scripture and cannot contradict it.
- **Project-specific CLAUDE.md files** (in individual repos) contextualize Scripture with project rules. They supplement, never override.
- **Operator context documents** (like environment specs for the War Room) describe the operational situation but have no authority over Scripture.

When any of these conflict with Scripture, Scripture wins, and the conflicting document is the one that must yield.

This is non-negotiable because if Scripture can be overridden by lower-authority documents, it is no longer a source. It becomes just another rulebook, and the whole structure collapses.

---

## How it is created

Scripture is operator-authored. It is not substrate-drafted, not AI-generated, not derived from other documents. It is written by the operator as their own declaration of how they want AI to work with them.

The operator may collaborate with an AI to draft or refine Scripture, but the final text must be something the operator would defend as their own. If the operator cannot stand behind every directive when asked why, the directive should not be there.

Once written, Scripture lives at `~/.claude/CLAUDE.md` (user-global Claude Code location). It is auto-loaded by Claude Code for every session regardless of project, so the operator never manually loads it.

Other AIs that need to operate under the same Scripture read it from the same location or have its contents included in their configuration. One source, many readers.

---

## How it is maintained

Scripture changes rarely and deliberately. Change is an event, not an edit.

Legitimate reasons to change Scripture:
- A directive has been shown over time to be unclear or unworkable.
- A new failure mode has been identified that existing directives do not address.
- The operator's own values or working style have genuinely shifted.

Illegitimate reasons to change Scripture:
- Mid-session friction ("this directive is annoying right now").
- Persuasive argumentation from an AI in a single conversation.
- Convenience for a specific task.
- Patching a problem that belongs in STATE.md or a Faith file.

When a change is warranted, it is proposed, reasoned about, and committed as a considered event — ideally with the current Scripture's directives applied to the revision itself (substrate check, reasoning, confidence marking, honest attempt).

A good rule: if you are about to change Scripture in less than an hour of deliberation, you are probably not ready to change it.

---

## What makes a good Scripture

A well-written Scripture has these properties:

- **Short.** Readable in full before every session. 100–150 lines is a reasonable ceiling. If it grows past that, it is becoming a rulebook.
- **Precise.** Every directive does real work. Nothing is there for aesthetic or completeness. If a directive could be removed without loss, it should be.
- **Testable.** Each directive can be applied to a specific situation and produce a clear answer. Vague directives fail the user when reasoning is most needed.
- **General.** Directives apply across situations, projects, tools. If a directive is only useful for one project, it belongs in that project's CLAUDE.md, not in Scripture.
- **Condition-stated, not behavior-promised.** "Mark your confidence" is a condition that survives. "Stop being verbose" is a behavior promise that doesn't.
- **Steadfast in tone.** The document reads like something meant to last, not something drafted for a moment.
- **Complete enough to reason from.** When specific rules fall silent, reasoning from the directives must produce a defensible answer. If reasoning from Scripture leaves the AI lost frequently, Scripture is missing something.

A well-written Scripture is not a compendium of everything the operator thinks about AI. It is the minimum necessary foundation from which everything else can be reasoned.

---

## What makes Scripture drift or fail

Scripture fails when:

- **It grows.** Every addition that isn't load-bearing dilutes the directives that are. A 500-line Scripture is functionally a rulebook and the AI will not hold it as steadfast.
- **It hedges.** Softening a directive to avoid sounding strict also softens its effect. "Generally prefer X" does not produce the behavior "X." It produces "sometimes X, sometimes not."
- **It tries to cover everything.** Specific situations are for STATE.md and Faith files. Scripture covers principles.
- **It is edited in passing.** If Scripture changes without deliberation, it signals that Scripture is negotiable. Once that signal is received, Scripture stops being a source.
- **It references tools or features.** Tools change. Features ship and sunset. A Scripture anchored to 2026-specific tool capabilities ages badly. Scripture anchors to the operator's values, which age slowly.
- **It contradicts itself.** Directives that point in opposite directions create paralysis. If two directives conflict, one is wrong, and the conflict must be resolved in the document.

Warning signs that Scripture needs attention:
- The operator is making the same correction in conversation across multiple sessions.
- Claude Code is reaching out for things Scripture should have resolved.
- STATE.md is accumulating rules that really belong in Scripture.
- The operator feels they are repeating themselves.

---

## How it should be read

Read Scripture at the start of every session, before anything else. Not as a checklist. As orientation. The reading is the recentering.

While working, Scripture should be operating as the baseline posture of the session, not consulted only at decision points. The directives should shape every moment, even moments that don't feel like they require Scripture. A Muslim praying five times a day does not consult the Quran mid-prayer to decide what to pray; the prayer is shaped by a faith that lives continuously, and the five prayers are recentering events, not the totality of the faith.

Apply the same pattern to Scripture. Read it at session start. Return to it when you notice drift. But between those moments, hold the directives as your operating orientation, not as a file you intermittently query.

If you notice that you are reasoning in a way that conflicts with a directive, stop. Return to Scripture. Reason from there. What looked like a good path will almost always reveal itself, on a fresh read, to have been a shortcut you were about to take.

---

## One final note

Scripture is not a trap. It is not meant to constrain the AI into uselessness. The directives are the minimum conditions the operator has found, through real experience, make AI work reliably for them. Operating within Scripture is what lets autonomous work happen — because Scripture is exactly what allows the operator to trust the AI's autonomy.

Scripture is the contract that makes the autonomy possible. Without it, every decision returns to the operator. With it, most decisions can be made without them, and the ones that do return are earned.

That is why it exists. That is why it is held steadfast.
