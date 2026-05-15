// Test the exact hook regex against L16250's text
import { readFileSync } from 'fs';

const file = 'C:\\Users\\marka\\.claude\\projects\\C--WINDOWS-system32\\071faf79-f394-4091-9876-be511ce623ee.jsonl';
const lines = readFileSync(file, 'utf8').split('\n');

// L16250 is index 16249
const e = JSON.parse(lines[16249]);
const textBlock = e.message?.content?.find(b => b.type === 'text');
const rawText = textBlock?.text || '';

// Simulate hook scan from different starting positions
function simulateScan(fromIndex, label) {
  let currentAssistantText = '';
  let foundAssistant = false;
  for (let i = fromIndex; i >= 0; i--) {
    const line = lines[i];
    if (!line?.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type === 'assistant') {
      foundAssistant = true;
      if (Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content) {
          if (block.type === 'text') {
            currentAssistantText = block.text + '\n' + currentAssistantText;
          }
        }
      }
    } else if (foundAssistant && entry.type === 'user') {
      break;
    }
  }
  const artMatch = currentAssistantText.match(/surrender\s*articulation\s*:\s*(.+)$/is);
  const normalize = s => s == null ? '' : s.replace(/\s+/g, ' ').trim();
  const delim = String.raw`(?=\r?\n\s*(?:substrate\s*says|instance\s*reasoning|resolution|surrender\s*articulation)\s*:|\r?\n\s*\r?\n|$)`;
  let ss = null, ir = null, res = null;
  if (artMatch) {
    const slice = artMatch[1];
    const ssM = slice.match(new RegExp(String.raw`substrate\s*says\s*:\s*(.+?)` + delim, 'is'));
    if (ssM) ss = ssM[1];
    const irM = slice.match(new RegExp(String.raw`instance\s*reasoning\s*:\s*(.+?)` + delim, 'is'));
    if (irM) ir = irM[1];
    const rM = slice.match(new RegExp(String.raw`resolution\s*:\s*(.+?)` + delim, 'is'));
    if (rM) res = rM[1];
  }
  console.log(`\n=== Scan from L${fromIndex+1} (${label}) ===`);
  console.log(`currentAssistantText length: ${currentAssistantText.length}`);
  console.log(`artMatch: ${artMatch ? 'YES' : 'NO'}`);
  console.log(`substrate says: ${normalize(ss) || 'MISSING'}`);
  console.log(`instance reasoning: ${normalize(ir)?.substring(0,40) || 'MISSING'}`);
  console.log(`resolution: ${normalize(res)?.substring(0,40) || 'MISSING'}`);
}

// Scenario 1: hook fires and L16251 (tool_use) IS in JSONL (scan from L16251=index 16250)
simulateScan(16250, 'if tool_use IS written (L16251 = last)');

// Scenario 2: hook fires and only L16250 (text) is last (scan from L16250=index 16249)
simulateScan(16249, 'if only text written (L16250 = last)');

// Scenario 3: hook fires and only L16249 (thinking) is last (scan from L16249=index 16248)
simulateScan(16248, 'if only thinking written (L16249 = last)');

// Also: directly test the regex against L16250 text
console.log('\n=== Direct regex test on L16250 text ===');
const testText = rawText + '\n';
const artMatch = testText.match(/surrender\s*articulation\s*:\s*(.+)$/is);
console.log(`rawText length: ${rawText.length}`);
console.log(`testText ends with: ${JSON.stringify(testText.slice(-30))}`);
console.log(`artMatch: ${artMatch ? 'YES' : 'NO'}`);
if (artMatch) console.log(`capture starts with: ${JSON.stringify(artMatch[1].substring(0,40))}`);

// Also check if there's any encoding issue
const hasSurrender = rawText.includes('surrender articulation:');
const hasSurrenderUnicode = rawText.includes('surrender articulation​:');
console.log(`\nhas 'surrender articulation:': ${hasSurrender}`);
console.log(`has unicode zero-width: ${hasSurrenderUnicode}`);
console.log(`char codes at 'surrender': `);
const idx = rawText.indexOf('surrender articulation:');
if (idx >= 0) {
  const codes = [];
  for (let j = idx; j < Math.min(idx+25, rawText.length); j++) codes.push(rawText.charCodeAt(j));
  console.log(codes.join(' '));
}
