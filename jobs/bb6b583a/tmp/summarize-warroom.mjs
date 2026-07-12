import { readFileSync, writeFileSync } from 'fs';
const results = JSON.parse(readFileSync('C:/Users/marka/.claude/jobs/bb6b583a/tmp/warroom-results.json', 'utf8'));

let out = '';
const auditResults = results.filter(r => r.result && r.result.verdicts);
let adopt=0, redesign=0, discard=0, other=0;
const verdictLines = [];
for (const r of auditResults) {
  const vs = r.result.verdicts;
  if (Array.isArray(vs)) {
    for (const v of vs) {
      const verdict = (v.verdict || v.decision || '').toLowerCase();
      if (verdict.includes('adopt')) adopt++;
      else if (verdict.includes('redesign')) redesign++;
      else if (verdict.includes('discard')) discard++;
      else other++;
      verdictLines.push(`- [${r.result.subsystem?.split('(')[0]?.split('—')[0]?.trim()?.slice(0,60)}] ${v.component || v.name || ''}: ${v.verdict || v.decision} — ${(v.why||v.reason||v.rationale||'').slice(0,200)}`);
    }
  }
}
out += `VERDICT TALLY: adopt=${adopt} redesign=${redesign} discard=${discard} other=${other}\n\n`;
out += `VERDICT LINES (${verdictLines.length}):\n` + verdictLines.join('\n') + '\n\n';

const builtNotRunning = auditResults.flatMap(r => (r.result.built_not_running||[]).map(x => `[${r.result.subsystem?.slice(0,40)}] ${typeof x === 'string' ? x : JSON.stringify(x)}`));
out += `BUILT-NOT-RUNNING (${builtNotRunning.length}):\n` + builtNotRunning.join('\n') + '\n\n';

const topRisks = auditResults.flatMap(r => (r.result.top_risks||[]).map(x => `[${r.result.subsystem?.slice(0,40)}] ${typeof x === 'string' ? x : JSON.stringify(x)}`));
out += `TOP RISKS (${topRisks.length}):\n` + topRisks.join('\n') + '\n\n';

const blockersEntry = results.find(r => r.result && r.result.blockers);
if (blockersEntry) {
  out += `BLOCKERS (${blockersEntry.result.blockers.length}):\n` + blockersEntry.result.blockers.map(b=>'- '+b).join('\n') + '\n\n';
  out += `OPERATOR DECISIONS NEEDED (${blockersEntry.result.operator_decisions_needed.length}):\n` + blockersEntry.result.operator_decisions_needed.map(b=>'- '+b).join('\n') + '\n\n';
}

const synthEntry = results.find(r => r.result && r.result.muezzin_should_borrow);
if (synthEntry) {
  out += `MUEZZIN SHOULD BORROW:\n${JSON.stringify(synthEntry.result.muezzin_should_borrow, null, 2)}\n\n`;
  out += `WARROOM NEEDS FROM MUEZZIN:\n${JSON.stringify(synthEntry.result.warroom_needs_from_muezzin, null, 2)}\n\n`;
  out += `SURPRISES:\n${JSON.stringify(synthEntry.result.surprises, null, 2)}\n\n`;
}

writeFileSync('C:/Users/marka/.claude/jobs/bb6b583a/tmp/warroom-summary.txt', out);
console.log('wrote summary,', out.length, 'chars');
