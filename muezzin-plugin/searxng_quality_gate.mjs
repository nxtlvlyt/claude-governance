#!/usr/bin/env node
// searxng_quality_gate.mjs — refuse POISONED search results instead of passing them on.
//
// WHY THIS EXISTS (2026-08-03). SearXNG on the laptop returned 10 results per query and
// reported `unresponsive_engines: []` — i.e. it looked perfectly healthy — while returning:
//   "qlora catastrophic forgetting"        -> Thai government procurement documents
//   "BFCL irrelevance detection benchmark" -> pizza places in Des Moines
//   "ollama OLLAMA_NUM_GPU environment..." -> Philippine Social Security System
// The same query returned DIFFERENT unrelated results on each call, which is the signature
// of the query text never reaching the engine: bing serves this client a generic page and
// SearXNG scrapes whatever links are on it.
//
// Receipts for the engine state at the time of writing:
//   duckduckgo -> CAPTCHA (wt-wt)             startpage -> redirected to /sp/captcha
//   brave      -> too many requests            google    -> HTTP 403 (suspended 180s)
//   bing       -> 200 OK, results unrelated to the query  <-- the dangerous one
//   arxiv, github -> first-party APIs, genuinely relevant
//
// THE POINT: a count of 10 with zero unresponsive engines is NOT health. The old
// searxng_preflight contract ("/search?format=json must answer") passes on this garbage.
// An empty result is honest; a full page of unrelated results is a lie a model will cite.
// This is the same failure class as the UTF-16 byte-count guard recorded in
// nxtbeast-wsl-orphaned-vm: a check that passes on garbage is worse than no check.

const BASE = process.env.SEARXNG_URL || 'http://localhost:8080';

// Probes whose correct answers are unmistakable. If a probe's results share no meaningful
// token with its own query, the pipeline is returning noise regardless of result count.
const PROBES = [
  { q: 'catastrophic forgetting lora fine tuning', want: ['forget', 'lora', 'fine-tun', 'finetun', 'adapt'] },
  { q: 'berkeley function calling leaderboard', want: ['function', 'call', 'berkeley', 'bfcl', 'gorilla'] },
  { q: 'ollama environment variables gpu', want: ['ollama', 'gpu', 'environment', 'env'] },
];

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'how', 'what']);

async function search(q, engines) {
  const p = new URLSearchParams({ q, format: 'json' });
  if (engines) p.set('engines', engines);
  const r = await fetch(`${BASE.replace(/\/$/, '')}/search?${p}`, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP_${r.status}`);
  return r.json();
}

function relevance(probe, results) {
  // fraction of results whose title+content contains ANY expected token
  if (!results.length) return 0;
  let hit = 0;
  for (const r of results) {
    const hay = `${r.title || ''} ${r.content || ''} ${r.url || ''}`.toLowerCase();
    if (probe.want.some((w) => hay.includes(w))) hit++;
  }
  return hit / results.length;
}

export async function assess() {
  const rows = [];
  for (const probe of PROBES) {
    let d;
    try { d = await search(probe.q); } catch (e) { rows.push({ q: probe.q, error: String(e) }); continue; }
    const results = d.results || [];
    rows.push({
      q: probe.q,
      n: results.length,
      unresponsive: (d.unresponsive_engines || []).length,
      relevance: relevance(probe, results),
      top: (results[0]?.title || '').slice(0, 60),
    });
  }
  const scored = rows.filter((r) => typeof r.relevance === 'number');
  const mean = scored.length ? scored.reduce((a, b) => a + b.relevance, 0) / scored.length : 0;
  // POISONED: results are being returned but they do not match their own queries.
  // This is the state that must fail loudly — it is invisible to a count-based check.
  const verdict = mean >= 0.5 ? 'HEALTHY' : (scored.some((r) => r.n > 0) ? 'POISONED' : 'EMPTY');
  return { verdict, meanRelevance: Number(mean.toFixed(2)), rows };
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop() || '')) {
  assess().then((a) => {
    console.log(`SEARXNG ${a.verdict}  meanRelevance=${a.meanRelevance}`);
    for (const r of a.rows) {
      if (r.error) { console.log(`  ERROR  ${r.q} :: ${r.error}`); continue; }
      console.log(`  n=${String(r.n).padStart(2)} rel=${r.relevance.toFixed(2)} unresp=${r.unresponsive}  ${r.q.slice(0, 40)}`);
      console.log(`         top: ${r.top}`);
    }
    if (a.verdict === 'POISONED') {
      console.log('\nPOISONED means results ARE returned but do not match their queries.');
      console.log('A count-based or unresponsive_engines check PASSES this state. Do not ground on it.');
    }
    process.exit(a.verdict === 'HEALTHY' ? 0 : 1);
  });
}
