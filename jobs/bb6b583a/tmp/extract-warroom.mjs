import { readFileSync, writeFileSync } from 'fs';
const jpath = 'C:/Users/marka/.claude/projects/C--Users-marka/bb6b583a-5f2e-42bf-9d87-d6fd7bbb8fdf/subagents/workflows/wf_a7fb1bdb-ce5/journal.jsonl';
const lines = readFileSync(jpath, 'utf8').trim().split('\n');
const entries = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
const results = entries.filter(e => e.type === 'result');
writeFileSync('C:/Users/marka/.claude/jobs/bb6b583a/tmp/warroom-results.json', JSON.stringify(results, null, 2));
console.log('wrote', results.length, 'results');
