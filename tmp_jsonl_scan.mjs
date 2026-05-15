import { readFileSync } from 'fs';
const file = 'C:\\Users\\marka\\.claude\\projects\\C--WINDOWS-system32\\071faf79-f394-4091-9876-be511ce623ee.jsonl';
const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
console.log('Total lines:', lines.length);

// Show last 50 entries: type, first content block type, text snippet
const last50 = lines.slice(-50);
for (let i = 0; i < last50.length; i++) {
  const line = last50[i];
  try {
    const e = JSON.parse(line);
    const topType = e.type;
    const contentTypes = Array.isArray(e.message?.content)
      ? e.message.content.map(b => b.type).join(',')
      : '';
    const textSnip = e.message?.content?.find(b => b.type === 'text')?.text?.substring(0,80).replace(/\n/g,' ') || '';
    const toolName = e.message?.content?.find(b => b.type === 'tool_use')?.name || '';
    console.log(`L${lines.length-50+i+1}: ${topType} [${contentTypes}] ${toolName} ${textSnip}`);
  } catch { console.log(`L${lines.length-50+i+1}: PARSE_ERROR`); }
}

// Also show entries 15970-15985 (around compaction)
console.log('\n--- Around line 15975 ---');
for (let i = 15969; i < Math.min(15985, lines.length); i++) {
  try {
    const e = JSON.parse(lines[i]);
    const topType = e.type;
    const ct = Array.isArray(e.message?.content) ? e.message.content.map(b => b.type).join(',') : '';
    const textSnip = e.message?.content?.find(b => b.type === 'text')?.text?.substring(0,80).replace(/\n/g,' ') || '';
    const toolName = e.message?.content?.find(b => b.type === 'tool_use')?.name || '';
    console.log(`L${i+1}: ${topType} [${ct}] ${toolName} ${textSnip}`);
  } catch { console.log(`L${i+1}: PARSE_ERROR`); }
}
