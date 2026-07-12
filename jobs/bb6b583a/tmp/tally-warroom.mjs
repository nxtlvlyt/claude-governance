import { readFileSync, writeFileSync } from 'fs';
const results = JSON.parse(readFileSync('C:/Users/marka/.claude/jobs/bb6b583a/tmp/warroom-results.json', 'utf8'));
const auditResults = results.filter(r => r.result && r.result.verdicts);
const tally = {};
const discards = [];
const redesigns = [];
for (const r of auditResults) {
  for (const v of r.result.verdicts) {
    const bin = v.bin || 'unknown';
    tally[bin] = (tally[bin]||0)+1;
    if (bin === 'discard') discards.push(`${v.component}: ${(v.why||'').slice(0,180)}`);
    if (bin === 'redesign') redesigns.push(`${v.component}: ${(v.why||'').slice(0,180)}`);
  }
}
console.log('TALLY:', JSON.stringify(tally, null, 2));
console.log('\n--- DISCARD (' + discards.length + ') ---');
discards.forEach(d => console.log('- ' + d));
console.log('\n--- REDESIGN (' + redesigns.length + ') ---');
redesigns.forEach(d => console.log('- ' + d));
