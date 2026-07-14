// Extract the size-ceiling patcher from the prep-workflow output.
import { readFileSync, writeFileSync } from 'node:fs';

const j = JSON.parse(readFileSync('C:/Users/marka/AppData/Local/Temp/claude/C--Users-marka/deef569c-dcf6-4695-8f3b-3ee6d4a96da1/tasks/wvnn4sy1z.output', 'utf8'));
const d = j.result.draft;

const start = d.indexOf('```js') + 5;
const end = d.lastIndexOf('```');
const patcher = d.slice(start, end).replace(/^\r?\n/, '');
writeFileSync('C:/Users/marka/.claude/muezzin-plugin/missions/_logs/deconstructor-size-ceiling-action-type-patch.mjs', patcher, 'utf8');
console.log('patcher written:', patcher.length, 'chars');
