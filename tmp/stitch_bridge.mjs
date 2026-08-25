// stitch_bridge.mjs — speak MCP JSON-RPC over stdio to the Stitch proxy (the session
// predates the MCP wiring, so the harness never registered its tools; the proxy itself
// is healthy — bridge it directly). Step 1: handshake + tools/list.
import { spawn } from 'child_process';

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
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch { /* non-JSON noise */ }
  }
});
child.stderr.on('data', (d) => { const s = d.toString().trim(); if (s) console.error('[stderr]', s.slice(0, 200)); });

function rpc(method, params, timeoutMs = 30000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`timeout ${method}`)); }, timeoutMs);
    pending.set(id, (msg) => { clearTimeout(t); resolve(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

try {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'conductor-bridge', version: '1.0' } }, 60000);
  console.log('INIT OK:', JSON.stringify(init.result?.serverInfo || init.result || init.error).slice(0, 200));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tools = await rpc('tools/list', {}, 30000);
  const list = tools.result?.tools || [];
  console.log(`TOOLS (${list.length}):`);
  for (const t of list) console.log(`- ${t.name}: ${String(t.description || '').slice(0, 100)}`);
} catch (e) {
  console.error('BRIDGE FAIL:', e.message);
} finally {
  child.kill();
  process.exit(0);
}
