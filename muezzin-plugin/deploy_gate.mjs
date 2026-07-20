// deploy_gate.mjs — post-deploy render-verification gate (M-DEPLOY-SELF-VERIFY, 2026-07-02).
//
// WHY THIS EXISTS: this session the conductor hand-deployed muddytires, then hand-caught that
// the deploy had REGRESSED the live map (/map served the SSR shell, not the interactive Leaflet
// map — a routing rule + Cloudflare's .html->extensionless redirect). Nothing in the pipeline
// verified the deploy actually rendered. This is that missing verification, as a reusable gate:
// an ops-deploy mission runs `node deploy_gate.mjs <url> [--require=a,b,c]` as a [command] step
// AFTER the wrangler deploy; a non-zero exit fails the mission (so the chain catches a broken
// deploy itself, instead of the conductor doing it by hand). Uses the bundled puppeteer.
//
// PASS = the page rendered the interactive surface (a real element/marker is present) AND every
// required script actually loaded. FAIL (exit 1) = shell/SSR-only, missing feature, or nav error.

import path from 'node:path';

// PURE: parse argv into { url, requireMarkers[], selector, timeoutMs, waitMs }. Exported for selftest.
export function parseArgs(argv) {
  const out = { url: null, requireMarkers: [], selector: '.leaflet-container', timeoutMs: 20000, waitMs: 5000 };
  for (const a of argv) {
    if (a.startsWith('--require=')) out.requireMarkers = a.slice(10).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--selector=')) out.selector = a.slice(11);
    else if (a.startsWith('--timeout=')) out.timeoutMs = Number(a.slice(10)) || out.timeoutMs;
    else if (a.startsWith('--wait=')) out.waitMs = Number(a.slice(7)) || out.waitMs;
    else if (!a.startsWith('--')) out.url = a;
  }
  return out;
}

// PURE: given the probe result, decide pass/fail + reasons. Exported for selftest (no browser).
export function judge({ selectorPresent, loadedScripts, requireMarkers, navOk }) {
  const reasons = [];
  if (!navOk) reasons.push('navigation failed (no document/body rendered)');
  if (!selectorPresent) reasons.push('required selector absent (page did not render the interactive surface — likely an SSR/shell fallback)');
  for (const m of requireMarkers) {
    if (!loadedScripts.some((s) => s.includes(m))) reasons.push(`required script never loaded: ${m}`);
  }
  return { ok: reasons.length === 0, reasons };
}

// PURE: does this probe result look like a coldstart flake (worth one retry) rather than a real
// failure? Exported for selftest. Coldstart flakes present as nav failing or the selector never
// appearing — a fresh page + short backoff often clears them; a genuine regression fails the same
// way twice.
export function isRetryableColdstart({ navOk, selectorPresent }) {
  return !navOk || !selectorPresent;
}

export const COLDSTART_RETRY_BACKOFF_MS = 1500;

// LIVE: render `url` in headless puppeteer, collect loaded scripts + selector presence.
// Retries once (fresh page, COLDSTART_RETRY_BACKOFF_MS backoff) if the first pass looks like a
// coldstart flake rather than a real regression.
export async function renderProbe(url, { selector, timeoutMs, waitMs, launchOptions } = {}) {
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch(launchOptions || { headless: true });
  try {
    const probeOnce = async () => {
      const page = await browser.newPage();
      try {
        const loadedScripts = [];
        page.on('response', (r) => { const u = r.url(); if (/\.js(\?|$)/i.test(u)) loadedScripts.push(u.split('/').pop().split('?')[0]); });
        await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
        try { await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs ?? 20000 }); }
        catch { /* interactive pages (leaflet tiles) may never idle — best-effort, still probe the DOM */ }
        await new Promise((r) => setTimeout(r, waitMs ?? 5000));
        const dom = await page.evaluate((sel) => ({
          selectorPresent: !!document.querySelector(sel),
          hasBody: !!(document.body && document.body.innerHTML.length > 200),
          bodyLen: document.body ? document.body.innerHTML.length : 0,
          title: document.title,
        }), selector || '.leaflet-container').catch(() => ({ selectorPresent: false, hasBody: false, bodyLen: 0, title: '' }));
        const navOk = dom.hasBody;
        return { ...dom, loadedScripts, navOk };
      } finally {
        await page.close();
      }
    };
    let result = await probeOnce();
    if (isRetryableColdstart(result)) {
      await new Promise((r) => setTimeout(r, COLDSTART_RETRY_BACKOFF_MS));
      result = await probeOnce();
    }
    return result;
  } finally {
    await browser.close();
  }
}

// argv-guarded CLI: node deploy_gate.mjs <url> [--require=a.js,b.js] [--selector=.foo] -> exit 0/1
if (process.argv[1]?.endsWith('deploy_gate.mjs') && process.argv.slice(2).some((a) => a && !a.startsWith('--'))) {
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    if (!args.url) { console.error('deploy_gate: no URL given'); process.exit(2); }
    const probe = await renderProbe(args.url, args);
    const verdict = judge({ selectorPresent: probe.selectorPresent, loadedScripts: probe.loadedScripts, requireMarkers: args.requireMarkers, navOk: probe.navOk });
    console.log(JSON.stringify({ url: args.url, ok: verdict.ok, title: probe.title, bodyLen: probe.bodyLen, selectorPresent: probe.selectorPresent, scripts: probe.loadedScripts.length, reasons: verdict.reasons }, null, 2));
    process.exit(verdict.ok ? 0 : 1);
  })();
}

// argv-guarded selftest (no browser): exercises parseArgs + judge (the pure decision logic).
// Runs on a bare `node deploy_gate.mjs` (the plugin's selftest convention) OR explicit --selftest;
// a URL arg routes to the CLI branch above instead.
if (process.argv[1]?.endsWith('deploy_gate.mjs') && !process.argv.slice(2).some((a) => a && !a.startsWith('--'))) {
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
  const a = parseArgs(['https://x.ca/map', '--require=leaflet.js,aurora-overlay.js', '--selector=.leaflet-container']);
  ck(a.url === 'https://x.ca/map', 'parseArgs: url');
  ck(a.requireMarkers.length === 2 && a.requireMarkers[0] === 'leaflet.js', 'parseArgs: --require list');
  ck(a.selector === '.leaflet-container', 'parseArgs: --selector');
  // the regression shape: SSR shell — selector absent, feature scripts NOT loaded -> FAIL
  const shell = judge({ selectorPresent: false, loadedScripts: ['app.js'], requireMarkers: ['leaflet.js', 'aurora-overlay.js'], navOk: true });
  ck(shell.ok === false, 'judge: SSR shell (no leaflet, no feature scripts) -> FAIL (the exact routing-regression this gate exists to catch)');
  ck(shell.reasons.length >= 3, 'judge: shell failure names selector-absent + each missing script');
  // the healthy shape: interactive map rendered + all required scripts loaded -> PASS
  const good = judge({ selectorPresent: true, loadedScripts: ['leaflet.js', 'aurora-overlay.js', 'plan-day-gpx-export.js'], requireMarkers: ['leaflet.js', 'aurora-overlay.js'], navOk: true });
  ck(good.ok === true && good.reasons.length === 0, 'judge: interactive map + required scripts loaded -> PASS');
  // partial: rendered but one required feature missing -> FAIL (names the missing one)
  const partial = judge({ selectorPresent: true, loadedScripts: ['leaflet.js'], requireMarkers: ['leaflet.js', 'aurora-overlay.js'], navOk: true });
  ck(partial.ok === false && partial.reasons.some((r) => r.includes('aurora-overlay.js')), 'judge: rendered but a required feature script missing -> FAIL, names it');
  // coldstart-retry predicate: nav failure or missing selector reads as a worth-a-retry flake
  ck(isRetryableColdstart({ navOk: false, selectorPresent: true }) === true, 'isRetryableColdstart: nav failure -> retryable');
  ck(isRetryableColdstart({ navOk: true, selectorPresent: false }) === true, 'isRetryableColdstart: selector absent -> retryable');
  ck(isRetryableColdstart({ navOk: true, selectorPresent: true }) === false, 'isRetryableColdstart: nav ok + selector present -> not retryable');
  console.log(fails === 0 ? '\nALL PASS — deploy_gate pure logic (parseArgs + judge)' : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}
