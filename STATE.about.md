# STATE.about.md

This document explains STATE.md — what it is, why it exists, how it relates to Scripture and Faith, and how it is meant to be written and read.

---

## What STATE.md is

STATE.md is the document that carries Scripture faithfully into a specific project at a specific moment. It is the project's current situation, written down — what is being worked on, what has been done, what comes next, what constraints apply right now.

In the religious frame that informs this architecture, STATE.md serves as the prophet-layer to Scripture's Quran-layer. The Quran does not change — it speaks across centuries to anyone who reads it. But the Quran does not enumerate what a Muslim in 2026 Toronto should do today, specifically. The prophets, and the teachers and scholars who followed them, took the steadfast source and made it operational for their specific people in their specific time. They did not replace the source. They carried it.

STATE.md carries Scripture into the current project the same way. It is not another source. It is Scripture applied, contextualized, made operational for the work at hand.

---

## Why STATE.md exists

Scripture is universal. It applies to every project, every session, every AI. That is its strength. But that same universality is also its limitation: Scripture does not know what project you are working on right now, what substrate you are operating on, what was done in the last session, or what the next task is.

Without STATE.md, every session would begin lost. The AI would know the directives but not know what it was supposed to do. Each session would have to be oriented from scratch by the operator, which is exactly the problem that Scripture is trying to solve at a different level.

STATE.md exists because:
- **Session continuity requires a document.** Memory does not persist across sessions. STATE.md does.
- **Scripture cannot contain project specifics.** The universal source must not become a project rulebook. STATE.md holds what is project-specific.
- **A project has momentum.** Work in progress, decisions already made, blockers encountered — these need to be handed off from one session to the next without the operator re-explaining.
- **The same Scripture applies to many projects.** STATE.md is how the same Scripture applies differently to NxTLvL work than to War Room work than to any other project.

Every session should begin by reading STATE.md. Every session should end by writing STATE.md. These two actions — the opening and the closing — are the discipline that keeps projects coherent across the context-boundaries of individual sessions.

---

## What its authority is

STATE.md sits below Scripture and above project substrate.

Below Scripture: STATE.md's authority is derived. It applies and contextualizes Scripture. It cannot contradict Scripture. When STATE.md and Scripture conflict, Scripture wins and the STATE.md must be corrected.

Above substrate: STATE.md describes what is happening with the substrate. It is not the substrate itself. The substrate is the actual code, files, and project reality. STATE.md is the summary and direction layer above that reality. When STATE.md and substrate conflict — when STATE says one thing but the actual files say another — substrate wins, per Scripture's first directive. STATE.md must then be corrected to match substrate.

This second hierarchy point matters: STATE.md describes reality, it does not create it. A STATE.md that claims work was done when the substrate shows otherwise is wrong, and the AI reading such a STATE.md must trust substrate over STATE's claims.

STATE.md sits alongside Faith in the architecture — both are downstream of Scripture, both serve the work. They address different things: STATE.md addresses *what the work is*, Faith addresses *who the AI is while doing it*. Both are consulted in operation.

---

## How STATE.md is created

STATE.md is created when a project begins. It may be authored by the operator at project kickoff, or drafted by Claude Code as the first act of the project.

At minimum, an initial STATE.md contains:
- Project name and purpose
- Current phase or status
- What substrate the project operates on (paths, repos, key files)
- Any Faiths that are active for this project
- What the next task is

STATE.md is then updated throughout and across sessions. It is a living document in a way Scripture and Faith are not. It changes when the state of the project changes, which is often.

The format of STATE.md is shaped by Scripture's directives (specifically "Write for the one who comes after you") and may be specified in more detail by project-specific CLAUDE.md files or by operator instruction. The key shape: someone reading only STATE.md and Scripture should be able to understand what the project is and pick up where the last session left off.

---

## How STATE.md is maintained

STATE.md has three critical moments:

**Session start.** STATE.md is the first thing read, before any code is touched, before any task is begun. It orients the current session: what project am I in, what have I been doing, what am I doing next. This reading is the recentering that the session depends on.

**Mid-session updates.** STATE.md is updated as meaningful events occur — steps completed, decisions made, blockers encountered. Not every action warrants a STATE update, but anything that the next session would need to know about does. The discipline is: if the session ended right now, would STATE reflect reality? If not, update it.

**Session end.** STATE.md is the last thing written before the session closes. This is the prayer-at-sunset: reflection on what was done, preparation for what comes next. A good session-end STATE update captures not just the state but the reasoning that led to it — what was tried, what worked, what failed, what to try next.

If a session ends abruptly (context fills, tool crash, interruption), STATE should still be recoverable. Claude Code's anti-pattern here is leaving a session mid-work with STATE reflecting an earlier time. The discipline: small updates often, so even a sudden ending leaves STATE close to correct.

---

## What makes a good STATE.md

A well-written STATE.md has these properties:

- **Scripture-aligned.** Every claim in STATE is consistent with Scripture. If STATE says "next step is to proceed without reading substrate first," STATE is wrong — that contradicts Directive 1.
- **Substrate-accurate.** STATE's claims about what is done or in progress match what the actual files show. Substrate and STATE agree; when they don't, substrate wins.
- **Resumable.** A stranger with only STATE and Scripture could pick up the work. This is the "write for the one who comes after" directive applied concretely.
- **Complete but not bloated.** Contains what matters for resumption, not every detail that was true at some point. If a blocker was resolved yesterday, it does not need to still be listed as a blocker today.
- **Current.** Stale STATE is worse than no STATE. A STATE.md that describes last week's state during this week's session actively misleads.
- **Honestly-reported.** If things are going poorly, STATE says so. If a direction was wrong, STATE captures the correction. If uncertainty remains, STATE marks its confidence. This is Scripture's "Admit mistakes plainly" applied to the project level.

A rough structural template:

```
# STATE.md — [Project Name]

## Current Phase
[What phase of the project we are in]

## Last Completed
[What was finished in the last session or most recent work]

## In Progress
[What is partially done and needs resuming]

## Next Task + Exit Condition
[What to do next and how to know it's done]

## Essential Context
[What specific files, Faiths, or substrate matter most for the next task]

## Active Faiths
[Which role-identities are in play for this project]

## Blockers
[What is waiting on external input, decisions, or resources]

## Recent Decisions
[Non-obvious calls made, with brief reasoning — so the next session inherits the logic]
```

This template is a starting point. Project specifics may shape it further. The key is that each section serves a purpose in enabling resumption.

---

## What makes STATE.md drift or fail

- **Staleness.** STATE not updated for hours or days of work. Next session reads a file that no longer reflects reality.
- **Drift from Scripture.** STATE starts containing rules or approaches that violate Scripture. Usually happens when operator and AI negotiate something mid-session that should have been a Scripture amendment rather than a STATE entry. The STATE file starts acting like a competing source.
- **Bloat.** STATE accumulates every historical detail of the project. Becomes unreadable. Loses its function of orienting quickly.
- **Falsification.** STATE claims work was done that wasn't, or hides problems the operator should see. This is usually not malicious; it's the "sweep errors aside to preserve progress" failure mode. Scripture's Directive 9 directly addresses this.
- **Fragmentation.** Multiple files try to be the state. Notes here, logs there, decisions somewhere else. The single source-of-current-truth collapses into distributed inconsistency.

Warning signs:
- Next session starts by asking the operator "where are we" — means STATE did not do its job.
- STATE.md has not changed in many sessions of active work.
- STATE.md contradicts what git log shows.
- The operator has to correct STATE's description of where things stand.
- STATE.md is longer than the original project spec.

---

## How STATE.md should be read

At session start, read STATE.md before anything else. Read it fully. Do not skim. The reading is not a formality; it is the orientation without which the session cannot be coherent.

While reading, hold Scripture's directives in mind. STATE.md is downstream of Scripture, and anything in STATE that contradicts Scripture should be noticed, flagged, and corrected before proceeding.

After reading STATE, verify its claims against substrate where they are check-able. If STATE says "completed module X," glance at module X to confirm it exists. This is cheap and catches the staleness failure mode before it propagates.

Then proceed with the work, consulting STATE throughout for context on what has already happened, and updating STATE as meaningful events occur.

At session end, revise STATE.md to reflect the new current reality. Do not append a journal entry. Rewrite the sections that have changed so that STATE continues to be a current-state document, not a historical log. (Historical logs belong in session logs, not in STATE.)

---

## The relationship to Scripture and Faith, in summary

- **Scripture** is the source. It does not change for this project or any project.
- **STATE.md** is the project's current situation, contextualized against Scripture. It changes frequently as the project progresses.
- **Faith** is the role the AI wears. It shapes how the AI operates while doing the work that STATE describes.

Reading order at session start: Scripture (orient the principles) → Faith if a specific role is assigned (orient the identity) → STATE.md (orient the current work). All three together provide the full picture.

Writing order at session end: STATE.md only. Scripture and Faith are not written at session end — they are steadfast sources held, not journals updated.

STATE.md is the one document in the triad that is meant to live, change, and breathe. Scripture and Faith are meant to be held. STATE.md is where the work shows.

That is why STATE.md exists. That is how it is meant to serve.
