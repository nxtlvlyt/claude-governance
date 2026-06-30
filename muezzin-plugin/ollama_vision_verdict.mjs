// ollama_vision_verdict.mjs — multimodal visual verdict via Ollama Cloud's
// gemini-3-flash-preview. Replaces the broken agy --print path for e2e visual QC.
//
// Why this exists: agy CLI --print mode returns empty stdout even for trivial
// prompts (substrate-verified 2026-06-24); the agy visual-witness path is therefore
// non-functional on this install. Ollama Cloud has gemini-3-flash-preview which
// is multimodal and accessible via the standard /v1/chat/completions endpoint
// using OpenAI-style image_url content blocks with base64 inline data.
//
// Aligned with operator-rulings.md: "use Ollama" — this is Ollama Cloud, allowed.
// NOT a frontier-worker dispatch (mcp__gemini-worker is forbidden); this is the
// Ollama-routed Gemini model on the operator's plan, which is the sanctioned
// access path.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const OLLAMA_URL = 'https://ollama.com/v1/chat/completions';
const DEFAULT_MODEL = 'gemini-3-flash-preview';

// Convert a PNG path to a data URL Ollama Cloud accepts as image content
function pngToDataUrl(filePath) {
  if (!existsSync(filePath)) throw new Error(`image not found: ${filePath}`);
  const bytes = readFileSync(filePath);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

// Send a vision request: text prompt + N image paths.
// Returns { ok, verdict, response, error?, raw? }
export async function ollamaVisionVerdict(promptText, imagePaths, opts = {}) {
  const t0 = Date.now();
  const model = opts.model || DEFAULT_MODEL;
  const apiKey = process.env.OLLAMA_API_KEY || process.env.OLLAMA_CLOUD_API_KEY;
  if (!apiKey) {
    return { ok: false, verdict: 'error', error: 'NO_API_KEY', elapsedMs: Date.now() - t0 };
  }
  if (!imagePaths || imagePaths.length === 0) {
    return { ok: false, verdict: 'error', error: 'NO_IMAGES', elapsedMs: Date.now() - t0 };
  }

  let content;
  try {
    content = [
      { type: 'text', text: promptText },
      ...imagePaths.map((p) => ({ type: 'image_url', image_url: { url: pngToDataUrl(p) } })),
    ];
  } catch (e) {
    return { ok: false, verdict: 'error', error: `IMAGE_ENCODE_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 };
  }

  const body = {
    model,
    messages: [{ role: 'user', content }],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2000,
  };

  const ctl = new AbortController();
  const killer = setTimeout(() => ctl.abort(), opts.timeoutMs || 120000);

  let resp;
  try {
    resp = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch (e) {
    clearTimeout(killer);
    return { ok: false, verdict: 'error', error: `FETCH_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 };
  }
  clearTimeout(killer);

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    // 2026-06-25: on 429 from Ollama Cloud, fall back to local nxtbeast multimodal.
    // gemma4 series supports vision; runs on Tailscale-accessible nxtbeast Ollama.
    if (resp.status === 429 && !opts._isFallback) {
      try {
        const fallbackUrl = OLLAMA_URL;
        const fallbackBody = { ...body, model: 'gemma4:31b' };
        const localResp = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(fallbackBody),
          signal: AbortSignal.timeout(opts.timeoutMs || 120000),
        });
        if (localResp.ok) {
          const localJson = await localResp.json();
          const localMsg = localJson?.choices?.[0]?.message || {};
          const localText = (localMsg.content || '').trim() || (localMsg.reasoning || '').trim();
          if (localText) {
            const vm = localText.match(/VERDICT:\s*(clean|concern|block)/i);
            return {
              ok: true,
              verdict: vm ? vm[1].toLowerCase() : 'concern',
              response: localText,
              model: 'gemma4:31b (cloud-429 fallback)',
              images_sent: imagePaths.length,
              elapsedMs: Date.now() - t0,
            };
          }
        }
        return { ok: false, verdict: 'error', error: `CLOUD_429_AND_FALLBACK_FAIL_HTTP_${localResp.status}`, elapsedMs: Date.now() - t0 };
      } catch (fbErr) {
        return { ok: false, verdict: 'error', error: `CLOUD_429_AND_FALLBACK_FAIL: ${fbErr.message}`, elapsedMs: Date.now() - t0 };
      }
    }
    return { ok: false, verdict: 'error', error: `HTTP_${resp.status}`, raw: t.slice(0, 400), elapsedMs: Date.now() - t0 };
  }

  let json;
  try { json = await resp.json(); }
  catch (e) { return { ok: false, verdict: 'error', error: `JSON_PARSE_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 }; }

  // 2026-06-24: gemini-3-flash-preview on Ollama Cloud has the EMPTY_CONTENT_THINKING bug
  // (substrate-verified) — actual answer lands in message.reasoning, content stays empty.
  // Fall back to reasoning when content is empty so the verdict path keeps working.
  const msg = json?.choices?.[0]?.message || {};
  const responseText = (msg.content || '').trim() || (msg.reasoning || '').trim();
  if (!responseText) {
    return { ok: false, verdict: 'error', error: 'EMPTY_RESPONSE', raw: JSON.stringify(json).slice(0, 400), elapsedMs: Date.now() - t0 };
  }

  // Parse VERDICT line from the response
  const verdictMatch = responseText.match(/VERDICT:\s*(clean|concern|block)/i);
  const verdict = verdictMatch ? verdictMatch[1].toLowerCase() : 'concern';

  return {
    ok: true,
    verdict,
    response: responseText,
    model,
    images_sent: imagePaths.length,
    elapsedMs: Date.now() - t0,
  };
}

// argv-guarded self-test: encode 1 baseline PNG + send a trivial "describe this image"
// prompt to verify the pipeline works end-to-end. Set OLLAMA_API_KEY first.
const _scriptPath = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
const _selfMatches = _scriptPath && (import.meta.url.endsWith(_scriptPath) || import.meta.url.endsWith('/' + _scriptPath));
if (_selfMatches && process.argv.includes('--selftest')) {
  (async () => {
    const here = path.dirname(import.meta.url.replace(/^file:\/+/, '')).replace(/\\/g, '/');
    const sample = path.join(here, 'qc-baseline', 'about', 'desktop.png');
    if (!existsSync(sample)) {
      console.error('FAIL: no sample image at', sample);
      process.exit(1);
    }
    console.log('sending sample image to', DEFAULT_MODEL, '...');
    const r = await ollamaVisionVerdict(
      'Describe this screenshot in one short sentence. End with: VERDICT: clean',
      [sample],
    );
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })();
}
