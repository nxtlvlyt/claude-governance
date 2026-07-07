// E2E replay of gap #6 kill-shape: a step lists a >250KB file as a context DEP
// (original receipt: 358KB map.html raw-inlined -> 265K tokens -> HTTP 400, 2026-06-18).
// Exercises the REAL readDep disk path (no readFn injection) via windowDepsForPrompt
// and the full buildEditFraming prompt builder.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = await import(pathToFileURL('C:/Users/marka/.claude/muezzin-plugin/executor.mjs').href);
const { windowDepsForPrompt, buildEditFraming } = mod;

const dir = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/gap6-cwd';
mkdirSync(dir, { recursive: true });

// Build a ~400KB dep mimicking map.html with one anchor-relevant region
const lines = [];
for (let i = 0; i < 12000; i++) {
  lines.push(i === 9000
    ? '<div id="reviewsPanelAnchor">reviews panel mount point</div>'
    : `<!-- filler map markup line ${i} lorem ipsum dolor sit amet -->`);
}
const bigDep = lines.join('\n');
writeFileSync(path.join(dir, 'map.html'), bigDep);
const target = 'reviews-ui.mjs';
const current = 'export const panel = 1;\n';
writeFileSync(path.join(dir, target), current);

const step = {
  step_index: 1,
  description: 'wire the reviewsPanelAnchor mount into the reviews UI panel',
  action_type: 'edit',
  target_files: [target],
  context_dependencies: ['map.html'],
  validation_command: 'node -c reviews-ui.mjs',
};

const results = [];
const ck = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) process.exitCode = 1; };

console.log(`raw dep size on disk: ${bigDep.length} bytes (> 250KB kill-shape: ${bigDep.length > 250000})`);

// 1) The dep-windowing function over the REAL disk read path
const dw = windowDepsForPrompt(step, dir);
console.log(`windowDepsForPrompt output: ${dw.length} bytes`);
ck(bigDep.length > 250000, `dep is genuinely over 250KB (${bigDep.length} bytes)`);
ck(dw.length < 61000, `dep block capped under the 60KB per-dep budget (got ${dw.length} bytes, was ${bigDep.length} raw)`);
ck(/dep windowed|dep truncated/.test(dw), 'omission marker present on the capped dep');
ck(dw.includes('reviewsPanelAnchor'), 'anchor-relevant region survives windowing');

// 2) The full edit-framing prompt (the thing that used to hit HTTP 400)
const ef = buildEditFraming(step, dir, current);
console.log(`buildEditFraming total prompt: ${ef.length} bytes`);
ck(ef.length < 100000, `whole edit-framing prompt bounded (${ef.length} bytes; pre-fix it embedded the full ${bigDep.length}-byte dep)`);
ck(/dep windowed|dep truncated/.test(ef), 'framing carries the dep-window marker (windowed path engaged inside the builder)');
ck(ef.includes(current.trim()), 'target file still embedded whole (windowing hit the DEP, not the small target)');

console.log(results.join('\n'));

rmSync(dir, { recursive: true, force: true });
