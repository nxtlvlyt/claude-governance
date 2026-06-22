// mission_split.mjs — the MISSION-LEVEL size ceiling + auto-split (Hajj architecture,
// the keystone that was DESIGNED but never wired).
//
// MISSION_ARCHITECTURE.md is the contract:
//   L7  : "when a mission's decomposition exceeds the SIZE CEILING, the Architect SPLITS
//          it into sub-missions, each its own Maqsad + sub-state."
//   L10 : "Each mission/sub-mission carries a budget: ... a max micro-action count. Exceed
//          it -> split into sub-missions, each under budget."
//   L11 : "The numeric budget is tunable/calibrated empirically, not a magic constant."
//   L18 : "The size ceiling splits oversized missions *before* they ever reach a seat."
//   L33 : sub-missions queued + run in tartib order (a later sub-mission may not start
//          until its predecessor's receipt exists).
//
// THE TWO CEILINGS — DO NOT CONFLATE:
//   * MICRO-ACTION ceiling (deconstructor.validateMicroAction L70-78): a SINGLE step
//     touches at most ONE implementation file. UNTOUCHED by this module.
//   * MISSION-LEVEL ceiling (THIS module): the WHOLE micro_queue carries at most
//     MISSION_SIZE_CEILING steps. Over it -> split into sub-missions.
//
// This module is PURE + injectable: the split logic (planning) is separated from the
// emission (file writes). orchestrate.mjs calls splitOversizedPlan() to decide+plan and
// emitSubMissions() to write the artifacts, with the fs/queue ops injectable for offline
// selftest. No model dispatch happens here — the split is a deterministic regrouping of an
// already-validated micro_queue, so it is witnessed by code, not a seat.

import path from 'path';
// The MIQAT gate the daemon runs on every fired mission. Imported here so emitSubMissions
// can SELF-CHECK each generated child against the SAME lint the daemon enforces — a child
// that would be MIQAT-REFUSED is a GENERATOR bug to surface, not an artifact to ship.
// (Live 2026-06-16: emitted children tripped 'no-done-means' 12x, spamming the operator.)
import { lintMission } from './mission_lint.mjs';
import { parseMissionClass, normalizeRel } from './mission_class.mjs';

// THE MISSION-LEVEL SIZE CEILING (max micro-action count per mission). Grounded in
// 2026-06-16 receipts: corpus-complete-1 FAILED at 16 steps; the single-subject missions
// (3-5 steps) SUCCEEDED. The boundary sits between them. 8 is the chosen default:
//   - generous enough that an honest 5-7 step mission runs UNCHANGED (no false split);
//   - low enough that the 16-step (corpus) and 7-stage (resilience-2, which decomposes to
//     well over 8 micro-actions) monoliths split BEFORE a seat is overwhelmed.
// TUNABLE (MISSION_ARCHITECTURE.md L11 — "not a magic constant"): override via
// opts.sizeCeiling or the MUEZZIN_SIZE_CEILING env var. Flagged, not asserted.
export const MISSION_SIZE_CEILING = 8;

// resolve the active ceiling: explicit opt > env > default. A non-positive / non-numeric
// value falls back to the default (a poisoned env can never disable the gate).
export function resolveSizeCeiling(opts = {}) {
  if (Number.isInteger(opts.sizeCeiling) && opts.sizeCeiling > 0) return opts.sizeCeiling;
  const env = parseInt(process.env.MUEZZIN_SIZE_CEILING || '', 10);
  if (Number.isInteger(env) && env > 0) return env;
  return MISSION_SIZE_CEILING;
}

// A step is "over the ceiling" purely by COUNT — the micro-action ceiling already proved
// each step is single-file, so step COUNT is the mission-level capacity measure.
export function isOverCeiling(queue, opts = {}) {
  const n = Array.isArray(queue?.steps) ? queue.steps.length : 0;
  return n > resolveSizeCeiling(opts);
}

// --- STAGE/SUBJECT GROUPING ------------------------------------------------------------
// Group an oversized queue's steps into coherent sub-missions, RESPECTING natural
// boundaries in this priority:
//   1. EXPLICIT STAGE markers in a step's description ("STAGE 3", "Stage: X", "Phase 2",
//      "Part B", "SUB-MISSION 2") — the architect's own declared structure wins.
//   2. If no usable markers (or only one distinct marker), fall back to contiguous chunks
//      of <= ceiling steps, preserving tartib order.
// Either way EVERY step lands in exactly one group, original order is preserved, and the
// returned groups are themselves each <= ceiling (a marker-group larger than the ceiling is
// further chunked, so the split GUARANTEE holds — no sub-mission is itself oversized).
const STAGE_RE = /\b(?:stage|phase|part|sub-?mission|step-?group|section)\s*[:#-]?\s*([0-9]+|[a-z]\b|[ivx]+\b)/i;

function stageKeyOf(description) {
  const m = String(description || '').match(STAGE_RE);
  if (!m) return null;
  // normalize "STAGE 3" / "Phase: 3" / "Part B" -> a stable key on the matched leader+id
  const leader = m[0].match(/^[a-z-]+/i)?.[0]?.toLowerCase() || 'grp';
  return `${leader}:${String(m[1]).toLowerCase()}`;
}

// chunk an array into contiguous slices of at most `size`.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function groupSteps(steps, ceiling) {
  const list = Array.isArray(steps) ? steps : [];
  // pass 1: collect explicit stage keys in first-seen order, keeping steps in original order.
  const keys = [];
  const byKey = new Map();
  let markerCount = 0;
  for (const s of list) {
    const k = stageKeyOf(s?.description);
    if (k) markerCount++;
    const bucket = k || '__nostage__';
    if (!byKey.has(bucket)) { byKey.set(bucket, []); keys.push(bucket); }
    byKey.get(bucket).push(s);
  }
  // Use STAGE grouping only when the markers actually PARTITION the work into >=2 distinct
  // stages AND tag (nearly) every step. A lone marker, or a handful of tagged steps in a
  // mostly-unmarked queue, is NOT a reliable partition -> fall back to contiguous chunking.
  const distinctStages = keys.filter((k) => k !== '__nostage__').length;
  const reliableStageSplit = distinctStages >= 2 && markerCount >= Math.ceil(list.length / 2);

  let groups;
  if (reliableStageSplit) {
    // honor declared stages; a stage bigger than the ceiling is further chunked so no
    // emitted sub-mission is itself over budget (the split guarantee is absolute).
    groups = [];
    for (const k of keys) groups.push(...chunk(byKey.get(k), ceiling));
  } else {
    groups = chunk(list, ceiling);
  }
  return groups;
}

// --- MAQSAD / MISSION-TEXT DERIVATION --------------------------------------------------
// Pull the parent's Niyyah / Maqsad / MISSION-CLASS so each sub-mission inherits the
// objective frame (MISSION_CONSTRUCTION.md: Maqsad + Niyyah, unbiased, no mechanics).
function field(text, label) {
  // capture a labelled block up to the next ALL-CAPS/Capitalized "Word:" header or EOF.
  const re = new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Za-z -]*:|\\n#|$)`, 'mi');
  const m = String(text || '').match(re);
  return m ? m[1].trim() : '';
}

function missionIdOf(text) {
  const m = String(text || '').match(/MISSION-ID:\s*([^\r\n]+)/i);
  return m ? m[1].trim() : null;
}

function missionClassLine(text) {
  const m = String(text || '').match(/MISSION-CLASS:\s*([^\r\n]+)/i);
  return m ? `MISSION-CLASS: ${m[1].trim()}` : null;
}

// Pull the parent's parent-level "Done means" contract (if any), so the child can graft
// the inherited slice-of-the-objective onto its OWN per-step done contract. The regex
// mirrors lintMission RULE 4's detector (/done\s*(means|=)/i): we grab the text AFTER
// "Done means:" / "Done =" up to the next ALL-CAPS/Capitalized header or EOF.
function parentDoneMeans(text) {
  const m = String(text || '').match(/done\s*(?:means|=)\s*:?\s*([\s\S]*?)(?=\n[A-Z][A-Za-z -]*:|\n#|$)/i);
  return m ? m[1].trim() : '';
}

// The repo-relative files THIS group's steps actually write, as a normalized, de-duped,
// in-allowlist subset of the parent's ALLOW-FILES. A code-repo child must carry REPO-ROOT
// plus the slice of ALLOW-FILES its own steps touch — never the whole parent allowlist
// (least-privilege: a child may only write what its assigned steps write) and never a file
// the parent never declared (the kernel would reject an undeclared target at write time).
// Each step's write targets live on s.target_files (the micro-action's single-file output;
// validateMicroAction guarantees <=1 impl file per step, but we tolerate an array).
function groupAllowFiles(group, parentAllow) {
  const allowSet = new Set((parentAllow || []).map(normalizeRel));
  const out = [];
  const seen = new Set();
  for (const s of group || []) {
    const tf = s?.target_files;
    const files = Array.isArray(tf) ? tf : (tf ? [tf] : []);
    for (const f of files) {
      const rel = normalizeRel(f);
      // keep only files the parent declared (in-allowlist) and not already collected.
      if (rel && allowSet.has(rel) && !seen.has(rel)) { seen.add(rel); out.push(rel); }
    }
  }
  return out;
}

// Build ONE sub-mission's text from the parent + its assigned step group + tartib position.
// REQUIRES carries the predecessor sub-mission id (tartib: N+1 lists N), so the queue-flow
// layer (M-ENGINE.QUEUE-FLOW.1) holds a child until its predecessor's receipt exists.
export function buildSubMissionText(parentText, group, idx, total, parentId, predecessorId, opts = {}) {
  const parentNiyyah = field(parentText, 'Niyyah');
  const parentMaqsad = field(parentText, 'Maqsad');
  const klass = missionClassLine(parentText);
  const subId = `${parentId}.S${idx + 1}`;
  // CODE-REPO INHERITANCE: when the parent is MISSION-CLASS: code-repo, each child MUST
  // carry REPO-ROOT + the ALLOW-FILES SUBSET its own steps write — else lintMission RULE 6
  // (code-repo-missing-declaration) refuses the child. Least-privilege: only this slice's
  // declared files, never the whole parent allowlist.
  const parentClass = parseMissionClass(parentText);
  const isCodeRepo = parentClass.class === 'code-repo';
  let childAllow = isCodeRepo ? groupAllowFiles(group, parentClass.allowFiles) : [];
  // EMPTY-ALLOWLIST FALLBACK (2026-06-17, laguna-APPROVED): when a code-repo slice's steps carry NO
  // matching target_files, groupAllowFiles returns [] -> an empty "ALLOW-FILES:" header -> lintMission
  // RULE 6 refuses the child ("code-repo-missing-declaration"). This aborted autosplit on m28-2 /
  // m1-1-v3 / partners. Inherit the parent's full allowlist so the child is lint-valid; least-privilege
  // is unchanged when the slice DOES carry target_files, and the per-step containment guard still scopes
  // actual writes regardless.
  if (isCodeRepo && childAllow.length === 0) childAllow = (parentClass.allowFiles || []).map(normalizeRel);
  // the sub-mission's OWN Maqsad: derived from the parent objective + the concrete work of
  // THIS group's steps (objective-only framing — we list WHAT each step achieves, the
  // architect re-decomposes the HOW under the smaller budget).
  const stepLines = group.map((s) => `  - ${String(s.description || '').trim()}`).join('\n');
  // step ids/range for the Done-means contract: S<sub>.1..S<sub>.k over THIS group's steps.
  const k = group.length;
  const stepRange = k === 1 ? `step ${subId}.1` : `steps ${subId}.1..${subId}.${k}`;
  const lines = [];
  lines.push(`MISSION-ID: ${subId}`);
  if (klass) lines.push(klass);
  // REPO-ROOT + ALLOW-FILES inherited for code-repo children (header block parseMissionClass
  // + lintMission both read). Placed right under MISSION-CLASS so the declaration reads as one
  // block. A code-repo parent whose group writes no declared file still carries REPO-ROOT and
  // an (empty-but-present) ALLOW-FILES header — but groupSteps keeps real impl steps together,
  // so in practice every code-repo child's steps carry their target files.
  if (isCodeRepo && parentClass.repoRoot) {
    lines.push(`REPO-ROOT: ${parentClass.repoRoot}`);
    lines.push('ALLOW-FILES:');
    for (const af of childAllow) lines.push(`  - ${af}`);
  }
  lines.push(`PARENT: ${parentId}  (sub-mission ${idx + 1} of ${total}, auto-split by the size ceiling)`);
  // REQUIRES / tartib: a child may not start until its predecessor's receipt exists.
  lines.push(predecessorId
    ? `REQUIRES: predecessor ${predecessorId} DONE (tartib — sub-mission ${idx + 1} runs after ${idx} of ${total})`
    : `REQUIRES: none (first sub-mission of ${total} in tartib order)`);
  lines.push('');
  lines.push(`Niyyah: ${parentNiyyah || '(inherited from parent ' + parentId + ')'}`);
  lines.push('');
  lines.push(`Maqsad: this is part ${idx + 1} of ${total} of the parent objective below — a right-sized slice the engine can decompose under the size ceiling without overwhelming a seat. Achieve ONLY this slice's work; the sibling sub-missions own the rest.`);
  lines.push(`PARENT MAQSAD (the whole objective these sub-missions together serve): ${parentMaqsad || '(see parent ' + parentId + ')'}`);
  lines.push('');
  lines.push(`THIS SUB-MISSION'S WORK (the parent decomposition's steps assigned to this slice — re-decompose them under the smaller budget; do not exceed the ceiling):`);
  lines.push(stepLines);
  lines.push('');
  // DONE MEANS (lintMission RULE 4): a SUBSTANTIVE per-slice contract the verdict panel can
  // judge against — each of this slice's steps complete WITH its validation_command receipt,
  // plus the inherited parent done-condition for this slice. NOT a placeholder: it names the
  // concrete step range and the receipt bar the panel checks.
  const inheritedDone = parentDoneMeans(parentText);
  const inheritedClause = inheritedDone
    ? `the parent's done-condition holds for this slice — ${inheritedDone}`
    : `this slice's portion of the parent objective above is achieved (parent ${parentId} carried no explicit Done-means; the slice is judged against its steps' receipts and the parent Maqsad).`;
  lines.push(`Done means: ${stepRange} are all complete, each with its validation_command receipt passing (the deed witnessed, not asserted); and ${inheritedClause}`);
  lines.push('');
  lines.push(`Amanah: this slice was split from a larger mission so it stays inside the chain's reliable working capacity (Q2:286 / mizan). Discharge it with ihsan; its receipt unlocks the next sibling.`);
  return lines.join('\n');
}

// --- THE SPLIT PLANNER (pure) ----------------------------------------------------------
// splitOversizedPlan(mission, queue, opts) -> one of:
//   { split:false }                                  -> under ceiling: caller runs the queue UNCHANGED.
//   { split:true, subMissions:[{id,text,group}], ceiling, stepCount }  -> emit these in order.
//   { split:false, fail:true, reason }               -> over ceiling but CANNOT split validly
//                                                        (caller FAILS with a named receipt; never runs the monolith).
// PURE: no fs, no dispatch. The caller decides how to emit (emitSubMissions below).
export function splitOversizedPlan(mission, queue, opts = {}) {
  const ceiling = resolveSizeCeiling(opts);
  const steps = Array.isArray(queue?.steps) ? queue.steps : [];
  if (steps.length <= ceiling) return { split: false };   // UNDER ceiling -> unchanged path (the critical fallback)

  // COMMAND-CLASS EXEMPTION (2026-06-18, mt-cutover-1): a mission whose steps are exact
  // shell/wrangler commands (ops-deploy / command-class) must run as ONE ordered sequence —
  // splitting a deploy mid-sequence strands the mutating step. Never split it, at any size.
  if (/MISSION-CLASS:\s*ops-deploy/i.test(String(mission)) || /\bcommand-class\b/i.test(String(mission))) {
    return { split: false };
  }

  // FAILSAFE: a mission with no parseable id cannot mint coherent sub-mission ids/REQUIRES
  // -> fail with a NAMED receipt rather than emit ambiguous children or run the monolith.
  const parentId = missionIdOf(mission) || queue?.mission_id;
  if (!parentId) {
    return { split: false, fail: true, reason: `size-ceiling split aborted: queue has ${steps.length} steps (> ceiling ${ceiling}) but the mission carries no MISSION-ID and no queue.mission_id to derive sub-mission ids from — cannot split coherently; refusing to run the oversized monolith` };
  }

  // RECURSION GUARD (live 2026-06-18: mt-cutover-1 -> S1 -> S1.S1 ...): a mission that is ITSELF
  // a split child (PARENT: header or a .S<n> id) must NEVER be re-split. Its steps are already a
  // right-sized slice; re-splitting re-trips the count ceiling forever AND the child-filename
  // derivation overwrites the parent's own .S files. Over-ceiling AND already-a-child is a
  // GENERATOR defect (groupSteps/buildSubMissionText emitted an oversized slice) -> fail with a
  // named receipt (like the failsafes above), never recurse.
  if (/^PARENT:/mi.test(String(mission)) || /\.S\d+$/.test(String(parentId))) {
    return { split: false, fail: true, reason: `recursion guard: ${parentId} is already a split sub-mission (${steps.length} steps > ceiling ${ceiling}) — refusing to re-split a child (would recurse S->S.S->...). Fix the first-level slice size in groupSteps/buildSubMissionText, do not recurse.` };
  }

  const groups = groupSteps(steps, ceiling);
  // a valid split must yield >=2 groups, each non-empty and <= ceiling, covering EVERY step
  // exactly once (no step lost, none duplicated). Otherwise fail-with-receipt.
  const totalGrouped = groups.reduce((n, g) => n + g.length, 0);
  const allWithinCeiling = groups.every((g) => g.length >= 1 && g.length <= ceiling);
  if (groups.length < 2 || totalGrouped !== steps.length || !allWithinCeiling) {
    return { split: false, fail: true, reason: `size-ceiling split aborted: ${steps.length} steps (> ceiling ${ceiling}) could not be grouped into >=2 valid sub-missions (got ${groups.length} group(s), covering ${totalGrouped}/${steps.length} steps, within-ceiling=${allWithinCeiling}) — refusing to run the oversized monolith` };
  }

  const subMissions = groups.map((group, i) => {
    const predecessorId = i === 0 ? null : `${parentId}.S${i}`;
    const text = buildSubMissionText(mission, group, i, groups.length, parentId, predecessorId, opts);
    return { id: `${parentId}.S${i + 1}`, text, group, predecessorId };
  });
  return { split: true, subMissions, ceiling, stepCount: steps.length, parentId };
}

// --- EMISSION (injectable io) ----------------------------------------------------------
// emitSubMissions(splitResult, ctx, io) -> { ok, files:[...], manifestPath, queued:[...] }
// Writes one <basename>.mission.txt per sub-mission into the missions dir, a
// _split-manifest.json (the conductor/daemon handoff record), and — when an appendQueue io
// is provided — appends them to the fire queue (AUTORUN) IN TARTIB ORDER. The parent is
// NOT run; the caller marks it SPLIT. io is injectable so this is offline-testable.
//
// HANDOFF to M-ENGINE.QUEUE-FLOW.1: this writes the sub-mission FILES + a manifest the
// daemon/conductor can pick up, AND appends them to AUTORUN when given an appendQueue io
// (the minimal working queue flow). Priority/dependency-ordered auto-promotion (holding a
// child until its predecessor's receipt lands) is queue-flow-1's deeper job; here the
// REQUIRES line + manifest carry the tartib so that layer can enforce it.
export function emitSubMissions(splitResult, ctx, io) {
  if (!splitResult?.split) return { ok: false, reason: 'nothing to emit (not a split result)' };
  const { missionsDir, parentMissionFile } = ctx;
  const { writeFile, appendQueue = null } = io;
  // MIQAT SELF-CHECK (2026-06-16): before writing ANY child, run each child's text through
  // the SAME lintMission the daemon enforces at fire time. A child that would be MIQAT-REFUSED
  // is a GENERATOR bug — refuse to emit it (return a named fail) rather than ship an artifact
  // that will refuse-loop and spam the operator. This makes the generator's own gate identical
  // to the one downstream, so a regression here is caught at emit, not at the 13th phone push.
  const lintFails = [];
  for (const sm of splitResult.subMissions) {
    const lint = lintMission(sm.text);
    if (!lint.ok) lintFails.push({ id: sm.id, problems: lint.problems });
  }
  if (lintFails.length) {
    const why = lintFails
      .map((f) => `${f.id}: ${f.problems.map((p) => p.rule).join(', ')}`)
      .join(' | ');
    return {
      ok: false,
      fail: true,
      reason: `emitSubMissions ABORTED: generator produced ${lintFails.length} MIQAT-INVALID child(ren) — ${why}. This is a generator bug (buildSubMissionText), not a shippable artifact; refusing to emit so the daemon never refuse-loops on these.`,
      lintFails,
    };
  }
  // base name for the children: parent file basename without .mission.txt
  const parentBase = path.basename(String(parentMissionFile || ctx.parentId || 'mission'))
    .replace(/\.mission\.txt$/i, '').replace(/\.[^.]+$/, '');
  const files = [];
  const queued = [];
  for (let i = 0; i < splitResult.subMissions.length; i++) {
    const sm = splitResult.subMissions[i];
    const fileName = `${parentBase}.S${i + 1}.mission.txt`;
    const filePath = path.join(missionsDir, fileName);
    writeFile(filePath, sm.text);
    const relForQueue = `missions/${fileName}`;
    files.push({ id: sm.id, file: filePath, rel: relForQueue, predecessorId: sm.predecessorId, steps: sm.group.length });
    // append to the fire queue in tartib order (first sub-mission first). The daemon's
    // readQueue picks up appended lines on its next poll. HELD/gated semantics are the
    // queue-flow layer's concern; here we hand the ordered lines over.
    if (appendQueue) { appendQueue(relForQueue, sm); queued.push(relForQueue); }
  }
  // the manifest: the durable handoff record (parent -> ordered children + tartib).
  const manifest = {
    parent: splitResult.parentId,
    parentMissionFile: parentMissionFile || null,
    ceiling: splitResult.ceiling,
    originalStepCount: splitResult.stepCount,
    splitAt: new Date().toISOString(),
    subMissions: files.map((f) => ({ id: f.id, file: f.rel, requires: f.predecessorId, steps: f.steps })),
    note: 'PARENT marked SPLIT (not executed). Children run in tartib order; each REQUIRES its predecessor DONE. Queue flow: M-ENGINE.QUEUE-FLOW.1.',
  };
  const manifestPath = path.join(missionsDir, `${parentBase}._split-manifest.json`);
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { ok: true, files, manifestPath, queued, manifest };
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('mission_split.mjs')) {
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  const mkSteps = (n, descFn = (i) => `step ${i + 1} edits file${i + 1}.mjs`) =>
    Array.from({ length: n }, (_, i) => ({ step_index: i + 1, description: descFn(i), action_type: 'edit', target_files: [`file${i + 1}.mjs`], context_dependencies: [], validation_command: `node -c file${i + 1}.mjs` }));

  const parent = `MISSION-ID: M-CORPUS.1
MISSION-CLASS: research
Niyyah: the whole corpus must be captured so nothing is lost.
Maqsad: a complete corpus index covering every source.`;

  // ---- ceiling resolution + over/under detection ----
  ck(resolveSizeCeiling() === MISSION_SIZE_CEILING, `default ceiling is ${MISSION_SIZE_CEILING} (grounded: 16 failed, 3-5 succeeded)`);
  ck(resolveSizeCeiling({ sizeCeiling: 5 }) === 5, 'explicit opts.sizeCeiling overrides the default');
  {
    const saved = process.env.MUEZZIN_SIZE_CEILING;
    process.env.MUEZZIN_SIZE_CEILING = '6';
    ck(resolveSizeCeiling() === 6, 'MUEZZIN_SIZE_CEILING env overrides the default');
    ck(resolveSizeCeiling({ sizeCeiling: 4 }) === 4, 'explicit opt still wins over env');
    process.env.MUEZZIN_SIZE_CEILING = 'garbage';
    ck(resolveSizeCeiling() === MISSION_SIZE_CEILING, 'a poisoned env value falls back to the default (gate can never be disabled)');
    if (saved === undefined) delete process.env.MUEZZIN_SIZE_CEILING; else process.env.MUEZZIN_SIZE_CEILING = saved;
  }
  ck(isOverCeiling({ steps: mkSteps(16) }) === true, 'a 16-step queue is OVER the ceiling (the corpus failure)');
  ck(isOverCeiling({ steps: mkSteps(5) }) === false, 'a 5-step queue is UNDER the ceiling (the missions that succeeded)');
  ck(isOverCeiling({ steps: mkSteps(8) }) === false, 'an exactly-8-step queue is AT the ceiling (not over)');

  // ---- (1) UNDER-CEILING: split:false, the caller runs the queue UNCHANGED (critical fallback) ----
  {
    const r = splitOversizedPlan(parent, { mission_id: 'M-CORPUS.1', steps: mkSteps(5) });
    ck(r.split === false && !r.fail, 'UNDER-CEILING: splitOversizedPlan returns split:false (no fail) — the unchanged path');
  }

  // ---- (2) OVER-CEILING, NO stage markers: contiguous chunks of <= ceiling, tartib order ----
  {
    const q = { mission_id: 'M-CORPUS.1', steps: mkSteps(16) };
    const r = splitOversizedPlan(parent, q);
    ck(r.split === true, 'OVER-CEILING (16 steps): splits');
    ck(r.subMissions.length === 2, '16 steps / ceiling 8 -> 2 sub-missions');
    ck(r.subMissions.every((s) => s.group.length <= 8 && s.group.length >= 1), 'every sub-mission is within the ceiling (no child is itself oversized)');
    const covered = r.subMissions.reduce((n, s) => n + s.group.length, 0);
    ck(covered === 16, 'all 16 steps covered exactly once across the sub-missions (none lost/duplicated)');
    // tartib: S1 requires none, S2 requires S1.
    ck(/REQUIRES: none/.test(r.subMissions[0].text), 'sub-mission 1 REQUIRES none (first in tartib)');
    ck(r.subMissions[1].predecessorId === 'M-CORPUS.1.S1' && /REQUIRES: predecessor M-CORPUS\.1\.S1 DONE/.test(r.subMissions[1].text), 'sub-mission 2 REQUIRES predecessor S1 DONE (tartib N+1 lists N)');
    ck(r.subMissions[0].id === 'M-CORPUS.1.S1' && r.subMissions[1].id === 'M-CORPUS.1.S2', 'sub-mission ids derive from the parent id + .S<n>');
    // each child carries its own Maqsad + the parent objective + its assigned steps.
    ck(/Maqsad:/.test(r.subMissions[0].text) && /PARENT MAQSAD/.test(r.subMissions[0].text), 'each sub-mission carries its OWN Maqsad + the parent objective (MISSION_CONSTRUCTION framing)');
    ck(/MISSION-CLASS: research/.test(r.subMissions[0].text), 'sub-mission inherits the parent MISSION-CLASS');
    // DONE-MEANS (the live 2026-06-16 bug: children emitted no Done-means -> MIQAT-REFUSED 12x).
    ck(r.subMissions.every((s) => /Done means:/.test(s.text)), 'EVERY sub-mission carries a "Done means" clause (the live no-done-means refuse-loop fix)');
    ck(/Done means:[^\n]*M-CORPUS\.1\.S1\.1\.\.M-CORPUS\.1\.S1\.8[^\n]*validation_command receipt/.test(r.subMissions[0].text), 'the Done-means is SUBSTANTIVE: names this slice\'s step range + the validation_command receipt bar (not a placeholder)');
    // THE KEYSTONE: every generated child PASSES the REAL lintMission (the same gate the daemon fires).
    ck(r.subMissions.every((s) => lintMission(s.text).ok), 'EVERY generated child PASSES the real lintMission (imported gate) — no MIQAT-REFUSED, no refuse-loop');
  }

  // ---- (2b) THE LIVE BUG, end-to-end: emitSubMissions self-check PASSES on a research split ----
  {
    const q = { mission_id: 'M-CORPUS.1', steps: mkSteps(16) };
    const r = splitOversizedPlan(parent, q);
    const written = new Map();
    const out = emitSubMissions(r, { missionsDir: '/m', parentMissionFile: 'corpus-complete-1.mission.txt', parentId: 'M-CORPUS.1' }, { writeFile: (p, c) => written.set(p, c) });
    ck(out.ok === true && !out.fail, 'emitSubMissions SELF-CHECK passes: every emitted research child is MIQAT-valid (no lint-fail abort)');
  }

  // ---- (2c) CODE-REPO parent -> CODE-REPO-VALID children (RULE 6: REPO-ROOT + ALLOW-FILES subset) ----
  {
    // 12 single-file code steps, each writing a declared repo-relative file. The parent
    // declares ALL of them in ALLOW-FILES; each child must inherit REPO-ROOT + ONLY the
    // subset of ALLOW-FILES its own steps write (least-privilege), and pass lintMission RULE 6.
    const codeSteps = Array.from({ length: 12 }, (_, i) => ({
      step_index: i + 1,
      description: `implement feature module ${i + 1}`,
      action_type: 'edit',
      target_files: [`src/mod${i + 1}.mjs`],
      context_dependencies: [],
      validation_command: `node -c src/mod${i + 1}.mjs`,
    }));
    const allowBlock = codeSteps.map((s) => `  - ${s.target_files[0]}`).join('\n');
    const codeParent = `MISSION-ID: M-CODE.1
MISSION-CLASS: code-repo
REPO-ROOT: C:\\proj\\muezzin
ALLOW-FILES:
${allowBlock}
Niyyah: the feature suite must ship complete and tested.
Maqsad: implement the 12 feature modules with passing node -c checks.
Done means: all 12 modules exist and node -c passes on each.`;
    const r = splitOversizedPlan(codeParent, { mission_id: 'M-CODE.1', steps: codeSteps });
    ck(r.split === true && r.subMissions.length === 2, 'CODE-REPO: 12 steps / ceiling 8 -> 2 children');
    // each child inherits the class + REPO-ROOT and carries ONLY its slice's ALLOW-FILES.
    ck(r.subMissions.every((s) => /MISSION-CLASS: code-repo/.test(s.text) && /REPO-ROOT: C:\\proj\\muezzin/.test(s.text)), 'CODE-REPO child inherits MISSION-CLASS + REPO-ROOT');
    {
      const c0 = parseMissionClass(r.subMissions[0].text);
      const c1 = parseMissionClass(r.subMissions[1].text);
      ck(c0.allowFiles.length === 8 && c1.allowFiles.length === 4, 'CODE-REPO child carries ONLY its OWN slice of ALLOW-FILES (8 + 4, least-privilege — not the whole parent allowlist)');
      ck(c0.allowFiles.includes('src/mod1.mjs') && !c0.allowFiles.includes('src/mod9.mjs'), 'CODE-REPO child 1 has its files (mod1) and NOT a sibling\'s (mod9)');
      ck(c1.allowFiles.includes('src/mod9.mjs') && !c1.allowFiles.includes('src/mod1.mjs'), 'CODE-REPO child 2 has its files (mod9) and NOT child 1\'s (mod1)');
    }
    // THE KEYSTONE for code-repo: every child PASSES the real lintMission RULE 6.
    ck(r.subMissions.every((s) => lintMission(s.text).ok), 'EVERY code-repo child PASSES the real lintMission (RULE 6: code-repo-missing-declaration NOT tripped)');
    // and emitSubMissions self-check passes end-to-end on the code-repo split.
    const out = emitSubMissions(r, { missionsDir: '/m', parentMissionFile: 'code-1.mission.txt', parentId: 'M-CODE.1' }, { writeFile: () => {} });
    ck(out.ok === true && !out.fail, 'emitSubMissions SELF-CHECK passes on the CODE-REPO split (every child MIQAT-valid)');
  }

  // ---- (3) OVER-CEILING WITH STAGE MARKERS: groups by declared stage, not blind chunks ----
  {
    // 9 steps across 3 explicit stages (3 each). With ceiling 8 a blind chunk would make
    // 8+1; the STAGE markers must instead make 3 coherent sub-missions of 3.
    const steps = [];
    let idx = 0;
    for (const st of [1, 2, 3]) for (let k = 0; k < 3; k++) steps.push({ step_index: ++idx, description: `STAGE ${st}: do work item ${k + 1}`, action_type: 'edit', target_files: [`s${st}_${k}.mjs`], context_dependencies: [], validation_command: 'node -c x' });
    const r = splitOversizedPlan(parent, { mission_id: 'M-RES.2', steps });
    ck(r.split === true && r.subMissions.length === 3, 'STAGE markers: 9 steps in 3 stages -> 3 sub-missions (declared boundaries honored, not blind chunks)');
    ck(r.subMissions.every((s) => s.group.length === 3), 'each stage sub-mission holds exactly its 3 stage steps');
    ck(r.subMissions.reduce((n, s) => n + s.group.length, 0) === 9, 'all 9 stage steps covered exactly once');
  }

  // ---- (3b) a STAGE bigger than the ceiling is FURTHER chunked (no child over budget) ----
  {
    // stage 1 has 10 steps, stage 2 has 3 -> stage 1 must split into 8+2, stage 2 stays 3.
    const steps = [];
    let idx = 0;
    for (let k = 0; k < 10; k++) steps.push({ step_index: ++idx, description: `STAGE 1: item ${k}`, action_type: 'edit', target_files: [`a${k}.mjs`], context_dependencies: [], validation_command: 'node -c x' });
    for (let k = 0; k < 3; k++) steps.push({ step_index: ++idx, description: `STAGE 2: item ${k}`, action_type: 'edit', target_files: [`b${k}.mjs`], context_dependencies: [], validation_command: 'node -c x' });
    const r = splitOversizedPlan(parent, { mission_id: 'M-BIG.1', steps });
    ck(r.split === true && r.subMissions.length === 3, 'an oversized STAGE is further chunked: 10+3 -> [8,2,3] = 3 sub-missions');
    ck(r.subMissions.every((s) => s.group.length <= 8), 'no emitted sub-mission exceeds the ceiling even from a huge stage (split guarantee absolute)');
    ck(r.subMissions.reduce((n, s) => n + s.group.length, 0) === 13, 'all 13 steps covered once');
  }

  // ---- (4) UNSPLITTABLE OVER-CEILING -> fail-with-receipt (never run the monolith) ----
  {
    // no MISSION-ID and no queue.mission_id -> cannot mint sub-mission ids -> named fail.
    const r = splitOversizedPlan('Maqsad: a thing with no id.', { steps: mkSteps(12) /* no mission_id */ });
    ck(r.split === false && r.fail === true && /no MISSION-ID/.test(r.reason), 'UNSPLITTABLE (no parseable id): fails with a NAMED receipt, never runs the monolith');
  }

  // ---- (5) EMISSION: writes one file per sub-mission + a manifest; appends to queue in tartib ----
  {
    const q = { mission_id: 'M-CORPUS.1', steps: mkSteps(16) };
    const r = splitOversizedPlan(parent, q);
    const written = new Map();
    const appended = [];
    const io = {
      writeFile: (p, c) => written.set(p, c),
      appendQueue: (rel) => appended.push(rel),
    };
    const out = emitSubMissions(r, { missionsDir: '/m', parentMissionFile: 'corpus-complete-1.mission.txt', parentId: 'M-CORPUS.1' }, io);
    ck(out.ok === true && out.files.length === 2, 'EMISSION: one .mission.txt written per sub-mission');
    ck([...written.keys()].some((k) => k.endsWith('corpus-complete-1.S1.mission.txt')) && [...written.keys()].some((k) => k.endsWith('corpus-complete-1.S2.mission.txt')), 'EMISSION: sub-mission files named <parentbase>.S<n>.mission.txt');
    ck([...written.keys()].some((k) => k.endsWith('corpus-complete-1._split-manifest.json')), 'EMISSION: a _split-manifest.json is written (the conductor/daemon handoff record)');
    const manifest = JSON.parse([...written.entries()].find(([k]) => k.endsWith('_split-manifest.json'))[1]);
    ck(manifest.parent === 'M-CORPUS.1' && manifest.subMissions.length === 2 && manifest.subMissions[1].requires === 'M-CORPUS.1.S1', 'EMISSION: manifest records parent + ordered children + tartib REQUIRES');
    ck(JSON.stringify(appended) === JSON.stringify(['missions/corpus-complete-1.S1.mission.txt', 'missions/corpus-complete-1.S2.mission.txt']), 'EMISSION: children appended to the queue IN TARTIB ORDER (S1 before S2)');
    // queue append is OPTIONAL: without appendQueue io, files+manifest still written, nothing queued.
    const written2 = new Map();
    const out2 = emitSubMissions(r, { missionsDir: '/m', parentMissionFile: 'corpus-complete-1.mission.txt' }, { writeFile: (p, c) => written2.set(p, c) });
    ck(out2.ok === true && out2.queued.length === 0 && [...written2.keys()].length === 3, 'EMISSION: no appendQueue io -> files+manifest written, queue untouched (handoff-by-file fallback)');
  }

  console.log(fails === 0
    ? '\nALL PASS — mission-level size ceiling + auto-split: under-ceiling unchanged, over-ceiling splits in tartib (stage-aware + chunk fallback), unsplittable fails-with-receipt, emission writes files+manifest+queue'
    : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}
