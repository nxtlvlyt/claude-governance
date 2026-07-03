// ollama_vision_verdict.mjs — multimodal visual verdict via LOCAL Ollama (nxtbeast),
// gemma4:31b. Replaces the broken agy --print path for e2e visual QC.
//
// Why this exists: agy CLI --print mode returns empty stdout even for trivial
// prompts (substrate-verified 2026-06-24); the agy visual-witness path is therefore
// non-functional on this install. gemma4:31b is multimodal and accessible via the
// standard /v1/chat/completions endpoint using OpenAI-style image_url content
// blocks with base64 inline data.
//
// LOCAL-ONLY (NO-CLOUD ruling 2026-07-02, operator-rulings.md; enforced here 2026-07-03):
// this module previously defaulted to Ollama Cloud's gemini-3-flash-preview with three
// separate ollama.com fallback paths — the last hardcoded cloud dispatch in the plugin
// after seat_dispatch's lane removal. All ollama.com paths are GONE; on local failure the
// verdict fails CLOSED with a named error instead of reaching for a forbidden provider.
// Seat choice is receipted, not arbitrary: gemma4:31b live-benchmarked 12/12 on real
// qc-baseline screenshot pairs (2026-07-01), beating both qwen3.6:27b (failed outright)
// and the old cloud gemini path (EMPTY_CONTENT_THINKING bug).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const LOCAL_URL = 'http://nxtbeast:11434/v1/chat/completions';
const LOCAL_MODEL = 'gemma4:31b';

// Convert a PNG path to a data URL the OpenAI-compat endpoint accepts as image content
function pngToDataUrl(filePath) {
  if (!existsSync(filePath)) throw new Error(`image not found: ${filePath}`);
  const bytes = readFileSync(filePath);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

// Send a vision request: text prompt + N image paths.
// Returns { ok, verdict, response, error?, raw? }
export async function ollamaVisionVerdict(promptText, imagePaths, opts = {}) {
  const t0 = Date.now();
  const model = opts.model || LOCAL_MODEL;
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

  let resp;
  try {
    resp = await fetch(LOCAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs || 120000),
    });
  } catch (e) {
    // FAIL CLOSED: no non-local fallback exists by design (NO-CLOUD ruling 2026-07-02).
    return { ok: false, verdict: 'error', error: `LOCAL_FETCH_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 };
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    return { ok: false, verdict: 'error', error: `HTTP_${resp.status}`, raw: t.slice(0, 400), elapsedMs: Date.now() - t0 };
  }

  let json;
  try { json = await resp.json(); }
  catch (e) { return { ok: false, verdict: 'error', error: `JSON_PARSE_FAIL: ${e.message}`, elapsedMs: Date.now() - t0 }; }

  // Some thinking-style models land the answer in message.reasoning with empty content —
  // fall back to reasoning when content is empty so the verdict path keeps working.
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
    model: `${model}@nxtbeast`,
    images_sent: imagePaths.length,
    elapsedMs: Date.now() - t0,
  };
}

// argv-guarded self-test: encode 1 baseline PNG + send a trivial "describe this image"
// prompt to verify the pipeline works end-to-end against LOCAL nxtbeast (no auth needed).
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
    console.log('sending sample image to', LOCAL_MODEL, '(LOCAL-ONLY — no cloud path exists in this module)', '...');
    const r = await ollamaVisionVerdict(
      'Describe this screenshot in one short sentence. End with: VERDICT: clean',
      [sample],
    );
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })();
}
