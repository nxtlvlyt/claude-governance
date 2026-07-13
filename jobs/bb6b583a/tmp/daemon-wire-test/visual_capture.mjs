// visual_capture.mjs — captures deployed-preview screenshots for visual_witness.mjs
//
// Companion to capture-visreg-baseline.mjs (which captures the BASELINE screenshots).
// This module captures the PREVIEW side of the pair: same slug inventory (sourced from
// inventoryBaseline() in ./visual_witness.mjs), same 3 viewports, same animation-freeze
// intent, so witnessVisualDiff() gets an apples-to-apples comparison.
//
// NOTE on the animation-freeze CSS: capture-visreg-baseline.mjs was not available as a
// read dependency for this file, so the freeze rule below is authored independently to
// the same intent (kill animations/transitions/smooth-scroll before the screenshot) —
// it is not verified byte-for-byte identical to that file's rule.
//
// Uses the bundled `puppeteer` package (not puppeteer-core) so no separate Chrome
// download/path wiring is required.

import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { inventoryBaseline } from './visual_witness.mjs';

// Mirrors capture-visreg-baseline.mjs's viewport matrix.
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2 },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];

const ANIMATION_FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
`;

const DEFAULT_WAIT_MS = 2500;

// PURE: where a captured preview screenshot for (slug, viewport) lives under outDir.
export function previewPathFor(outDir, slug, viewport) {
  return path.join(outDir, slug, `${viewport}.png`);
}

function defaultUrlForSlug(slug) {
  return slug === 'home' ? '/' : `/${slug}.html`;
}

// PURE: builds the URL to navigate to for a given slug. urlForSlug, if provided,
// overrides the default 'home'->'/' else '/<slug>.html' mapping.
export function buildPreviewUrl(baseUrl, slug, urlForSlug) {
  const mapper = typeof urlForSlug === 'function' ? urlForSlug : defaultUrlForSlug;
  const suffix = mapper(slug);
  return `${String(baseUrl).replace(/\/+$/, '')}${suffix}`;
}

// Returns a (slug, viewport) => path function bound to outDir, for handing to
// witnessVisualDiff()'s previewPathFn parameter.
export function buildPreviewPathFn(outDir) {
  return (slug, viewport) => previewPathFor(outDir, slug, viewport);
}

const STATIC_CONTENT_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};

// Creates (does not start) a tiny static file server rooted at staticRoot. Serves files by
// path, maps '/'-and-trailing-slash to index.html, refuses to serve outside staticRoot (403),
// 404s missing files. Extracted so the static-serve path is unit-testable without puppeteer.
export async function createStaticServer(staticRoot) {
  const http = await import('http');
  const { readFile } = await import('fs/promises');
  return http.createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent((req.url || '/').split('?')[0]);
      if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
      const fp = path.join(staticRoot, rel.replace(/^\/+/, ''));
      // containment: never serve outside staticRoot
      if (!path.resolve(fp).startsWith(path.resolve(staticRoot))) { res.writeHead(403); res.end(); return; }
      const data = await readFile(fp);
      res.writeHead(200, { 'Content-Type': STATIC_CONTENT_TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
}

// capturePreviews — launches puppeteer, walks every slug from inventoryBaseline() across
// the 3 viewports, screenshots each to previewPathFor(outDir, slug, viewport.name).
// Never throws: all failures are collected into the returned receipt instead.
export async function capturePreviews(baseUrl, outDir, opts = {}) {
  const viewports = opts.viewports || VIEWPORTS;
  const urlForSlug = opts.urlForSlug;
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS;
  const captured = [];
  const failed = [];
  let browser;
  let staticSrv = null;
  let effectiveBaseUrl = baseUrl;

  // STATIC-SERVE (M-VISUAL-QC capture fix, 2026-07-02): when opts.staticRoot is set, serve the
  // repo files directly from a tiny ephemeral static server and capture against THAT instead of
  // baseUrl. This bypasses wrangler pages dev's .html->extensionless 308 redirect, which was
  // silently serving the SSR fallback (45KB, no leaflet/feature scripts) instead of the real
  // 391KB interactive page — proven via puppeteer 2026-07-02, the root reason zero VISUAL-QC
  // missions ever completed. Opt-in only: no staticRoot -> behavior byte-identical to before.
  // Tradeoff (accepted): a static server does not serve /api/* Pages Functions, so live data is
  // absent — fine for feature-PRESENCE QC (the scripts load + render), which is the common case.
  if (opts.staticRoot) {
    try {
      staticSrv = await createStaticServer(opts.staticRoot);
      await new Promise((resolve) => staticSrv.listen(0, '127.0.0.1', resolve));
      effectiveBaseUrl = `http://127.0.0.1:${staticSrv.address().port}`;
    } catch (err) {
      // static server failed to start -> fall back to the given baseUrl (never block capture)
      failed.push({ slug: null, viewport: null, error: `static-serve setup failed, using baseUrl: ${String(err?.message || err)}` });
      staticSrv = null;
      effectiveBaseUrl = baseUrl;
    }
  }

  try {
    const puppeteer = (await import('puppeteer')).default;
    browser = await puppeteer.launch(opts.launchOptions || { headless: true });

    const baselines = inventoryBaseline(opts.baselineDir);
    const slugs = [...new Set(baselines.map((b) => b.slug))];

    for (const slug of slugs) {
      for (const viewport of viewports) {
        let page;
        try {
          page = await browser.newPage();
          await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.deviceScaleFactor,
          });
          const url = buildPreviewUrl(effectiveBaseUrl, slug, urlForSlug);
          // BEST-EFFORT NAV (M-VISUAL-QC, 2026-07-02): a live interactive page (leaflet tiles,
          // analytics, sentry) may keep network connections open indefinitely and never reach
          // networkidle0 — proven on map.html, which never idles. Previously that meant a 30s
          // timeout THROW, caught below as a "failed" entry, and NO screenshot: the exact reason
          // a real feature page could never be captured. Now: bound the wait, and if it times
          // out but the document rendered a body, capture what's on screen anyway. A genuine nav
          // failure (no document at all) still rethrows and is recorded as failed.
          const waitUntil = opts.waitUntil || 'networkidle0';
          const gotoTimeoutMs = opts.gotoTimeoutMs ?? 20000;
          try {
            await page.goto(url, { waitUntil, timeout: gotoTimeoutMs });
          } catch (navErr) {
            const hasBody = await page.evaluate(() => !!(document && document.body && document.body.innerHTML.length > 0)).catch(() => false);
            if (!hasBody) throw navErr; // never actually loaded — real failure
            // else: rendered but network never settled — proceed to best-effort screenshot
          }
          await page.addStyleTag({ content: ANIMATION_FREEZE_CSS });
          await new Promise((resolve) => setTimeout(resolve, waitMs));

          const outPath = previewPathFor(outDir, slug, viewport.name);
          await mkdir(path.dirname(outPath), { recursive: true });
          await page.screenshot({ path: outPath });
          captured.push({ slug, viewport: viewport.name, path: outPath });
        } catch (err) {
          failed.push({ slug, viewport: viewport.name, error: String(err?.message || err) });
        } finally {
          if (page) {
            try { await page.close(); } catch { /* page already gone */ }
          }
        }
      }
    }

    return { ok: failed.length === 0, captured, failed };
  } catch (err) {
    failed.push({ slug: null, viewport: null, error: String(err?.message || err) });
    return { ok: false, captured, failed };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* already closed */ }
    }
    if (staticSrv) {
      try { await new Promise((resolve) => staticSrv.close(resolve)); } catch { /* already closed */ }
    }
  }
}

// argv-guarded self-test: verifies path shape, URL-mapping defaults+override, and that
// `import puppeteer from 'puppeteer'` resolves — WITHOUT calling puppeteer.launch().
// Per plugin convention (mirrors visual_witness.mjs's --selftest).

if (process.argv[1]?.endsWith('visual_capture.mjs') && process.argv.includes('--selftest')) {
  (async () => {
    let failures = 0;

    const p = previewPathFor('/tmp/out', 'home', 'mobile');
    const expectedPath = path.join('/tmp/out', 'home', 'mobile.png');
    if (p === expectedPath) {
      console.log('PASS: previewPathFor path shape');
    } else {
      console.error('FAIL: previewPathFor', p, 'expected', expectedPath);
      failures++;
    }

    const homeUrl = buildPreviewUrl('https://example.com', 'home');
    if (homeUrl === 'https://example.com/') {
      console.log('PASS: buildPreviewUrl default home mapping');
    } else {
      console.error('FAIL: buildPreviewUrl home mapping ->', homeUrl);
      failures++;
    }

    const slugUrl = buildPreviewUrl('https://example.com', 'about');
    if (slugUrl === 'https://example.com/about.html') {
      console.log('PASS: buildPreviewUrl default slug mapping');
    } else {
      console.error('FAIL: buildPreviewUrl slug mapping ->', slugUrl);
      failures++;
    }

    const overrideUrl = buildPreviewUrl('https://example.com', 'about', (slug) => `/custom/${slug}`);
    if (overrideUrl === 'https://example.com/custom/about') {
      console.log('PASS: buildPreviewUrl override mapping');
    } else {
      console.error('FAIL: buildPreviewUrl override mapping ->', overrideUrl);
      failures++;
    }

    const bound = buildPreviewPathFn('/tmp/out');
    if (bound('home', 'desktop') === previewPathFor('/tmp/out', 'home', 'desktop')) {
      console.log('PASS: buildPreviewPathFn binding');
    } else {
      console.error('FAIL: buildPreviewPathFn binding');
      failures++;
    }

    try {
      const mod = await import('puppeteer');
      if (mod && typeof mod.default?.launch === 'function') {
        console.log('PASS: puppeteer module resolves (launch() present, not called)');
      } else {
        console.error('FAIL: puppeteer module resolved but default.launch is not a function');
        failures++;
      }
    } catch (err) {
      console.error('FAIL: puppeteer import failed:', err?.message || err);
      failures++;
    }

    // createStaticServer: serves a real file, maps / -> index.html, 403 on path-escape, 404 on miss.
    try {
      const os = await import('os');
      const { mkdtemp, writeFile } = await import('fs/promises');
      const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'vqc-static-'));
      const marker = '<!doctype html><html><body>STATIC-SERVE-OK-42</body></html>';
      await writeFile(path.join(tmpRoot, 'index.html'), marker, 'utf8');
      const srv = await createStaticServer(tmpRoot);
      await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${srv.address().port}`;
      const getStatusBody = async (p) => {
        const r = await fetch(base + p);
        return { status: r.status, body: await r.text() };
      };
      try {
        const root = await getStatusBody('/');
        if (root.status === 200 && root.body.includes('STATIC-SERVE-OK-42')) {
          console.log('PASS: createStaticServer serves / -> index.html with real content');
        } else {
          console.error('FAIL: createStaticServer / ->', root.status, root.body.slice(0, 40));
          failures++;
        }
        const explicit = await getStatusBody('/index.html');
        if (explicit.status === 200 && explicit.body.includes('STATIC-SERVE-OK-42')) {
          console.log('PASS: createStaticServer serves explicit /index.html');
        } else {
          console.error('FAIL: createStaticServer /index.html ->', explicit.status);
          failures++;
        }
        const miss = await getStatusBody('/does-not-exist.html');
        if (miss.status === 404) {
          console.log('PASS: createStaticServer 404s missing file');
        } else {
          console.error('FAIL: createStaticServer missing-file status ->', miss.status);
          failures++;
        }
        const escape = await getStatusBody('/..%2f..%2f..%2fwindows%2fwin.ini');
        if (escape.status === 403 || escape.status === 404) {
          console.log('PASS: createStaticServer refuses path-escape (403/404)');
        } else {
          console.error('FAIL: createStaticServer path-escape not contained ->', escape.status);
          failures++;
        }
      } finally {
        await new Promise((resolve) => srv.close(resolve));
      }
    } catch (err) {
      console.error('FAIL: createStaticServer self-test threw:', err?.message || err);
      failures++;
    }

    if (failures === 0) {
      console.log('PASS: all self-tests passed');
      process.exit(0);
    } else {
      console.error(`FAIL: ${failures} self-test(s) failed`);
      process.exit(1);
    }
  })();
}
