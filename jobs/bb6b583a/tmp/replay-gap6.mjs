// E2E replay of gap #6 kill-shape (read-only on engine; scratch dir only).
// Original failure (receipt reviews-ui-2, 2026-06-18): a step listed 358KB map.html as a
// context DEP; readDep raw-inlined it uncapped -> 265K-token prompt -> HTTP 400, so
// "windowed-edit never engaged" on >250KB files. Replay: real 358KB dep ON DISK, fired
// through the exported PRODUCTION framing builder (buildEditFraming -> windowDepsForPrompt
// -> real readDep). Expect: dep capped with a marker, anchor region survives, whole prompt
// bounded far below the HTTP-400 class.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildEditFraming, windowDepsForPrompt } from 'file:///C:/Users/marka/.claude/muezzin-plugin/executor.mjs';

const dir = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/gap6-cwd';
mkdirSync(dir, { recursive: true });

// Build a ~358KB dep simulating map.html, with the step's anchor term buried deep inside.
const lines = [];
for (let i = 0; i < 12000; i++) {
  lines.push(i === 9000
    ? '  function renderReviewsPanelXq() { /* the region the step needs */ }'
    : `  <div class="filler-row-${i}">lorem ipsum dolor sit amet consectetur adipiscing elit ${i}</div>`);
}
let dep = lines.join('\n');
while (dep.length < 358 * 1024) dep += '\n<!-- pad ' + 'x'.repeat(200) + ' -->';
writeFileSync(`${dir}/map.html`, dep);

const step = {
  step_index: 1,
  description: 'wire renderReviewsPanelXq into the reviews UI panel',
  action_type: 'edit',
  target_files: ['reviews.mjs'],
  context_dependencies: ['map.html'],
  validation_command: 'node -c reviews.mjs',
};
const currentTarget = 'export function reviewsPanel() {\n  return null; // TODO wire renderReviewsPanelXq\n}\n';

let pass = 0, fail = 0;
const ck = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); ok ? pass++ : fail++; };

console.log(`dep on disk: ${dep.length} bytes (kill-shape threshold: >250KB, original 358KB)`);

// 1. Direct exported function, real readDep path (no mock readFn)
const win = windowDepsForPrompt(step, dir);
console.log(`windowDepsForPrompt output: ${win.length} bytes`);
ck(win.length <= 61000, `dep block capped at per-dep 60KB budget (got ${win.length} bytes from ${dep.length})`);
ck(/dep windowed|dep truncated/.test(win), 'omission marker present (cut is explicit, not silent)');
ck(win.includes('renderReviewsPanelXq'), 'anchor-relevant region survives windowing');

// 2. Full production framing builder (the path the seat prompt actually takes)
const framing = buildEditFraming(step, dir, currentTarget);
console.log(`buildEditFraming full prompt: ${framing.length} bytes`);
ck(framing.length < 200000, `whole framing prompt bounded (got ${framing.length} bytes; raw-inline era would exceed ${dep.length})`);
ck(framing.length < dep.length, 'prompt is SMALLER than the raw dep (proof windowing engaged, unlike 2026-06-18)');
ck(framing.includes('map.html'), 'dep still named in the prompt (context not dropped, only windowed)');

// 3. Total-budget bound: three copies of the >250KB dep (many-big-deps shape)
const multi = windowDepsForPrompt({ ...step, context_dependencies: ['map.html', 'map.html', 'map.html'] }, dir);
ck(multi.length <= 155000, `3x358KB deps bounded by 150KB TOTAL budget (got ${multi.length} bytes vs ${3 * dep.length} raw)`);

rmSync(dir, { recursive: true, force: true });
console.log(fail === 0 ? `\nALL PASS (${pass}/${pass + fail}) — gap #6 kill-shape rejected by live executor.mjs` : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
