// lint-batch.mjs — lint every target mission file, emit JSON {file: {ok, rules:[...]}}
import { readFileSync } from 'node:fs';
import { lintMission } from 'file:///C:/Users/marka/.claude/muezzin-plugin/mission_lint.mjs';

const files = [
  'mt-integrate-aurora-forecast-diff-report.S1.mission.txt',
  'mt-integrate-aurora-forecast-diff-report.S2.mission.txt',
  'mt-integrate-aurora-forecast-diff-report.mission.txt',
  'mt-integrate-b13-aria-live.mission.txt',
  'mt-integrate-bookmark-widget.mission.txt',
  'mt-integrate-contributor-leaderboard.mission.txt',
  'mt-integrate-dynamic-favicon-fire-ban.mission.txt',
  'mt-integrate-near-me-discovery.mission.txt',
  'mt-integrate-onboarding-tour-2026-06-23.mission.txt',
  'mt-integrate-osm-conflict-detect.mission.txt',
  'mt-integrate-park-reservation-deep-link.mission.txt',
  'mt-integrate-partner-embed-iframe-verification.mission.txt',
  'mt-integrate-partner-widget.mission.txt',
  'mt-integrate-photo-upload-ux.mission.txt',
  'mt-integrate-plan-day-gpx-export-2026-06-23.mission.txt',
  'mt-integrate-poi-hover-preview-cards.mission.txt',
  'mt-integrate-poi-print-sheet-worktree-audit.mission.txt',
  'mt-integrate-poi-services-nearby.S2.mission.txt',
  'mt-integrate-poi-services-nearby.mission.txt',
  'mt-integrate-poi-tags-2026-06-23.mission.txt',
  'mt-integrate-region-heatmap-2026-06-23.mission.txt',
  'mt-integrate-spot-share-card.mission.txt',
  'mt-integrate-testimonials.mission.txt',
  'mt-integrate-trip-cost-split-2026-06-23.mission.txt',
  'mt-integrate-weather-aware-planning-2026-06-23.mission.txt',
  'mt-integrate-wikipedia-link-2026-06-23.mission.txt',
  'mt-integrate-wildlife-advisory.mission.txt',
  'qc-concern-operators-html-business-claim-page-2026-06-25.mission.txt',
  'qc-fix-add-spot-worker-submission-add-spot-worker-js-2026-06-24.mission.txt',
  'qc-fix-filter-stack-modal-filter-stack-js-2026-06-24.mission.txt',
  'qc-fix-share-spot-share-spot-js-2026-06-24.mission.txt',
];

const base = 'C:/Users/marka/.claude/muezzin-plugin/missions/';
const out = {};
for (const f of files) {
  const r = lintMission(readFileSync(base + f, 'utf8'));
  out[f] = { ok: r.ok, rules: r.problems.map((p) => p.rule) };
}
console.log(JSON.stringify(out, null, 1));
