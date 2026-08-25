// patch_resume.mjs — cross-attempt resumable uploads (server status endpoint + client resume)
import { readFileSync, writeFileSync } from 'fs';

// ---- chunk.php: add act=status (server already tracks .idx — expose it) ----
const sAnchor = `if ($act === 'chunk') {`;
const sNew = `if ($act === 'status') {
  // RESUME SUPPORT (operator receipt 2026-06-12 17:14: three stalled high-res attempts,
  // 508MB orphaned — each page reload minted a new batch and restarted from zero).
  $out = [];
  foreach (glob("$bdir/*.part.idx") as $st) {
    if (preg_match('/(\\d{2})\\.([a-z0-9]+)\\.part\\.idx$/', $st, $m)) $out[(int)$m[1]] = ['chunks' => (int)file_get_contents($st)];
  }
  foreach (glob("$bdir/*.{jpg,jpeg,png,webp,heic,mp4,mov}", GLOB_BRACE) as $f) {
    if (preg_match('/(\\d{2})\\.[a-z0-9]+$/', basename($f), $m)) $out[(int)$m[1]] = ['done' => true];
  }
  echo json_encode(['ok' => true, 'files' => (object)$out]); exit;
}

if ($act === 'chunk') {`;

// ---- index.php JS: fingerprint + resume ----
const jAnchor = `  const batch = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);`;
const jNew = `  // CROSS-ATTEMPT RESUME: same files re-picked after a stall -> same batch id, server
  // tells us what it already has, we skip it (operator lost 3 attempts at GB scale).
  const fp = picked.map(en => en.f.name + ':' + en.f.size + ':' + en.f.lastModified).join('|');
  let batch = null, resume = {};
  try {
    const saved = JSON.parse(localStorage.getItem('nxtlvl-up') || 'null');
    if (saved && saved.fp === fp && saved.batch) {
      const st = await fetch('chunk.php?act=status&batch=' + saved.batch).then(r => r.ok ? r.json() : null);
      if (st && st.ok) { batch = saved.batch; resume = st.files || {}; }
    }
  } catch {}
  if (!batch) batch = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
  localStorage.setItem('nxtlvl-up', JSON.stringify({ batch, fp }));`;

const loopAnchor = `    for (let n = 0; n < files.length; n++) {
      const f = files[n];
      const ext = (f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
      const chunks = Math.max(1, Math.ceil(f.size / CHUNK));
      for (let i = 0; i < chunks; i++) {`;
const loopNew = `    for (let n = 0; n < files.length; n++) {
      const f = files[n];
      const ext = (f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
      const chunks = Math.max(1, Math.ceil(f.size / CHUNK));
      const rs = resume[n] || {};
      if (rs.done) { sent += f.size; bar.style.width = Math.round(100 * sent / totalBytes) + '%'; ptext.textContent = f.name + ': already uploaded, skipping'; continue; }
      const startChunk = Math.min(rs.chunks || 0, chunks);
      if (startChunk > 0) { sent += Math.min(startChunk * CHUNK, f.size); bar.style.width = Math.round(100 * sent / totalBytes) + '%'; ptext.textContent = f.name + ': resuming at ' + Math.round(100 * startChunk / chunks) + '%'; }
      for (let i = startChunk; i < chunks; i++) {`;

const finAnchor = `    ptext.textContent = '';
    prog.style.display = 'none';`;
const finNew = `    localStorage.removeItem('nxtlvl-up');
    ptext.textContent = '';
    prog.style.display = 'none';`;

for (const [f, pairs] of [
  ['N:/web/vanlife/map/post/chunk.php', [[sAnchor, sNew]]],
  ['E:/AI_Storage/website-pipeline/apps/post-intake/web/chunk.php', [[sAnchor, sNew]]],
  ['N:/web/vanlife/map/post/index.php', [[jAnchor, jNew], [loopAnchor, loopNew], [finAnchor, finNew]]],
  ['E:/AI_Storage/website-pipeline/apps/post-intake/web/index.php', [[jAnchor, jNew], [loopAnchor, loopNew], [finAnchor, finNew]]],
]) {
  let c; try { c = readFileSync(f, 'utf8'); } catch (e) { console.log('SKIP (missing):', f); continue; }
  let ok = true;
  for (const [a, b] of pairs) {
    if (c.includes(a)) c = c.replace(a, b);
    else { ok = false; console.log('MISS in', f, ':', JSON.stringify(a.slice(0, 60))); }
  }
  if (ok) { writeFileSync(f, c); console.log('patched:', f); }
}
