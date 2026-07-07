// One-shot bench: candidate vision-verdict seat via the exact native /api/chat shape
// ollama_vision_verdict.mjs uses (gap #10 demotion candidate test, 2026-07-07).
import { readFileSync } from 'fs';

const MODEL = process.argv[2] || 'gemma4:12b-it-q8_0';
const IMG = process.argv[3] || 'C:/Users/marka/.claude/muezzin-plugin/qc-baseline/landing/desktop.png';

const img = readFileSync(IMG).toString('base64');
const body = {
  model: MODEL,
  stream: false,
  options: { num_ctx: 8192 },
  messages: [{
    role: 'user',
    content: 'You are a visual QC witness. Describe this webpage screenshot: site name, main heading text, and the 3 most prominent UI elements. Then answer: does the page render correctly (no blank areas, no overlapping text)? Answer VERDICT: PASS or VERDICT: FAIL with one reason.',
    images: [img],
  }],
};

const t0 = Date.now();
const resp = await fetch('http://nxtbeast:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(300000),
});
if (!resp.ok) {
  console.log(`HTTP_${resp.status}: ${(await resp.text()).slice(0, 400)}`);
  process.exit(1);
}
const j = await resp.json();
console.log(`--- ${MODEL} responded in ${Date.now() - t0}ms ---`);
console.log(j.message?.content || JSON.stringify(j).slice(0, 500));

const ps = await (await fetch('http://nxtbeast:11434/api/ps')).json();
console.log('--- residency ---');
for (const m of ps.models) {
  console.log(`${m.name} vram=${Math.round(m.size_vram / 1e9)}GB size=${Math.round(m.size / 1e9)}GB`);
}
