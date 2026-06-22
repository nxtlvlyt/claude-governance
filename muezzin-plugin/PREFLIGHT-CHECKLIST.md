# Muezzin Chain Pre-Flight Checklist (conductor — run before firing into a cold chain)

Purpose: tie the camel to every moving part BEFORE firing missions, so a broken part is caught
proactively (before a mission dies on it), not reactively (after). Derived 2026-06-18 from a full
parallel chain-health audit (workflow muezzin-chain-preflight). This is the mechanical embodiment of
"verify first, fire second" — it must not depend on which instance remembers to do it.

## The 8 checks (each with its GREEN condition)

1. **Board liveness** — `missions/_logs/STATUS-BOARD.md` tail shows a heartbeat within ~5 min and no
   trailing FAILED on the active lane. GREEN: latest firing line is recent AND the most recent seat
   line is `attempt-ok`, not a hang/error.
2. **Ollama idle + present** — `GET http://localhost:11434/api/ps` then `/api/tags`. GREEN: /api/ps
   EMPTY (nothing stuck/held) AND all 5 chain models in tags: nemotron-3-super, laguna-xs.2:q4_K_M,
   granite4.1-guardian:8b, granite4.1:30b, qwen3.6:27b. Re-check /api/ps immediately before ANY local
   dispatch (serial-inference discipline).
3. **Cloud keys + recent 200** — both `OLLAMA_API_KEY` and `OLLAMA_CLOUD_API_KEY` set (len ~57) AND
   the dispatch heartbeat shows an ollama-cloud `attempt-ok` today with NO BUDGET-EXHAUSTED / HTTP_429
   in the last 24h. GREEN: last 429 is stale (>24h).
4. **SearXNG grounded** — `curl 'http://localhost:8080/search?q=test&format=json'` → 200 with
   results>0. GREEN: results >= ~5 (some engines rate-limited is fine; zero = fail-closed HALT).
5. **Mode + architect route** — `~/.claude/state/muezzin-route.json` mode is the intended one
   (currently `reasoning-heavy`) AND the daemon was launched with `MUEZZIN_ARCHITECT_ROUTE=panel`.
   GREEN: route reason matches the operator's latest ruling; panel resolves opus+sonnet+minimax-m3
   (confirm all three fire together in the board).
6. **Worktree branches sane** — frontend-wt on `oracle-frontend-swap`, d1-wt on `d1-standup`,
   `git status` shows no merge/rebase markers (no UU/AA). GREEN: right branch, only expected
   modified/untracked files.
7. **No stray hung commit** — process query for a `laguna-pre-commit` node proc returns EMPTY.
   GREEN: zero matches; if firing manual commits, use `--no-verify` (mission path already does —
   git_steps.mjs:41).
8. **Mission class match** — the mission about to fire is command-class / small-edit (verbatim
   -replace, file-move, deploy), NOT a large model-emit authoring job (renders, large-file edits,
   multi-source cards). GREEN: command-class → fire; model-emit → confirm the authoring path is
   healthy (witness-cap fix is in) or quarantine in `_blocked/`.

## Resolved roster (reasoning-heavy mode, verified seat_modes.mjs 2026-06-18)
- PHASE-1 architects: opus + sonnet + minimax-m3 (cloud)
- integrator / auditor / **per-step witness**: opus  (NOTE: witness is OPUS here, not nemotron —
  nemotron-3-super is only the defaultWitness fallback when no mode resolves it)
- executor: kimi-k2.7-code   |   validator: sonnet
- Launch REQUIRES `MUEZZIN_ARCHITECT_ROUTE=panel` (kimi planner times out without it).

## Known caveats (2026-06-18 audit)
- **Command-class ships reliably; large model-emit authoring is the weak path.** 39 DONE / 70 FAILED
  historically (many FAILED were superseded or false-fail). Fire command-class freely.
- **Witness truncation: FIXED.** orchestrate.mjs:361 cap 12000 -> `MUEZZIN_WITNESS_ARTIFACT_CAP || 48000`.
- **SEARCH_BLIND / groundedness `<score>no</score>`: OPEN + re-diagnosis needed.** Earlier hypothesis
  ("cloud seats can't reach localhost SearXNG") is WRONG — search runs conductor-side
  (seat_dispatch.mjs:393-395); the cloud model never touches localhost. SearXNG IS up (200). The real
  trigger is unknown; do NOT fix on the old hypothesis. See INBOX item (C).

## TODO to make this MECHANICAL (the real upgrade)
This file is the spec. The durable upgrade is a daemon-integrated preflight module that runs these 8
checks at startup / before firing and refuses to fire (or warns) on a non-GREEN, so the verification
is automatic for every instance — not dependent on the conductor remembering. Construct as a mission.
