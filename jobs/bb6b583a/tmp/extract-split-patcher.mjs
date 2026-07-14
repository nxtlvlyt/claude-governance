// Extract the mission_split patcher (BLOCK 1) from the autosplit-prep workflow output.
import { readFileSync, writeFileSync } from 'node:fs';

const j = JSON.parse(readFileSync('C:/Users/marka/AppData/Local/Temp/claude/C--Users-marka/deef569c-dcf6-4695-8f3b-3ee6d4a96da1/tasks/wgip043nn.output', 'utf8'));
const d = j.result.draft;

const b1 = d.indexOf('## BLOCK 1');
const b2 = d.indexOf('## BLOCK 2');
const start = d.indexOf('```js', b1) + 5;
const end = b2 > -1 ? d.lastIndexOf('```', b2) : d.lastIndexOf('```');
const patcher = d.slice(start, end).replace(/^\r?\n/, '');
writeFileSync('C:/Users/marka/.claude/muezzin-plugin/missions/_logs/mission-split-full-step-carriage-patch.mjs', patcher, 'utf8');
console.log('patcher written:', patcher.length, 'chars; block2 present:', b2 > -1);
