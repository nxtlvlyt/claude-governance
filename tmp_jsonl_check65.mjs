import { readFileSync } from 'fs';
const file = 'C:\\Users\\marka\\.claude\\projects\\C--WINDOWS-system32\\65c12d2a-61e5-4c5c-8d2e-33040851dd3a.jsonl';
const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
console.log('Total lines:', lines.length);

// Show first 5 and last 30 entries
console.log('\n--- First 5 ---');
for (let i = 0; i < Math.min(5, lines.length); i++) {
  try {
    const e = JSON.parse(lines[i]);
    const topType = e.type;
    const ct = Array.isArray(e.message?.content) ? e.message.content.map(b => b.type).join(',') : '';
    const textSnip = e.message?.content?.find(b => b.type === 'text')?.text?.substring(0,80).replace(/\n/g,' ') || '';
    const sid = e.sessionId || '';
    console.log(`L${i+1}: ${topType} [${ct}] sid=${sid} ${textSnip}`);
  } catch { console.log(`L${i+1}: PARSE_ERROR`); }
}

console.log('\n--- Last 30 ---');
const last30 = lines.slice(-30);
for (let i = 0; i < last30.length; i++) {
  try {
    const e = JSON.parse(last30[i]);
    const topType = e.type;
    const ct = Array.isArray(e.message?.content) ? e.message.content.map(b => b.type).join(',') : '';
    const textSnip = e.message?.content?.find(b => b.type === 'text')?.text?.substring(0,80).replace(/\n/g,' ') || '';
    const toolName = e.message?.content?.find(b => b.type === 'tool_use')?.name || '';
    const extra = toolName || textSnip;
    console.log(`L${lines.length-30+i+1}: ${topType} [${ct}] ${extra}`);
  } catch { console.log(`L${lines.length-30+i+1}: PARSE_ERROR`); }
}
