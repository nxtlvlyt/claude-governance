import { readFileSync } from 'fs';
import { injectDeclaredDeps, parseDeclaredDeps } from '/c/Users/marka/agy-muezzin/deconstructor.mjs';
const missionText = readFileSync('/c/Users/marka/agy-muezzin/missions/atv-1-competitor-analysis.S2.mission.txt', 'utf8');
const decls = parseDeclaredDeps(missionText);
console.log('parsed decls:', decls.length);
decls.forEach((d, i) => console.log(' decl', i, 'targets:', d.targets, '| deps:', d.deps.length, d.deps.slice(0,1)));
const queue = { steps: [
  { step_index: 1, action_type: 'edit', target_files: ['ANDROIDTV-COMPETITOR-ANALYSIS.md'], context_dependencies: ['parts/competitor-firetvsticks.com.md'] }
]};
const result = injectDeclaredDeps(queue, missionText, { research: true });
console.log('inject result:', JSON.stringify(result));
console.log('queue step 0 deps after inject:', JSON.stringify(queue.steps[0].context_dependencies));
