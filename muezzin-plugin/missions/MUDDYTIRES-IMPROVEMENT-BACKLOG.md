# muddytires Website Improvement Backlog (2026-06-16)

Source: a parallel extraction workflow (`wip0l7oq6`, 4 lenses: positioning / UX-components / D1-features / current-site-gaps) over the mined cards + the LIVE site, plus two focused agents (admin-login-AI; map-nav tweaks). Every item is grounded in a card principle or a verified backend.

## BUILD MODEL (read first)
Almost every item **touches the live site** (it changes `index.html` / the Pages deploy on muddytires.ca — the #1 asset). So the discipline: **build + preview-deploy on the `d1-standup` worktree branch (additive, a `*.workers.dev`/preview URL), the operator reviews the preview, then production-merge on his go.** Live production is never changed without that review. The D1 backend pieces below are already BUILT + VERIFIED on that branch (remote D1 = 4000 POIs; write tables + Oracle Worker proven on test workers.dev) — they are NOT yet wired into the live page.

## STATUS CORRECTION (do not propagate the stale read)
The admin/AI extractor concluded the backend is "spec, not built" — it read the daemon's STALE FAILED mission files. Directly verified otherwise this session: D1 holds 4000 POIs; the contribute/review tables + Worker and the fire-free Oracle Worker are built and proven on the `d1-standup` branch / test workers.dev. State = **built + verified, not yet wired to live.**

## ★★ ROOT FINDING — the site is HALF-MIGRATED (operator preview review, 2026-06-17 03:10)
Operator reviewed the oracle-landing-preview and hit 3 things, ALL one root cause (verified in the worktree, not memory):
the PHP->Cloudflare-Pages migration only converted the MAP (index.html->map.html) + the LANDING to static. EVERYTHING ELSE
is STILL PHP and therefore DEAD on Pages: guides.php (a markdown-rendering app over /guides/*.md + manifest.json — NOT a flat
page), about.php, add.php, partners.php (7 php blocks), contribute*.php. NO .html equivalents exist. So the landing's nav
(guides/about/add/partners) all dead-link -> SPA-fallback to the landing. SEPARATELY: the Crown-land Oracle (the SOTA
differentiator) IS built+live but POPUP-ONLY — it only renders when a user clicks a campsite pin (nnOracle panel + "Ask the
Oracle"); there is NO standalone button/heading/signpost, so it's undiscoverable. The landing only mentions "Crown land" in a
feature-card heading + a data credit, with no working CTA into it.
CONSEQUENCE: the preview is correctly NOT cutover-ready — finish-migration + surface-Oracle must land first. DECOMPOSE into
missions (NOT one mega-patch — engine fails those): (1) guides static-gen (render /guides/*.md -> guides.html + per-slug pages);
(2) about static (mostly 1 php block — convertible); (3) partners static (flatten the 7-block logic to the affiliate list);
(4) contribute/add (these are the user-submission flow -> needs the write Worker, bigger); (5) SURFACE the Oracle — a visible
"Check Crown-land legality" entry on the map + a working landing CTA. Content is RECOVERABLE (the .php source + the /guides
markdown exist). Command/conversion path (reliable), staged on oracle-frontend-swap, preview, operator cutover.

## ★ RECURRING LIVE BUG — landing page "keeps going away" (operator, 2026-06-17 02:35)
ROOT CAUSE (verified live + in deploy source, NOT memory): the live root `/` serves `index.html`, and the COMMITTED deploy
source's `index.html` IS the 360KB map app — the landing exists only as a separate `landing.html` (links to dead landing.php),
there is NO `_redirects`, and the apex now points at muddytires.pages.dev (root=index.html=map). So EVERY deploy serves the map
at `/`; any landing-at-root the operator saw was a temporary/uncommitted setup the next deploy wiped. A `/ -> /landing.html 200`
rewrite does NOT hold: Pages canonicalizes `/index.html` -> `/`, so the rewrite also captures the map's own URL + its internal
`index.html?camp=` links -> map breaks (the earlier attempt's breakage).
DURABLE FIX (a mission, staged + preview + operator cutover — touches the #1 asset): make the landing the COMMITTED root —
`index.html` = landing, the map moved to `map.html` with its internal `index.html` self-links repointed via the deterministic
`-replace` COMMAND technique (dodges the 360KB large-file-edit wall, same as surface-2b). MUST sequence AFTER oracle-ui-surface-2b
(both touch index.html). Then the landing survives every future deploy. Until then, root = map by construction.

---
## ★ NORTH STAR: BEAT iOVERLANDER (frame EVERY improvement against the competitor)
We did a sourced competitor review (`m28-1-ioverlander-study/_prior-attempt/competitor-card-ioverlander.md`). Every muddytires
improvement is positioned against iOverlander via the KB's Failure→Fix lesson ("scan competitor failures → position as the
resolution"). Their exploitable failures, and our counter:
- **They PAYWALL community data** ($59.99–$99.99/yr; quoted users: *"greed has taken over … $99 a year AND expects you to keep feeding data in"*; *"paywalling data users gave for free"*) → **muddytires is FREE, no login, no paywall.** (drives: homepage band, trust strip, "no login required")
- **They have NO Canadian crown-land legality** (only US BLM/USFS overlays) → **our Oracle gives sourced Canadian crown-land camping legality + park containment.** THE killer differentiator. (drives: Oracle-on-map-click, free-camping filter, provenance badges)
- **Their map clutters** (sourced complaints: markers so dense *"you can't see the underlying towns/highways"*) → **we ship a clean legend + filters + a sidebar.** (drives: legend, filters, sidebar, loading skeleton)
- **Their data velocity is at risk** (paywalling contributors chills contribution; only 0.5% of users drive 30% of check-ins) → **our contribute flow is free + frictionless.** (drives: add-a-spot wiring, reviews)
EVERY build-agent dispatch must carry this framing: "this beats iOverlander because [their specific, sourced failure]." The competitor card is being ingested into the KB (`nxtlvl-knowledge`) so agents can query it.

---
## HIGH priority (build first — biggest visitor impact)
1. **Homepage landing band above the map** — H1 differentiator ("Free Canadian camping spots with honest, sourced legality") + 2-3 conviction paragraphs + ONE CTA. Today visitors land on "loading…" + a bare map (~65 chars of text). [book-website §2.1; touches-live]
2. **Wire the Road Oracle to map-click** — click/long-press any lat/lng → sourced briefing card (camping legality, park containment, nearest water/dump, honest fire degrade). Backend DONE; this is the frontend wire-up. [Oracle Worker; touches-live]
3. **Wire the "Add a spot" button to the contribute WRITE backend** — pick location → node_type → notes → POST → pending `community_spot`. Today it's a stub. [contribute API; touches-live, NOT additive-safe]
4. **Interactive legend + node_type filter** — color-coded toggles (camp/water/dump/shower/propane/scenic/park) from the READ API. No legend/filter exists today. [cgsports tokens; touches-live]
5. **"Free camping only" legality filter toggle** — surface the 4-state classification as one tap. [READ API meta.crown_camping; depends on #4]
6. **Per-POI provenance + "last verified" date in popups** — make the "sourced honesty" claim visible (source attribution + date); pois.json currently has zero source/date fields. [book-website §1/§3; touches-live]
7. **Reachable contact infra** — email + About + Privacy in a footer (today: only Instagram + a dead Share link). [book-website §3; touches-live]
8. **GPS "find me" zoom button** *(operator request)* — standalone control: geolocate → `flyTo`/`locate` → accuracy ring. **Low-risk additive JS; the site ALREADY calls `navigator.geolocation` + `map.setView` in the add-spot flow** — just needs a standalone button. Leaflet `map.locate()` native (no plugin). [map-nav agent; touches-live but trivial]

## MED priority
9. Reviews/check-ins on POIs (pending state) [community_review; depends #3]
10. Confidence/freshness badge driven by review counts+recency [depends #9]
11. Trust strip under the header (100% free / community-verified / no login / X spots / official-source legality) [2boots; book §1.5]
12. Footer + map data-source attribution (Leaflet/OSM credit legally required, currently absent)
13. Replace bare "loading…" with a real map skeleton state [cgsports pulse tokens]
14. Spot-list sidebar (filterable, collapses on mobile; SEO-indexable) [depends #4]
15. Real Guides articles w/ own titles+canonicals (guides.php is currently a byte-identical map shell) [SEO long-tail]
16. Valid XML sitemap + fix robots.txt (sitemap.php serves HTML, not XML) [depends #15]
17. **Admin moderation QUEUE** — manage POIs + moderate community_spot/review + edit camping rules. Build as ISOLATED tab modules (NOT 2boots' monolith), server-authoritative roles (UI hides, Worker decides), explicit D1 migrations. [2boots anti-patterns; resilience-2 DD#3]
18. **Auth — 2-role model** — OPEN community (anonymous submit → queue, no account) + RESTRICTED owner (operator+wife, sees social-posting). Minimal viable: anonymous submit + moderator-PIN (Worker secret); evolve to accounts / Cloudflare Access. [community LOCKED DECISIONS; nxtlvl auth]
19. XSS-safe (textContent-only) rendering of user content + atomic rate-limiting on the submit endpoint [2boots; depends #3]

## LOW priority / polish
20. Nearest-amenity quick-action buttons in the Oracle card [depends #2]
21. Share control → live per-spot Oracle briefing URL [depends #2]
22. SRI integrity hashes (+ consider self-hosting) for the unpkg Leaflet/Turf/SunCalc CDN deps
23. OG/Twitter metadata polish (og:locale, twitter:description, twitter:site)
24. Central site-config (contact, trust items, categories) as single source of truth [2boots; the ONLY additive_safe-not-touching-live item]

## AI track (grounded, mostly future-phase — runs on Workers AI / operator's Gemini-Ultra, NOT local)
25. Natural-language Oracle briefings — finish the optional NL layer oracle.php already specs (deterministic fallback preserved; hard-bound prompt: never invent legality). 
26. AI moderation of submissions — score new spots/reviews for spam/safety, auto-route low-confidence to the human queue (#17). [nxtlvl applyQualityGate template]
27. AI-assisted POI enrichment of meta_json legal fields (human-gated before "gold"). 

---
## DECISIONS NEEDED FROM OPERATOR (2 — 1 RESOLVED)
- **Map twist/rotate — DECIDED 2026-06-16: Path A (`leaflet-rotate` plugin) now; MapLibre GL = documented FUTURE addition.**
  - **NOW (Path A):** add the `leaflet-rotate` plugin — bearing/spin rotation only, additive, keeps the existing Leaflet map
    (markers, popups, planner, feed, GPS, overlays, OCR, search) intact. Monkey-patches Leaflet → regression-test the
    overlays. Its own mission. GATED behind the engine's large-`index.html` edit capability (same wall as the declutter).
  - **FUTURE (Path B — MapLibre GL):** the better UX ceiling — native rotation **plus true tilt/pitch + vector tiles**
    (app-like, e.g. iOverlander/AllStays feel), but it **rewrites the entire map core** (everything is built on Leaflet APIs)
    and "can seem slower to redraw" (npm maplibre-gl-leaflet). Revisit as a deliberate, resourced map rebuild ONLY if a
    modern tilting map becomes a core selling point. SOTA-search-grounded 2026-06-16 (MapLibre Leaflet-migration guide:
    rotation/vector/globe are the reasons to migrate; r/gis: Leaflet "more user-friendly and stable" for simple maps).
- **Oracle NL-layer model** — oracle.php defaults to Anthropic claude-haiku-4-5; the resilience-2 strawman is **Gemini Flash** (you have Google AI Ultra → zero marginal cost). Identity-bound (your account) → your call.
- **Contribute auth depth** — start with anonymous-submit + moderator-PIN (minimal), or go straight to community accounts?

## REMAINING resilience-2 backend (separate from the above frontend backlog)
- FIRE INGEST — fire_hotspot/fire_perimeter are EXTERNAL live feeds (CWFIS m3 / NASA VIIRS via NRCan); needs a Cloudflare Cron Worker (fetch + staging-swap; endpoint recovered from the server cron). Its own mission.
- Photos → R2 (R2 perms were a wall earlier).
