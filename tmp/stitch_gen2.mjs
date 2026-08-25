// stitch_gen2.mjs — schema-correct screen generation into the existing project
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
const adc = JSON.parse(readFileSync(path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json'), 'utf8'));
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: adc.client_id, client_secret: adc.client_secret, refresh_token: adc.refresh_token, grant_type: 'refresh_token' }) })).json();
const EP = 'https://stitch.googleapis.com/mcp';
const H = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${tok.access_token}`, 'x-goog-user-project': adc.quota_project_id };
async function call(body, timeoutMs = 300000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(EP, { method: 'POST', headers: H, body: JSON.stringify(body), signal: ctl.signal });
    const text = await r.text();
    if ((r.headers.get('content-type') || '').includes('event-stream')) { const d = text.split(/\r?\n/).filter((l) => l.startsWith('data:')); return JSON.parse(d[d.length - 1].slice(5)); }
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}
const PROMPT = `Mobile-first content library dashboard for a social media automation tool called "NXTLVL Post". Dark theme: background #10151a, cards #1a222b, accent teal #0d9488, light text #e8edf2. A scrollable list of content batches: each row shows a 16:9 hero thumbnail on the left, the post title (single line, truncated), a small metadata line (date, a vanlife/nxtlvl tag chip, status), and a circular hook-score badge on the right (e.g. green "8"). The newest batch row is expanded showing: a horizontal thumbnail strip, an inline video player with download chips under it (9:16, 16:9, hook-card, trimmed), a hook-score panel with a one-line verdict, and four platform cards (Instagram, TikTok, YouTube, Facebook) each with caption text and a prominent teal Copy button. A floating "+ New upload" button bottom right. Generous touch targets, one-thumb reachable, clean information hierarchy.`;
await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }, 60000);
const gen = await call({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'generate_screen_from_text', arguments: { projectId: '18052995375163688094', prompt: PROMPT, deviceType: 'MOBILE', modelId: 'GEMINI_3_1_PRO' } } }, 300000);
const out = JSON.stringify(gen.result ?? gen.error, null, 1);
writeFileSync('C:/Users/marka/.claude/tmp/stitch-gen-result.json', out);
console.log('GEN (first 1200):', out.slice(0, 1200));
