// Adversarial re-verification of the gap-6 E2E-FAIL verdict (read-only replay).
// Kill-shape: a real ~768,886-byte map.html-like DEP on disk, anchor region ~76% in,
// read via the DEFAULT readDep path (no readFn injection).
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { windowDepsForPrompt, buildEditFraming } from 'file:///C:/Users/marka/.claude/muezzin-plugin/executor.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'gap6-replay-'));
try {
  // Build a 768,886-byte HTML-like dep with a distinctive anchor region ~76% in.
  const line = '<div class="poi" data-lat="49.28" data-lng="-123.12">marker popup content filler</div>\n'; // 86 bytes
  const anchor = 'function initClusterMarkers(map) { /* ANCHOR-REGION: bindPopup wiring lives here */ }\n'; // 87 bytes
  const TARGET_SIZE = 768886;
  const anchorAt = Math.floor(TARGET_SIZE * 0.76);
  let head = '';
  while (head.length < anchorAt) head += line;
  head = head.slice(0, anchorAt - (anchorAt % line.length)); // keep whole lines
  let body = head + anchor;
  while (body.length < TARGET_SIZE) body += line;
  body = body.slice(0, TARGET_SIZE);
  writeFileSync(path.join(dir, 'map.html'), body);

  const step = {
    step_index: 1,
    description: 'update initClusterMarkers popup binding in app.js using map.html as reference',
    action_type: 'edit',
    target_files: ['app.js'],
    context_dependencies: ['map.html'],
    validation_command: 'node -e "0"',
  };

  console.log('raw dep size on disk:', body.length, 'bytes');
  console.log('anchor offset:', body.indexOf('initClusterMarkers'), `(~${Math.round(100 * body.indexOf('initClusterMarkers') / body.length)}% in)`);

  // (A) default readDep path — what production actually does
  const win = windowDepsForPrompt(step, dir);
  console.log('windowDepsForPrompt (default readFn) output:', win.length, 'bytes');
  const hasMarker = /dep windowed|dep truncated|bytes omitted|dep omitted/.test(win);
  const hasAnchor = win.includes('initClusterMarkers');
  console.log(win.length < 60000 + 500 ? 'PASS dep block capped under the 60KB per-dep budget' : 'FAIL dep block exceeds 60KB budget');
  console.log(hasMarker ? 'PASS omission marker present on the capped dep' : 'FAIL omission marker present on the capped dep');
  console.log(hasAnchor ? 'PASS anchor-relevant region survives windowing' : 'FAIL anchor-relevant region survives windowing');

  // (B) full edit-framing prompt
  const framing = buildEditFraming(step, dir, 'export const wired = false;\n');
  console.log('buildEditFraming total prompt:', framing.length, 'bytes');
  console.log(framing.length < 200000 ? 'PASS whole edit-framing prompt bounded' : 'FAIL whole edit-framing prompt unbounded');
  console.log(/dep windowed|dep truncated|bytes omitted|dep omitted/.test(framing) ? 'PASS framing carries the dep-window marker' : 'FAIL framing carries the dep-window marker');

  // (C) control: same dep content via injected readFn (the selftest's bypass) — does windowing engage then?
  const injected = windowDepsForPrompt(step, dir, { readFn: () => body });
  console.log('CONTROL injected-readFn output:', injected.length, 'bytes;',
    'marker:', /dep windowed|dep truncated/.test(injected),
    'anchor survives:', injected.includes('initClusterMarkers'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
