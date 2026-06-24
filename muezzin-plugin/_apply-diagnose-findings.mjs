#!/usr/bin/env node
// One-off: take the diagnose workflow findings + append AUTORUN annotations + write Done means clauses.
// Run: node _apply-diagnose-findings.mjs <findings-output-path>

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const findingsPath = process.argv[2];
if (!findingsPath) { console.error('usage: node _apply-diagnose-findings.mjs <findings-output-path>'); process.exit(2); }

const findings = JSON.parse(readFileSync(findingsPath, 'utf8')).result.findings;

const autorunPath = path.join(process.cwd(), 'missions', 'AUTORUN.md');
let autorun = readFileSync(autorunPath, 'utf8');
let annotated = 0;
let skippedNoLine = 0;
let skippedAlreadyAnnotated = 0;
const skippedIds = [];
const stamp = new Date().toISOString().slice(0, 16) + 'Z';

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

for (const f of findings) {
  const missionPath = `missions/${f.mission_id}.mission.txt`;
  const escaped = esc(missionPath);
  // Match a status line for this mission, optionally with existing comment
  const re = new RegExp(`^(FAILED|BLOCKED|SPLIT|RUNNING|HELD)\\s+${escaped}(\\s*<!--.*?-->)?\\s*$`, 'm');
  const match = autorun.match(re);
  if (!match) { skippedNoLine++; skippedIds.push(f.mission_id); continue; }
  const annot = (f.annotation_text || '').replace(/[\r\n]+/g, ' ').slice(0, 280);
  // OVERWRITE existing annotation if the workflow-generated one has FIX:/SUPERSEDED:/BLOCKED: keyword
  // (conduct-cycle's parser requires those keywords; stale prior comments often lack them)
  const hasKeyword = /^(FIX:|SUPERSEDED:|RESOLVED:|BLOCKED:|REQUEUE:)/.test(annot);
  if (match[2] && !hasKeyword) { skippedAlreadyAnnotated++; continue; }
  const newLine = `${match[1]} ${missionPath}  <!-- ${stamp} ${annot} -->`;
  autorun = autorun.replace(re, newLine);
  annotated++;
}

writeFileSync(autorunPath, autorun);
console.log(`AUTORUN annotated: ${annotated}`);
console.log(`AUTORUN skipped (no matching status line): ${skippedNoLine}`);
console.log(`AUTORUN skipped (already annotated): ${skippedAlreadyAnnotated}`);
if (skippedIds.length) console.log(`  no-line ids: ${skippedIds.join(', ')}`);

// Now: append Done means clauses to the 5 miqat-no-done-means missions
const miqatTargets = [
  { id: 'vanlife-editor-A-proofzoom', doneMeans: 'Done means: js/vanlife-editor.js exposes a proof-zoom mode the operator can toggle from the editor toolbar; the mode is observable in a browser (zoom rectangle renders); changelog notes the addition with file:line.' },
  { id: 'engine-hajj-autosplit-1', doneMeans: 'Done means: deconstructor.mjs exports SIZE_CEILING (or equivalent) plus a post-plan splitter; over-ceiling plans emit N tartib-ordered sub-mission files with the parent marked SPLIT (not run); inline selftests cover both the split-fired and under-ceiling no-op branches; existing selftests still pass.' },
  { id: 'engine-faith-consolidation-1-canonical-home', doneMeans: 'Done means: ~/.claude/faiths/ is the sole FAITH_DIR target; seat_dispatch.mjs FAITH_DIR points there; every dispatched role resolves its faith from that path; one live dispatch confirms (any role) end-to-end.' },
  { id: 'engine-guardian-1-faith-then-bite', doneMeans: 'Done means: Stage-1 — ~/.claude/faiths/groundedness_checker.faith.md exists in first-person matching governance_scanner anatomy. Stage-2 — the gate fires only when false-positive evidence supports promotion; selftest covers both stages.' },
  { id: 'engine-reliability-1-edit-discipline-and-cloud-budget', doneMeans: 'Done means: a code-repo EDIT mission completes end-to-end on a clean repo with a witnessed receipt AND a measured drop in cloud dispatches per plan vs. the prior baseline.' },
];

let doneMeansApplied = 0;
const missingMissionFiles = [];
for (const t of miqatTargets) {
  const file = path.join(process.cwd(), 'missions', `${t.id}.mission.txt`);
  if (!existsSync(file)) { missingMissionFiles.push(t.id); continue; }
  const txt = readFileSync(file, 'utf8');
  if (/done\s*(means|=)|done-means/i.test(txt)) {
    console.log(`  ${t.id}: already has Done means, skipping`);
    continue;
  }
  // Append at end with a blank line separator
  const newTxt = txt.replace(/\s*$/, '\n\n' + t.doneMeans + '\n');
  writeFileSync(file, newTxt);
  doneMeansApplied++;
}

console.log(`Done-means clauses appended: ${doneMeansApplied}`);
if (missingMissionFiles.length) console.log(`  mission files not found: ${missingMissionFiles.join(', ')}`);
