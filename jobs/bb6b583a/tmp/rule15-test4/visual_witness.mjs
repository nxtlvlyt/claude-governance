// visual_witness.mjs — visual-regression witness via Ollama Cloud's gemini-3-flash-preview
//
// Uses ollamaVisionVerdict from ./ollama_vision_verdict.mjs to compare deployed-preview
// screenshots against the baseline screenshots captured by capture-visreg-baseline.mjs.
// This replaces the agy (Google Antigravity) path because agy CLI --print returns empty
// stdout even for trivial prompts (substrate-verified 2026-06-24), making the agy
// visual-witness path non-functional on this install. Ollama Cloud's
// gemini-3-flash-preview is multimodal and accessible via the standard
// /v1/chat/completions endpoint using OpenAI-style image_url content blocks.
//
// Aligned with operator-rulings.md: "use Ollama" — this is Ollama Cloud, allowed.
// NOT a frontier-worker dispatch; this is the Ollama-routed Gemini model on the
// operator's plan, which is the sanctioned access path.
//
// PENDING the operator sign-off on a MUEZZIN-SEAT-PLAN-LOCKED.md addendum adding visual
// witness as a Phase-3 boundary auditor. Not yet wired into orchestrate.mjs / verdict_merge.mjs.
//
// Why this lives in the plugin (not in mt-audit/qc-harness-v2.mjs):
// - mt-audit/qc-harness-v2.mjs is shadow infrastructure that gets abandoned (no remote,
//   ad-hoc, outside the plugin's verdict_merge governance)
// - The plugin IS the canonical infrastructure (PLUGIN_SUMMARY.md: "everything is in
//   `git log` here -- recoverable")
// - Visual-witness fits the plugin's "deeds-not-claims" model: screenshot bytes ARE a
//   real execution receipt, not a model's claim
//
// Receipt shape (returned by witnessVisualDiff):
//   {
//     ok: boolean,           // true if the witness ran successfully (regardless of verdict)
//     verdict: 'pass'|'concern'|'block',
//     pages_compared: [{ slug, viewport, baseline_path, preview_path, diff_summary, finding }],
//     blocking_findings: string[],   // populated when verdict='block'
//     elapsedMs: number,
//     model: string,
//     error?: { kind, detail }       // populated when ok=false
//   }

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ollamaVisionVerdict } from './ollama_vision_verdict.mjs';

const HERE = path.dirname(import.meta.url.replace(/^file:\/+/, '')).replace(/\\/g, '/');
const BASELINE_DIR = path.join(HERE, 'qc-baseline');
const DEFAULT_MODEL = 'gemini-3-flash-preview'; // Ollama Cloud multimodal vision default

// ---- inlined from self_witness.mjs to avoid circular dependency ---------------------------
// PURE: strip JSON tool-call artifacts that local models sometimes emit instead of prose.
// Objects containing a 'tool_calls' key or both 'name' + 'arguments' keys are not verdicts;
// they are removed, and whitespace-only content is collapsed to ''. Returns { content, sanitized }.
function sanitizeWitnessContent(raw) {
  let content = String(raw ?? '');
  let sanitized = false;
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      if ('tool_calls' in obj || ('name' in obj && 'arguments' in obj)) {
        content = '';
        sanitized = true;
      }
    }
  } catch { /* not JSON — leave content as-is */ }
  if (!content.trim()) content = '';
  return { content, sanitized };
}

// Build the substantive prompt the vision model needs. For visual witness,
// "compare these N pairs of images and list any regression" IS substantive.

function buildVisualPrompt(pagePairs) {
  const intro =
    'You are a visual-regression witness for the muddytires.ca POI-map application. ' +
    'For each (baseline, preview) image pair below, compare them carefully and list any ' +
    'visible regression: layout shifts, missing elements, broken images, color drift, ' +
    'font swap visible, viewport overflow, or unreachable content. ' +
    'Be precise — report only changes you can actually see, not theoretical concerns. ' +
    'For each pair, output one line:\n' +
    '  <slug>/<viewport>: CLEAN | CONCERN: <one-sentence finding> | BLOCK: <one-sentence finding>\n\n' +
    'CLEAN = no visible regression. CONCERN = 1-2 cosmetic shifts. BLOCK = layout breaks or content unreachable.\n\n' +
    'End your report with a single VERDICT line: VERDICT: pass | VERDICT: concern | VERDICT: block.\n\n' +
    'Image pairs to compare:';

  const refs = pagePairs.map((p, i) =>
    `\n[${i + 1}] ${p.slug}/${p.viewport}\n    baseline: ${p.baseline_path}\n    preview:  ${p.preview_path}`
  ).join('\n');

  return intro + refs;
}

// Parse the vision model's response into a structured verdict. If the model returns
// an empty response, the verdict is reported as 'error' kind=EMPTY_RESPONSE — the
// caller can decide whether to retry or escalate.

function parseVisualResponse(responseText, pagePairs) {
  const { content } = sanitizeWitnessContent(responseText);
  if (!content) {
    return {
      verdict: 'error',
      pages_compared: pagePairs.map(p => ({ ...p, diff_summary: '(model returned no parseable visual analysis)', finding: null })),
      blocking_findings: [],
    };
  }
  const lines = content.split(/\r?\n/);
  const findings = [];
  for (const p of pagePairs) {
    const tag = `${p.slug}/${p.viewport}`;
    const line = lines.find((l) => l.includes(tag));
    if (!line) { findings.push({ ...p, diff_summary: '(no line for this pair)', finding: null }); continue; }
    if (/\bCLEAN\b/i.test(line)) findings.push({ ...p, diff_summary: line.trim(), finding: 'clean' });
    else if (/\bBLOCK\b/i.test(line)) findings.push({ ...p, diff_summary: line.trim(), finding: 'block' });
    else if (/\bCONCERN\b/i.test(line)) findings.push({ ...p, diff_summary: line.trim(), finding: 'concern' });
    else findings.push({ ...p, diff_summary: line.trim(), finding: 'unparseable' });
  }
  const overallLine = lines.find((l) => /^\s*VERDICT:\s*(pass|concern|block)/i.test(l));
  let verdict = 'concern'; // safe-default if parsing fails
  if (overallLine) {
    const m = overallLine.match(/VERDICT:\s*(pass|concern|block)/i);
    if (m) verdict = m[1].toLowerCase();
  } else if (findings.every((f) => f.finding === 'clean')) {
    verdict = 'pass';
  } else if (findings.some((f) => f.finding === 'block')) {
    verdict = 'block';
  }
  const blocking_findings = findings.filter((f) => f.finding === 'block').map((f) => `${f.slug}/${f.viewport}: ${f.diff_summary}`);
  return { verdict, pages_compared: findings, blocking_findings };
}

// Inventory the baseline screenshots. Per the visreg-baseline capture, each page has
// 3 viewports (mobile, tablet, desktop); structure is qc-baseline/<slug>/<viewport>.png.

export function inventoryBaseline(baselineDir = BASELINE_DIR) {
  if (!existsSync(baselineDir)) return [];
  const pairs = [];
  for (const slug of readdirSync(baselineDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
    const dir = path.join(baselineDir, slug);
    for (const f of readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile() && /\.png$/i.test(d.name))) {
      const viewport = f.name.replace(/\.png$/i, '');
      pairs.push({ slug, viewport, baseline_path: path.join(dir, f.name).replace(/\\/g, '/') });
    }
  }
  return pairs;
}

// witnessVisualDiff — capture preview screenshots, dispatch ollamaVisionVerdict to compare
// them against baselines, parse the verdict, return structured receipt.
//
// previewPathFn: function(slug, viewport) -> absolute path to a captured preview screenshot
// (the caller's responsibility — orchestrate.mjs after deploying a preview).

export async function witnessVisualDiff(previewPathFn, opts = {}) {
  const t0 = Date.now();
  const model = opts.model || DEFAULT_MODEL;

  if (!(process.env.OLLAMA_API_KEY || process.env.OLLAMA_CLOUD_API_KEY)) {
    return {
      ok: false, verdict: 'error', pages_compared: [], blocking_findings: [],
      elapsedMs: Date.now() - t0, model,
      error: { kind: 'NO_API_KEY', detail: 'set OLLAMA_API_KEY or OLLAMA_CLOUD_API_KEY' },
    };
  }

  const baselines = inventoryBaseline(opts.baselineDir);
  if (baselines.length === 0) {
    return {
      ok: false, verdict: 'error', pages_compared: [], blocking_findings: [],
      elapsedMs: Date.now() - t0, model,
      error: { kind: 'BASELINE_MISSING', detail: `no baseline screenshots in ${opts.baselineDir || BASELINE_DIR}` },
    };
  }

  // Pair each baseline with its preview path (caller-provided)
  const pairs = baselines.map(b => ({ ...b, preview_path: previewPathFn(b.slug, b.viewport) }))
    .filter(p => p.preview_path && existsSync(p.preview_path));

  if (pairs.length === 0) {
    return {
      ok: false, verdict: 'error', pages_compared: [], blocking_findings: [],
      elapsedMs: Date.now() - t0, model,
      error: { kind: 'NO_PREVIEW_PAIRS', detail: 'no preview screenshots match the baseline inventory' },
    };
  }

  const prompt = buildVisualPrompt(pairs);
  const imagePaths = pairs.flatMap(p => [p.baseline_path, p.preview_path]);
  const r = await ollamaVisionVerdict(prompt, imagePaths, {
    model,
    timeoutMs: opts.timeoutMs || 5 * 60 * 1000,
  });

  const responseText = sanitizeWitnessContent(r?.response).content;

  if (!r.ok) {
    return {
      ok: false, verdict: 'error', pages_compared: pairs.map(p => ({ ...p, diff_summary: '(vision verdict failed)', finding: null })),
      blocking_findings: [], elapsedMs: Date.now() - t0, model,
      error: { kind: r.error || 'VISION_VERDICT_FAIL', detail: r.raw || '' },
    };
  }

  const parsed = parseVisualResponse(responseText, pairs);
  return {
    ok: parsed.verdict !== 'error',
    verdict: parsed.verdict,
    pages_compared: parsed.pages_compared,
    blocking_findings: parsed.blocking_findings,
    elapsedMs: Date.now() - t0,
    model,
    ...(parsed.verdict === 'error' ? { error: { kind: 'EMPTY_RESPONSE', detail: 'vision model returned no parseable response' } } : {}),
  };
}

// argv-guarded self-test: verifies the module loads + inventories baselines + builds
// a prompt without invoking the vision model (no quota burn). Per plugin convention.

if (process.argv[1]?.endsWith('visual_witness.mjs') && process.argv.includes('--selftest')) {
  (async () => {
    const baselines = inventoryBaseline();
    console.log(`baseline inventory: ${baselines.length} pages`);
    if (baselines.length === 0) {
      console.error('FAIL: no baselines found at', BASELINE_DIR, '(need to be moved here from mt-audit/qc-baseline/)');
      process.exit(1);
    }
    const samplePairs = baselines.slice(0, 3).map(b => ({ ...b, preview_path: b.baseline_path /* self-test: compare baseline to itself */ }));
    const prompt = buildVisualPrompt(samplePairs);
    console.log(`prompt length: ${prompt.length} chars (sample for 3 pairs)`);
    const testResponseText = [
      `${samplePairs[0].slug}/${samplePairs[0].viewport}: CLEAN`,
      `${samplePairs[1].slug}/${samplePairs[1].viewport}: CONCERN: minor color drift`,
      `${samplePairs[2].slug}/${samplePairs[2].viewport}: CLEAN`,
      'VERDICT: concern'
    ].join('\n');
    const parsed = parseVisualResponse(testResponseText, samplePairs);
    console.log('parse test verdict:', parsed.verdict, 'findings:', parsed.pages_compared.map(p => p.finding));
    if (parsed.verdict === 'concern' && parsed.pages_compared.filter(f => f.finding === 'clean').length === 2 && parsed.pages_compared.filter(f => f.finding === 'concern').length === 1) {
      console.log('PASS: inventory + prompt-build + response-parse all OK (no vision call made)');
      process.exit(0);
    } else {
      console.error('FAIL: parse test did not return expected structure');
      process.exit(1);
    }
  })();
}
