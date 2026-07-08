// One tiny live receipt through the FORK's cloud lane (converts the report's last
// UNVERIFIED item — cloud /api/chat honors options — into a dated receipt).
import { dispatchWithWaterfall } from 'file:///C:/Users/marka/agy-muezzin/seat_dispatch.mjs';
const r = await dispatchWithWaterfall(
  { model: 'qwen3.5:2b', messages: [{ role: 'user', content: 'Reply with exactly: CLOUD-LANE-OK' }], options: { num_ctx: 4096, num_predict: 32 } },
  { cwd: 'C:/Users/marka/agy-muezzin', role: 'executor' },
);
const text = typeof r === 'string' ? r : (r?.content || r?.message?.content || JSON.stringify(r).slice(0, 200));
console.log('RESPONSE:', String(text).slice(0, 80));
