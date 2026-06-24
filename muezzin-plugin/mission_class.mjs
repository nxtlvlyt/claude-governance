// mission_class.mjs — the SINGLE CONTAINMENT KERNEL (Foundation 0.4: code-missions in
// named repos). One place decides "may a mission write to this path", for EVERY mission
// class. The never-weaken rule: a path that escapes its declared root, traverses with
// '..', touches a .git internals segment, or hits the secrets denylist is REFUSED in
// every class — research, sandbox, code-repo alike. This kernel is the only door; the
// deconstructor (plan-time), executor (write-time), repair (heal-time), and git_steps
// (commit-time) all resolve through it so containment can never be reasoned about twice.
//
// Two exports:
//   parseMissionClass(text) -> { class, repoRoot|null, allowFiles:[] }
//   resolveRepoTarget(repoRoot, allowFiles, relOrAbs) -> { ok, absPath } | { ok:false, reason }

import path from 'path';

// SECRETS DENYLIST (never-weaken, every class): a code mission may declare an allowlist,
// but these names can NEVER be a write target even if allowlisted — an exfiltration /
// credential-clobber vector. Matched on the BASENAME (case-insensitive). Globs (.env.* ,
// *.pem, *.key) match by suffix/prefix on the basename. A code mission writing real files
// into a real repo is exactly where a stray .env or id_rsa target would do the most harm.
const SECRET_PATTERNS = [
  /^\.env$/i,            // .env
  /^\.env\./i,           // .env.*  (.env.local, .env.production, ...)
  /\.pem$/i,             // *.pem
  /\.key$/i,             // *.key
  /^id_rsa$/i,           // id_rsa
  /^credentials/i,       // credentials*
  /^secrets/i,           // secrets*
];

// Is this basename a forbidden secret target (any class)?
export function isSecretTarget(baseName) {
  const b = String(baseName || '');
  return SECRET_PATTERNS.some((re) => re.test(b));
}

// Normalize a repo-relative form for exact allowlist matching: forward slashes, no
// leading "./", trimmed. The allowlist is compared in this normalized space so
// "src/x.mjs", "./src/x.mjs", and "src\\x.mjs" all mean the same declared file.
export function normalizeRel(rel) {
  return String(rel || '').replace(/\\/g, '/').trim().replace(/^\.\//, '').trim();
}

// parseMissionClass(text) -> { class, repoRoot, allowFiles }
//   class:     'research' | 'code-repo' | 'code'  (default 'research' — unchanged behavior:
//              the engine's pre-0.4 world is sandbox/research; no header => research).
//   repoRoot:  absolute REPO-ROOT for code-repo, else null.
//   allowFiles: normalized repo-relative paths from ALLOW-FILES (relative only; absolutes
//              and traversal entries are dropped here and re-flagged by mission_lint).
// Header block shape (anywhere in the mission text):
//   MISSION-CLASS: code-repo
//   REPO-ROOT: C:\path\to\project
//   ALLOW-FILES:
//     - src/foo.mjs
//     - test/foo.test.mjs
// ALLOW-FILES also accepts a single-line comma form: "ALLOW-FILES: src/a.mjs, src/b.mjs".
export function parseMissionClass(text) {
  const t = String(text || '');

  // MISSION-CLASS — explicit wins; research/code-repo recognized, anything else => 'code'
  // only when explicitly 'code', else default research (backward compatible).
  let klass = 'research';
  const mc = t.match(/MISSION-CLASS:\s*([a-z-]+)/i);
  if (mc) {
    const v = mc[1].toLowerCase();
    if (v === 'code-repo' || v === 'research' || v === 'code') klass = v;
  } else if (/MISSION-CLASS:\s*research/i.test(t)) {
    klass = 'research';
  }
  // NOTE: a bare missing header keeps 'research' (the deconstructor's prior default flag
  // was research-vs-not; sandbox/code missions without the research header behaved as
  // non-research, which the validator treats as the strict code-contained path). We keep
  // 'research' as the parse default so the research branch stays byte-for-byte; the
  // executor/deconstructor only diverge when class === 'code-repo'.

  // REPO-ROOT (absolute path) — only meaningful for code-repo
  let repoRoot = null;
  const rr = t.match(/REPO-ROOT:\s*([^\r\n]+)/i);
  if (rr) {
    const raw = rr[1].trim().replace(/^["']|["']$/g, '');
    if (raw) repoRoot = raw;
  }

  // TARGET-BRANCH (b13-sitemap-prune root fix, 2026-06-24): the branch the code-repo work
  // must land on. Without this, the engine reads whatever HEAD points to — which is
  // whatever the last mission (or operator) left checked out, producing wrong-tree reads
  // and false-failure decompositions. Consumed by orchestrate.mjs's code-repo prelude.
  let targetBranch = null;
  const tb = t.match(/TARGET-BRANCH:\s*([^\r\n]+)/i);
  if (tb) {
    const raw = tb[1].trim().replace(/^["']|["']$/g, '');
    if (raw) targetBranch = raw;
  }

  // ALLOW-FILES — either a single-line comma list or a following bullet/line block.
  const allowFiles = [];
  // [ \t]* (NOT \s*) after the colon: \s* greedily eats the newline + the next line's
  // leading indent, swallowing the FIRST bullet into the same-line group with its dash.
  const afLine = t.match(/ALLOW-FILES:[ \t]*([^\r\n]*)\r?\n?([\s\S]*)?/i);
  if (afLine) {
    const sameLine = afLine[1].trim();
    if (sameLine) {
      for (const part of sameLine.split(',')) {
        const p = normalizeRel(part);
        if (p) allowFiles.push(p);
      }
    }
    // following lines: collect leading "- foo" / "  foo" bullets until a blank line or a
    // line that looks like a new header (WORD:) — stop at the first non-list line.
    const rest = afLine[2] || '';
    for (const lineRaw of rest.split(/\r?\n/)) {
      const line = lineRaw.replace(/\t/g, ' ');
      if (!line.trim()) {
        if (allowFiles.length) break;   // blank after entries => block ended
        continue;                       // skip blank between header and first entry
      }
      // a new "HEADER:" line ends the block (e.g. "Done means:" or "Maqsad:")
      if (/^\s*[A-Za-z][\w -]*:\s/.test(line) && !/^\s*-/.test(line)) break;
      const m = line.match(/^\s*-\s*(.+?)\s*$/);
      if (m) { const p = normalizeRel(m[1]); if (p && !p.startsWith('#')) allowFiles.push(p); }
      else if (allowFiles.length) break; // a non-bullet, non-blank line after entries ends the block
    }
  }
  // De-dup, drop absolutes / traversal entries here (lint re-flags them; the kernel must
  // never carry a poisoned allowlist into resolveRepoTarget).
  const cleaned = [...new Set(allowFiles)].filter((p) => p && !/^([a-zA-Z]:|\/|\\\\)/.test(p) && !p.split('/').includes('..'));

  return { class: klass, repoRoot: klass === 'code-repo' ? repoRoot : (repoRoot || null), allowFiles: cleaned, targetBranch };
}

// resolveRepoTarget(repoRoot, allowFiles, relOrAbs) -> { ok:true, absPath } | { ok:false, reason }
// THE NEVER-WEAKEN KERNEL. A target is admitted ONLY when ALL hold:
//   1. repoRoot is a non-empty absolute path.
//   2. The resolved absolute target lives strictly UNDER path.resolve(repoRoot)+sep.
//   3. No '..' component anywhere in the requested path (checked on the raw form, before
//      resolution — a resolved path can hide a traversal that climbed and came back).
//   4. No '.git' path segment (repo internals are never a write target, any class).
//   5. The basename is not on the secrets denylist (.env/.env.*/*.pem/*.key/id_rsa/
//      credentials*/secrets*).
//   6. The repo-RELATIVE form of the target is in allowFiles (EXACT match after normalize).
// Both relative and absolute inputs are accepted: a relative target is joined onto
// repoRoot; an absolute target must already resolve under repoRoot. Either way the
// allowlist gate (rule 6) is the final word — only declared files may be written.
export function resolveRepoTarget(repoRoot, allowFiles, relOrAbs) {
  if (!repoRoot || typeof repoRoot !== 'string')
    return { ok: false, reason: 'code-repo target rejected: no REPO-ROOT declared' };
  if (!path.isAbsolute(repoRoot))
    return { ok: false, reason: `code-repo target rejected: REPO-ROOT '${repoRoot}' is not an absolute path` };

  const raw = String(relOrAbs || '');
  if (!raw.trim()) return { ok: false, reason: 'code-repo target rejected: empty target' };

  // rule 3 — traversal in the REQUESTED form (before any resolution can mask it)
  const rawSegs = raw.replace(/\\/g, '/').split('/');
  if (rawSegs.includes('..'))
    return { ok: false, reason: `code-repo target rejected: '${raw}' contains a '..' traversal component` };

  const rootAbs = path.resolve(repoRoot);
  const rootPrefix = rootAbs + path.sep;
  const absPath = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(rootAbs, raw);

  // rule 2 — must live strictly UNDER the repo root. The prefix compare is CASE-INSENSITIVE
  // so a legitimate Windows target (e.g. 'c:\repo\src\x' against REPO-ROOT 'C:\repo') that
  // differs only in drive/path casing is ACCEPTED. Windows folds case on the filesystem, so
  // these name the same path; lowercasing both sides only ever ADMITS more in-root matches
  // and can never admit an out-of-root path (a genuinely-outside path stays outside under
  // lowercase too), so containment is not weakened — and it stays correct on case-sensitive
  // filesystems where exact-casing in-root paths still match their own lowercase prefix.
  if (!absPath.toLowerCase().startsWith(rootPrefix.toLowerCase()))
    return { ok: false, reason: `code-repo target rejected: '${raw}' resolves to '${absPath}', outside REPO-ROOT '${rootAbs}'` };

  // WINDOWS NAME-FOLDING DEFENSE (defense-in-depth for rules 4 & 5). Windows strips trailing
  // dots and spaces from path segments, so '.env ' (trailing space) and 'server.pem.'
  // (trailing dot) FOLD to the real secret names '.env' and 'server.pem' on disk — yet would
  // slip past the segment-equality (.git) and basename-regex (secrets) checks below if left
  // raw. Build a COMPARISON-ONLY view of the repo-relative path with each segment's trailing
  // dots/spaces trimmed. This view is used solely for rules 4 & 5; it never alters absPath
  // or the allowlist (rule 6) semantics.
  const relFromRoot = path.relative(rootAbs, absPath).replace(/\\/g, '/');
  const relSegs = relFromRoot.split('/');
  const foldedSegs = relSegs.map((s) => s.replace(/[. ]+$/, ''));

  // rule 4 — no .git segment anywhere in the resolved path (relative to root), name-folded
  if (foldedSegs.includes('.git'))
    return { ok: false, reason: `code-repo target rejected: '${raw}' touches a .git internals segment (never a write target)` };

  // rule 5 — secrets denylist on the basename (name-folded so '.env ' / 'server.pem.' that
  // Windows folds to the real secret name cannot slip past).
  const base = foldedSegs[foldedSegs.length - 1];
  if (isSecretTarget(base))
    return { ok: false, reason: `code-repo target rejected: '${base}' matches the secrets denylist (.env/*.pem/*.key/id_rsa/credentials*/secrets*) — never a write target in any class` };

  // rule 6 — the repo-relative form MUST be allowlisted (exact match after normalize)
  const wantRel = normalizeRel(relFromRoot);
  const allow = (allowFiles || []).map(normalizeRel);
  if (!allow.includes(wantRel))
    return { ok: false, reason: `code-repo target rejected: '${wantRel}' is not in ALLOW-FILES (declared: ${allow.length ? allow.join(', ') : '(none)'}) — only declared files may be written` };

  return { ok: true, absPath };
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('mission_class.mjs')) {
  const fs = await import('fs'); const os = await import('os');
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  // throwaway repo root (os.tmpdir ONLY — never the NAS, never a real project).
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'missionclass_test_'));
  const allow = ['src/foo.mjs', 'test/foo.test.mjs', 'lib/util.ts'];

  // ---- parseMissionClass ----
  const codeMission = [
    'MISSION-CLASS: code-repo',
    `REPO-ROOT: ${repo}`,
    'ALLOW-FILES:',
    '  - src/foo.mjs',
    '  - test/foo.test.mjs',
    '',
    'Maqsad: add a function. Done means: tests pass.',
  ].join('\n');
  const pc = parseMissionClass(codeMission);
  ck(pc.class === 'code-repo', 'parse: MISSION-CLASS code-repo recognized');
  ck(pc.repoRoot === repo, 'parse: REPO-ROOT captured as absolute path');
  ck(pc.allowFiles.length === 2 && pc.allowFiles.includes('src/foo.mjs') && pc.allowFiles.includes('test/foo.test.mjs'), 'parse: ALLOW-FILES bullet block captured + normalized');

  const commaForm = parseMissionClass(`MISSION-CLASS: code-repo\nREPO-ROOT: ${repo}\nALLOW-FILES: src/a.mjs, ./src/b.mjs , src\\c.mjs\nDone means: x`);
  ck(commaForm.allowFiles.length === 3 && commaForm.allowFiles.includes('src/b.mjs') && commaForm.allowFiles.includes('src/c.mjs'), 'parse: ALLOW-FILES comma form + ./ and backslash normalization');

  ck(parseMissionClass('MISSION-CLASS: research\nDone means: report').class === 'research', 'parse: research class recognized');
  ck(parseMissionClass('Maqsad: do a thing. Done means: done.').class === 'research', 'parse: NO header defaults to research (backward compatible)');
  // poisoned allowlist entries are dropped at parse (lint re-flags)
  const poisoned = parseMissionClass(`MISSION-CLASS: code-repo\nREPO-ROOT: ${repo}\nALLOW-FILES:\n  - ../escape.mjs\n  - C:\\abs\\x.mjs\n  - src/ok.mjs\nDone means: x`);
  ck(poisoned.allowFiles.length === 1 && poisoned.allowFiles[0] === 'src/ok.mjs', 'parse: traversal + absolute ALLOW-FILES entries dropped (kernel never carries a poisoned allowlist)');

  // ---- resolveRepoTarget ----
  const okR = resolveRepoTarget(repo, allow, 'src/foo.mjs');
  ck(okR.ok === true && okR.absPath === path.resolve(repo, 'src/foo.mjs'), 'resolve: allowlisted repo-relative target ACCEPTED -> absolute under root');

  const okAbs = resolveRepoTarget(repo, allow, path.resolve(repo, 'test/foo.test.mjs'));
  ck(okAbs.ok === true, 'resolve: allowlisted ABSOLUTE target under root ACCEPTED');

  ck(resolveRepoTarget(repo, allow, 'src/other.mjs').ok === false, 'resolve: non-allowlisted target REJECTED (only declared files)');

  const outside = resolveRepoTarget(repo, allow, path.resolve(repo, '..', 'evil.mjs'));
  ck(outside.ok === false && /traversal|outside/i.test(outside.reason), 'resolve: absolute target OUTSIDE the repo REJECTED');

  ck(resolveRepoTarget(repo, allow, '../escape.mjs').ok === false, "resolve: '..' traversal REJECTED");
  ck(resolveRepoTarget(repo, allow, 'src/../../escape.mjs').ok === false, "resolve: buried '..' traversal REJECTED");

  const gitTarget = resolveRepoTarget(repo, [...allow, '.git/config'], '.git/config');
  ck(gitTarget.ok === false && /\.git/i.test(gitTarget.reason), 'resolve: .git internals segment REJECTED even if allowlisted');

  // secrets denylist — rejected even when allowlisted
  for (const secret of ['.env', '.env.production', 'config/app.pem', 'deploy/server.key', 'id_rsa', 'credentials.json', 'secrets.yaml']) {
    const r = resolveRepoTarget(repo, [...allow, normalizeRel(secret)], secret);
    ck(r.ok === false && /denylist/i.test(r.reason), `resolve: secret '${secret}' REJECTED even when allowlisted`);
  }

  ck(resolveRepoTarget('', allow, 'src/foo.mjs').ok === false, 'resolve: missing REPO-ROOT REJECTED');
  ck(resolveRepoTarget('relative/root', allow, 'src/foo.mjs').ok === false, 'resolve: non-absolute REPO-ROOT REJECTED');

  // ---- Windows name-folding defense (FIX 1) — '.env ' / 'server.pem.' fold to the real
  // secret name on Windows and must be REJECTED even when allowlisted in their raw form.
  const trailSpace = resolveRepoTarget(repo, [...allow, '.env '], '.env ');
  ck(trailSpace.ok === false && /denylist/i.test(trailSpace.reason), "resolve: '.env ' (trailing space) REJECTED — folds to .env");
  const trailDot = resolveRepoTarget(repo, [...allow, 'config/server.pem.'], 'config/server.pem.');
  ck(trailDot.ok === false && /denylist/i.test(trailDot.reason), "resolve: 'server.pem.' (trailing dot) REJECTED — folds to server.pem");
  const gitFold = resolveRepoTarget(repo, [...allow, '.git /config'], '.git /config');
  ck(gitFold.ok === false && /\.git/i.test(gitFold.reason), "resolve: '.git ' (trailing space) segment REJECTED — folds to .git");

  // ---- case-insensitive root containment (FIX 2) — a lowercase-drive in-root target must be
  // ACCEPTED; a genuinely-outside path must still be REJECTED.
  if (/^[a-zA-Z]:/.test(path.resolve(repo))) {
    const lcRepo = path.resolve(repo);
    const lcTarget = lcRepo.charAt(0).toLowerCase() + lcRepo.slice(1) + path.sep + path.join('src', 'foo.mjs');
    const lcR = resolveRepoTarget(repo, allow, lcTarget);
    ck(lcR.ok === true, 'resolve: lowercase-drive in-root absolute target ACCEPTED (case-insensitive containment)');
  } else {
    ck(true, 'resolve: lowercase-drive case (skipped on case-sensitive fs)');
  }
  const stillOutside = resolveRepoTarget(repo, allow, path.resolve(repo, '..', 'evil', 'x.mjs'));
  ck(stillOutside.ok === false && /outside|traversal/i.test(stillOutside.reason), 'resolve: genuinely-outside path STILL REJECTED (containment not weakened)');

  fs.rmSync(repo, { recursive: true, force: true });
  console.log(`\n${fails === 0 ? 'ALL PASS — mission_class kernel: parse + the never-weaken resolveRepoTarget (root-contained + allowlisted + no ../.git/secrets)' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
