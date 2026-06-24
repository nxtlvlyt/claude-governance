# Tartib — 2026-06-24 QC-fix mission queue (14 missions, priority order)

Authored 2026-06-24 by conductor session based on operator visibility + dependency
analysis. Each row references an existing `.mission.txt` file in `missions/`. Process
top-to-bottom — operator-visible bugs first, complex/auth-gated last.

## TIER 1 — operator-visible bugs (user-reported / immediate UX)

These ship the most user value per fix. Process first.

| # | Mission slug | Why TIER 1 |
|---|---|---|
| 1 | `qc-fix-carbon-footprint-chip-currently-missing-from-build-2026-06-24` | **Operator explicitly reported missing.** Mechanical: grep `computeCO2` returns 0 in `js/plan-day.js`. Bounded scope, single file. |
| 2 | `qc-fix-filter-stack-modal-filter-stack-js-2026-06-24` | Primary UX — filter modal not rendering. Visible immediately on map page. |
| 3 | `qc-fix-crown-land-overlay-layer-crown-land-overlay-js-2026-06-24` | Critical Canadian POI feature — Crown land polygons missing on map. |
| 4 | `qc-fix-day-rhythm-planning-visualizer-day-rhythm-js-2026-06-24` | Planner UX — bar-handle absent. Affects core planning workflow. |

## TIER 2 — workflow features needing UI fixes

| # | Mission slug | Why TIER 2 |
|---|---|---|
| 5 | `qc-fix-spot-list-sidebar-spot-list-sidebar-js-2026-06-24` | POI list sidebar entirely absent. Discoverability UX. |
| 6 | `qc-fix-saved-list-manager-saved-list-js-2026-06-24` | POI save UI not rendering — counter visible behavior. |
| 7 | `qc-fix-share-spot-share-spot-js-2026-06-24` | Per-POI share button missing. |
| 8 | `qc-fix-share-export-menu-share-export-js-2026-06-24` | Multi-destination share menu missing. |

## TIER 3 — POI detail / interaction layer

| # | Mission slug | Why TIER 3 |
|---|---|---|
| 9 | `qc-fix-municipal-parking-panel-municipal-parking-panel-js-2026-06-24` | Embedded in POI popup; requires popup-click first. |
| 10 | `qc-fix-oracle-quick-actions-oracle-quick-actions-js-2026-06-24` | AI quick-action card not visible. |

## TIER 4 — auth-gated / complex (defer until test infra adds login fixture)

These need e2e-runner improvements before they can be re-tested. Author fixes
but acknowledge auth-fixture dependency.

| # | Mission slug | Why TIER 4 |
|---|---|---|
| 11 | `qc-fix-profile-editor-profile-js-2026-06-24` | Needs logged-in `#profile-authed` state; e2e-runner currently anonymous. |
| 12 | `qc-fix-reviews-submission-render-reviews-js-2026-06-24` | Auth-gated tip posting flow. |
| 13 | `qc-fix-add-spot-worker-submission-add-spot-worker-js-2026-06-24` | Contribute flow needs `?add=1` + auth. |
| 14 | `qc-fix-region-offline-pack-via-bg-fetch-region-download-bg-fetch-js-2026-06-24` | Service worker; bg-fetch unobservable in headless e2e. |

## Dispatch via Hermes

Each tier becomes a batch:
```powershell
cd C:\Users\marka\.claude\state
# Tier 1 (4 missions)
.\run-hermes.ps1 -BriefPath .\hermes-brief-execute-tier1-2026-06-24.md
```

The execution-phase brief (to be authored next) tells Hermes:
- Read the mission spec file
- Read the JS module(s) named in ALLOW-FILES
- Author the fix per the mission's Maqsad
- Write the patched JS file
- Commit on the mission's TARGET-BRANCH

Per Hermes' agent-loop pattern + `MODEL-ROUTING: TIER_CLOUD_CODE` tag in each
mission: dispatch with `qwen3-coder:480b --provider ollama-cloud` (the agentic
coder that succeeded for authoring; should also succeed for editing).

## Per the autosplit/hajj recursion-guard ruling (mission_split.mjs)

If any TIER batch exceeds the daemon's 8-step ceiling when dispatched through
the chain (which is currently parked, but for future): the recursion guard now
prevents children-of-children splits. Use parent-only or single-step missions.
The 14 QC-fix missions are each single-feature, well within ceiling.

## What this document is NOT

This is the conductor's priority ordering, not a hajj canon entry. The canon
defines mission shape + autosplit rules; this is the runtime ordering for
THIS specific batch. Future batches author their own TARTIB-*.md per cycle.
