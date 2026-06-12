// dump generate_screen_from_text's exact inputSchema
import { readFileSync } from 'fs';
import path from 'path';
const adc = JSON.parse(readFileSync(path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json'), 'utf8'));
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: adc.client_id, client_secret: adc.client_secret, refresh_token: adc.refresh_token, grant_type: 'refresh_token' }) })).json();
const EP = 'https://stitch.googleapis.com/mcp';
const H = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${tok.access_token}`, 'x-goog-user-project': adc.quota_project_id };
async function call(body) {
  const r = await fetch(EP, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const text = await r.text();
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('event-stream')) { const d = text.split(/\r?\n/).filter((l) => l.startsWith('data:')); return JSON.parse(d[d.length - 1].slice(5)); }
  return JSON.parse(text);
}
await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } });
const tools = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
for (const t of tools.result.tools) {
  if (['generate_screen_from_text', 'get_screen', 'list_screens'].includes(t.name)) {
    console.log(`=== ${t.name} ===`);
    console.log(JSON.stringify(t.inputSchema, null, 1).slice(0, 1500));
  }
}
