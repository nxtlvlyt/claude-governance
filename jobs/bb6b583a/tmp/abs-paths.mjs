import { readFileSync, writeFileSync } from 'fs';
const F = 'C:/Users/marka/agy-muezzin/missions/atv-1-competitor-analysis.mission.txt';
let t = readFileSync(F, 'utf8');
const before = (t.match(/data\/atv-corpus\//g) || []).length;
t = t.replace(/(?<![\w/])data\/atv-corpus\//g, 'C:/Users/marka/agy-muezzin/data/atv-corpus/');
writeFileSync(F, t);
console.log('replaced', before, 'refs');
