import { readFileSync } from 'fs';
const file = 'C:\\Users\\marka\\.claude\\projects\\C--WINDOWS-system32\\071faf79-f394-4091-9876-be511ce623ee.jsonl';
const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());

// Show entries 16025-16075 (after compaction boundary)
console.log('\n--- Lines 16025-16075 (post-compaction) ---');
for (let i = 16024; i < Math.min(16075, lines.length); i++) {
  try {
    const e = JSON.parse(lines[i]);
    const topType = e.type;
    const ct = Array.isArray(e.message?.content)
      ? e.message.content.map(b => b.type).join(',')
      : (Array.isArray(e.content) ? e.content.map(b => typeof b === 'string' ? 'str' : b.type).join(',') : '');
    const textSnip = (e.message?.content?.find(b => b.type === 'text')?.text ||
                     (Array.isArray(e.content) ? e.content.find(b => b?.type === 'text')?.text : '') || '')
                    .substring(0,100).replace(/\n/g,' ');
    const toolName = e.message?.content?.find(b => b.type === 'tool_use')?.name || '';
    console.log(`L${i+1}: ${topType} [${ct}] ${toolName} ${textSnip}`);
  } catch (err) { console.log(`L${i+1}: PARSE_ERROR: ${err.message.substring(0,60)}`); }
}
