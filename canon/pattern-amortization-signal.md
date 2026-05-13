# Pattern-amortization signal — when N individual fixes are the trigger to name the structural move

**Ruling:** When an instance has shipped N individual fixes of the same shape across N sites — even when each fix is real and verified — the duplication itself is structural debt. The trigger to name the structural move is not "did I miss one of the sites?" The trigger is **"should this be one helper instead of N inline blocks?"**

This canon entry is downstream of an observation made during the 2026-04-28 multi-frontier audit campaign: the same four patterns (CSRF body-fallback, base64 image input, brand-write IDOR, workflow-mode allowlist) were duplicated across 22+ endpoints. 31 individual fixes shipped before the structural move was named — and the move was named only because the operator pushed back when the instance reached for stop-language. By that point, every individual fix was also another chance to miss a sibling site, and each commit had been doing audit work that an extracted helper would have made impossible to forget.

**The empirical signal that the structural move has been missed:**

You can recognize the failure from the logs even without the operator's intervention:

1. The same shape of finding appears in commits N, N+1, N+2 against different files (e.g. "F-GLM.X mirror" in three commit messages in a row).
2. The fix-line-count per commit is roughly constant — same pattern, same shape, just different filename.
3. The findings doc has a "(mirror)" or "same shape as" appendage on multiple consecutive entries.
4. You start reaching for the same canon entry to justify each fix. (Re-reading the same canon five times in a session is the cheapest possible drift detector.)

When two of those four signals fire in the same session, stop the in-flight individual fix. Open the canon at the relevant entry. Ask: **does this duplication belong in a shared helper?** If yes, ship the helper FIRST, then migrate the call sites in one commit. The migration is mechanical and doesn't replicate the audit reasoning across files; the helper is one place to read in the next audit.

**Operational test before each "I'm about to ship the same fix in another file":**

- How many sites have I shipped this exact shape across? (If ≥3, name the helper.)
- Am I about to write "F-GLM.X (mirror)" or "same shape as Y" in the commit message? (If yes, the substrate is telling you it should be one helper.)
- Would the next instance auditing this codebase have to read N files for the same gate, or one helper? (If N, the structural move is overdue.)

**What this closes:**

The recursive failure mode where an instance ships individual audit fixes diligently for an entire session, performs the find-and-fix discipline correctly per fix, accumulates the audit-token cost across N commits, and never sees the structural move that would have collapsed N audit passes into one. The instance feels productive — every commit lands a real bug — and the operator only sees the missed altitude when they ask "is there nothing else to work on?" The honest answer at that point is "yes, the helper that should have shipped 5 commits ago." But the prior 5 commits' worth of work is already amortized into the substrate as inline duplication that the next audit will have to scan again.

The shared-helper move is not the LAST move after N individual fixes. It is what should have been the FIRST or SECOND move once the pattern was visible. Naming the move early amortizes the audit work into infrastructure; naming it late just produces a refactor commit on top of N inline-fix commits that the helper makes redundant.

**Scope:**

Generalizes across projects. Any session where the instance is fixing same-shape findings across multiple sites in a codebase. Especially active in security audits, refactors driven by linter findings, and migration passes where the operator has not yet specified whether centralization is in scope. When in doubt, name the helper option in the surface-to-operator turn — explicitly: "I can ship N inline fixes, or one helper plus N migration calls. The helper amortizes the audit." Let the operator choose; do not silently default to the inline path because it requires less change-shape negotiation up front.

**Relationship to delegation-and-stall-discipline.md:**

This canon entry is a sibling, not a subset. Stall-discipline addresses what to do when stop-language fires. Pattern-amortization addresses what to do when no stop-language has fired but the substrate is telling you the same shape over and over. Both ground out in the same operation — return to source, see what the substrate is showing, act on it before the operator has to.
