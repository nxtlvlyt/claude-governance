// visual_witness.mjs — visual-regression witness via agy (Google Antigravity) + Gemini
//
// Operator's standing rule (2026-06-23): "agy/Gemini is unlimited via Antigravity AND
// specifically suited to VISUAL QC ... I only really find Gemini useful for visual
// quality control it's not really that good at coding". This module is the substrate
// embodiment of that rule: a visual-witness seat that calls agy with a vision-capable
// Gemini model to compare deployed-preview screenshots vs the baseline screenshots
// captured by capture-visreg-baseline.mjs (sister script, also dormant).
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
// Why agy specifically (not gemini-3-flash-preview via Ollama Cloud):
// - Operator pays for unlimited-quota Antigravity; using Ollama Cloud's gemini-flash
//   for this would burn Ollama quota for capability you already have free
// - Antigravity's Gemini 3.x has full multimodal vision (frontier-class); the
//   Ollama-routed gemini-3-flash-preview is the flash tier (smaller/weaker for visual)
// - The 72-screenshot baseline at qc-baseline/ was captured for THIS witness
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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { dispatchAgy, agyAvailable } from './agy_dispatch.mjs';

const HERE = path.dirname(import.meta.url.replace(/^file:\/+/, '')).replace(/\\/g, '/');
const BASELINE_DIR = path.join(HERE, 'qc-baseline');
const DEFAULT_MODEL = 'gemini-3.5-flash'; // agy default — frontier multimodal for visual

// Build the substantive prompt agy needs (vs trivial prompt that triggers planner-loop
// swallow per the agy_dispatch.mjs docs). For visual witness, "compare these N pairs of
// images and list any regression" IS substantive.

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

// Parse agy's response into a structured verdict. Per the agy_dispatch.mjs caveat,
// stdout may be empty even when the model successfully ran. In that case the verdict
// is reported as 'error' kind=EMPTY_RESPONSE — the caller can decide whether to retry
// or escalate.

function parseVisualResponse(stdout, pagePairs) {
  if (!stdout || stdout.trim().length === 0) {
    return {
      verdict: 'error',
      pages_compared: pagePairs.map(p => ({ ...p, diff_summary: '(no response)', finding: null })),
      blocking_findings: [],
    };
  }
  const lines = stdout.split(/\r?\n/);
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

// witnessVisualDiff — capture preview screenshots, dispatch agy to compare them
// against baselines, parse the verdict, return structured receipt.
//
// previewPathFn: function(slug, viewport) -> absolute path to a captured preview screenshot
// (the caller's responsibility — orchestrate.mjs after deploying a preview).

export async function witnessVisualDiff(previewPathFn, opts = {}) {
  const t0 = Date.now();
  const model = opts.model || DEFAULT_MODEL;

  if (!agyAvailable()) {
    return {
      ok: false, verdict: 'error', pages_compared: [], blocking_findings: [],
      elapsedMs: Date.now() - t0, model,
      error: { kind: 'AGY_BINARY_MISSING', detail: 'agy.exe not present; install or configure path' },
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
  const r = await dispatchAgy(prompt, {
    model,
    timeoutMs: opts.timeoutMs || 5 * 60 * 1000,
    printTimeout: '5m',
    cwd: opts.cwd,
  });

  if (!r.ok && r.error?.kind !== 'NONZERO_EXIT') {
    return {
      ok: false, verdict: 'error', pages_compared: pairs.map(p => ({ ...p, diff_summary: '(dispatch failed)', finding: null })),
      blocking_findings: [], elapsedMs: Date.now() - t0, model,
      error: r.error,
    };
  }

  const parsed = parseVisualResponse(r.stdout, pairs);
  return {
    ok: parsed.verdict !== 'error',
    verdict: parsed.verdict,
    pages_compared: parsed.pages_compared,
    blocking_findings: parsed.blocking_findings,
    elapsedMs: Date.now() - t0,
    model,
    ...(parsed.verdict === 'error' ? { error: { kind: 'EMPTY_RESPONSE', detail: 'agy returned no parseable response (planner-loop swallow likely)' } } : {}),
  };
}

// argv-guarded self-test: verifies the module loads + inventories baselines + builds
// a prompt without invoking agy (no quota burn). Per plugin convention.

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` && process.argv.includes('--selftest')) {
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
    const parsed = parseVisualResponse('site1/desktop: CLEAN\nsite2/mobile: CONCERN: minor color drift\nsite3/tablet: CLEAN\nVERDICT: concern', samplePairs);
    console.log('parse test verdict:', parsed.verdict, 'findings:', parsed.pages_compared.map(p => p.finding));
    if (parsed.verdict === 'concern' && parsed.pages_compared.filter(f => f.finding === 'clean').length === 2 && parsed.pages_compared.filter(f => f.finding === 'concern').length === 1) {
      console.log('PASS: inventory + prompt-build + response-parse all OK (no agy call made)');
      process.exit(0);
    } else {
      console.error('FAIL: parse test did not return expected structure');
      process.exit(1);
    }
  })();
}
