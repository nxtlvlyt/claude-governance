import { readFileSync } from 'fs';
const file = 'C:\\Users\\marka\\.claude\\projects\\C--WINDOWS-system32\\071faf79-f394-4091-9876-be511ce623ee.jsonl';
const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
console.log('Total lines:', lines.length);

// Show entries 15975-16030 to find compaction boundary and first Edit attempts
console.log('\n--- Lines 15975-16030 ---');
for (let i = 15974; i < Math.min(16030, lines.length); i++) {
  try {
    const e = JSON.parse(lines[i]);
    const topType = e.type;
    const ct = Array.isArray(e.message?.content) ? e.message.content.map(b => b.type).join(',') : '';
    const textSnip = e.message?.content?.find(b => b.type === 'text')?.text?.substring(0,100).replace(/\n/g,' ') || '';
    const toolName = e.message?.content?.find(b => b.type === 'tool_use')?.name || '';
    const toolResultSnip = e.message?.content?.find(b => b.type === 'tool_result')?.content?.substring(0,60) || '';
    const extra = toolName || textSnip || toolResultSnip;
    console.log(`L${i+1}: ${topType} [${ct}] ${extra}`);
  } catch (err) { console.log(`L${i+1}: PARSE_ERROR ${err.message.substring(0,40)}`); }
}
