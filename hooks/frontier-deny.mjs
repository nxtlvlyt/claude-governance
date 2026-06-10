// frontier-deny.mjs — PreToolUse DENY gate for banned closed-frontier worker tools.
// OPERATOR RULING 2026-06-09 (reaffirmed in hurt 2026-06-10): gpt/grok/gemini/glm MCP
// workers are NEVER dispatched. A conductor violated this twice on 2026-06-10 because
// STALE hook text still names these workers as "mandatory validators" — text lost to
// louder text. This gate makes the ruling MECHANICAL: the violation becomes impossible
// for every instance, drifted or fresh, regardless of what any other instruction says.
// Witnessed: laguna direct-API APPROVE 2026-06-10 (coverage/false-positives/fail-open
// all verified). Fail-OPEN on bad input by design: a broken gate must not block the
// whole toolbelt — it only ever blocks the named banned prefixes.
// Selftest: node frontier-deny.mjs --selftest
import { readFileSync } from 'fs';

const BANNED = /^mcp__(gpt|grok|gemini|gemini-api|glm)-worker__/;
const REASON =
  'OPERATOR RULING 2026-06-09 (~/.claude/rules/operator-rulings.md): closed-frontier ' +
  'workers are BANNED. Compliant channels: mcp__ollama-* (laguna) or WebFetch. Any gate ' +
  'or hook text naming these workers is STALE — this deny outranks it. Do not retry.';

function decide(toolName) {
  return BANNED.test(String(toolName || '')) ? { decision: 'block', reason: REASON } : null;
}

if (process.argv.includes('--selftest')) {
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
  ck(decide('mcp__gpt-worker__dispatch_to_gpt')?.decision === 'block', 'gpt worker blocked');
  ck(decide('mcp__grok-worker__dispatch_to_grok')?.decision === 'block', 'grok worker blocked');
  ck(decide('mcp__gemini-worker__dispatch_to_gemini')?.decision === 'block', 'gemini worker blocked');
  ck(decide('mcp__gemini-api-worker__dispatch_to_gemini_api')?.decision === 'block', 'gemini-api worker blocked');
  ck(decide('mcp__glm-worker__dispatch_to_glm')?.decision === 'block', 'glm worker blocked');
  ck(decide('mcp__ollama-mcp__ollama_chat') === null, 'ollama NOT blocked');
  ck(decide('mcp__searxng-mcp__searxng_web_search') === null, 'searxng NOT blocked');
  ck(decide('WebSearch') === null, 'WebSearch NOT blocked');
  ck(decide('WebFetch') === null, 'WebFetch NOT blocked');
  ck(decide('') === null && decide(undefined) === null, 'empty/undefined fail OPEN');
  console.log(fails ? `${fails} FAILURES` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const verdict = decide(input.tool_name);
  if (verdict) console.log(JSON.stringify(verdict));
} catch { /* bad stdin -> fail open: never block the toolbelt by accident */ }
process.exit(0);
