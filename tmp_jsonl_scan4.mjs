import { readFileSync } from 'fs';
const file = 'C:\\Users\\marka\\.claude\\projects\\C--WINDOWS-system32\\071faf79-f394-4091-9876-be511ce623ee.jsonl';
const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());

// Get exact text content of L16042 (index 16041)
const e = JSON.parse(lines[16041]);
const textBlock = e.message?.content?.find(b => b.type === 'text');
console.log('=== L16042 TEXT CONTENT ===');
console.log(JSON.stringify(textBlock?.text || 'NO TEXT'));

// Also simulate the hook scan exactly as the hook does it
// starting from line 16048 (just before L16049's Edit fires)
console.log('\n=== HOOK SIMULATION FROM L16049 (scanning backward from L16048) ===');
const tail = lines;
let currentAssistantText = '';
let foundAssistant = false;
let scanLog = [];
let stopLine = null;

for (let i = 16048 - 1; i >= 0; i--) {  // 0-indexed, so 16048 = index 16047
  const line = tail[i];
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch {
    scanLog.push(`L${i+1}: PARSE_ERROR (skip)`);
    continue;
  }

  if (entry.type === 'assistant') {
    const ct = entry.message?.content?.map(b => b.type).join(',') || '';
    const textPart = entry.message?.content?.find(b => b.type === 'text')?.text?.substring(0,60) || '';
    foundAssistant = true;
    scanLog.push(`L${i+1}: assistant [${ct}] "${textPart}" → foundAssistant=true`);
    if (Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block.type === 'text') {
          currentAssistantText = block.text + '\n' + currentAssistantText;
        }
      }
    }
  } else if (foundAssistant && entry.type === 'user') {
    scanLog.push(`L${i+1}: user → BREAK (foundAssistant=true)`);
    stopLine = i+1;
    break;
  } else {
    if (scanLog.length < 30) {
      scanLog.push(`L${i+1}: ${entry.type} → skip`);
    }
  }

  if (scanLog.length > 50) break; // safety limit
}

// Print last 20 scan log entries
const recentLogs = scanLog.slice(-20);
for (const log of recentLogs) console.log(log);

console.log('\nfoundAssistant:', foundAssistant);
console.log('currentAssistantText length:', currentAssistantText.length);
if (currentAssistantText.length > 0) {
  console.log('First 200 chars:', JSON.stringify(currentAssistantText.substring(0, 200)));
  const artMatch = currentAssistantText.match(/surrender\s*articulation\s*:\s*(.+)$/is);
  console.log('artMatch:', artMatch ? 'YES' : 'NO');
  if (artMatch) {
    const artSlice = artMatch[1];
    const delim = String.raw`(?=\r?\n\s*(?:substrate\s*says|instance\s*reasoning|resolution|surrender\s*articulation)\s*:|\r?\n\s*\r?\n|$)`;
    const ssMatch = artSlice.match(new RegExp(String.raw`substrate\s*says\s*:\s*(.+?)` + delim, 'is'));
    console.log('substrate says:', ssMatch ? ssMatch[1] : 'NOT FOUND');
    const irMatch = artSlice.match(new RegExp(String.raw`instance\s*reasoning\s*:\s*(.+?)` + delim, 'is'));
    console.log('instance reasoning:', irMatch ? irMatch[1].substring(0,60) : 'NOT FOUND');
    const rMatch = artSlice.match(new RegExp(String.raw`resolution\s*:\s*(.+?)` + delim, 'is'));
    console.log('resolution:', rMatch ? rMatch[1].substring(0,60) : 'NOT FOUND');
  }
}
