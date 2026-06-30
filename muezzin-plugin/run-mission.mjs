// run-mission.mjs — detached mission launcher: node run-mission.mjs <mission-file> <cwd>
// Missions are FILES, not argv strings: multi-line Maqsad+niyyah text does not survive
// process-spawn quoting (found live: P0-CORPUS launch — a niyyah fragment became the cwd
// and the sandbox gate correctly refused it). The file is also the mission's durable
// record (Directive 8).
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { orchestrate } from './orchestrate.mjs';

const [missionFile, cwd] = process.argv.slice(2);
if (!missionFile || !cwd) {
  console.error('usage: node run-mission.mjs <mission-file> <cwd>');
  process.exit(2);
}
const mission = readFileSync(missionFile, 'utf8');
const missionHash = createHash('sha256').update(mission).digest('hex');
mkdirSync(cwd, { recursive: true });

const r = await orchestrate(mission, cwd, { maxRepairs: 1, missionHash });
const report = JSON.stringify(r, null, 2);
console.log(report);
// Receipt lands next to the mission file regardless of how the process was observed.
writeFileSync(missionFile.replace(/\.[^.]+$/, '') + '.result.json', report, 'utf8');
process.exit(r.ok ? 0 : 1);
