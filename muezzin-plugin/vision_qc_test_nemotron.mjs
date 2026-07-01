import { readFileSync } from 'node:fs';
import path from 'node:path';
const BASE = 'C:\Users\marka\.claude\muezzin-plugin\qc-baseline';
const OLLAMA = 'http://nxtbeast:11434/api/chat';
function toB64(p) { return readFileSync(p).toString('base64'); }
const imgA = toB64(path.join(BASE, 'about', 'desktop.png'));
const imgB = toB64(path.join(BASE, 'ambassadors', 'desktop.png'));
const PROMPT = `You are a visual-regression witness. Compare the BASELINE image (first) against the PREVIEW image (second). Report:
CLEAN = no visible difference. CONCERN = minor differences. BLOCK = major differences / clearly different content.
Respond with exactly one line: VERDICT: clean | concern | block
Then one sentence explaining why.`;
async function ask(model, images, label) {
  const t0 = Date.now();
  const body = { model, messages: [{ role: 'user', content: PROMPT, images }], stream: false, options: { temperature: 0.1 } };
  const ctl = new AbortController();
  const killer = setTimeout(() => ctl.abort(), 400000);
  try {
    const res = await fetch(OLLAMA, { method: 'POST', body: JSON.stringify(body), signal: ctl.signal });
    const j = await res.json();
    console.log(`\n=== ${model} :: ${label} (${Date.now()-t0}ms, http ${res.status}) ===`);
    console.log(j?.message?.content ?? JSON.stringify(j).slice(0,500));
  } catch (e) {
    console.log(`\n=== ${model} :: ${label} — ERROR: ${e.message} (${Date.now()-t0}ms) ===`);
  } finally { clearTimeout(killer); }
}
await ask('nemotron3:33b', [imgA, imgA], 'TEST A: identical images — expect CLEAN');
await ask('nemotron3:33b', [imgA, imgB], 'TEST B: different real pages — expect CONCERN/BLOCK');
