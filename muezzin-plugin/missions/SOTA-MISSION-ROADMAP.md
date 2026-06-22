# MUDDYTIRES → SOTA — MISSION ROADMAP (2026-06-16)

Grounded in COMPETITOR-MASTER.md (12/12 verified) + this session's hard execution evidence.

## THE ORGANIZING INSIGHT
Sequence missions by **what the engine can actually execute**, because the SOTA moat happens to be the executable part:
- **Engine RELIABLE at:** command/verify, data-ingestion, Worker-backend, small-doc missions (proven: healthcheck APPROVE, card-* DONE, D1 4000-POI load).
- **Engine NOT reliable at:** large-file (378KB index.html) frontend edits — failed 3× (declutter ×2, plus the empty-emission/executor-fallback gremlins).
- **The differentiator (Crown-land legality Oracle) is BACKEND/DATA** → it's exactly what the engine CAN build now.
→ Front-load the Oracle moat via reliable data/Worker missions; gate the frontend last-mile on fixing the engine-edit foundation.

## PHASE 1 — THE ORACLE MOAT (executable NOW; the SOTA differentiator) — Ontario-first
Data/command/Worker missions, the proven shape. Start in Ontario where CLUPA open data is cleanest.
- **M1.1 Ingest Ontario Crown-land legality** → D1. CONFIRMED SOURCE (SearXNG 2026-06-16): Ontario GeoHub "Crown land use
  policy area (provincial)" — geohub.lio.gov.on.ca/datasets/lio::crown-land-use-policy-area-provincial — exports GeoJSON +
  ArcGIS REST API (mirrors: data.ontario.ca, open.canada.ca b2232809). Carries policy designations (provincial parks,
  conservation reserves, crown-land MNR unpatented, CLUPA geometry). CAVEAT: province-wide polygons are LARGE and D1 isn't
  spatial — M1.1 must also solve point-in-polygon (pre-tile / bbox-index / simplify, or geometry in R2 + attrs in D1). This
  is a real data-engineering mission (backend = engine's better zone), NOT a trivial command mission. (data-ingest mission)
- **M1.2 Ingest federal Crown land + fire feeds** → D1/staging. Sources: open.canada.ca Federal Crown Land; CWFIS m3 / NASA VIIRS fire (Cron Worker). (data-ingest mission)
- **M1.3 Oracle Worker legality compute** — extend oracle-d1.js: lat/lng → sourced answer {crown? recreation-permitted (CLUPA)? stay-limit? live fire-ban? nearest water/dump}. Deterministic, every field source-tagged. (Worker-backend mission)
- **M1.4 Magic-moment proof** — positive-assertion verify the Oracle on real Ontario points (the "can I legally camp here? YES — sourced" demo). (command/verify mission — the healthcheck shape that WORKS)

## PHASE 0 — FOUNDATION (parallel to Phase 1; unblocks the frontend) — engine-reliability
- **M0.1 Make index.html editable** — EITHER split the 378KB monolith into modules the engine can edit, OR land the windowed-edit hard-cap + executor local-fallback fix (qwen3-coder-next 404 → an installed local coder). This is the gate for ALL frontend work.
- **M0.2 Finish the .php→Workers migration** — the LIVE dynamic features (search/feed/planner/contribute) are dead (Pages can't run .php). Restore via Workers. Also fixes the Guides-download + landing-entry mess.

## PHASE 2 — FRONTEND LAST-MILE (GATED on Phase 0) — index.html edits
- **M2.1 Wire Oracle to map-click** — the magic moment in the UI (backend already built in Phase 1).
- **M2.2 Competitive counters** (from COMPETITOR-MASTER.md weaknesses): free/no-login conviction band; per-POI provenance + "last-verified" (beats stale crowdsource); free contribute flow (beats paywalls); clean legend/filters (beats clutter); the declutter (operator-validated).

## PHASE 3 — DISTRIBUTION (the footprint gap)
- **M3.1 SEO** — sitemap.xml + real Guides content + metadata. Model 3 couldn't even find muddytires.ca in search; a SOTA product nobody finds isn't SOTA.

## WHY THIS BEATS THE FIELD (per COMPETITOR-MASTER.md)
The Oracle (Phase 1) is the thing NO competitor has — verified across 12 rivals + 3 models. Phase 2 closes the table-stakes
gaps (free/no-login/clean/sourced). Adjacent Crown tools (CrownAccess Ontario-only, Northern Stay, crownlandmap raw) are
beaten by fusing national legality + camping-discovery UX + offline. The data substrate is open-gov and in hand.

## OPERATOR DECISIONS STILL OPEN (identity/taste)
- aimlapi (Gemma 4 31b) key for any AI layer on the Oracle (your account).
- Landing-entry scope (narrow vs full migration) — overlaps M0.2.
- Production cutover timing (your word, per standing ruling).
