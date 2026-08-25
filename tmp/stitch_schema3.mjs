import { readFileSync } from 'fs';
import path from 'path';
const adc = JSON.parse(readFileSync(path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json'), 'utf8'));
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: adc.client_id, client_secret: adc.client_secret, refresh_token: adc.refresh_token, grant_type: 'refresh_token' }) })).json();
const EP = 'https://stitch.googleapis.com/mcp';
const H = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${tok.access_token}`, 'x-goog-user-project': adc.quota_project_id };
async function call(body) {
  const r = await fetch(EP, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const text = await r.text();
  if ((r.headers.get('content-type') || '').includes('event-stream')) { const d = text.split(/\r?\n/).filter(l => l.startsWith('data:')); return JSON.parse(d[d.length - 1].slice(5)); }
  return JSON.parse(text);
}
await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } });
const tools = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
const t = tools.result.tools.find(x => x.name === 'edit_screens');
console.log('REQUIRED:', JSON.stringify(t.inputSchema.required));
console.log('PROPS:', Object.keys(t.inputSchema.properties).join(', '));
console.log('screens prop:', JSON.stringify(t.inputSchema.properties.screens || t.inputSchema.properties.selectedScreens || null).slice(0, 600));
console.log('prompt prop:', JSON.stringify(t.inputSchema.properties.prompt || null).slice(0, 300));
// also pull the project's screen instances for the edit call
const proj = await call({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_project', arguments: { projectId: '18052995375163688094' } } });
const ptxt = JSON.stringify(proj.result?.content ?? proj.error);
console.log('PROJECT (first 1500):', ptxt.slice(0, 1500));
