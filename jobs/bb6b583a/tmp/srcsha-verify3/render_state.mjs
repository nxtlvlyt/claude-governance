// render_state.mjs — Muezzin keystone (agy M31 `buildStateMdUpdate`): deterministic STATE.md.
//
// Takes a STRUCTURED state object (assembled from verified substrate + the merged verdict) and
// renders the human-readable STATE.md PROGRAMMATICALLY. No LLM writes the record — that is
// Directive 1 enforced: a model can't put in the record anything the disk doesn't back up.
// Pairs with verdict_merge.mjs (the gate) and a prev-hash chain (tamper-evidence; genesis = no prior).

// The headers the renderer OWNS — anything else in a prior STATE.md is agent-authored and must survive.
const OWNED_HEADERS = [
  '## Pipeline Status', '## Active Concerns', '## Rulings',
  '## Bootstrap Handoff', '## Last Compaction',
];

// Directive 8: a section authored by a prior session (not owned by this renderer) must NOT be dropped
// on overwrite, or the next session can't resume. Find every top-level '## '/'# ' section in the prior
// STATE.md whose header the renderer does NOT own, and append it under a 'Preserved (carried forward)'
// block of the freshly rendered output. Returns renderedMd unchanged when there is nothing to carry.
export function preserveSections(prevStateMd, renderedMd, knownHeaders = OWNED_HEADERS) {
  if (!prevStateMd || typeof prevStateMd !== 'string') return renderedMd;
  const lines = prevStateMd.split(/\r?\n/);
  // Identify top-level section boundaries: lines starting with '# ' or '## ' (not '###'+).
  const isTopHeader = (ln) => /^#{1,2} \S/.test(ln);
  const owned = new Set(knownHeaders.map((h) => h.trim()));
  const orphanBlocks = [];
  let i = 0;
  while (i < lines.length) {
    if (isTopHeader(lines[i])) {
      const header = lines[i].trim();
      // Collect this section's body until the next top-level header.
      const block = [lines[i]];
      i++;
      while (i < lines.length && !isTopHeader(lines[i])) { block.push(lines[i]); i++; }
      // Skip the document title '# STATE.md' and any header the renderer owns or already produced.
      const isDocTitle = /^# STATE\.md\b/.test(header);
      const alreadyRendered = renderedMd.includes(header);
      if (!isDocTitle && !owned.has(header) && !alreadyRendered) {
        // Trim trailing blank lines off the carried block so spacing stays clean.
        while (block.length && block[block.length - 1].trim() === '') block.pop();
        orphanBlocks.push(block.join('\n'));
      }
    } else {
      i++;
    }
  }
  if (!orphanBlocks.length) return renderedMd;
  const out = renderedMd.replace(/\s+$/, '');
  return `${out}\n\n## Preserved (carried forward)\n\n` +
    '> Sections authored by a prior session, not owned by the renderer (Directive 8 — carried so the next session can resume).\n\n' +
    orphanBlocks.join('\n\n') + '\n';
}

export function renderStateMd(state, prevStateMd = null) {
  const L = [];
  L.push('# STATE.md', '');
  L.push('> Rendered programmatically by the Muezzin from verified substrate (Directive 1).');
  L.push(`> Last Compaction: ${state.timestamp || '(stamped at write time)'}`, '');

  L.push('## Pipeline Status', '');
  for (const m of (state.missions || [])) {
    L.push(`- **${m.id}** — ${m.status}${m.confidence != null ? ` (conf ${m.confidence})` : ''}`);
  }
  if (!(state.missions || []).length) L.push('- (none)');
  L.push('');

  L.push('## Active Concerns', '');
  for (const c of (state.concerns || [])) {
    L.push(`- **${c.id}** (Bucket ${c.bucket}) [${c.status}]: ${c.description}`);
  }
  if (!(state.concerns || []).length) L.push('- (none)');
  L.push('');

  L.push('## Rulings', '');
  for (const r of (state.rulings || [])) {
    L.push(`- ${r.ruling_id}: ${r.decision} (conf ${r.confidence}) — ${r.subject}`);
  }
  if (!(state.rulings || []).length) L.push('- (none)');
  L.push('');

  L.push('## Bootstrap Handoff', '');
  for (const p of (state.handoff_paths || [])) {
    L.push(`- ${p.exists ? '✓' : '✗ MISSING'} ${p.path}`);
  }
  if (!(state.handoff_paths || []).length) L.push('- (none)');
  L.push('');

  L.push('## Last Compaction', '');
  L.push(`- verdict: ${state.verdict || 'n/a'}`);
  L.push(`- prev_state_hash: ${state.prev_hash || 'GENESIS'}`); // hash-chain; GENESIS when no prior entry
  L.push('');
  const rendered = L.join('\n');
  // Directive 8: carry forward any prior agent-authored section the renderer doesn't own.
  return prevStateMd ? preserveSections(prevStateMd, rendered) : rendered;
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('render_state.mjs')) {
  const md = renderStateMd({
    timestamp: '2026-06-10T00:00:00Z', verdict: 'APPROVE', prev_hash: 'GENESIS',
    missions: [{ id: 'M42', status: 'COMPLETE', confidence: 0.98 }],
    concerns: [{ id: 'M42-AC-1', bucket: 2, status: 'OPEN', description: 'sub-state size cap' }],
    rulings: [{ ruling_id: 'KK-INT-M42-R1', decision: 'ADOPTED', confidence: 0.97, subject: 'micro-queue' }],
    handoff_paths: [{ path: 'C:/x/y.md', exists: true }, { path: 'C:/x/z.md', exists: false }],
  });
  let fails = 0;
  const ck = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };
  for (const s of ['## Pipeline Status', '## Active Concerns', '## Rulings', '## Bootstrap Handoff', '## Last Compaction'])
    ck(md.includes(s), `section present: ${s}`);
  ck(md.includes('✗ MISSING C:/x/z.md'), 'missing path flagged, not silently dropped');
  ck(md.includes('prev_state_hash: GENESIS'), 'genesis hash present (witness round-3 fix)');
  ck(md.includes('M42** — COMPLETE'), 'mission status rendered from structured data');

  // Directive-8 content-loss fix: a prior agent-authored custom section must survive a re-render.
  const priorWithCustom = md + '\n\n## Isha Rulings (session 2026-06-09)\n\n- carried decision: keep the niyyah gate read-only during bootstrap\n- second line of the custom section\n';
  const md2 = renderStateMd({
    timestamp: '2026-06-11T00:00:00Z', verdict: 'APPROVE', prev_hash: 'abc123',
    missions: [{ id: 'M43', status: 'PHASE_2', confidence: 0.9 }],
    concerns: [], rulings: [], handoff_paths: [],
  }, priorWithCustom);
  ck(md2.includes('## Isha Rulings (session 2026-06-09)') &&
     md2.includes('carried decision: keep the niyyah gate read-only during bootstrap') &&
     md2.includes('second line of the custom section') &&
     md2.includes('## Preserved (carried forward)'),
     'Directive 8: prior custom section (## Isha Rulings ...) survives re-render under Preserved block');

  console.log(`\n${fails === 0 ? 'ALL PASS — deterministic STATE.md renderer sound' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
