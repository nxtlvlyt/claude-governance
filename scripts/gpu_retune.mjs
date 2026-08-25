#!/usr/bin/env node
// gpu_retune.mjs — empirical GPU-fit tester for local Ollama models (PROPOSAL tool).
//
// Tests ONE (model, num_gpu, num_ctx): dispatches a tiny timed prompt, reports
// OK / 500 + approx tokens/sec, then unloads the model. The caller sweeps num_gpu
// (descending) to find the LARGEST that doesn't 500 → that is the retune value for
// deliberate.py / muezzin model config.
//
// Grounded in: kv-cache-budget-checks.md (weights + KV must fit ~22.6GB free VRAM)
// and model-rijal.md (qwen/gemma full-attention → big KV; granite/laguna GQA → small KV;
// all weights 20-35GB so only PARTIAL offload fits a 24GB card — sweep finds the max layers).
//
// PREREQUISITE: the Ollama server must run OLLAMA_LLM_LIBRARY=cuda_v12, else num_gpu is
// ignored (machine-scope cpu_avx2 forces CPU). Verify with --check before trusting results.
//
// Usage:
//   node gpu_retune.mjs --check                      # is the server GPU-capable + VRAM free?
//   node gpu_retune.mjs <model> <num_gpu> <num_ctx> [--json]
//
// Serial discipline: stops any other loaded model first; stops the tested model after.

import * as http from 'http';
import { spawnSync } from 'child_process';

const argv = process.argv.slice(2);
const jsonOut = argv.includes('--json');

function apiGet(path, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const r = http.request({ host: 'localhost', port: 11434, path, method: 'GET', timeout: timeoutMs }, (res) => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    });
    r.on('error', () => resolve(null)); r.on('timeout', () => { r.destroy(); resolve(null); }); r.end();
  });
}

async function stop(model) {
  // ollama stop via REST keep_alive:"0s" (string — avoids the 0.23.2 deadlock)
  await new Promise((resolve) => {
    const payload = JSON.stringify({ model, messages: [], keep_alive: '0s' });
    const r = http.request({ host: 'localhost', port: 11434, path: '/api/chat', method: 'POST', timeout: 25000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => { res.resume(); res.on('end', resolve); });
    r.on('error', resolve); r.on('timeout', () => { r.destroy(); resolve(); }); r.write(payload); r.end();
  });
  await new Promise(r => setTimeout(r, 1500));
}

// Buffered NDJSON dispatch (the muezzin fix: carry partial line across chunks)
function dispatch(body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    let content = '', buf = '';
    const r = http.request({ host: 'localhost', port: 11434, path: '/api/chat', method: 'POST', timeout: 600000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      if (res.statusCode === 500) { res.resume(); resolve({ ok: false, status: 500, error: 'Ollama 500 (does not fit / layout)' }); return; }
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buf += chunk; const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) { if (!line.trim()) continue; try { const o = JSON.parse(line); const p = o.message?.content || o.response || ''; if (p) content += p; } catch {} }
      });
      res.on('end', () => { if (buf.trim()) { try { const o = JSON.parse(buf); content += (o.message?.content || ''); } catch {} } resolve({ ok: true, status: 200, content }); });
      res.on('error', (e) => resolve({ ok: false, error: e.message }));
    });
    r.on('error', (e) => resolve({ ok: false, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'dispatch timeout' }); });
    r.write(payload); r.end();
  });
}

async function check() {
  // GPU-capable? nvidia-smi free VRAM + whether ollama serve has a GPU. We infer GPU capability by
  // reading the ollama server's runner via /api/ps is not enough; report VRAM + remind about cuda_v12.
  const smi = spawnSync('nvidia-smi', ['--query-gpu=memory.free,memory.total,utilization.gpu', '--format=csv,noheader'], { encoding: 'utf8' });
  const ps = await apiGet('/api/ps');
  const out = { vram: (smi.stdout || '').trim() || 'nvidia-smi unavailable', loaded: (ps?.models || []).map(m => m.name),
    note: 'num_gpu only takes effect if the ollama server runs OLLAMA_LLM_LIBRARY=cuda_v12. If a high num_gpu gives the SAME slow time as num_gpu=0, the server is on cpu_avx2 — restart it with cuda_v12 (deliberate.py _restart_ollama_server pattern).' };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n'); process.exit(0);
}

async function main() {
  if (argv[0] === '--check') return check();
  const [model, g, c] = argv;
  if (!model || g == null || c == null) { process.stderr.write('usage: node gpu_retune.mjs <model> <num_gpu> <num_ctx> [--json] | --check\n'); process.exit(2); }
  const num_gpu = parseInt(g, 10), num_ctx = parseInt(c, 10);

  const ps = await apiGet('/api/ps');
  for (const m of (ps?.models || []).map(x => x.name)) if (m !== model) await stop(m);

  const body = { model, messages: [{ role: 'user', content: 'Reply with exactly one short sentence about the sky.' }],
    stream: true, options: { num_gpu, num_ctx, num_predict: 48, temperature: 0 } };
  const t0 = Date.now();
  const res = await dispatch(body);
  const secs = (Date.now() - t0) / 1000;
  await stop(model);

  const approx_tok_s = res.ok && secs > 0 ? +(((res.content || '').length / 4) / secs).toFixed(1) : 0;
  const out = { model, num_gpu, num_ctx, ok: res.ok, status: res.status || null, seconds: +secs.toFixed(1), chars: (res.content || '').length, approx_tok_s, error: res.error || null };
  if (jsonOut) process.stdout.write(JSON.stringify(out) + '\n');
  else process.stdout.write(`${model} num_gpu=${num_gpu} num_ctx=${num_ctx}: ${res.ok ? 'OK' : 'FAIL'} status=${res.status || '-'} ${secs.toFixed(1)}s ~${approx_tok_s}tok/s ${res.error || ''}\n`);
  process.exit(res.ok ? 0 : 1);
}
main();
