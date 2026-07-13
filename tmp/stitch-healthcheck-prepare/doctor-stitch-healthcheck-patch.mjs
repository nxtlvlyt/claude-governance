#!/usr/bin/env node
// doctor-stitch-healthcheck-patch.mjs -- one-shot patcher adding a Stitch MCP round-trip
// health check to doctor.mjs (gap-seat-health-is-roundtrip, GAP-REGISTER.jsonl 2026-07-12).
// Committed as a mission input artifact per the srcsha-anchor-patch / heal-selftest-race /
// mission-lint-rule14 precedent: literal scripted precision, never an LLM edit-step on a
// multi-region change. Idempotent: exits 0 with ALREADY-PATCHED if the check is already wired.
//
// What this closes (GAP-REGISTER.jsonl gap-seat-health-is-roundtrip, "owned" by ENGINE BATCH 2
// rider + warroom intake): "heartbeat census includes a real per-seat round-trip; Stitch seat
// gets a cheap list_projects probe" -- receipt: the Stitch seat sat "Connected" for a MONTH
// while stitch.googleapis.com 403d on every real call, because doctor.mjs never exercised the
// actual API path for Stitch (or for anything else -- checkOllamaLocal only hits /api/tags,
// checkClaudeCLI only runs `claude --version`; neither proves a real generation succeeds. This
// patch closes the Stitch leg ONLY -- the Ollama/Claude/agy round-trip legs are a named
// follow-on gap, explicitly out of scope for this pass).
//
// This is a SMALL, deliberately non-critical integration: checkStitch() calls the real
// stitch_dispatch.mjs::stitchRoundTripHealthy() probe and reports PASS/WARN in the same
// two-column board style as the wrangler/git checks (renderCheck with crit=false) -- it does
// NOT fold into the conduct-critical or fire-readiness gates. That is a separate design
// decision (does a dead Stitch seat block firing?) left for the conductor to make deliberately,
// not smuggled in via this patch.
import { readFileSync, writeFileSync } from 'fs';

const path = 'doctor.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('checkStitch()')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const edits = [
  // Edit 1: import the real round-trip probe alongside the other PREFLIGHT deps.
  {
    old: `import { activeSeats, readMode, resolveMode, MODES } from './seat_modes.mjs';
import { searxngPreflight } from './searxng_preflight.mjs';`,
    new: `import { activeSeats, readMode, resolveMode, MODES } from './seat_modes.mjs';
import { searxngPreflight } from './searxng_preflight.mjs';
// STITCH HEALTHCHECK (gap-seat-health-is-roundtrip, GAP-REGISTER.jsonl 2026-07-12): a real
// list_projects round-trip, not a connection/tool-enumeration check -- the Stitch seat sat
// "Connected" for a MONTH while every real call 403d, because nothing here ever made one.
import { stitchRoundTripHealthy } from './stitch_dispatch.mjs';`,
  },
  // Edit 2: define checkStitch() alongside the other checkX() functions, right after
  // checkClaudeCLI (same pairing as the board render order: Ollama local, then Claude, then
  // Stitch -- the three externally-dispatched seats).
  {
    old: `function checkClaudeCLI() {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 15000 });
    return { ok: true, detail: 'claude --version: available' };
  } catch (e) {
    const code = e.status ?? 1;
    return { ok: false, detail: \`claude --version exit \${code} (unavailable or not installed)\` };
  }
}

function checkGit() {`,
    new: `function checkClaudeCLI() {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 15000 });
    return { ok: true, detail: 'claude --version: available' };
  } catch (e) {
    const code = e.status ?? 1;
    return { ok: false, detail: \`claude --version exit \${code} (unavailable or not installed)\` };
  }
}

// checkStitch -- REAL round-trip (initialize + list_projects), not a connection check. See
// stitch_dispatch.mjs for the full transport/auth (copied verbatim from the proven-live
// mechanism in STITCH-KNOWLEDGE.md). Non-critical (WARN, not FAIL) here deliberately: whether
// a dead Stitch seat should block firing is a conduct-critical/fire-readiness design decision
// left for the conductor, not smuggled into this patch.
async function checkStitch() {
  const r = await stitchRoundTripHealthy();
  return { ok: r.ok, detail: r.ok ? \`list_projects round-trip OK (\${r.latencyMs}ms, checked \${r.checkedAt})\` : \`\${r.detail} (kind=\${r.error?.kind || '?'})\` };
}

function checkGit() {`,
  },
  // Edit 3: actually run the probe alongside the other awaited PREFLIGHT-adjacent checks.
  {
    old: `checks.localOllama = ollamaLocal;
checks.claude = claudePing;`,
    new: `checks.localOllama = ollamaLocal;
checks.claude = claudePing;
const stitch = await checkStitch();
checks.stitch = stitch;`,
  },
  // Edit 4: render it on the main board, right after the Claude CLI row (WARN-only: crit=false,
  // the default when the third renderCheck arg is omitted).
  {
    old: `renderCheck('Claude CLI ping', checks.claude, true);`,
    new: `renderCheck('Claude CLI ping', checks.claude, true);
renderCheck('Stitch MCP round-trip', checks.stitch);`,
  },
];

for (const [i, e] of edits.entries()) {
  const n = t.split(e.old).length - 1;
  if (n !== 1) {
    console.error(`EDIT-${i}-NOT-UNIQUE: found ${n} occurrences of: ${e.old.slice(0, 80)}`);
    process.exit(1);
  }
  t = t.replace(e.old, e.new);
}

writeFileSync(path, t);
console.log('PATCHED');