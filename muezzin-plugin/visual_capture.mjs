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
          const url = buildPreviewUrl(baseUrl, slug, urlForSlug);
          await page.goto(url, { waitUntil: 'networkidle0' });
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

    if (failures === 0) {
      console.log('PASS: all self-tests passed');
      process.exit(0);
    } else {
      console.error(`FAIL: ${failures} self-test(s) failed`);
      process.exit(1);
    }
  })();
}
