// stitch_design.mjs — bridge step 2: create project + generate the Library screen.
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const child = spawn('node', ['C:/Users/marka/.claude/tools/stitch-launch.mjs'], { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '';
const pending = new Map();
let nextId = 1;
child.stdout.on('data', (d) => {
  buf += d.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    try { const msg = JSON.parse(line); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } } catch {}
  }
});
child.stderr.on('data', (d) => { const s = d.toString().trim(); if (s) console.error('[p]', s.slice(0, 120)); });
function rpc(method, params, timeoutMs = 60000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`timeout ${method}`)); }, timeoutMs);
    pending.set(id, (m) => { clearTimeout(t); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
const PROMPT = `Mobile-first content library dashboard for a social media automation tool called "NXTLVL Post". Dark theme: background #10151a, cards #1a222b, accent teal #0d9488, light text #e8edf2. A scrollable list of content batches: each row shows a 16:9 hero thumbnail on the left, the post title (single line, truncated), a small metadata line (date, a vanlife/nxtlvl tag chip, status), and a circular hook-score badge on the right (e.g. green "8"). The newest batch row is expanded showing: a horizontal thumbnail strip, an inline video player with download chips under it (9:16, 16:9, hook-card, trimmed), a hook-score panel with a one-line verdict, and four platform cards (Instagram, TikTok, YouTube, Facebook) each with caption text and a prominent teal Copy button. A floating "+ New upload" button bottom right. Generous touch targets, one-thumb reachable, clean information hierarchy.`;

try {
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'conductor-bridge', version: '1.0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const proj = await rpc('tools/call', { name: 'create_project', arguments: { title: 'NXTLVL Post Library' } }, 60000);
  const projText = JSON.stringify(proj.result?.content || proj.error).slice(0, 600);
  console.log('PROJECT:', projText);
  const pname = (projText.match(/projects\/[A-Za-z0-9_-]+/) || [])[0];
  if (!pname) throw new Error('no project name parsed');
  console.log('using', pname);
  const gen = await rpc('tools/call', { name: 'generate_screen_from_text', arguments: { project_name: pname, prompt: PROMPT, device_type: 'MOBILE' } }, 300000);
  const out = JSON.stringify(gen.result ?? gen.error, null, 1);
  writeFileSync('C:/Users/marka/.claude/tmp/stitch-gen-result.json', out);
  console.log('GEN RESULT (first 800):', out.slice(0, 800));
} catch (e) { console.error('FAIL:', e.message); }
finally { child.kill(); process.exit(0); }
