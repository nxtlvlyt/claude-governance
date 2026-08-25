// stitch_http.mjs — direct MCP-over-HTTP client for stitch.googleapis.com, carrying the
// x-goog-user-project header the third-party proxy drops (403 receipt 2026-06-12).
import { readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

const adc = JSON.parse(readFileSync(path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json'), 'utf8'));
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ client_id: adc.client_id, client_secret: adc.client_secret, refresh_token: adc.refresh_token, grant_type: 'refresh_token' }),
})).json();
if (!tok.access_token) { console.error('token mint failed'); process.exit(1); }

const EP = 'https://stitch.googleapis.com/mcp';
let session = null;
let id = 0;
async function call(method, params, timeoutMs = 240000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(EP, {
      method: 'POST', signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${tok.access_token}`,
        'x-goog-user-project': adc.quota_project_id,
        ...(session ? { 'mcp-session-id': session } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    });
    session = r.headers.get('mcp-session-id') || session;
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
    if (ct.includes('event-stream')) {
      // take the last data: line (final result)
      const datas = text.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
      return JSON.parse(datas[datas.length - 1]);
    }
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}

const PROMPT = `Mobile-first content library dashboard for a social media automation tool called "NXTLVL Post". Dark theme: background #10151a, cards #1a222b, accent teal #0d9488, light text #e8edf2. A scrollable list of content batches: each row shows a 16:9 hero thumbnail on the left, the post title (single line, truncated), a small metadata line (date, a vanlife/nxtlvl tag chip, status), and a circular hook-score badge on the right (e.g. green "8"). The newest batch row is expanded showing: a horizontal thumbnail strip, an inline video player with download chips under it (9:16, 16:9, hook-card, trimmed), a hook-score panel with a one-line verdict, and four platform cards (Instagram, TikTok, YouTube, Facebook) each with caption text and a prominent teal Copy button. A floating "+ New upload" button bottom right. Generous touch targets, one-thumb reachable, clean information hierarchy.`;

try {
  const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'conductor-direct', version: '1.0' } }, 60000);
  console.log('INIT:', JSON.stringify(init.result?.serverInfo || init.error).slice(0, 150), 'session:', session ? 'yes' : 'no');
  // notifications/initialized (fire and forget)
  await fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${tok.access_token}`, 'x-goog-user-project': adc.quota_project_id, ...(session ? { 'mcp-session-id': session } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }).catch(() => {});
  const proj = await call('tools/call', { name: 'create_project', arguments: { title: 'NXTLVL Post Library' } }, 90000);
  const ptxt = JSON.stringify(proj.result?.content ?? proj.error);
  console.log('PROJECT:', ptxt.slice(0, 400));
  const pname = (ptxt.match(/projects\\?\/[A-Za-z0-9_-]+/) || [])[0]?.replace('\\/', '/');
  if (!pname) throw new Error('no project id parsed');
  console.log('using', pname);
  const gen = await call('tools/call', { name: 'generate_screen_from_text', arguments: { project_name: pname, prompt: PROMPT, device_type: 'MOBILE' } }, 300000);
  const out = JSON.stringify(gen.result ?? gen.error, null, 1);
  writeFileSync('C:/Users/marka/.claude/tmp/stitch-gen-result.json', out);
  console.log('GEN (first 1000):', out.slice(0, 1000));
} catch (e) { console.error('FAIL:', e.message); }
