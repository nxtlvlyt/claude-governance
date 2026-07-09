import { readFileSync } from 'fs';
const t = readFileSync('C:/Users/marka/agy-muezzin/missions/atv-1-competitor-analysis.S2/ANDROIDTV-COMPETITOR-ANALYSIS.md', 'utf8');
const urls = [...new Set(t.match(/https?:\/\/[^\s)\]]+/g) || [])];
console.log('bytes', t.length, '| distinct URLs', urls.length);
for (const d of ['firetvsticks\.com', 'firesticktricks\.com', 'androidtv-guide\.com', 'troypoint\.com', 'tv\.google', 'android\.com', 'aftv\.news', 'SOURCES', 'Surfshark', 'Real-Debrid', 'TorBox', 'Premiumize', 'ENOENT', 'not evidenced', 'NOT EVIDENCED'])
  console.log(d, new RegExp(d).test(t) ? 'FOUND' : '-');
console.log('--- sections ---');
(t.match(/^#{1,3} .+$/gm) || []).forEach(h => console.log(h));
