// Extract the seat_roundtrip.mjs module and doctor patcher from the prep-workflow output.
import { readFileSync, writeFileSync } from 'node:fs';

const j = JSON.parse(readFileSync('C:/Users/marka/AppData/Local/Temp/claude/C--Users-marka/deef569c-dcf6-4695-8f3b-3ee6d4a96da1/tasks/w0055cc77.output', 'utf8'));
const d = j.result.draft;

const a1start = d.indexOf('```js', d.indexOf('ARTIFACT 1 of 3')) + 5;
const a1end = d.lastIndexOf('```', d.indexOf('ARTIFACT 2 of 3'));
const mod = d.slice(a1start, a1end).replace(/^\r?\n/, '');
writeFileSync('C:/Users/marka/.claude/muezzin-plugin/missions/_logs/seat_roundtrip.mjs.staged', mod, 'utf8');
console.log('artifact1 written:', mod.length, 'chars');

const a3start = d.indexOf('```js', d.indexOf('ARTIFACT 3 of 3')) + 5;
const a3end = d.lastIndexOf('```');
const patcher = d.slice(a3start, a3end).replace(/^\r?\n/, '');
writeFileSync('C:/Users/marka/.claude/muezzin-plugin/missions/_logs/doctor-seat-roundtrip-patch.mjs', patcher, 'utf8');
console.log('artifact3 written:', patcher.length, 'chars');
