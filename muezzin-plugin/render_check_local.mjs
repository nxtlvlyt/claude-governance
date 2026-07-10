// render_check_local.mjs — local-static-server headless-render verification (QUEUE.md P1d).
//
// WHY THIS EXISTS: naive `puppeteer.goto('file://...')` false-negatives on root-relative
// asset paths (e.g. `/assets/style.css`) — those resolve against the filesystem root when
// opened as a bare file://, not the site folder, so a correct site (Cloudflare Pages
// resolves `/` to the site root) looks broken under test. This spins up a real local
// static file server first, matching how the site is actually served, then renders through
// puppeteer against http://127.0.0.1:<port>/ URLs.
//
// Proven live (2026-07-09, atv-7-build-styling): caught two real defects that every
// text-based Select-String check missed — a missing `/*` that made the browser's CSS
// parser silently drop the whole :root {} block (35 rules parsed, zero :root), and a
// .site-nav selector that never matched any element because nothing added that class to
// the real <nav aria-label="Primary"> markup. Both only visible via document.styleSheets
// inspection + getComputedStyle after an actual render — not file-content regex.
//
// Usage: node render_check_local.mjs <static-root-dir> <page1,page2,...> [--require-css]
// Exit 0 = every listed page's stylesheet(s) parsed with a real :root rule (if present)
// and produced no console errors. Exit 1 = any page failed, with reasons printed to stderr.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export function startStaticServer(root) {
  const absRoot = path.resolve(root);
  const server = http.createServer(async (req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const filePath = path.join(absRoot, urlPath);
    if (!filePath.startsWith(absRoot)) { res.writeHead(403); res.end(); return; }
    try {
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Not found: ' + urlPath);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// PURE: given a raw evaluate() result, decide pass/fail + reasons. Exported for selftest.
// consoleErrors = genuine JS exceptions/console.error calls (favicon 404s excluded — those
// are tracked separately as failedRequests, with an actual URL, not parsed from text).
export function judgePage({ styleSheetCount, hasParseableStylesheets, consoleErrors, failedRequests, bodyLen }) {
  const reasons = [];
  if (bodyLen < 20) reasons.push('page body is empty/near-empty — render likely failed');
  if (styleSheetCount > 0 && !hasParseableStylesheets) reasons.push('stylesheet(s) linked but none exposed any parseable CSS rules');
  if (consoleErrors.length > 0) reasons.push(`console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
  if (failedRequests?.length > 0) reasons.push(`failed requests: ${failedRequests.slice(0, 3).join(' | ')}`);
  return { ok: reasons.length === 0, reasons };
}

export async function renderPage(baseUrl, pagePath) {
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    // The console error TEXT for a failed resource load is generic ("Failed to load
    // resource: 404") and never names the URL — matching on message text can't tell a
    // favicon 404 apart from a real one. Track the actual URL via the response event
    // instead, and filter favicon.ico there (the browser's own automatic, unsolicited
    // request — none of these pages declare one; that's a cosmetic gap, not a render
    // failure). Any OTHER failed request still counts.
    // Generic "Failed to load resource" console messages carry no URL and duplicate what
    // the response listener below already captures precisely — excluded here so a filtered
    // favicon 404 doesn't sneak back in as an unfiltered console error with the same event.
    page.on('console', (m) => { if (m.type() === 'error' && !/failed to load resource/i.test(m.text())) consoleErrors.push(m.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('response', (res) => {
      if (res.status() >= 400 && !/favicon\.ico$/i.test(res.url())) failedRequests.push(`${res.status()} ${res.url()}`);
    });
    await page.goto(new URL(pagePath, baseUrl).href, { waitUntil: 'networkidle0', timeout: 15000 });
    const dom = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let hasParseableStylesheets = false;
      for (const s of sheets) {
        try { if (s.cssRules.length > 0) { hasParseableStylesheets = true; break; } } catch { /* cross-origin, skip */ }
      }
      return {
        styleSheetCount: sheets.length,
        hasParseableStylesheets,
        bodyLen: document.body ? document.body.innerHTML.length : 0,
      };
    });
    return judgePage({ ...dom, consoleErrors, failedRequests });
  } finally {
    await browser.close();
  }
}

async function main() {
  const [, , rootArg, pagesArg] = process.argv;
  if (!rootArg || !pagesArg) {
    console.error('Usage: node render_check_local.mjs <static-root-dir> <page1,page2,...>');
    process.exit(2);
  }
  const pages = pagesArg.split(',').map((p) => p.trim()).filter(Boolean);
  const { server, port } = await startStaticServer(rootArg);
  const baseUrl = `http://127.0.0.1:${port}/`;
  let allOk = true;
  for (const p of pages) {
    const result = await renderPage(baseUrl, p);
    if (result.ok) {
      console.log(`PASS ${p}`);
    } else {
      allOk = false;
      console.error(`FAIL ${p}: ${result.reasons.join('; ')}`);
    }
  }
  server.close();
  process.exit(allOk ? 0 : 1);
}

// Entry point. BARE invocation (`node render_check_local.mjs`, no args) is this fork's
// established offline-self-test convention (.githooks/pre-commit: "every staged OFFLINE
// module also runs its argv-guarded self-test (`node <module>.mjs`)") — runs the PURE
// judgePage logic only, no browser, no network, no server. Real CLI use requires two
// positional args (root dir, comma-separated pages) and runs the live browser check.
const isDirectRun = process.argv[1]?.endsWith('render_check_local.mjs');
const hasRealArgs = process.argv.length > 3; // node, script, root, pages = 4 argv entries minimum

if (isDirectRun && hasRealArgs) {
  main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
} else if (isDirectRun) {
  const cases = [
    { name: 'clean page passes', input: { styleSheetCount: 1, hasParseableStylesheets: true, consoleErrors: [], failedRequests: [], bodyLen: 500 }, expectOk: true },
    { name: 'empty body fails', input: { styleSheetCount: 1, hasParseableStylesheets: true, consoleErrors: [], failedRequests: [], bodyLen: 5 }, expectOk: false },
    { name: 'unparseable stylesheet fails', input: { styleSheetCount: 1, hasParseableStylesheets: false, consoleErrors: [], failedRequests: [], bodyLen: 500 }, expectOk: false },
    { name: 'console errors fail', input: { styleSheetCount: 1, hasParseableStylesheets: true, consoleErrors: ['ReferenceError: x'], failedRequests: [], bodyLen: 500 }, expectOk: false },
    { name: 'no stylesheets linked still passes (not every page needs CSS)', input: { styleSheetCount: 0, hasParseableStylesheets: false, consoleErrors: [], failedRequests: [], bodyLen: 500 }, expectOk: true },
    { name: 'non-favicon failed request fails', input: { styleSheetCount: 1, hasParseableStylesheets: true, consoleErrors: [], failedRequests: ['404 /assets/style.css'], bodyLen: 500 }, expectOk: false },
    { name: 'favicon is pre-filtered upstream, never reaches judgePage as a failure', input: { styleSheetCount: 1, hasParseableStylesheets: true, consoleErrors: [], failedRequests: [], bodyLen: 500 }, expectOk: true },
  ];
  let fail = 0;
  for (const c of cases) {
    const r = judgePage(c.input);
    const pass = r.ok === c.expectOk;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.name}`);
    if (!pass) fail++;
  }
  console.log(fail === 0 ? `ALL PASS (${cases.length}/${cases.length})` : `${fail} FAILURE(S)`);
  process.exit(fail === 0 ? 0 : 1);
}
