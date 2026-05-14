#!/usr/bin/env node
// ~/.claude/tools/ollama-mcp/server.js
// Minimal MCP stdio server — routes to local Ollama models.
// Node 18+ required (uses built-in fetch).
//
// Registered via: claude mcp add --scope user ollama-mcp -- node <path>
// Three tools: ollama_chat, ollama_generate, ollama_list

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

const TOOLS = [
  {
    name: 'ollama_chat',
    description: 'Send a chat request to a specific local Ollama model and return its response.',
    inputSchema: {
      type: 'object',
      required: ['model', 'prompt'],
      properties: {
        model:      { type: 'string', description: 'Exact Ollama model name (e.g. laguna-xs.2:q4_K_M, mistral-medium-3.5:128b-q4_K_M, nemotron-3-super:latest)' },
        prompt:     { type: 'string', description: 'The user message to send' },
        system:     { type: 'string', description: 'Optional system prompt' },
        num_predict: { type: 'integer', description: 'Max tokens to generate (default 800). Keep low for workshop/review calls on large CPU models to stay within MCP timeout window.' }
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
    const timeoutMs = numPredict * 2 * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // stream:true so Ollama detects client disconnect per-token and releases the slot immediately,
    // rather than holding the slot for the full inference duration (stream:false only detects
    // disconnect at write time, after all tokens are generated).
    const body = { model: args.model, messages: msgs, stream: true,
                   options: { num_predict: numPredict } };
    try {
      const r = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      let content = '';
      const text = await r.text();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error(chunk.error);
          content += chunk.message?.content || '';
        } catch (e) {
          if (e.message && !e.message.startsWith('{')) throw e;
        }
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
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
      serverInfo: { name: 'ollama-mcp', version: '1.0.0' }
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
