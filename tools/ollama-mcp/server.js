#!/usr/bin/env node
// ~/.claude/tools/ollama-mcp/server.js
// Minimal MCP stdio server — routes to Ollama models (local + cloud-proxied + cloud-direct).
// Node 18+ required (uses built-in fetch).
//
// Registered via: claude mcp add --scope user ollama-mcp -- node <path>
// Three tools: ollama_chat, ollama_generate, ollama_list
//
// ollama_chat uses a WATERFALL: models differ in accepted fields and change often, so
// requests degrade across SHAPE silently (full → no-think → bare) but across IDENTITY or
// TRANSPORT loudly — any rung that changes the model name or route is labeled in the
// output so witness attribution (which model actually answered) is never corrupted.

'use strict';

const readline = require('readline');
function resolveOllamaHost() {
  const raw = process.env.OLLAMA_HOST || 'http://localhost:11434';
  // Bind-address (0.0.0.0) is not a valid connect target — use localhost.
  const normalized = raw.replace(/^(https?:\/\/)?0\.0\.0\.0/, 'http://localhost');
  const withProto = normalized.startsWith('http') ? normalized : `http://${normalized}`;
  // Append default port if none present.
  return withProto.replace(/^(https?:\/\/[^/:]+)(?::(\d+))?(.*)$/, (_, h, p, rest) =>
    `${h}:${p || '11434'}${rest}`);
}
const OLLAMA = resolveOllamaHost();
const CLOUD_URL = 'https://ollama.com/api/chat';

const TOOLS = [
  {
    name: 'ollama_chat',
    description: 'Send a chat request to an Ollama model (local, :cloud-proxied, or Ollama Cloud direct) and return its response. Has a waterfall fallback: shape degradation is silent, model/transport fallbacks are labeled in the output.',
    inputSchema: {
      type: 'object',
      required: ['model', 'prompt'],
      properties: {
        model:      { type: 'string', description: 'Exact Ollama model name. Local (e.g. laguna-xs.2:q4_K_M) or cloud-proxied (e.g. glm-4.6:cloud, deepseek-v3.2:cloud) — cloud models route via Ollama Cloud, zero local RAM.' },
        prompt:     { type: 'string', description: 'The user message to send' },
        system:     { type: 'string', description: 'Optional system prompt' },
        num_predict: { type: 'integer', description: 'Max tokens to generate (default 800). Keep low for workshop/review calls on large CPU models to stay within MCP timeout window.' },
        think:      { type: 'boolean', description: 'Enable model thinking (default false — thinking silently consumes the num_predict budget before any content is produced).' },
        fallback_models: { type: 'array', items: { type: 'string' }, description: 'Optional ordered fallback models, tried through the full transport waterfall if the primary fails. Any fallback use is labeled in the output — never silent.' }
      }
    }
  },
  {
    name: 'ollama_generate',
    description: 'Raw completion (generate) request to a specific local Ollama model.',
    inputSchema: {
      type: 'object',
      required: ['model', 'prompt'],
      properties: {
        model:      { type: 'string', description: 'Exact Ollama model name' },
        prompt:     { type: 'string', description: 'Completion prompt' },
        system:     { type: 'string', description: 'Optional system prompt' },
        num_predict: { type: 'integer', description: 'Max tokens to generate (default 800).' }
      }
    }
  },
  {
    name: 'ollama_list',
    description: 'List all locally available Ollama models.',
    inputSchema: { type: 'object', properties: {} }
  }
];

async function callTool(name, args) {
  if (name === 'ollama_list') {
    const r = await fetch(`${OLLAMA}/api/tags`);
    const d = await r.json();
    return d.models.map(m => m.name).join('\n');
  }

  if (name === 'ollama_chat') {
    const msgs = [];
    if (args.system) msgs.push({ role: 'system', content: args.system });
    msgs.push({ role: 'user', content: args.prompt });
    const numPredict = args.num_predict ?? 800;
    // HTTP timeout = num_predict * 2 seconds (CPU at 1-10 t/s; per feedback_local_model_timeout_rule)
    // One controller for the WHOLE waterfall — the budget is total, not per-rung.
    const timeoutMs = numPredict * 2 * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const cloudKey = process.env.OLLAMA_API_KEY || process.env.OLLAMA_CLOUD_API_KEY || '';
    const path = [];       // audit trail of every attempt
    const failures = [];   // human-readable failure per rung

    // One streamed chat attempt at a given request shape.
    // shape 0: think + options | shape 1: options only | shape 2: bare (max compatibility)
    // stream:true so Ollama detects client disconnect per-token and releases the slot
    // immediately rather than holding it for the full inference duration.
    // think defaults to FALSE: thinking models (glm, qwen, nemotron) otherwise burn the
    // entire num_predict budget on message.thinking and return 0 content chars silently.
    const attempt = async (url, model, shape, headers = {}) => {
      const body = { model, messages: msgs, stream: true };
      if (shape <= 0) body.think = args.think ?? false;
      if (shape <= 1) body.options = { num_predict: numPredict };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      let content = '', thinking = '';
      const text = await r.text();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error(chunk.error);
          content += chunk.message?.content || '';
          thinking += chunk.message?.thinking || '';
        } catch (e) {
          if (e.message && !e.message.startsWith('{')) throw e;
        }
      }
      if (!content && !thinking && !r.ok) throw new Error(`HTTP ${r.status}`);
      return { content, thinking };
    };

    const isFieldError = (e) => /think|option|unsupported|unknown (?:field|parameter)|invalid (?:field|option)/i.test(e.message || '');
    const isNotFound   = (e) => /not found|no such model|does not exist/i.test(e.message || '');
    const isConnError  = (e) => /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket|network/i.test(e.message || '');

    // Walk request shapes at one transport+model. Only field errors justify stripping;
    // anything else propagates to the next waterfall rung.
    const tryShapes = async (url, model, label, headers) => {
      let lastErr = null;
      for (let shape = 0; shape <= 2; shape++) {
        path.push(shape === 0 ? label : `${label}(${['full', 'no-think', 'bare'][shape]})`);
        try {
          return await attempt(url, model, shape, headers);
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          lastErr = e;
          if (!isFieldError(e)) throw e;
        }
      }
      throw lastErr;
    };

    const models = [args.model, ...(Array.isArray(args.fallback_models) ? args.fallback_models : [])];
    let result = null, usedLabel = '';
    try {
      outer:
      for (const model of models) {
        // Rung 1: local daemon, model as named.
        try {
          result = await tryShapes(`${OLLAMA}/api/chat`, model, `local:${model}`);
          usedLabel = `local:${model}`;
          break outer;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          failures.push(`local:${model} -> ${e.message}`);

          // Rung 2: local daemon, cloud-proxied variant (same weights, cloud-served).
          if (isNotFound(e) && !/:cloud$/.test(model)) {
            try {
              result = await tryShapes(`${OLLAMA}/api/chat`, `${model}:cloud`, `local:${model}:cloud`);
              usedLabel = `local:${model}:cloud`;
              break outer;
            } catch (e2) {
              if (e2.name === 'AbortError') throw e2;
              failures.push(`local:${model}:cloud -> ${e2.message}`);
            }
          }

          // Rung 3: Ollama Cloud direct — when the local daemon is down or lacks the model.
          if (cloudKey && (isConnError(e) || isNotFound(e))) {
            const cloudModel = model.replace(/:cloud$/, '');
            try {
              result = await tryShapes(CLOUD_URL, cloudModel, `cloud-direct:${cloudModel}`,
                                       { Authorization: `Bearer ${cloudKey}` });
              usedLabel = `cloud-direct:${cloudModel}`;
              break outer;
            } catch (e3) {
              if (e3.name === 'AbortError') throw e3;
              failures.push(`cloud-direct:${cloudModel} -> ${e3.message}`);
            }
          }
        }
      }
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        return `(aborted after ${Math.round(timeoutMs / 1000)}s — a local model may still be running; check /api/ps before re-dispatching. Do NOT treat as completed. Attempts: ${path.join(' -> ')})`;
      }
      throw e;
    }
    clearTimeout(timer);

    if (!result) {
      return `(all waterfall rungs failed for ${args.model}. Do NOT treat as completed. Attempts:\n${failures.join('\n')})`;
    }

    // Identity/transport fallbacks are never silent: label whenever the answer did not
    // come from the model as originally named, first try.
    const cleanFirstTry = usedLabel === `local:${args.model}` && path.length === 1;
    const note = cleanFirstTry ? '' : `\n\n[waterfall: ${path.join(' -> ')}; answered by ${usedLabel}]`;

    if (result.content) return result.content + note;
    if (result.thinking) return `(0 content chars — model spent the num_predict budget on thinking. Raise num_predict or keep think:false. thinking head: ${result.thinking.slice(0, 300)})${note}`;
    return `(0 chars from ${usedLabel} — model produced no output. Check model name and num_predict budget. Do NOT treat this as a completed dispatch.)${note}`;
  }

  if (name === 'ollama_generate') {
    const numPredict = args.num_predict ?? 800;
    const timeoutMs = numPredict * 2 * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const body = { model: args.model, prompt: args.prompt, stream: true,
                   options: { num_predict: numPredict } };
    if (args.system) body.system = args.system;
    try {
      const r = await fetch(`${OLLAMA}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      let response = '';
      const text = await r.text();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error(chunk.error);
          response += chunk.response || '';
        } catch (e) {
          if (e.message && !e.message.startsWith('{')) throw e;
        }
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Unknown tool: ${name}`);
}

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }

  const { id, method, params } = req;

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'ollama-mcp', version: '1.1.0' }
    });
    return;
  }

  if (method === 'notifications/initialized' || method === 'ping') return;

  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    try {
      const text = await callTool(params.name, params.arguments || {});
      reply(id, { content: [{ type: 'text', text }] });
    } catch (err) {
      reply(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });
    }
    return;
  }

  replyError(id, -32601, `Method not found: ${method}`);
});
