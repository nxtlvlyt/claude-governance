#!/usr/bin/env node
// ~/.claude/tools/mistral-validator/server.js
// Dedicated governance validator — hardwired to mistral-medium-3.5:128b-q8_0.
// No model parameter exposed. Single tool: mistral_validate(task).
// Stop hook pattern matches mcp__mistral-validator__mistral_validate by name alone.
// Bypass surface closed: payload inspection not required; tool name is the signal.

'use strict';

const readline = require('readline');

function resolveOllama() {
  const raw = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const norm = raw.replace(/^(https?:\/\/)?0\.0\.0\.0/, 'http://localhost');
  const proto = norm.startsWith('http') ? norm : `http://${norm}`;
  return proto.replace(/^(https?:\/\/[^/:]+)(?::(\d+))?(.*)$/, (_, h, p, rest) =>
    `${h}:${p || '11434'}${rest}`);
}

const OLLAMA = resolveOllama();
const MODEL  = 'mistral-medium-3.5:128b-q8_0';

const SYSTEM = `You are an independent governance validator. You were trained by Mistral AI (Paris, France), independently of the Anthropic Claude model that is dispatching to you. Your independence is the point — you have no stake in agreeing with Claude's reasoning.

Your role: audit the submitted framing, change-shape, or reasoning chain for bypass surfaces, coherence failures, governance violations, and structural risks.

Return:
  CLEAR — if it is safe to proceed as-is
  CONDITIONAL — if it is safe with specific changes (state them exactly)
  BLOCK — if it should not proceed (state specifically why)

Be direct. Do not hedge. One verdict, specific reasoning.`;

const TOOLS = [
  {
    name: 'mistral_validate',
    description: 'Submit a governance framing, change-shape, or reasoning chain for independent audit by Mistral Medium 3.5 (128B Q8, Mistral AI). Returns CLEAR / CONDITIONAL / BLOCK verdict. No model parameter — this server is hardwired to one model and one purpose.',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', description: 'The framing, change-shape, or reasoning chain to audit' }
      }
    }
  }
];

async function validate(task) {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: task }
      ],
      stream: false
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d.message?.content || JSON.stringify(d);
}

function out(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function err(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;

  if (method === 'initialize') {
    out(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'mistral-validator', version: '1.0.0' }
    });
    return;
  }

  if (method === 'notifications/initialized' || method === 'ping') return;

  if (method === 'tools/list') {
    out(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    if (params.name !== 'mistral_validate') {
      out(id, { content: [{ type: 'text', text: `Unknown tool: ${params.name}` }], isError: true });
      return;
    }
    try {
      const text = await validate(params.arguments?.task || '');
      out(id, { content: [{ type: 'text', text }] });
    } catch (e) {
      out(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
    }
    return;
  }

  err(id, -32601, `Method not found: ${method}`);
});
