// Scratch e2e replay for gap #10 (gemma4:31b CUDA demotion, ab4c5f1).
// Exercises the exported ollamaVisionVerdict WITHOUT any real Ollama dispatch:
// globalThis.fetch is stubbed to capture the request the module would send.
// The gap's kill-shape was: vision-verdict duty dispatching gemma4:31b (the
// CUDA-crashing 31b at the VRAM edge). The demotion's promised behavior: the
// same duty now dispatches gemma4:12b-it-q8_0 with ARM-1 num_gpu options intact.
import path from 'node:path';

const engineDir = 'C:/Users/marka/.claude/muezzin-plugin';
// Isolate heartbeat writes away from the production census log.
process.env.MUEZZIN_HB_FILE = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/hb-scratch.log';

const { ollamaVisionVerdict } = await import(`file://${engineDir}/ollama_vision_verdict.mjs`);

let captured = null;
globalThis.fetch = async (url, init) => {
  captured = { url, body: JSON.parse(init.body) };
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: { content: 'Stub screenshot description. VERDICT: clean' } }),
    text: async () => '',
  };
};

const sample = path.join(engineDir, 'qc-baseline', 'about', 'desktop.png');
const r = await ollamaVisionVerdict('Describe this screenshot. End with VERDICT: clean', [sample]);

const checks = [
  ['model is the demoted-to 12b', captured?.body?.model === 'gemma4:12b-it-q8_0'],
  ['model is NOT gemma4:31b', captured?.body?.model !== 'gemma4:31b'],
  ['endpoint is native local /api/chat', captured?.url === 'http://nxtbeast:11434/api/chat'],
  ['image actually encoded into request', Array.isArray(captured?.body?.messages?.[0]?.images) && captured.body.messages[0].images.length === 1],
  ['ARM-1 options object present (num_gpu)', captured?.body?.options?.num_gpu === 56],
  ['verdict pipeline parsed the response', r.ok === true && r.verdict === 'clean'],
  ['result names the 12b seat', r.model === 'gemma4:12b-it-q8_0@nxtbeast'],
];

let fails = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}`);
  if (!pass) fails++;
}
console.log(`RESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'} (dispatched model=${captured?.body?.model})`);
process.exit(fails === 0 ? 0 : 1);
