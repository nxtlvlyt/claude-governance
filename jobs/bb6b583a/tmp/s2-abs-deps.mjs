import { readFileSync, writeFileSync } from 'fs';
const F = 'C:/Users/marka/agy-muezzin/missions/atv-1-competitor-analysis.S2.mission.txt';
const ABS = 'C:/Users/marka/agy-muezzin/missions/atv-1-competitor-analysis.S1/parts/';
let t = readFileSync(F, 'utf8');
// Only dep references to S1-produced files become absolute; S2's own outputs
// (parts/affiliate-patterns.md as a target, and its same-sandbox dep) stay relative.
for (const f of ['competitor-firetvsticks.com.md','competitor-firesticktricks.com.md','competitor-androidtv-guide.com.md','competitor-troypoint.com.md','competitor-tv.google.md','competitor-android.com.md','competitor-aftv.news.md','competitors-found.md']) {
  t = t.split('parts/' + f).join(ABS + f);
}
t = t.replace('MISSION-CLASS: research',
`MISSION-CLASS: research
AMENDMENT (attempt-8b, 2026-07-08): S1 is DONE; its part-files are FINAL in its sandbox.
S2's deps on them were relative parts/ paths that do not exist in S2's OWN sandbox (the
last cross-child gap — sibling outputs are not staged forward). Deps on S1 outputs now use
the absolute S1-sandbox path (engine admits absolute deps for research class); S2's own
affiliate-patterns output stays relative. ENGINE INTAKE FILED: tartib successors need
mechanical access to DONE predecessors' artifacts.`);
writeFileSync(F, t);
console.log('abs-dep refs now:', (t.match(/S1\/parts\//g) || []).length);
