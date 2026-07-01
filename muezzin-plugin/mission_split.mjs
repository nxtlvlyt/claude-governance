// mission_split.mjs — Hajj auto-split engine (MISSION_ARCHITECTURE.md L7/L10-11/L18/L33).
// When the Architect's decomposition exceeds the SIZE_CEILING, the engine AUTOMATICALLY
// splits the mission into coherent tartib-ordered sub-missions BEFORE any seat executes a step.
// The parent is marked SPLIT (not run); the children flow to the queue.
//
// Two exports:
//   splitOversizedPlan(mission, queue, opts) -> { split:false } | { split:true, ... } | { fail:true, reason }
//   emitSubMissions(plan, ctx, io) -> { ok:true, files, manifestPath, queued } | { ok:false, reason }

import { SIZE_CEILING } from './deconstructor.mjs';
import { writeFileSync, mkdirSync, appendFileSync, existsSync } from 'fs';
import path from 'path';

// ---- buildDoneMeansClause ----------------------------------------------------------
export function buildDoneMeansClause(targetFiles) {
  // Dedupe targetFiles
  const deduped = [...new Set(targetFiles || [])];

  if (deduped.length === 0) {
    return 'Done means: (none) exist/are updated as specified.';
  }

  const hasUiFile = deduped.some(f => /\.(html|js|jsx|tsx|css)$/i.test(f));
  const filesJoined = deduped.join(', ');
  let clause = `Done means: ${filesJoined} exist/are updated as specified.`;

  if (hasUiFile) {
    clause += ' Verify by headless browser render, not by reading the code.';
  }

  return clause;
}

// ---- extractVisualQcHeader ---------------------------------------------------------
export function extractVisualQcHeader(missionText) {
  if (typeof missionText !== 'string') return null;
  const match = missionText.match(/^.*VISUAL-QC-REQUIRED.*$/im);
  return match ? match[0] : null;
}

// ---- splitOversizedPlan -----------------------------------------------------------
// Decides whether the validated micro_queue exceeds the size ceiling. If so, groups the
// steps into coherent sub-missions (by stage/subject — currently a simple equal-chunk
// grouping; the grouping strategy is tunable). Under the ceiling -> { split:false }.
// Unsplittable (no mission_id, no MISSION-ID in the text) -> { fail:true, reason }.
export function splitOversizedPlan(mission, queue, opts = {}) {
  const ceiling = opts.sizeCeiling ?? SIZE_CEILING;
  const steps = queue?.steps || [];
  const n = steps.length;

  // Under ceiling — run as one mission, unchanged.
  if (n <= ceiling) return { split: false };

  // Extract parent mission ID and class from the queue or the mission text.
  const parentId = queue?.mission_id
    || (String(mission || '').match(/MISSION-ID:\s*(\S+)/i) || [])[1]
    || null;
  const parentClass = (String(mission || '').match(/MISSION-CLASS:\s*(\S+)/i) || [])[1] || null;

  if (!parentId) {
    return { fail: true, reason: 'unsplittable: no MISSION-ID in queue or mission text — cannot mint child mission IDs' };
  }

  // Group steps into coherent sub-missions. Simple equal-chunk strategy: each sub-mission
  // gets up to `ceiling` steps. The last chunk may be smaller.
  const groups = [];
  for (let i = 0; i < n; i += ceiling) {
    const chunk = steps.slice(i, Math.min(i + ceiling, n));
    groups.push({
      index: groups.length + 1,
      steps: chunk,
      stepCount: chunk.length,
    });
  }

  return {
    split: true,
    parentId,
    parentClass,
    _parentMission: mission,
    ceiling,
    originalStepCount: n,
    groupCount: groups.length,
    groups,
  };
}

// ---- emitSubMissions --------------------------------------------------------------
// Writes each sub-mission as a .mission.txt file + a _split-manifest.json handoff record
// into the missions directory. Appends each child to the AUTORUN queue in tartib order.
// Each child carries its own Maqsad, the parent objective, inherited MISSION-CLASS, and
// a REQUIRES clause pointing to its predecessor (tartib: a child may not start until its
// predecessor's receipt exists).
export function emitSubMissions(plan, ctx = {}, io = {}) {
  const { missionsDir, parentMissionFile, parentId } = ctx;
  const writeFile = io.writeFile || ((p, c) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, c); });
  const appendQueue = io.appendQueue || null;

  if (!missionsDir) return { ok: false, reason: 'emitSubMissions: no missionsDir in ctx' };
  if (!plan.groups || !plan.groups.length) return { ok: false, reason: 'emitSubMissions: plan has no groups' };

  // BUG 1 FIX (2026-06-25, path-doubling): the daemon passes an ABSOLUTE parentMissionFile
  // (path.resolve(HERE, raw) at fire time). Stripping only `.mission.txt` left parentBase as
  // an absolute path like `C:\Users\...\missions\b13-...`; filename then became absolute too,
  // and `path.join(missionsDir, absoluteFilename)` on Windows DOUBLED the prefix —
  // exactly `mkdir 'C:\...\missions\C:\...\missions'` in the b13 retro. Reduce to BASENAME
  // first so `filename` and `rel` are always relative; the join below is safe.
  const parentBase = (typeof parentMissionFile === 'string' ? parentMissionFile : `${parentId}.mission.txt`).replace(/\.mission\.txt$/i, '');
  const files = [];
  const queued = [];

  for (const group of plan.groups) {
    const childId = `${parentId}.S${group.index}`;
    const predecessorId = group.index > 1 ? `${parentId}.S${group.index - 1}` : null;
    const filename = `${parentBase}.S${group.index}.mission.txt`;
    const rel = `missions/${filename}`;

    // Compute groupTargetFiles by flat-mapping group.steps' target_files
    const groupTargetFiles = group.steps.flatMap(s => s.target_files || []);

    // Compute isUiTouching
    const hasUiFile = groupTargetFiles.some(f => /\.(html|js|jsx|tsx|css)$/i.test(f));

    // Compute doneMeansClause
    const doneMeansClause = buildDoneMeansClause(groupTargetFiles);

    // Compute visualQcHeader
    const visualQcHeader = extractVisualQcHeader(plan._parentMission);

    // Build the child mission text.
    const stepList = group.steps.map((s, i) =>
      `  ${s.step_index}. ${s.description} [${s.action_type}] ${(s.target_files || []).join(', ')}`
    ).join('\n');

    const requiresClause = predecessorId
      ? `REQUIRES: ${predecessorId} (tartib — this sub-mission may not start until ${predecessorId}'s receipt exists)`
      : 'REQUIRES: none (first in tartib order)';

    // Build header lines with optional visualQcHeader
    const headerLines = [
      `MISSION-ID: ${childId}`,
      `MISSION-CLASS: ${plan.parentClass || 'code-repo'}`,
      `PARENT: ${parentId}`,
      `TARTIB-INDEX: ${group.index} of ${plan.groupCount}`,
      requiresClause,
      `STEPS: ${group.stepCount}`,
      ``,
      `PARENT MAQSAD: ${String((plan._parentMission || '').slice(0, 200) || '(see parent mission)')}`,
      ``,
      `Maqsad: sub-mission ${group.index} of ${plan.groupCount} — ${group.steps[0]?.description || 'execute steps'} through ${group.steps[group.steps.length - 1]?.description || 'completion'}`,
      ``,
    ];

    // Insert visualQcHeader as an additional header line ONLY when isUiTouching AND visualQcHeader is non-null
    const headerContent = [...headerLines];
    if (hasUiFile && visualQcHeader) {
      headerContent.splice(headerLines.indexOf('') + 1, 0, visualQcHeader);
    }

    const childText = [
      ...headerContent,
      `Steps:`,
      stepList,
      ``,
      doneMeansClause,
      ``,
    ].join('\n');

    // BUG 1 GUARD (2026-06-25): on Windows, path.join(prefix, absolutePath) produces a
    // doubled-prefix string instead of replacing — the b13 mkdir doubling. parentBase is
    // now a basename (above), so `filename` will be relative, but guard anyway: if anything
    // upstream passes an already-absolute path, honor it instead of doubling the prefix.
    const filePath = path.isAbsolute(filename) ? filename : path.join(missionsDir, filename);
    writeFile(filePath, childText);

    files.push({
      id: childId,
      rel,
      steps: group.stepCount,
      predecessorId,
    });

    // Append to AUTORUN queue in tartib order.
    if (appendQueue) {
      try { appendQueue(rel); queued.push(rel); } catch { /* queue append best-effort */ }
    }
  }

  // Write the _split-manifest.json handoff record. (parentBase is now a basename — see
  // BUG 1 fix above; the join is safe.)
  const manifestName = `${parentBase}._split-manifest.json`;
  const manifestPath = path.isAbsolute(manifestName) ? manifestName : path.join(missionsDir, manifestName);
  const manifest = {
    parentId: plan.parentId,
    ceiling: plan.ceiling,
    originalStepCount: plan.originalStepCount,
    groupCount: plan.groupCount,
    children: files.map((f) => ({ id: f.id, file: f.rel, steps: f.steps, requires: f.predecessorId })),
    ts: new Date().toISOString(),
  };
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return { ok: true, files, manifestPath, queued };
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('mission_split.mjs')) {
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  // ---- splitOversizedPlan ----------------------------------------------------------
  const mkQueue = (id, n) => ({ mission_id: id, steps: Array.from({ length: n }, (_, i) => ({
    step_index: i + 1, description: `step ${i + 1}`, action_type: 'edit',
    target_files: [`f${i + 1}.mjs`], context_dependencies: [], validation_command: `node -c f${i + 1}.mjs`,
  })) });

  // (1) UNDER ceiling -> { split: false }
  {
    const r = splitOversizedPlan('MISSION-ID: M-T1\nMaqsad: small.', mkQueue('M-T1', 3), { sizeCeiling: 8 });
    ck(r.split === false, 'UNDER ceiling (3 <= 8): returns { split:false } — run unchanged');
  }

  // (2) AT ceiling -> { split: false } (ceiling is inclusive)
  {
    const r = splitOversizedPlan('MISSION-ID: M-T2\nMaqsad: exact.', mkQueue('M-T2', 8), { sizeCeiling: 8 });
    ck(r.split === false, 'AT ceiling (8 == 8): returns { split:false } — ceiling is inclusive');
  }

  // (3) OVER ceiling -> { split: true, groups, ... }
  {
    const r = splitOversizedPlan('MISSION-ID: M-T3\nMaqsad: big.', mkQueue('M-T3', 16), { sizeCeiling: 8 });
    ck(r.split === true, 'OVER ceiling (16 > 8): returns { split:true }');
    ck(r.parentId === 'M-T3', 'parentId extracted from queue.mission_id');
    ck(r.ceiling === 8, 'ceiling carried in result');
    ck(r.originalStepCount === 16, 'originalStepCount = 16');
    ck(r.groupCount === 2, '16 steps / ceiling 8 = 2 groups');
    ck(r.groups.length === 2, 'groups array has 2 entries');
    ck(r.groups[0].stepCount === 8 && r.groups[1].stepCount === 8, 'both groups have 8 steps each (equal chunk)');
  }

  // (4) OVER ceiling, uneven split (last chunk smaller)
  {
    const r = splitOversizedPlan('MISSION-ID: M-T4\nMaqsad: uneven.', mkQueue('M-T4', 7), { sizeCeiling: 3 });
    ck(r.split === true && r.groupCount === 3, '7 steps / ceiling 3 = 3 groups');
    ck(r.groups[0].stepCount === 3 && r.groups[1].stepCount === 3 && r.groups[2].stepCount === 1, 'groups: [3, 3, 1] — last chunk smaller');
  }

  // (5) MISSION-ID from mission text (not queue)
  {
    const q = { steps: mkQueue('x', 9).steps }; // NO mission_id on queue
    const r = splitOversizedPlan('MISSION-ID: M-T5\nMaqsad: from text.', q, { sizeCeiling: 3 });
    ck(r.split === true && r.parentId === 'M-T5', 'parentId extracted from MISSION-ID in mission TEXT when queue has no mission_id');
  }

  // (6) UNSPLITTABLE: no mission_id anywhere
  {
    const r = splitOversizedPlan('Maqsad: no id at all.', { steps: mkQueue('x', 9).steps }, { sizeCeiling: 3 });
    ck(r.fail === true && /no MISSION-ID/.test(r.reason), 'UNSPLITTABLE: no MISSION-ID -> { fail:true } with named reason');
  }

  // (7) Default ceiling (SIZE_CEILING from deconstructor.mjs)
  {
    const r = splitOversizedPlan('MISSION-ID: M-T7\nMaqsad: default.', mkQueue('M-T7', 3));
    ck(r.split === false, 'DEFAULT ceiling: 3 steps under SIZE_CEILING=8 -> { split:false }');
  }

  // ---- emitSubMissions -------------------------------------------------------------
  {
    const os = await import('os');
    const fsEmit = await import('fs');
    const tmp = fsEmit.mkdtempSync(path.join(os.tmpdir(), 'msplit_'));
    const missionsDir = path.join(tmp, 'missions');
    fsEmit.mkdirSync(missionsDir, { recursive: true });
    const autorun = path.join(missionsDir, 'AUTORUN.md');
    fsEmit.writeFileSync(autorun, '# queue\n');

    const plan = splitOversizedPlan('MISSION-ID: M-E1\nMISSION-CLASS: research\nMaqsad: a complete index.', mkQueue('M-E1', 7), { sizeCeiling: 3 });
    plan._parentMission = 'MISSION-ID: M-E1\nMISSION-CLASS: research\nMaqsad: a complete index.';

    const out = emitSubMissions(plan, {
      missionsDir,
      parentMissionFile: 'emit-1.mission.txt',
      parentId: plan.parentId,
    }, {
      writeFile: (p, c) => { fsEmit.mkdirSync(path.dirname(p), { recursive: true }); fsEmit.writeFileSync(p, c); },
      appendQueue: (rel) => { fsEmit.appendFileSync(autorun, `\n${rel}`); },
    });

    ck(out.ok === true, 'emitSubMissions: returns ok:true');
    ck(out.files.length === 3, 'emitSubMissions: 3 files emitted for 3 groups');
    ck(out.files[0].id === 'M-E1.S1' && out.files[0].predecessorId === null, 'emitSubMissions: S1 has no predecessor');
    ck(out.files[1].id === 'M-E1.S2' && out.files[1].predecessorId === 'M-E1.S1', 'emitSubMissions: S2 requires S1');
    ck(out.files[2].id === 'M-E1.S3' && out.files[2].predecessorId === 'M-E1.S2', 'emitSubMissions: S3 requires S2');

    // Check file existence
    ck(fsEmit.existsSync(path.join(missionsDir, 'emit-1.S1.mission.txt')), 'emitSubMissions: S1 file written');
    ck(fsEmit.existsSync(path.join(missionsDir, 'emit-1.S2.mission.txt')), 'emitSubMissions: S2 file written');
    ck(fsEmit.existsSync(path.join(missionsDir, 'emit-1.S3.mission.txt')), 'emitSubMissions: S3 file written');
    ck(fsEmit.existsSync(path.join(missionsDir, 'emit-1._split-manifest.json')), 'emitSubMissions: manifest written');

    // Check child content
    const s1 = fsEmit.readFileSync(path.join(missionsDir, 'emit-1.S1.mission.txt'), 'utf8');
    ck(/MISSION-ID: M-E1\.S1/.test(s1), 'emitSubMissions: child carries MISSION-ID');
    ck(/PARENT: M-E1/.test(s1), 'emitSubMissions: child carries PARENT');
    ck(/TARTIB-INDEX: 1 of 3/.test(s1), 'emitSubMissions: child carries TARTIB-INDEX');
    ck(/REQUIRES: none/.test(s1), 'emitSubMissions: first child has REQUIRES: none');
    ck(/PARENT MAQSAD/.test(s1), 'emitSubMissions: child carries PARENT MAQSAD');
    ck(/MISSION-CLASS: research/.test(s1), 'emitSubMissions: child inherits MISSION-CLASS');

    const s2 = fsEmit.readFileSync(path.join(missionsDir, 'emit-1.S2.mission.txt'), 'utf8');
    ck(/REQUIRES: M-E1\.S1/.test(s2), 'emitSubMissions: S2 REQUIRES S1');

    // Check manifest
    const manifest = JSON.parse(fsEmit.readFileSync(path.join(missionsDir, 'emit-1._split-manifest.json'), 'utf8'));
    ck(manifest.parentId === 'M-E1' && manifest.children.length === 3, 'emitSubMissions: manifest has parentId + 3 children');

    // Check AUTORUN append
    const autorunBody = fsEmit.readFileSync(autorun, 'utf8');
    ck(autorunBody.indexOf('emit-1.S1.mission.txt') < autorunBody.indexOf('emit-1.S2.mission.txt')
      && autorunBody.indexOf('emit-1.S2.mission.txt') < autorunBody.indexOf('emit-1.S3.mission.txt'),
      'emitSubMissions: children appended to AUTORUN in tartib order');

    // Cleanup
    fsEmit.rmSync(tmp, { recursive: true, force: true });
  }

  // New self-test cases for buildDoneMeansClause and extractVisualQcHeader
  {
    const os = await import('os');
    const fsEmit = await import('fs');
    const tmp = fsEmit.mkdtempSync(path.join(os.tmpdir(), 'msplit_test2_'));
    const missionsDir = path.join(tmp, 'missions');
    fsEmit.mkdirSync(missionsDir, { recursive: true });

    // Test (1): code-only synthetic split (no VISUAL-QC-REQUIRED, non-UI target files)
    {
      const plan1 = {
        parentId: 'CODE-ONLY',
        parentClass: 'code-repo',
        ceiling: 3,
        originalStepCount: 2,
        groupCount: 1,
        groups: [{
          index: 1,
          steps: [{
            step_index: 1,
            description: 'code-only step',
            action_type: 'edit',
            target_files: ['app.mjs', 'lib.mjs']
          }],
          stepCount: 1
        }],
        _parentMission: 'MISSION-ID: CODE-ONLY\nMaqsad: code-only test.'
      };

      const out1 = emitSubMissions(plan1, {
        missionsDir,
        parentMissionFile: 'code-only.mission.txt',
        parentId: 'CODE-ONLY'
      }, {
        writeFile: (p, c) => { fsEmit.mkdirSync(path.dirname(p), { recursive: true }); fsEmit.writeFileSync(p, c); }
      });

      ck(out1.ok === true, 'code-only split: emitSubMissions succeeds');

      const s1 = fsEmit.readFileSync(path.join(missionsDir, 'code-only.S1.mission.txt'), 'utf8');
      const doneMeansRegex = /done\s*means\s*:|done-means/i;
      const renderWitnessRegex = /\b(headless\s*browser|playwright|puppeteer|headless\s*render|browser\s*render)\b/i;

      ck(doneMeansRegex.test(s1), 'code-only split: done-means regex matched');
      ck(!renderWitnessRegex.test(s1), 'code-only split: no render witness regex matched');
    }

    // Test (2): UI-touching group with VISUAL-QC-REQUIRED header
    {
      const plan2 = {
        parentId: 'UI-QC',
        parentClass: 'ui-repo',
        ceiling: 3,
        originalStepCount: 1,
        groupCount: 1,
        groups: [{
          index: 1,
          steps: [{
            step_index: 1,
            description: 'ui step',
            action_type: 'edit',
            target_files: ['index.html', 'style.css']
          }],
          stepCount: 1
        }],
        _parentMission: 'MISSION-ID: UI-QC\nMISSION-CLASS: ui\nVISUAL-QC-REQUIRED\nMaqsad: UI test with header.'
      };

      const out2 = emitSubMissions(plan2, {
        missionsDir,
        parentMissionFile: 'ui-qc.mission.txt',
        parentId: 'UI-QC'
      }, {
        writeFile: (p, c) => { fsEmit.mkdirSync(path.dirname(p), { recursive: true }); fsEmit.writeFileSync(p, c); }
      });

      ck(out2.ok === true, 'UI-QC split: emitSubMissions succeeds');

      const s2 = fsEmit.readFileSync(path.join(missionsDir, 'ui-qc.S1.mission.txt'), 'utf8');
      const doneMeansRegex = /done\s*means\s*:|done-means/i;
      const renderWitnessRegex = /\b(headless\s*browser|playwright|puppeteer|headless\s*render|browser\s*render)\b/i;

      ck(doneMeansRegex.test(s2), 'UI-QC split: done-means regex matched');
      ck(renderWitnessRegex.test(s2), 'UI-QC split: render witness regex matched');
      ck(/VISUAL-QC-REQUIRED/.test(s2), 'UI-QC split: VISUAL-QC-REQUIRED present in child text');
    }

    // Cleanup
    fsEmit.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(fails === 0 ? '\nALL PASS — mission_split: splitOversizedPlan + emitSubMissions sound' : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}
