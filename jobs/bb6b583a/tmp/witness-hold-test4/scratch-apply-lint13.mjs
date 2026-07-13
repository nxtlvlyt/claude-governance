import { readFileSync, writeFileSync } from 'node:fs';
const f = 'mission_lint.mjs';
const src = readFileSync(f, 'utf8');
const oldS = readFileSync(process.env.TEMP + '/lint13-old.txt', 'utf8');
const newS = readFileSync(process.env.TEMP + '/lint13-new.txt', 'utf8');
const first = src.indexOf(oldS);
if (first < 0) { console.error('OLD NOT FOUND'); process.exit(1); }
if (src.indexOf(oldS, first + 1) >= 0) { console.error('OLD NOT UNIQUE'); process.exit(1); }
writeFileSync(f, src.slice(0, first) + newS + src.slice(first + oldS.length));
console.log('REPLACED 1 occurrence, delta=' + (newS.length - oldS.length));
