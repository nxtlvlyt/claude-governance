# REQUIREMENTS REGISTRY — muddytires (the requirement→mission→landed map)

Purpose: the missing traceability. A requested/learned requirement can silently lack a
mission (Amazon-pickup, aimlapi assist did); or have a mission that FAILED / false-DONE'd
(poi-tags); or land partially. The doneness gate (`computeDoneness`) checks mission→landed;
THIS registry checks requirement→mission. Together they answer "is it actually done e2e."

Status legend: DONE (landed in deployable tree + verified) · PARTIAL (some landed, gap named)
· NOT-DONE (mission exists, not landed) · **NO-MISSION** (requirement never became a mission)
· LEARN-ONLY (scanned/analyzed but never turned into a muddytires feature).

Verified 2026-07-02 (code + git + mission receipts + doneness patch-id scan). Not asserted from memory.

## A. User-facing feature complaints (operator-named)

| # | Requirement | Mission(s) | Status | Gap / evidence |
|---|---|---|---|---|
| A1 | POI/roadside info richness (oddities, roadsides had no useful info) | poi-tags, poi-services-nearby, poi-hover-preview-cards | **PARTIAL (shipped)** | FIXED + DEPLOYED 2026-07-02 (conductor-direct): `roadside_oddity`/`charging`/`locker` `popup()` branches — **live-verified on production muddytires.ca/map** (not just repo). The empty-placeholder complaint is resolved for POIs that carry the data. `locker` branch also ships the Amazon-pickup DISPLAY side (C1). STILL OPEN: poi-tags/poi-services ENRICHMENT (tag/service DATA on POIs) stranded on feature branches. |
| A2 | Layers filter Apply button that minimizes the menu | (inline in map.html, no clean mission) | **DONE** | `map.html:306` `qApply.onclick=panel.style.display='none'` — committed, shippable. |
| A3 | Confirmation media got added to a spot | add-spot-worker (committed), photo-upload-ux (untracked) | **PARTIAL** | Honest toast + per-file strip exist, but `photo-upload-ux.js` is UNTRACKED (deploy-only, mission FAILED on dirty-worktree gate). No image thumbnail preview. |
| A4 | Oversized community-spot images | map.html sizing (committed), CDN proxy (e03d091) | **PARTIAL** | Visual sizing fixed (120/170/150px). CDN resize exists but popup never passes `?w=` → full-res bytes still download. |

## B. Learnings → integration (learn → understand → integrate pipeline)

| # | Learning source | Understood-how-to-apply? | Integration mission | Status | Gap |
|---|---|---|---|---|---|
| B1 | 2boots portal (project scan) | yes (card-2boots) | admin panel (off-mission commits) | **DONE** | admin.html + moderation + operator-TODOs + D1; cites 2boots pattern. |
| B2 | cgsports / nxtlvl / tidaltreasures (project scan) | cards produced | — | **LEARN-ONLY** | Scanned, never applied to muddytires. No feature traces. |
| B3 | Business-context corpus (KB) | yes (corpus-priority-alignment) | fire-bans, admin priority scoring | **DONE** | 95d5879 "P1 from corpus digest"; vanlife-audience cited verbatim. |
| B4 | Internal pattern-card KB query | NO — hallucinated answer | — | **LEARN-ONLY (dud)** | Query returned invented lab tests / wrong domain; shipped nothing. |
| B5 | Competitor analysis | yes (competitor-feature-matrix) | pledge.html table (eabee84) | **PARTIAL** | Matrix + pledge table landed; public `compare.html` mission FAILED, file absent. |

## C. Requested features with NO mission (the silent gaps)

| # | Requirement | Mission | Status | Note |
|---|---|---|---|---|
| C1 | Amazon pickup locations (map layer) | — | **NO-MISSION** | No mission or map-layer code found. Only `guides/amazon-kit-list.html` (affiliate, unrelated). Needs: mission (spec → integrate). |
| C2 | aimlapi Gemma-4 31b add-spot assist | — | **NO-MISSION** | No mission, no add-spot AI code. `oracle/nl-brief.js` is an LLM feature but for Crown-land, not add-spot. Needs: mission (spec → integrate). |

## Rollup (as of 2026-07-02)
- DONE: 3 (A2, B1, B3)
- PARTIAL: 3 (A3, A4, B5)
- NOT-DONE: 1 (A1)
- LEARN-ONLY (never integrated): 2 (B2, B4)
- NO-MISSION (never queued): 2 (C1, C2)

**Answer to "did we get everything and queue it all?": NO.** 3 of 11 tracked items are DONE.
The pipeline leaks at every stage: learn (B4 dud), apply (B2 never applied), queue (C1/C2 no
mission), integrate (A1 false-DONE on feature branches). This registry is the mechanism that
makes those leaks visible instead of silently lost — extend it as new requirements appear, and
gate every "done" claim against BOTH this (requirement→mission) and doneness.json (mission→landed).
