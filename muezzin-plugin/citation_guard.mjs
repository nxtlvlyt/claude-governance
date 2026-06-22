// citation_guard.mjs — code gate (not a prompt) against executor FABRICATION (#engine-batch).
// The witness model catches invented citations at the quality bar, but a model bar is
// probabilistic. This gate is deterministic: a backtick-quoted filename token in an
// emitted artifact that exists nowhere the seat could have read it (sandbox files,
// declared context_dependencies, the step's own targets) and is not a generic project
// file is a FABRICATED citation. Pure matcher + an fs collector, so it is unit-testable
// and can route into the same repair path the witness uses. Deeds-not-claims at the
// citation level: a cited source must actually be a source the seat had.

import { readdirSync, statSync, readFileSync } from 'fs';
import path from 'path';

// Generic filenames a seat may legitimately reference without having a local copy
// (build/config conventions). Lowercased basenames.
const GENERIC = new Set([
  'package.json', 'readme.md', 'tsconfig.json', 'next.config.js', 'next.config.mjs',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '.env', '.env.local', '.gitignore',
  'dockerfile', 'docker-compose.yml', 'schema.prisma', 'index.ts', 'index.js', 'index.html',
  'index.tsx', 'styles.css', 'config.json', 'data.json', 'tailwind.config.js', 'vite.config.js',
  'eslintrc.json', 'prettierrc.json', 'makefile', 'license.md', 'changelog.md', 'contributing.md',
]);

// PURE: flag backtick-quoted filename tokens that are neither allowed (a real source the
// seat had) nor generic. allowedBasenames = iterable of lowercased basenames. Returns the
// raw fabricated tokens (de-duped by basename), [] when clean.
export function findFabricatedCitations(text, allowedBasenames) {
  const allow = new Set([...(allowedBasenames || [])].map((s) => String(s).toLowerCase()));
  const src = String(text || '');
  const re = /`([^`\n]{1,80}?\.(?:txt|md|json|html|csv|pdf|docx?|ya?ml|toml|mjs|tsx?|jsx?))`/gi;
  const flagged = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(src)) !== null) {
    const raw = m[1].trim();
    const base = raw.split(/[\\/]/).pop().toLowerCase();
    if (seen.has(base)) continue;
    seen.add(base);
    if (GENERIC.has(base)) continue;
    if (allow.has(base)) continue;
    // CODE-PATH-LITERAL EXEMPTION (2026-06-15 bootstrap fix — 3phase-1 + impl-vocab citation-halt
    // receipts): a backtick token containing a template-literal interpolation (${...}) is emitted
    // CODE that builds a path at RUNTIME, not a source citation — it cannot be a file the seat had,
    // because it has no concrete value until runtime. This was DEADLOCKING the engine: every
    // code-repo mission that emits a normal runtime path string citation-halted, including the
    // missions written to FIX the bug. Real fabricated citations are concrete names, never ${...}.
    if (raw.includes('${')) continue;
    // ABSENCE-REPORT EXEMPTION (census receipt 2026-06-11 22:37: the same 7 names burned
    // 2 repair rounds — a census REPORTING a manifest as absent is doing its job, not
    // citing evidence. Naming a file you DON'T have carries no false authority.) The
    // line containing the mention must carry an explicit absence marker.
    const ls = src.lastIndexOf('\n', m.index) + 1;
    const le = src.indexOf('\n', m.index);
    const line = src.slice(ls, le === -1 ? src.length : le);
    if (/\b(absent|missing|not\s+(found|present|staged)|does\s+not\s+exist|none\s+found|no\s+manifest|gap)\b/i.test(line)) continue;
    // COMMAND-SHAPE EXEMPTION: `node scripts/x.mjs` quoted from a staged manifest's
    // scripts is a command string, not a source citation.
    if (/\s/.test(raw) && /^(node|npm|pnpm|npx|yarn|python|uv|git|pwsh|bash)\b/i.test(raw)) continue;
    flagged.push(raw);
  }
  return flagged;
}

// QUOTED-MENTION FILTER (census receipt 2026-06-12 00:44: after the absence/command
// exemptions, the residue flags were names that exist INSIDE staged files' content —
// dist/_worker.js inside the staged wrangler.toml, BRAND-TO-SITE-FAST.md named by the
// staged MASTER-PLAN. Reporting what a source the seat HAD says is not fabrication.)
// Deterministic + bounded: a flagged token survives ONLY if its basename appears in no
// sandbox file's content. A truly invented name still flags.
// LAUNDERING GUARDS: the artifact under check contains every flagged token by
// definition (exclude its basename via `exclude`), and _prior-attempt archives may
// carry a PRIOR draft's fabrications (excluded wholesale) — neither may self-exempt.
export function filterQuotedMentions(cwd, flagged, { maxFiles = 200, maxBytes = 300_000, exclude = [] } = {}) {
  if (!flagged?.length) return [];
  const skip = new Set(exclude.map((s) => String(s).split(/[\\/]/).pop().toLowerCase()));
  const remaining = new Map(flagged.map((f) => [String(f).split(/[\\/]/).pop().toLowerCase(), f]));
  let count = 0;
  const walk = (dir) => {
    if (count >= maxFiles || remaining.size === 0) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count >= maxFiles || remaining.size === 0) return;
      if (e.name === '.git' || e.name === 'node_modules' || e.name === '_prior-attempt') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.isFile()) continue;
      const ebase = e.name.toLowerCase();
      if (skip.has(ebase) || remaining.has(ebase)) continue;  // never self-exempt
      count++;
      let txt;
      try { if (statSync(full).size > maxBytes) continue; txt = readFileSync(full, 'utf8').toLowerCase(); } catch { continue; }
      for (const [base] of remaining) if (txt.includes(base)) remaining.delete(base);
    }
  };
  walk(cwd);
  return [...remaining.values()];
}

// fs: collect the lowercased basenames of every file the seat could legitimately cite —
// every file present in the sandbox (recursively, bounded), plus the step's declared
// context_dependencies and its own target_files. .git is skipped. Bounded so a huge
// sandbox can't blow up the sweep.
export function collectAllowedBasenames(cwd, step, { maxFiles = 4000 } = {}) {
  const out = new Set();
  for (const t of (step?.context_dependencies || [])) out.add(String(t).split(/[\\/]/).pop().toLowerCase());
  for (const t of (step?.target_files || [])) out.add(String(t).split(/[\\/]/).pop().toLowerCase());
  let count = 0;
  const walk = (dir) => {
    if (count >= maxFiles) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count >= maxFiles) return;
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      let isDir = e.isDirectory();
      if (!isDir && !e.isFile()) { try { isDir = statSync(full).isDirectory(); } catch { continue; } }
      if (isDir) walk(full);
      else { out.add(e.name.toLowerCase()); count++; }
    }
  };
  walk(cwd);
  return out;
}

// ---- selftests: node citation_guard.mjs
if (process.argv[1] && process.argv[1].endsWith('citation_guard.mjs')) {
  let pass = 0, fail = 0;
  const eq = (name, got, want) => {
    const ok = JSON.stringify(got.map((x) => x.toLowerCase()).sort()) === JSON.stringify(want.map((x) => x.toLowerCase()).sort());
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} -> ${JSON.stringify(got)}`);
    ok ? pass++ : fail++;
  };
  // 1. real 4a-style fabrications flagged
  eq('fabricated flagged',
    findFabricatedCitations('Per `1. Market & User.txt` and `deep-research-report gpt.md`, X. See `operator-context.md`.', ['operator-context.md']),
    ['1. Market & User.txt', 'deep-research-report gpt.md']);
  // 2. legit cited (allowed) + generic -> no false positive
  eq('legit clean',
    findFabricatedCitations('Reading `vanlife-tree.txt`, `package.json`, `muddytires.html`.', ['vanlife-tree.txt', 'muddytires.html']),
    []);
  // 3. bare prose -> clean
  eq('prose clean', findFabricatedCitations('The market is large; persona is a vanlife traveler.', []), []);
  // 4. path-qualified citation matched by basename
  eq('path basename allowed',
    findFabricatedCitations('See `docs/operator-context.md`.', ['operator-context.md']),
    []);
  // 5. de-dupe by basename (same fabricated file twice -> one flag)
  eq('dedupe',
    findFabricatedCitations('`ghost-report.md` then again `ghost-report.md`.', []),
    ['ghost-report.md']);
  // 6. non-filename backticks (code idents) ignored
  eq('code idents ignored',
    findFabricatedCitations('Call `findFabricatedCitations` and `step.target_files`.', []),
    []);
  // 7. null/garbage input -> clean, no throw
  eq('null safe', findFabricatedCitations(null, null), []);
  // 7b. ABSENCE-REPORT exemption (census class): naming a file as absent is not a citation
  eq('absence report clean',
    findFabricatedCitations('| 2boots | `wrangler.toml` | ABSENT — no manifest found |\n`pyproject.toml`: not found for this source.', []),
    []);
  // 7c. COMMAND-SHAPE exemption: a quoted command is not a citation
  eq('command shape clean',
    findFabricatedCitations('The build runs `node scripts/pull-services.mjs` per the staged package.json.', []),
    []);
  // 7d. COUNTER-TEST: a fabricated EVIDENCE cite still flags (no absence marker, no command shape)
  eq('fabrication still flags',
    findFabricatedCitations('Per `ghost-evidence.md`, the metric is 42%. `wrangler.toml` confirms the route.', []),
    ['ghost-evidence.md', 'wrangler.toml']);
  // 7f. CODE-PATH-LITERAL exemption (2026-06-15 bootstrap fix): a backtick token with a
  // template-literal interpolation is emitted CODE, not a citation — does not flag; a concrete
  // fabricated name beside it STILL flags (no weakening of the real-fabrication path).
  eq('code path-literal interp exempt',
    findFabricatedCitations('Build `${FAITH_DIR}/${roleName}.faith.md` then read `config/${env}.json`.', []),
    []);
  eq('concrete fake still flags beside interp',
    findFabricatedCitations('Code writes `${diagDir}/plan-attempt-${n}.raw.txt` but cites `ghost-evidence.md`.', []),
    ['ghost-evidence.md']);
  // 7e. QUOTED-MENTION filter: a name present in a STAGED file's content is exempt; an
  // invented name still flags; the artifact itself + _prior-attempt never self-exempt.
  {
    const fs7 = await import('fs'); const os7 = await import('os'); const p7 = path;
    const d = fs7.mkdtempSync(p7.join(os7.tmpdir(), 'cg_qm_'));
    fs7.writeFileSync(p7.join(d, 'staged-manifest.toml'), 'main = "dist/_worker.js"\n');
    fs7.writeFileSync(p7.join(d, 'census.md'), 'Output is `dist/_worker.js`. Also per `ghost.md` (invented).');
    fs7.mkdirSync(p7.join(d, '_prior-attempt'));
    fs7.writeFileSync(p7.join(d, '_prior-attempt', 'old-draft.md'), 'mentions `ghost.md` from a prior fabrication');
    eq('quoted mention exempt, invented still flags, no laundering',
      filterQuotedMentions(d, ['dist/_worker.js', 'ghost.md'], { exclude: ['census.md'] }),
      ['ghost.md']);
    fs7.rmSync(d, { recursive: true, force: true });
  }
  // 8. collector picks up target_files + context_dependencies basenames
  const got8 = collectAllowedBasenames('Z:\\does\\not\\exist-xyz', { context_dependencies: ['fetched.txt'], target_files: ['out/card.md'] });
  const has8 = got8.has('fetched.txt') && got8.has('card.md');
  console.log(`${has8 ? 'PASS' : 'FAIL'} collector deps+targets -> ${JSON.stringify([...got8])}`);
  has8 ? pass++ : fail++;
  // 9. end-to-end: allowed from collector clears a citation to a declared dep
  const allow9 = collectAllowedBasenames('Z:\\nope', { context_dependencies: ['research-notes.md'], target_files: [] });
  eq('collector feeds matcher', findFabricatedCitations('Per `research-notes.md` the finding holds.', allow9), []);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
