// patch_mgmt.mjs — add regenerate + caption-edit controls to results.php (both copies)
import { readFileSync, writeFileSync } from 'fs';

const h = `$batches = [];`;
const hNew = `// regenerate action (operator management 2026-06-12): retire the current result as
// HISTORY (result-<ts>.json stays in the batch dir) and requeue the AI tail — the
// processor re-runs analysis/captions/thumbnails with whatever the pipeline knows NOW.
if (!empty($_POST['regen'])) {
  $name = preg_replace('/[^a-zA-Z0-9\\-]/', '', $_POST['regen']);
  if ($name && is_dir("$qdir/$name") && file_exists("$qdir/$name/meta.json")) {
    if (file_exists("$qdir/$name/result.json")) rename("$qdir/$name/result.json", "$qdir/$name/result-" . date('Ymd-His') . ".json");
    $m = json_decode(file_get_contents("$qdir/$name/meta.json"), true);
    $m['status'] = 'pending'; unset($m['error']); $m['retries'] = 0;
    file_put_contents("$qdir/$name/meta.json", json_encode($m, JSON_PRETTY_PRINT));
  }
  header('Location: results.php'); exit;
}
// caption edit (operator management): his words overwrite the model's, flagged so
// QC and future regenerations know a human took the pen.
if (!empty($_POST['savecap']) && isset($_POST['captext'])) {
  $name = preg_replace('/[^a-zA-Z0-9\\-]/', '', $_POST['savecap']);
  $plat = preg_replace('/[^a-z]/', '', $_POST['plat'] ?? '');
  $rf = "$qdir/$name/result.json";
  if ($name && $plat && file_exists($rf)) {
    $res = json_decode(file_get_contents($rf), true);
    if (isset($res['packages'][$plat])) {
      if ($plat === 'youtube') { $res['packages'][$plat]['description'] = $_POST['captext']; }
      else { $res['packages'][$plat]['caption'] = $_POST['captext']; }
      $res['packages'][$plat]['operator_edited'] = true;
      file_put_contents($rf, json_encode($res, JSON_PRETTY_PRINT));
    }
  }
  header('Location: results.php'); exit;
}

$batches = [];`;

const loop = `<?php foreach ($cards as $name => $text): if (!trim($text)) continue; [$ic, $col] = $picon[$name]; ?>`;
const loopNew = `<?php foreach ($cards as $name => $text): if (!trim($text)) continue; [$ic, $col] = $picon[$name]; $rawKey = strtolower($name); $raw = $name === 'YouTube' ? ($p['youtube']['description'] ?? '') : ($p[$rawKey]['caption'] ?? ''); ?>`;

const btn = `<span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 0;">content_copy</span> Copy
</button>
</div>
<?php endforeach; ?>`;
const btnNew = `<span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 0;">content_copy</span> Copy
</button>
<details class="mt-2"><summary class="font-label-sm text-label-sm text-secondary cursor-pointer uppercase tracking-wider">Edit</summary>
<form method="post" class="mt-2">
<input type="hidden" name="savecap" value="<?= $bid ?>"><input type="hidden" name="plat" value="<?= $rawKey ?>">
<textarea name="captext" rows="5" class="w-full rounded bg-[#10151a] border border-white/10 text-on-surface text-sm p-2 font-body-md"><?= esc($raw) ?></textarea>
<button class="mt-2 w-full py-1.5 rounded accent-teal text-white font-label-md text-label-md">Save my version</button>
</form></details>
</div>
<?php endforeach; ?>`;

const tail = `</div>
<?php endif; ?>
</div>
</details>`;
const tailNew = `</div>
<?php endif; ?>
<form method="post" class="mt-4" onsubmit="return confirm('Regenerate captions, hook score and designed thumbnail for this batch? The current version is kept as history. Renders and originals are untouched.')">
<input type="hidden" name="regen" value="<?= $bid ?>">
<button class="w-full py-2 rounded border border-[#0d9488]/40 text-[#0d9488] font-label-md text-label-md hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 0;">refresh</span> Regenerate this batch</button>
</form>
</div>
</details>`;

for (const f of ['N:/web/vanlife/map/post/results.php', 'E:/AI_Storage/website-pipeline/apps/post-intake/web/results.php']) {
  let c = readFileSync(f, 'utf8');
  let ok = true;
  for (const [a, b] of [[h, hNew], [loop, loopNew], [btn, btnNew], [tail, tailNew]]) {
    if (c.includes(a)) c = c.replace(a, b);
    else { ok = false; console.log('MISS in', f, ':', JSON.stringify(a.slice(0, 50))); }
  }
  if (ok) { writeFileSync(f, c); console.log('patched:', f); }
}
