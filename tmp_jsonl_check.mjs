import { readFileSync } from 'fs';
const file = 'C:\\Users\\marka\\.claude\\projects\\C--WINDOWS-system32\\071faf79-f394-4091-9876-be511ce623ee.jsonl';
const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
const last25 = lines.slice(-25);
for (const line of last25) {
  try {
    const e = JSON.parse(line);
    const topType = e.type;
    const contentTypes = Array.isArray(e.message?.content)
      ? e.message.content.map(b => b.type).join(',')
      : '';
    const textSnip = e.message?.content?.find(b => b.type === 'text')?.text?.substring(0,60) || '';
    console.log(`${topType} [${contentTypes}] ${textSnip}`);
  } catch { console.log('PARSE_ERROR'); }
}
