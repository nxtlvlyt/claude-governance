import { readFileSync, readdirSync } from 'fs';
const dirs = ['C:/Users/marka/agy-muezzin/missions/atv-1-competitor-analysis.S1/parts', 'C:/Users/marka/agy-muezzin/missions/atv-1-competitor-analysis.S2/parts'];
const all = new Set();
for (const d of dirs) for (const f of readdirSync(d)) {
  const t = readFileSync(d + '/' + f, 'utf8');
  const u = t.match(/https?:\/\/[^\s)\]]+/g) || [];
  u.forEach(x => all.add(x.replace(/[.,;:]+$/, '')));
  console.log(f, '→', new Set(u).size, 'distinct');
}
console.log('TOTAL DISTINCT ACROSS ALL PARTS:', all.size);
