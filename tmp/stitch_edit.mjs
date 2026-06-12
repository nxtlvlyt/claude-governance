// stitch_edit.mjs — repair arm: fix the 4 graded defects on the library screen
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
const adc = JSON.parse(readFileSync(path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json'), 'utf8'));
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: adc.client_id, client_secret: adc.client_secret, refresh_token: adc.refresh_token, grant_type: 'refresh_token' }) })).json();
const EP = 'https://stitch.googleapis.com/mcp';
const H = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${tok.access_token}`, 'x-goog-user-project': adc.quota_project_id };
async function call(body, timeoutMs = 420000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(EP, { method: 'POST', headers: H, body: JSON.stringify(body), signal: ctl.signal });
    const text = await r.text();
    if ((r.headers.get('content-type') || '').includes('event-stream')) { const d = text.split(/\r?\n/).filter(l => l.startsWith('data:')); return JSON.parse(d[d.length - 1].slice(5)); }
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}
const PROMPT = `Keep the existing dark theme and layout exactly as designed. Make only these four corrections:
1. Every collapsed batch row in the list must also show its circular hook-score badge on the right (color-coded: green 8-10, amber 5-7, red 1-4) — not just the expanded row.
2. The expanded batch must show exactly FOUR platform cards: Instagram, TikTok, YouTube, Facebook — each with caption text and a teal Copy button. Do not omit any of the four.
3. Add a small "Archive" action (box-archive icon + label) in the expanded batch header row, right-aligned, subtle styling — it moves the batch out of the main list.
4. Remove any bottom navigation tabs or menu items that do not correspond to a real feature. The only real surfaces are: this Library list, the "+ New upload" floating button, and the Archive action. No Analytics, Settings, Profile, or other placeholder destinations.`;
await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }, 60000);
const res = await call({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'edit_screens', arguments: { projectId: '18052995375163688094', selectedScreenIds: ['ce49f7aafb6b443196b2159bf83d0b5c'], prompt: PROMPT, modelId: 'GEMINI_3_1_PRO' } } });
const out = JSON.stringify(res.result ?? res.error, null, 1);
writeFileSync('C:/Users/marka/.claude/tmp/stitch-edit-result.json', out);
console.log('EDIT (first 1500):', out.slice(0, 1500));
