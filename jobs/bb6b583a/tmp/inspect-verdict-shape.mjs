import { readFileSync } from 'fs';
const results = JSON.parse(readFileSync('C:/Users/marka/.claude/jobs/bb6b583a/tmp/warroom-results.json', 'utf8'));
const auditResults = results.filter(r => r.result && r.result.verdicts);
console.log(JSON.stringify(auditResults[0].result.verdicts[0], null, 2));
