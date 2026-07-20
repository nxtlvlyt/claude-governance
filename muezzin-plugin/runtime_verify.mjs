// runtime_verify.mjs — RUN the artifact before the witness blesses it (HOLE 1 closure).
//
// THE HOLE: nothing in the engine actually LOADS/EXECUTES an emitted code or HTML artifact
// before the per-step witness + verdict panel approve it. `node --check` only PARSES — it does
// NOT resolve import specifiers (an `import x from 'node:fetch'` against a non-existent builtin
// passes `node --check` with exit 0). The v1 import-smoke fallback was ALSO skipped by a heuristic
// for files with no exports OR a top-level network call — which is EXACTLY a CLI like doctor.mjs
// (no exports, top-level `await fetch(`). So a broken CLI shipped green (defect 1a). And the HTML
// jsdom net was dormant because jsdom was never installed + there was no package.json (defect 1b).
//
// THE FIX: a single entrypoint runtimeVerify(targetPath, bytes) that, per file type:
//   CODE (.mjs/.js):
//     (1) a STATIC pre-scan for unresolvable bare builtins (node:fetch etc.) and obviously-broken
//         import specifiers — cheap, catches the doctor.mjs class without spawning.
//     (2) a BOUNDED SANDBOX SUBPROCESS (spawnSync node) in a temp cwd that IMPORTS the module via
//         dynamic import. For a NON-EXPORTING CLI this also EXECUTES it (importing a CLI module runs
//         its top-level body), surfacing a load/import/throw at init. We DO NOT skip non-exporting /
//         CLI files — that was defect 1a. A definitive load/import throw -> fail CLOSED.
//   HTML (.htm/.html): load via jsdom with runScripts:'dangerously' to surface init-time throws
//     (the leaflet-rotate `L.map` crash class). jsdom is a devDependency (package.json) so the
//     check is ACTIVE, not dormant (defect 1b). If jsdom is genuinely unavailable -> fail OPEN.
//   JSON (.json): JSON.parse — a parse throw fails CLOSED.
//   anything else: not verifiable here -> fail OPEN (ok:true) — this gate never invents a failure.
//
// CONTRACT (preserved from v1's verified-correct pieces):
//   - fail CLOSED (ok:false) on a DEFINITIVE load/parse/init throw.
//   - fail OPEN (ok:true) only on a GENUINE inability to verify (tool truly unavailable AFTER an
//     install attempt, unknown file type, an absent/empty target we were asked about) — absence of
//     a verifier is never a failure verdict.
//   - kill switch: MUEZZIN_RUNTIME_VERIFY=off -> always ok:true (detail says disabled).
//
// Pure node (+ optional jsdom). No Ollama, no network reliance: the subprocess runs with a stub
// global.fetch so a top-level fetch() does not hang on DNS — we surface IMPORT/LOAD throws, not
// the result of a live network call.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SUBPROC_TIMEOUT_MS = Number(process.env.MUEZZIN_RUNTIME_VERIFY_TIMEOUT_MS || 8000);

// ----- static pre-scan: unresolvable bare builtins + malformed specifiers (defect 1a, cheap pass).
// `node --check` does not resolve specifiers; this catches the most common unresolved-import class
// (a typo'd / non-existent `node:*` builtin) without spawning. Conservative: only flags specifiers
// we can prove bad, never a relative/package import we cannot resolve statically (those go to the
// subprocess, which resolves them for real).
const REAL_NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto',
  'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
  'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty',
  'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);
function staticImportScan(src) {
  // matches `import ... from 'node:X'` and bare `import 'node:X'` and dynamic import('node:X')
  const re = /(?:from|import)\s*\(?\s*['"]node:([a-z_/]+)['"]/gi;
  const bad = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const base = m[1].split('/')[0];
    if (!REAL_NODE_BUILTINS.has(base)) bad.push(`node:${m[1]}`);
  }
  return bad;
}

// ----- code verifier: static scan THEN a bounded sandbox subprocess that dynamic-imports the file.
function verifyCode(targetPath, src) {
  const badBuiltins = staticImportScan(src);
  if (badBuiltins.length) {
    return { ok: false, error: 'unresolvable-builtin-import', detail: `imports a non-existent node builtin: ${[...new Set(badBuiltins)].join(', ')}` };
  }

  // Sandbox: write the ARTIFACT BYTES to a temp file (NOT the original targetPath — we verify
  // the bytes we were handed, which may differ from disk or be a relative/absent name), then a
  // tiny probe script in the same temp dir dynamic-imports that temp file. Importing the module
  // runs its top-level body (so a non-exporting CLI EXECUTES far enough to surface a load/import
  // throw). global.fetch is stubbed to a never-resolving-but-not-throwing shim so a top-level
  // `await fetch(...)` does not hang the probe on DNS; we time out regardless.
  //
  // BUGFIX (2026-06-17, found by the fixture harness): v1 imported `targetPath` directly, so a
  // relative/absent target produced a FALSE 'load-throw' (Cannot find module) and an on-disk
  // target was verified against STALE disk bytes, not the `src` it was handed. We now import the
  // temp copy of `src`. The temp file keeps the artifact's real extension so module resolution
  // (.mjs vs .cjs vs .js) matches how the engine will load it.
  const probeDir = mkdtempSync(path.join(tmpdir(), 'rtv_'));

  // findNearestModuleType: walk up from a starting directory looking for the nearest package.json
  // and read its "type" field, mirroring Node's own real resolution rule (RTV-PARENT-RELATIVE-FIX)
  // instead of always forcing "type":"module" on the sandbox, which produced a false SyntaxError
  // for a .js artifact that actually lives under a CommonJS package.json.
  function findNearestModuleType(startDir) {
    let dir = startDir;
    for (let i = 0; i < 20; i++) {
      const pkgPath = path.join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
          return pkg.type === 'module' ? 'module' : 'commonjs';
        } catch { return 'commonjs'; }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return 'commonjs';
  }

  // PARENT_RELATIVE_RE: matches `require('../x')` / `from '../x'` / `import('../x')` specifiers
  // that reach OUTSIDE the artifact's own directory, so those files can be mirrored into the
  // sandbox at the same relative depth instead of flattened alongside the artifact, which broke
  // every `../` reference (RTV-PARENT-RELATIVE-FIX).
  const PARENT_RELATIVE_RE = /(?:require\(|from\s|import\()\s*['"](\.\.\/[^'"]+)['"]/g;

  const srcDir = path.dirname(targetPath);
  // artifactSubDir: the artifact is written one directory DEEPER than probeDir root, so a `../`
  // specifier in its source has somewhere real to resolve to once mirrored below.
  const artifactSubDir = path.join(probeDir, 'artifact');
  mkdirSync(artifactSubDir, { recursive: true });

  // Copy adjacent .mjs/.js/.cjs/.json files alongside the artifact so same-directory relative
  // imports resolve correctly.
  try {
    const files = readdirSync(srcDir, { withFileTypes: true });
    for (const f of files) {
      if (f.isFile() && (f.name.endsWith('.mjs') || f.name.endsWith('.js') || f.name.endsWith('.cjs') || f.name.endsWith('.json'))) {
        if (f.name === path.basename(targetPath)) continue;
        writeFileSync(path.join(artifactSubDir, f.name), readFileSync(path.join(srcDir, f.name)));
      }
    }
  } catch (e) { console.error('[RTV-COPY-ERROR]', e); }

  // Mirror parent-relative (`../`) referenced files into the sandbox at the matching depth so a
  // require/import that walks up out of the artifact's own directory finds a real file instead of
  // throwing MODULE_NOT_FOUND against an empty sandbox (RTV-PARENT-RELATIVE-FIX).
  PARENT_RELATIVE_RE.lastIndex = 0;
  let prm;
  while ((prm = PARENT_RELATIVE_RE.exec(src)) !== null) {
    const rel = prm[1];
    let resolvedSrcPath = path.resolve(srcDir, rel);
    let destRel = rel;
    if (!existsSync(resolvedSrcPath)) {
      const foundExt = ['.js', '.cjs', '.mjs', '.json'].find((e) => existsSync(resolvedSrcPath + e));
      if (!foundExt) continue;
      resolvedSrcPath += foundExt;
      destRel += foundExt;
    }
    const destPath = path.resolve(artifactSubDir, destRel);
    try {
      mkdirSync(path.dirname(destPath), { recursive: true });
      writeFileSync(destPath, readFileSync(resolvedSrcPath));
    } catch (e) { console.error('[RTV-COPY-ERROR]', e); }
  }

  const ext = (path.extname(String(targetPath)) || '.mjs').toLowerCase();
  const artifactPath = path.join(artifactSubDir, 'rtv_artifact' + ext);
  writeFileSync(artifactPath, src, 'utf8');
  // Detect the REAL module type from the nearest package.json to the artifact's actual location
  // (RTV-PARENT-RELATIVE-FIX) rather than always forcing "type":"module" — a .js artifact that
  // lives under a CommonJS package.json must stay CommonJS or a `require(...)` throws a false
  // SyntaxError against `import`. A .cjs artifact is always CommonJS regardless.
  const realModuleType = findNearestModuleType(srcDir);
  writeFileSync(path.join(probeDir, 'package.json'), JSON.stringify({ type: realModuleType }), 'utf8');
  const probePath = path.join(probeDir, 'rtv_probe.mjs');
  const targetUrl = 'file://' + artifactPath.replace(/\\/g, '/');
  const probe = `
// stub fetch so a top-level network call surfaces as a load-time hang we time out on,
// never a thrown ReferenceError that masquerades as a load defect.
globalThis.fetch = globalThis.fetch || (() => new Promise(() => {}));
try {
  await import(${JSON.stringify(targetUrl)});
  process.stdout.write('RTV_OK');
  process.exit(0);
} catch (e) {
  process.stderr.write('RTV_THROW:' + (e && e.message ? e.message : String(e)));
  process.exit(7);
}
`;
  writeFileSync(probePath, probe, 'utf8');
  try {
    const r = spawnSync(process.execPath, [probePath], {
      cwd: probeDir,
      timeout: SUBPROC_TIMEOUT_MS,
      encoding: 'utf8',
      env: { ...process.env, MUEZZIN_RUNTIME_VERIFY: 'off' }, // never recurse if the target imports the engine
    });
    // TIMEOUT: a top-level network/await that never resolves. NOT a definitive load throw -> fail
    // OPEN (we could not prove a defect; the witness/panel still judge it). Killed by signal.
    if (r.error && r.error.code === 'ETIMEDOUT') {
      return { ok: true, error: null, detail: `load probe timed out after ${SUBPROC_TIMEOUT_MS}ms (top-level await/network) — not a definitive throw, fail-open` };
    }
    if (r.error) {
      return { ok: true, error: null, detail: `could not spawn load probe (${r.error.code || r.error.message}) — fail-open` };
    }
    const out = String(r.stdout || '');
    const err = String(r.stderr || '');
    // EXIT 0 = the module loaded/initialized without throwing. Two shapes both qualify:
    //   - our probe reached `process.stdout.write('RTV_OK'); process.exit(0)` (clean import), OR
    //   - the artifact is a CLI that called `process.exit(0)` itself at top level (e.g. doctor.mjs),
    //     which exits BEFORE our RTV_OK line — but exit 0 with no caught throw is still a clean run.
    // BUGFIX (2026-06-17): v1 required RTV_OK in stdout, so a CLI doing its own process.exit(0)
    // was FALSELY reported as a load-throw ("exit 0"). A clean exit is a clean exit.
    if (r.status === 0) {
      return { ok: true, error: null, detail: out.includes('RTV_OK') ? 'module loaded/imported clean' : 'module ran to a clean exit(0) (CLI self-exit, no throw)' };
    }
    // Our probe uses exit 7 for a CAUGHT import/init throw. Any OTHER non-zero exit could be the
    // artifact's own intentional `process.exit(1)` (a CLI reporting a runtime condition, NOT a load
    // defect). We fail CLOSED only when we have a CAUGHT throw (RTV_THROW present); a bare non-zero
    // exit WITHOUT a captured throw is fail-OPEN (we cannot prove a LOAD defect — the witness/panel
    // judge the run's meaning). This keeps the gate honest: it blocks broken LOADS, not exit codes.
    const m = err.match(/RTV_THROW:([\s\S]*)/);
    if (m) {
      const thrown = m[1].trim() || `exit ${r.status}`;
      // BROWSER-GLOBAL CLASS -> fail OPEN (2026-07-03, plan-mode-mobile FAILED x2 receipt:
      // "load-throw: document is not defined" — but the ORIGINAL production plan-day.js throws
      // the IDENTICAL error in bare Node, so the gate structurally doomed EVERY edit to any
      // browser module that touches DOM at load. Baseline proof in the retro/QUEUE). A
      // ReferenceError on a browser global proves the probe runtime has no DOM — not that the
      // module is broken. Same reasoning as the fetch stub above. Genuine defects keep failing
      // CLOSED: SyntaxError ("Unexpected token") and every non-browser-global throw.
      const browserGlobal = /^(ReferenceError:\s*)?(document|window|navigator|location|localStorage|sessionStorage|HTMLElement|customElements|CustomEvent|MutationObserver|requestAnimationFrame|addEventListener) is not defined/.test(thrown);   // probe writes e.message (no error-name prefix)
      if (browserGlobal) {
        return { ok: true, error: null, detail: `browser-global ReferenceError at load (${thrown.slice(0, 80)}) — browser-targeted module in a DOM-less probe, not a load defect; fail-open (witness/panel still judge)` };
      }
      return { ok: false, error: 'load-throw', detail: `module threw at import/load: ${thrown.slice(0, 400)}` };
    }
    return { ok: true, error: null, detail: `module self-exited ${r.status} with no caught throw — not a definitive load defect, fail-open` };
  } finally {
    try { rmSync(probeDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ----- HTML verifier: load via jsdom, run inline scripts, surface an init-time throw.
async function verifyHtml(targetPath, src) {
  let mod;
  try {
    mod = await import('jsdom');
  } catch {
    // jsdom genuinely unavailable -> fail OPEN (v1 contract). The runbook's `npm i` makes this active.
    return { ok: true, error: null, detail: 'jsdom not installed — HTML runtime-verify fail-open (run `npm i` in the plugin to activate)' };
  }
  const { JSDOM, VirtualConsole } = mod;
  // virtualConsole captures script errors that jsdom would otherwise swallow as "jsdomError".
  const vc = new VirtualConsole();
  let initThrow = null;
  vc.on('jsdomError', (e) => { if (!initThrow) initThrow = e?.message || String(e); });
  try {
    const dom = new JSDOM(src, {
      runScripts: 'dangerously',
      resources: 'usable',
      virtualConsole: vc,
      url: 'file://' + targetPath.replace(/\\/g, '/'),
      pretendToBeVisual: true,
    });
    // give synchronous inline scripts a tick to throw (DOMContentLoaded handlers etc.)
    await new Promise((res) => setTimeout(res, 50));
    dom.window.close();
  } catch (e) {
    initThrow = initThrow || (e?.message || String(e));
  }
  if (initThrow) {
    return { ok: false, error: 'html-init-throw', detail: `inline script threw at init: ${String(initThrow).slice(0, 400)}` };
  }
  return { ok: true, error: null, detail: 'HTML loaded clean (jsdom, scripts ran)' };
}

function verifyJson(src) {
  try { JSON.parse(src); return { ok: true, error: null, detail: 'valid JSON' }; }
  catch (e) { return { ok: false, error: 'json-parse', detail: `JSON.parse threw: ${String(e?.message || e).slice(0, 300)}` }; }
}

// runtimeVerify(targetPath, bytes) -> { ok, error, detail }
//   targetPath : absolute path to the artifact (used for the file:// import URL + extension).
//   bytes      : the artifact's current bytes (string). If omitted, the caller had no content ->
//                fail OPEN (nothing to run; absence is not a defect verdict here).
export async function runtimeVerify(targetPath, bytes) {
  if (process.env.MUEZZIN_RUNTIME_VERIFY === 'off') {
    return { ok: true, error: null, detail: 'runtime-verify disabled (MUEZZIN_RUNTIME_VERIFY=off)' };
  }
  if (!targetPath) return { ok: true, error: null, detail: 'no target path — fail-open' };
  const src = typeof bytes === 'string' ? bytes : '';
  if (!src.trim()) return { ok: true, error: null, detail: 'empty/absent artifact — runtime-verify fail-open (emptiness is caught upstream by emission-empty)' };

  const ext = path.extname(targetPath).toLowerCase();
  try {
    if (ext === '.mjs' || ext === '.js' || ext === '.cjs') return verifyCode(targetPath, src);
    if (ext === '.html' || ext === '.htm') return await verifyHtml(targetPath, src);
    if (ext === '.json') return verifyJson(src);
    return { ok: true, error: null, detail: `no runtime verifier for '${ext || '(no ext)'}' — fail-open` };
  } catch (e) {
    // the verifier itself crashed -> fail OPEN (we could not prove a defect; never a false block).
    return { ok: true, error: null, detail: `runtime-verify crashed (${String(e?.message || e).slice(0, 200)}) — fail-open` };
  }
}

export default { runtimeVerify };

// ----- offline selftest: node runtime_verify.mjs --selftest (real probe spawns, tiny fixtures)
if (process.argv[1]?.endsWith('runtime_verify.mjs') && process.argv.includes('--selftest')) {
  const os = await import('node:os');
  let pass = 0, fail = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };
  const tmpBase = mkdtempSync(path.join(os.tmpdir(), 'rtv-selftest-'));   // real dir: verifyCode scandirs the target's parent for sibling imports
  // browser-global module (the plan-day.js class): must FAIL-OPEN with the named detail
  const rBrowser = await runtimeVerify(path.join(tmpBase, 'browser-mod.js'), `const el = document.getElementById('x');\nexport function mount() { return el; }\n`);
  ck(rBrowser.ok === true && /browser-global ReferenceError/.test(rBrowser.detail), 'browser-global ReferenceError (document) -> fail-open with named detail (plan-mode-mobile x2 class)');
  // genuinely broken module: must STILL fail closed
  const rSyntax = await runtimeVerify(path.join(tmpBase, 'broken-mod.js'), `export function x() { return 1; }\n}\n`);
  ck(rSyntax.ok === false && rSyntax.error === 'load-throw', 'SyntaxError module still fails CLOSED (real load defects keep blocking)');
  // non-browser ReferenceError (a real bug): must STILL fail closed
  const rRef = await runtimeVerify(path.join(tmpBase, 'refbug-mod.js'), `const v = totallyUndefinedIdentifier;\nexport default v;\n`);
  ck(rRef.ok === false && rRef.error === 'load-throw', 'non-browser ReferenceError still fails CLOSED (only DOM globals are exempt)');
  // parent-relative CJS require (the mirroring fix): artifact lives in a nested dir and requires
  // a file one level up via `require('../shared-lib.cjs')`; the pre-fix flat copy could not resolve
  // this and threw MODULE_NOT_FOUND. Set up a real nested dir so the mirror-copy logic has a real
  // parent file to find (RTV-PARENT-RELATIVE-FIX).
  const parentReqDir = mkdtempSync(path.join(tmpBase, 'parent-req-'));
  const nestedDir = path.join(parentReqDir, 'nested');
  mkdirSync(nestedDir, { recursive: true });
  writeFileSync(path.join(parentReqDir, 'shared-lib.cjs'), `module.exports = { value: 42 };\n`, 'utf8');
  const rParentReq = await runtimeVerify(path.join(nestedDir, 'consumer.cjs'), `const shared = require('../shared-lib.cjs');\nmodule.exports = shared.value;\n`);
  ck(rParentReq.ok === true, 'parent-relative CJS require (../shared-lib.cjs) resolves via mirrored directory copy (RTV-PARENT-RELATIVE-FIX)');
  console.log(`[selftest] ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
