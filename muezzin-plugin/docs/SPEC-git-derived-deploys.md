# SPEC — Make deploys git-derived, and make missions reap their own branches

**Filed 2026-07-25.** Operator asked for "the SOTA real answer not a bandaid" after a stale duplicate
checkout kept fooling agents. The checkout was a symptom. This spec names the disease and the fix.

## Diagnosis (all figures measured 2026-07-25)

- **289 remote branches / 283 local** on `nxtlvlyt/muddytires-pages`; **189 unmerged**; 8 are literal
  `_dryrun_*` / `_drytest_*` test branches. 60 already-merged local branches reaped this session
  (283 -> 223; safety tag `pre-branch-reap-2026-07-25`, manifest in scratchpad).
- **Cloudflare Pages has NO production-branch pin.** Deploys run `wrangler pages deploy .` — it uploads
  **whatever bytes are in the working directory**, with no relationship to git at all.
- Two local checkouts of the same remote existed: `mt-integration-2026-06-22` (main, canonical, 85 nav
  pages) and `muddytires-pages` (`d1-standup`, HEAD 3ad5ddd, last commit 2026-06-23, 84 pages). The
  entire divergence is ONE stale chore commit (workers.dev domain rename).

**THE DISEASE:** git state is *decorative*. Production truth is "whatever folder someone last uploaded
from." Two consequences, both observed this session:
1. **"Is X live?" is unanswerable without fetching the live site.** The aurora fix a612642 WAS live while
   `last-deployed.json` said 5e208477 and the daemon reported "3 commits not deployed."
2. **Agents measure the wrong tree.** Replay-control graders repeatedly analysed the month-stale
   `d1-standup` checkout and produced 84-vs-85 discrepancies that looked like counting errors.

The `--record-deploy` marker (fixed earlier today) is a BANDAID ON THIS — it verifies after the fact that
live bytes match HEAD, instead of making it impossible for them to differ.

## The fix, in dependency order

### 1. DEPLOYS BECOME GIT-DERIVED (the one that actually matters)
Deploy must take a **sha**, not a directory. Either:
- **(a) preferred, zero-custom-code:** connect the Pages project to the GitHub repo with production
  branch = `main`. Pushing to main IS the deploy; "what's live" is always a commit. Cloudflare records
  the deployment sha itself, so `last-deployed.json` becomes a mirror, not a source of truth.
- **(b) if direct-upload must stay:** the deploy wrapper refuses unless the tree is clean AND HEAD is
  pushed to origin, then deploys from a fresh `git archive`/temp clone of that sha — never from a
  developer/agent working directory. Record the sha as part of the same command, not a separate step.
Either way the invariant is: **there is no way to ship bytes that do not correspond to a pushed commit.**

### 2. MISSION = MERGED + BRANCH REAPED
A mission is not DONE until its branch is merged to `main` and deleted. Enforce in the engine (the same
place mission-lint already gates format). Rationale: 189 unmerged branches is not an accident, it is the
absence of this condition — the engine creates a branch per mission and nothing ever closes the loop.
Regrowth is guaranteed without it, so reaping without this step is pure bandaid.

### 3. ONE CLONE
Delete `C:\Users\marka\code\muddytires-pages` after cherry-picking its single unique commit (3ad5ddd,
the workers.dev rename) if still wanted. If two branches must ever be checked out at once, use
`git worktree add` — shared object store, structurally cannot drift.

### 4. BULK TRIAGE THE 189 (hygiene, do last)
Tag-then-delete so nothing is lost: `git tag archive/<branch> <sha>` for each, push tags, delete
branches. Most are abandoned mission attempts. The 8 `_dryrun_*` branches delete outright — the engine
should also stop creating them as real branches (use a temp worktree instead).

## STEP 0 — DONE 2026-07-25 (was a precondition nobody had spotted)

`master` was the GitHub **default branch** while sitting **70 commits behind `main` with 0 unique
commits**. Anyone opening the repo saw a month-stale tree, and wiring Pages to the repo (item 1) would
have defaulted to `master` and shipped a June site. agy's `last-deployed.json` was pinned to exactly
that stale head (`295fd9a1`, 2026-07-18) — the same root.

Fixed (operator-authorised, done via `gh` API + git, not a browser):
- `gh api -X PATCH repos/nxtlvlyt/muddytires-pages -f default_branch=main` -> verified `master` -> `main`.
- `git push github main:master` -> `295fd9a..994c07e`, a pure FAST-FORWARD (verified 0 unique commits on
  master first, so nothing could be lost; not a force push). Both refs now at `994c07e`.
This also genuinely resolves the daemon's standing L3 "main and master DIVERGED by 70 commit(s)" alarm —
it was never a true divergence, just staleness with zero conflicting work.

**Item 1 is now safe to execute.**

## Why this order

1 fixes correctness (production is knowable). 2 stops regrowth. 3 and 4 are cleanup that only stays clean
once 2 exists. Doing 4 first — the tempting move — buys a tidy branch list that refills within a month.

## Execution note (why this is a spec, not an armed mission)

A mission FILE dropped in `missions/` is auto-queued and fired by the daemon. Item 1 rewrites the DEPLOY
PATH of a live production site; that must not fire unattended from a long session. Execute deliberately,
with the existing guard chain (clean tree, e2e exit 0, parity byte-match, witnessed marker) intact
throughout the change.

source: C:\Users\marka\code\mt-integration-2026-06-22 (git forensics 2026-07-25)
source: C:\Users\marka\.claude\muezzin-plugin\conduct-cycle.mjs (--record-deploy, L1716-1747)
source: C:\Users\marka\.claude\muezzin-plugin\missions\_logs\last-deployed.json
