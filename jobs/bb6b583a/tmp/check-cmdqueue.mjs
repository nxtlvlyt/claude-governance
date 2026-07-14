// Preflight receipt: does the amended atv-production-redeploy-witness mission parse
// through the engine's own command-class door (command_queue.mjs)?
import { readFileSync } from 'fs';
import { isCommandClassMission, buildLiteralCommandQueue } from 'file:///C:/Users/marka/agy-muezzin/command_queue.mjs';

const mission = readFileSync('C:/Users/marka/agy-muezzin/missions/atv-production-redeploy-witness.mission.txt', 'utf8');
console.log('isCommandClass:', isCommandClassMission(mission));
const q = buildLiteralCommandQueue(mission);
if (!q.ok) { console.log('PARSE-FAIL:', q.reason); process.exit(1); }
console.log('PARSE-OK — steps:', q.queue.steps.length);
for (const s of q.queue.steps) console.log(`  step ${s.step_index}: ${s.validation_command.slice(0, 90)}...`);
if (q.queue.steps.length !== 3) { console.log('WRONG-STEP-COUNT'); process.exit(1); }
console.log('LITERAL-QUEUE-CONFIRMED');
