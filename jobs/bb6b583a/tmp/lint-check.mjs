import { readFileSync } from 'fs';
import { lintMission } from '../../.claude/muezzin-plugin/mission_lint.mjs';
const t = readFileSync('missions/engine-srcsha-anchor-fix.mission.txt', 'utf8');
const r = lintMission(t);
console.log(JSON.stringify(r, null, 2));
