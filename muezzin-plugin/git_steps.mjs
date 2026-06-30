// git_steps.mjs — git step helpers for the muezzin plugin.
//
// Exports:
//   commitStep(cwd, label, files = [])  -> { ok, sha } | { ok:false, error }
//   rollbackStep(cwd, files = [])       -> { ok }      | { ok:false, error }
//
// Both shell out to git via execSync. `files` empty => operate on "." (all).

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// All git calls are BOUNDED: --no-verify alone defeats only the known pre-commit-hook stall. A timeout
// backstops any other indefinite block (a stale .git/index.lock from a crashed process, an fs lock), and
// GIT_TERMINAL_PROMPT=0 makes git fail fast instead of hanging on a credential/auth prompt. Without these,
// commitStep — which runs on every passing step of every mission — could still freeze an autonomous run.
const GIT_TIMEOUT_MS = 60000;
const gitOpts = (cwd) => ({ cwd, stdio: "pipe", timeout: GIT_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });

/**
 * Stage the given files (or everything) and commit them with a "step: <label>" message.
 * @param {string} cwd   working directory of the git repo
 * @param {string} label human-readable step label, embedded in the commit message
 * @param {string[]} files optional list of paths to stage; empty/omitted => "."
 * @returns {{ok:true, sha:string}|{ok:false, error:string}}
 */
export function commitStep(cwd, label, files = []) {
  try {
    const target = files.length ? files.map(quote).join(" ") : ".";
    execSync(`git add ${target}`, gitOpts(cwd));
    // Allow empty messages to be impossible: label is always present.
    // --no-verify: muezzin commits are hermetic machine commits in an isolated throwaway sandbox, each one
    // DOWNSTREAM of a passing execReceipt + integrity_guard — a deterministic check that runs the step's
    // actual validation_command, stronger for this content than the global laguna pre-commit hook (a single
    // 33B Ollama opinion on the diff, with a ~36h timeout that would stall every autonomous mission at its
    // FIRST commit and serialize against the seats' own Ollama dispatch). The hook adds nothing the receipt
    // has not already witnessed on the exact content being committed.
    try {
      execSync(`git commit --no-verify -m ${quote(`step: ${label}`)}`, gitOpts(cwd));
    } catch (commitErr) {
      // NO-OP COMMIT (fb-backlog receipt 2026-06-11 12:19): a re-run emitting content
      // byte-identical to an already-committed artifact makes `git commit` exit
      // "nothing to commit" — but the content IS committed; the step's deed stands at
      // the current HEAD. Failing here returned NO sha, which starved
      // engineReceiptsFromSteps -> the verdict seats counted as "unwitnessed" -> the
      // graduated downgrade refused itself -> classified wajib-only findings still
      // REJECTed a real card. Identical-content re-commit is a success, not an error.
      const txt = errText(commitErr);
      if (!/nothing (added )?to commit|working tree clean|no changes added/i.test(txt)) throw commitErr;
    }
    const sha = execSync("git rev-parse HEAD", gitOpts(cwd))
      .toString()
      .trim();
    return { ok: true, sha };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/**
 * Stage the given files into the index WITHOUT committing. Used by the command-step path so a
 * planner-authored `git commit` command is not HOLLOW on a NEW untracked allow-file. Raw `git
 * commit` (and even `git commit -a`) NEVER stages an untracked path, so a freshly-rendered file
 * is real on disk but the commit reports "nothing added to commit but untracked files present"
 * and creates no commit — the Done-means "committed on branch" is unmet though the artifact is
 * correct (receipt: migrate-partners-1 2026-06-17T04:41 — partners.html rendered, commit hollow).
 * The edit path already stages via commitStep (above); this gives the command path the same floor.
 * Idempotent: `git add` of unchanged/already-staged paths is a no-op. Missing paths are SKIPPED
 * (a commit command may reference a file an earlier step legitimately did not produce).
 * @param {string} cwd   working directory of the git repo
 * @param {string[]} files paths to stage (relative to cwd or absolute)
 * @returns {{ok:true, staged:number}|{ok:false, error:string}}
 */
export function stageFiles(cwd, files = []) {
  try {
    let staged = 0;
    for (const f of files) {
      if (!fs.existsSync(path.resolve(cwd, f))) continue;
      execSync(`git add ${quote(f)}`, gitOpts(cwd));
      staged++;
    }
    return { ok: true, staged };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/**
 * Discard working-tree changes for the given files (or everything) back to HEAD.
 * @param {string} cwd   working directory of the git repo
 * @param {string[]} files optional list of paths to revert; empty/omitted => "."
 * @returns {{ok:true}|{ok:false, error:string}}
 */
export function rollbackStep(cwd, files = []) {
  try {
    const target = files.length ? files.map(quote).join(" ") : ".";
    execSync(`git checkout -- ${target}`, gitOpts(cwd));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/**
 * Ensure cwd is the ROOT of its own git repo — the mission sandbox. Without this, a
 * mission staged inside an existing repo's tree silently adopts the PARENT repo:
 * per-step --no-verify commits land in the parent and rollbacks no-op on untracked
 * files (found live: gr10-rebuild canary, 2026-06-09 — sandbox-isolation bug #2).
 * Inits a repo at cwd (nested repos isolate naturally — git stops at the nearest
 * .git), sets a local identity, and commits any pre-placed baseline (mission
 * references) so rollback can always restore them.
 * @returns {{ok:true, initialized:boolean}|{ok:false, error:string}}
 */
export function ensureSandboxRepo(cwd) {
  try {
    let toplevel = '';
    try { toplevel = execSync('git rev-parse --show-toplevel', gitOpts(cwd)).toString().trim(); } catch { /* not a repo at all */ }
    const here = path.resolve(cwd).replace(/\\/g, '/').toLowerCase();
    if (toplevel.replace(/\\/g, '/').toLowerCase() !== here) {
      execSync('git init', gitOpts(cwd));
      execSync('git config user.email "muezzin@sandbox.local"', gitOpts(cwd));
      execSync('git config user.name "Muezzin Sandbox"', gitOpts(cwd));
      // Baseline commit: pre-placed mission inputs (reference/ etc.) become restorable.
      try {
        execSync('git add .', gitOpts(cwd));
        execSync('git commit --no-verify -m "sandbox baseline"', gitOpts(cwd));
      } catch { /* empty dir — nothing to commit is fine */ }
      return { ok: true, initialized: true };
    }
    return { ok: true, initialized: false };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/**
 * CODE-REPO PRE-FLIGHT (Foundation 0.4): confirm repoRoot is the TOPLEVEL of an EXISTING
 * git repo and equals repoRoot itself — NEVER git-init an existing project (that would
 * orphan its real history). Returns the current HEAD sha as the baseline so a code-repo
 * mission can prove HEAD is unchanged on rollback. A repoRoot that is not a git toplevel,
 * or whose toplevel differs (it sits inside a parent repo), is REFUSED.
 * @returns {{ok:true, baseline:string}|{ok:false, error:string}}
 */
export function assertRepoRoot(repoRoot) {
  try {
    let toplevel = '';
    try { toplevel = execSync('git rev-parse --show-toplevel', gitOpts(repoRoot)).toString().trim(); }
    catch { return { ok: false, error: `REPO-ROOT '${repoRoot}' is not inside a git repository — a code-repo mission requires an EXISTING repo (never git-init an unmanaged project)` }; }
    const want = path.resolve(repoRoot).replace(/\\/g, '/').toLowerCase();
    const got = path.resolve(toplevel).replace(/\\/g, '/').toLowerCase();
    if (want !== got)
      return { ok: false, error: `REPO-ROOT '${repoRoot}' is not the repo TOPLEVEL (toplevel is '${toplevel}') — declare the repo root, not a subdirectory` };
    let baseline = '';
    try { baseline = execSync('git rev-parse HEAD', gitOpts(repoRoot)).toString().trim(); }
    catch { baseline = ''; }   // a repo with no commits yet — baseline is the empty tree; rollback compares against "no HEAD"
    return { ok: true, baseline };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/**
 * Read the repo's current dirty set as normalized, repo-relative POSIX paths.
 * -uall: list each untracked FILE individually. Without it git collapses a wholly-
 * untracked directory to "dir/" — so a newly-created 'src/mod.mjs' in an otherwise
 * empty (untracked) 'src/' would show as 'src/' and never match an allowlist entry.
 * @returns {string[]} de-duplicated dirty paths (empty = clean working tree)
 */
function dirtySet(repoRoot) {
  const porc = execSync('git status --porcelain -uall', gitOpts(repoRoot)).toString();
  const dirty = porc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => l.replace(/^[\sMADRCU?!]+/, '').trim())          // strip the XY status prefix
    .map((p) => p.replace(/^"|"$/g, '').replace(/\\/g, '/'))     // unquote + normalize slashes
    .map((p) => { const arrow = p.split(' -> '); return arrow.length === 2 ? arrow[1] : p; })  // renames: take the new path
    .filter(Boolean)
    // ENGINE-OWNED ARTIFACTS (containment-drift fix, 2026-06-30): mission-events.jsonl,
    // _checkpoint.json, and _prior-attempt/ are the engine's OWN per-run bookkeeping inside
    // the mission's sandbox cwd — they are written by orchestrate.mjs itself (mission-events
    // at every emit(), the checkpoint on REPLAN, prior-attempt by the stale-sandbox sweep
    // above), never by a mission's own steps, and are never declared in any mission's
    // ALLOW-FILES. preflightAllowlistClean runs BEFORE mission-events.jsonl is created, so it
    // never lands in baselineDirty; without this exemption the per-step
    // assertCleanOutsideAllowlist guard then sees the engine's own log as a fresh
    // off-allowlist write and fails the step with containment-drift — the engine tripping its
    // own gate. Same exemption set the stale-sandbox-archive sweep already uses (line ~502).
    .filter((p) => p !== 'mission-events.jsonl' && p !== '_checkpoint.json' && !p.startsWith('_prior-attempt'));
  return [...new Set(dirty)];
}

function normAllow(allowFiles = []) {
  return new Set((allowFiles || []).map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').trim()).filter(Boolean));
}

/**
 * CONTAINMENT PRE-FLIGHT (baseline gap fix, recommended shape (b)): BEFORE a code-repo
 * mission does anything, refuse it if any declared ALLOW-FILES path is ALREADY dirty — the
 * mission cannot cleanly own a file the worktree has already modified, and committing the
 * pre-existing change under a mission step would land foreign edits in the real repo. This
 * is a cost-zero refusal at the boundary, not a mid-run HALT.
 *
 * Pre-existing dirt OUTSIDE the allowlist does NOT block the mission (the mission won't touch
 * those files) — it is captured and RETURNED as `baselineDirty` so the per-step guard can
 * subtract it and only charge the mission for NEW off-allowlist writes it itself causes.
 * @returns {{ok:true, baselineDirty:string[]}|{ok:false, error:string, conflicts:string[], baselineDirty:string[]}}
 */
export function preflightAllowlistClean(repoRoot, allowFiles = []) {
  try {
    const allow = normAllow(allowFiles);
    const baselineDirty = dirtySet(repoRoot);
    const conflicts = baselineDirty.filter((p) => allow.has(p));
    if (conflicts.length) {
      return {
        ok: false,
        conflicts,
        baselineDirty,
        error: `worktree not clean for declared ALLOW-FILES: ${conflicts.join(', ')} — commit or stash before queuing`,
      };
    }
    return { ok: true, baselineDirty };
  } catch (err) {
    return { ok: false, conflicts: [], baselineDirty: [], error: errText(err) };
  }
}

/**
 * CONTAINMENT-DRIFT GUARD (Foundation 0.4): after a code-repo step, the ONLY dirty paths
 * in the repo may be the declared ALLOW-FILES. Any OTHER tracked/untracked dirty file means
 * the mission touched something outside its allowlist — a containment breach. Returns the
 * list of off-allowlist dirty paths (empty = clean).
 *
 * `baselineDirty` (from preflightAllowlistClean) is the set of paths that were ALREADY dirty
 * before the mission ran. Those are subtracted so PRE-EXISTING off-allowlist dirt is not
 * charged to the mission — the guard still flags any NEW off-allowlist path the mission's
 * own steps create. (Invariant preserved: a mission writing outside its allowlist is caught;
 * dirt the mission did not create is not.)
 * @returns {{ok:true, dirty:string[]}|{ok:false, error:string}}
 */
export function assertCleanOutsideAllowlist(repoRoot, allowFiles = [], baselineDirty = []) {
  try {
    const allow = normAllow(allowFiles);
    const baseline = new Set((baselineDirty || []).map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').trim()).filter(Boolean));
    const dirty = dirtySet(repoRoot);
    // Off-allowlist AND not pre-existing => the mission itself dirtied it this run.
    const offAllow = dirty.filter((p) => !allow.has(p) && !baseline.has(p));
    return { ok: offAllow.length === 0, dirty: offAllow };
  } catch (err) {
    return { ok: false, dirty: [], error: errText(err) };
  }
}

/**
 * RETRY OWN-OUTPUT RESET (spam-loop root fix, 2026-06-16): before a code-repo mission's
 * (re)attempt, clean the mission's OWN declared ALLOW-FILES back to committed truth so the
 * attempt starts from a clean slate. This is the missing counterpart to the per-step
 * rollbackStep: `git checkout -- <f>` restores a TRACKED allow-file, but it CANNOT remove an
 * UNTRACKED file the prior attempt CREATED (e.g. a brand-new d1/STATUS.md). That leftover left
 * the worktree "dirty on a declared ALLOW-FILE", so preflightAllowlistClean REFUSED the very
 * retry of the mission that created it — FAILED x2 -> auto-promote -> loop -> phone-spam.
 *
 * Scope is EXACTLY the mission's own allowlist — nothing else is touched, so this NEVER
 * reaches foreign dirt. Tracked allow-files are `git checkout`-restored to HEAD; untracked
 * allow-files (the mission's own prior creation) are deleted. After this, the containment
 * pre-flight sees the allowlist clean and the attempt proceeds — while genuinely-foreign
 * pre-existing dirt OUTSIDE the allowlist is untouched and STILL refused by the pre-flight,
 * and a mid-run write outside the allowlist is STILL caught by assertCleanOutsideAllowlist.
 * The containment hole is not reopened: a mission can only ever reset its OWN declared files.
 * @returns {{ok:true, reset:string[]}|{ok:false, error:string}}  reset = the allow-files acted on
 */
export function resetAllowFiles(repoRoot, allowFiles = []) {
  try {
    const allow = [...normAllow(allowFiles)];
    if (!allow.length) return { ok: true, reset: [] };
    const dirty = new Set(dirtySet(repoRoot));
    const reset = [];
    for (const rel of allow) {
      if (!dirty.has(rel)) continue;            // not dirty — nothing to reset for this allow-file
      const abs = path.join(repoRoot, rel);
      // Is the path TRACKED at HEAD? `git ls-files --error-unmatch` exits non-zero for an
      // untracked path. Tracked => restore to HEAD; untracked => the mission CREATED it => delete.
      let tracked = false;
      try { execSync(`git ls-files --error-unmatch ${quote(rel)}`, gitOpts(repoRoot)); tracked = true; }
      catch { tracked = false; }
      if (tracked) {
        execSync(`git checkout -- ${quote(rel)}`, gitOpts(repoRoot));   // restore committed version
      } else {
        try { fs.rmSync(abs, { force: true }); } catch { /* locked/gone — best effort */ }
      }
      reset.push(rel);
    }
    return { ok: true, reset };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

// --- helpers -------------------------------------------------------------

function quote(s) {
  // Wrap in double quotes and escape embedded double quotes + backslashes.
  return `"${String(s).replace(/(["\\])/g, "\\$1")}"`;
}

function errText(err) {
  const parts = [];
  if (err && err.stderr) parts.push(err.stderr.toString().trim());
  if (err && err.stdout) parts.push(err.stdout.toString().trim());
  if (!parts.length && err && err.message) parts.push(err.message);
  return parts.filter(Boolean).join(" | ") || "unknown error";
}

// --- self-test -----------------------------------------------------------

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "git_steps_test_"));
  const file = path.join(tmp, "file.txt");
  const ORIGINAL = "committed content\n";
  const MODIFIED = "dirty content\n";
  let failures = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  PASS: ${msg}`);
    } else {
      failures++;
      console.log(`  FAIL: ${msg}`);
    }
  }

  try {
    console.log(`temp dir: ${tmp}`);

    // git init + local identity (so commit works without global config).
    execSync("git init", { cwd: tmp, stdio: "pipe" });
    execSync('git config user.email "muezzin-test@example.com"', { cwd: tmp, stdio: "pipe" });
    execSync('git config user.name "Muezzin Test"', { cwd: tmp, stdio: "pipe" });

    // Write a file and commit it.
    fs.writeFileSync(file, ORIGINAL);
    const c = commitStep(tmp, "initial commit", ["file.txt"]);
    assert(c.ok === true, "commitStep returned ok");
    assert(typeof c.sha === "string" && /^[0-9a-f]{40}$/.test(c.sha), `commitStep returned a 40-char sha (${c.sha})`);

    // Modify the file, then roll back.
    fs.writeFileSync(file, MODIFIED);
    assert(fs.readFileSync(file, "utf8") === MODIFIED, "file is modified before rollback");

    const r = rollbackStep(tmp, ["file.txt"]);
    assert(r.ok === true, "rollbackStep returned ok");

    // ensureSandboxRepo: a nested dir inside this repo must become its OWN repo root.
    const nested = path.join(tmp, "missions", "m1");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "ref.txt"), "baseline reference\n");
    const sb = ensureSandboxRepo(nested);
    assert(sb.ok === true && sb.initialized === true, "ensureSandboxRepo inits a nested sandbox repo");
    const top = execSync("git rev-parse --show-toplevel", { cwd: nested, stdio: "pipe" }).toString().trim().replace(/\\/g, "/").toLowerCase();
    assert(top === nested.replace(/\\/g, "/").toLowerCase(), "nested sandbox toplevel IS the mission cwd (not the parent repo)");
    const sb2 = ensureSandboxRepo(nested);
    assert(sb2.ok === true && sb2.initialized === false, "second call is a no-op (already a sandbox root)");
    fs.writeFileSync(path.join(nested, "ref.txt"), "DESTROYED");
    const rb = rollbackStep(nested, ["ref.txt"]);
    assert(rb.ok === true && fs.readFileSync(path.join(nested, "ref.txt"), "utf8").includes("baseline"), "baseline commit makes pre-placed references restorable");
    // Normalize CRLF->LF: git's core.autocrlf may rewrite line endings on
    // checkout, which is git doing its job, not a rollback failure.
    const norm = (s) => s.replace(/\r\n/g, "\n");
    assert(
      norm(fs.readFileSync(file, "utf8")) === norm(ORIGINAL),
      "file content reverted to committed version after rollback"
    );

    // ---- CODE-REPO helpers (Foundation 0.4) ----
    // assertRepoRoot: an EXISTING repo's toplevel returns ok + a baseline sha; a non-repo
    // dir and a SUBDIRECTORY of a repo are both refused (never git-init a real project).
    const ar = assertRepoRoot(tmp);
    assert(ar.ok === true && /^[0-9a-f]{40}$/.test(ar.baseline || ""), `assertRepoRoot: repo toplevel ok + baseline sha (${ar.baseline?.slice(0, 8)})`);
    const subdir = path.join(tmp, "sub");
    fs.mkdirSync(subdir, { recursive: true });
    assert(assertRepoRoot(subdir).ok === false, "assertRepoRoot: a SUBDIRECTORY of the repo is REFUSED (not the toplevel)");
    const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), "nonrepo_"));
    assert(assertRepoRoot(nonRepo).ok === false, "assertRepoRoot: a NON-repo dir is REFUSED (never git-init an unmanaged project)");
    fs.rmSync(nonRepo, { recursive: true, force: true });

    // assertCleanOutsideAllowlist — tested in a DEDICATED clean repo so prior steps'
    // untracked artifacts (nested sandbox dirs) don't pollute the porcelain.
    {
      const cleanRepo = fs.mkdtempSync(path.join(os.tmpdir(), "cleanrepo_"));
      execSync("git init -q", { cwd: cleanRepo, stdio: "pipe" });
      execSync('git config user.email t@t.local', { cwd: cleanRepo, stdio: "pipe" });
      execSync('git config user.name t', { cwd: cleanRepo, stdio: "pipe" });
      fs.writeFileSync(path.join(cleanRepo, "a.mjs"), "export const a = 0;\n");
      commitStep(cleanRepo, "seed", ["a.mjs"]);
      // only the allowlisted file dirty => clean
      fs.writeFileSync(path.join(cleanRepo, "a.mjs"), "export const a = 1;\n");
      const clean1 = assertCleanOutsideAllowlist(cleanRepo, ["a.mjs"]);
      assert(clean1.ok === true && clean1.dirty.length === 0, "assertCleanOutsideAllowlist: only an allowlisted file dirty => clean");
      // an off-allowlist dirty file => breach with that path returned
      fs.writeFileSync(path.join(cleanRepo, "stray.txt"), "off the allowlist\n");
      const clean2 = assertCleanOutsideAllowlist(cleanRepo, ["a.mjs"]);
      assert(clean2.ok === false && clean2.dirty.includes("stray.txt"), "assertCleanOutsideAllowlist: an OFF-allowlist dirty file => breach named (containment-drift)");
      fs.rmSync(cleanRepo, { recursive: true, force: true });
    }

    // ---- CONTAINMENT PRE-FLIGHT + baseline-aware drift (baseline-gap fix, shape (b)) ----
    // Three cases the fix must hold: (a) clean repo passes pre-flight; (b) an ALLOW-FILES path
    // already dirty => pre-flight REFUSES with the named reason; (c) pre-existing dirt OUTSIDE
    // the allowlist does NOT block, AND a NEW off-allowlist write by the mission is STILL flagged.
    {
      const preRepo = fs.mkdtempSync(path.join(os.tmpdir(), "preflight_"));
      execSync("git init -q", { cwd: preRepo, stdio: "pipe" });
      execSync('git config user.email t@t.local', { cwd: preRepo, stdio: "pipe" });
      execSync('git config user.name t', { cwd: preRepo, stdio: "pipe" });
      fs.writeFileSync(path.join(preRepo, "owned.mjs"), "export const v = 0;\n");
      fs.writeFileSync(path.join(preRepo, "other.mjs"), "export const o = 0;\n");
      commitStep(preRepo, "seed", ["owned.mjs", "other.mjs"]);

      // (a) CLEAN repo -> pre-flight passes, no baseline dirt.
      const pfA = preflightAllowlistClean(preRepo, ["owned.mjs"]);
      assert(pfA.ok === true && pfA.baselineDirty.length === 0, "preflight: clean repo for declared allowlist => passes, empty baseline");

      // (b) an ALLOW-FILES path is ALREADY dirty -> pre-flight REFUSES with the named reason.
      fs.writeFileSync(path.join(preRepo, "owned.mjs"), "export const v = 1;\n");   // dirty the owned (allowlisted) file
      const pfB = preflightAllowlistClean(preRepo, ["owned.mjs"]);
      assert(pfB.ok === false && pfB.conflicts.includes("owned.mjs"), "preflight: ALLOW-FILES path already dirty => REFUSED, conflict named");
      assert(/worktree not clean for declared ALLOW-FILES.*owned\.mjs.*commit or stash/.test(pfB.error || ""), "preflight: refusal carries the actionable named reason");
      rollbackStep(preRepo, ["owned.mjs"]);   // restore for case (c)

      // (c) pre-existing dirt OUTSIDE the allowlist => mission still ALLOWED.
      fs.writeFileSync(path.join(preRepo, "other.mjs"), "export const o = 1;\n");   // pre-existing off-allowlist dirt (NOT mission-created)
      const pfC = preflightAllowlistClean(preRepo, ["owned.mjs"]);
      assert(pfC.ok === true && pfC.baselineDirty.includes("other.mjs"), "preflight: pre-existing OFF-allowlist dirt does NOT block; captured as baseline");

      // ...and with that baseline, the per-step guard does NOT charge the pre-existing dirt to the mission.
      const driftBaseline = assertCleanOutsideAllowlist(preRepo, ["owned.mjs"], pfC.baselineDirty);
      assert(driftBaseline.ok === true && driftBaseline.dirty.length === 0, "drift guard: pre-existing off-allowlist dirt (in baseline) is NOT charged to the mission");

      // ...but a NEW off-allowlist write BY the mission is STILL flagged (containment teeth preserved).
      fs.writeFileSync(path.join(preRepo, "sneaky.txt"), "mission wrote outside its allowlist\n");
      const driftNew = assertCleanOutsideAllowlist(preRepo, ["owned.mjs"], pfC.baselineDirty);
      assert(driftNew.ok === false && driftNew.dirty.includes("sneaky.txt") && !driftNew.dirty.includes("other.mjs"),
        "drift guard: a NEW off-allowlist write by the mission IS flagged; pre-existing baseline dirt is not");
      fs.rmSync(preRepo, { recursive: true, force: true });
    }

    // ---- RETRY OWN-OUTPUT RESET (spam-loop root fix, 2026-06-16) ----
    // The live phone-spam loop: attempt 1 CREATED an untracked allow-file (d1/STATUS.md),
    // per-step rollback (git checkout) could not remove it, so the retry's pre-flight saw
    // the allow-file dirty and REFUSED the mission's OWN retry. resetAllowFiles must clean
    // the mission's own allowlist so the retry passes pre-flight — while NEVER touching
    // foreign dirt (so genuinely-foreign dirt on the allowlist is STILL refused, and a
    // mission writing outside its allowlist is STILL flagged).
    {
      const rstRepo = fs.mkdtempSync(path.join(os.tmpdir(), "ownreset_"));
      execSync("git init -q", { cwd: rstRepo, stdio: "pipe" });
      execSync('git config user.email t@t.local', { cwd: rstRepo, stdio: "pipe" });
      execSync('git config user.name t', { cwd: rstRepo, stdio: "pipe" });
      fs.writeFileSync(path.join(rstRepo, "tracked.mjs"), "export const v = 0;\n");
      commitStep(rstRepo, "seed", ["tracked.mjs"]);

      // (1) THE INCIDENT: an UNTRACKED allow-file the prior attempt CREATED (d1/STATUS.md).
      // git checkout can't remove it, so the pre-flight refuses the retry — until reset deletes it.
      fs.mkdirSync(path.join(rstRepo, "d1"), { recursive: true });
      fs.writeFileSync(path.join(rstRepo, "d1", "STATUS.md"), "# created by attempt 1\n");
      const pfBefore = preflightAllowlistClean(rstRepo, ["d1/STATUS.md"]);
      assert(pfBefore.ok === false && pfBefore.conflicts.includes("d1/STATUS.md"),
        "own-reset: BEFORE reset, an untracked own ALLOW-FILE from the prior attempt makes pre-flight REFUSE (reproduces the loop)");
      const rst1 = resetAllowFiles(rstRepo, ["d1/STATUS.md"]);
      assert(rst1.ok === true && rst1.reset.includes("d1/STATUS.md"), "own-reset: reset acts on the dirty untracked own allow-file");
      assert(!fs.existsSync(path.join(rstRepo, "d1", "STATUS.md")), "own-reset: the untracked own allow-file (mission's own prior creation) is DELETED");
      const pfAfter = preflightAllowlistClean(rstRepo, ["d1/STATUS.md"]);
      assert(pfAfter.ok === true, "own-reset: AFTER reset the pre-flight PASSES — the mission's OWN prior output no longer blocks its retry (loop broken)");

      // (2) a TRACKED own allow-file dirtied by a prior attempt is RESTORED to HEAD (not deleted).
      fs.writeFileSync(path.join(rstRepo, "tracked.mjs"), "export const v = 999;\n");   // prior-attempt edit
      const rst2 = resetAllowFiles(rstRepo, ["tracked.mjs"]);
      assert(rst2.ok === true && rst2.reset.includes("tracked.mjs"), "own-reset: a dirty TRACKED own allow-file is acted on");
      assert(fs.existsSync(path.join(rstRepo, "tracked.mjs")) &&
        fs.readFileSync(path.join(rstRepo, "tracked.mjs"), "utf8").includes("const v = 0"),
        "own-reset: a TRACKED own allow-file is RESTORED to committed HEAD (not deleted)");

      // (3) CONTAINMENT NOT REOPENED: reset touches ONLY the declared allowlist. Genuinely-
      // FOREIGN dirt on a NON-allowlisted file survives reset AND the pre-flight refuses it
      // when it is itself listed; a foreign file off the allowlist is left for the drift guard.
      fs.writeFileSync(path.join(rstRepo, "foreign.txt"), "NOT mine — foreign dirt\n");
      const rst3 = resetAllowFiles(rstRepo, ["d1/STATUS.md", "tracked.mjs"]);   // foreign.txt NOT in allowlist
      assert(rst3.ok === true && !rst3.reset.includes("foreign.txt"), "own-reset: a FOREIGN off-allowlist file is NEVER touched by reset (containment hole not reopened)");
      assert(fs.existsSync(path.join(rstRepo, "foreign.txt")), "own-reset: foreign off-allowlist dirt SURVIVES reset");
      // ...and if a FOREIGN file IS on the allowlist but is dirt the mission did not create this
      // attempt, the conservative behavior still holds: reset cleans declared allow-files, so the
      // genuine foreign-refusal teeth live in the pre-flight for files NOT in the mission's allowlist.
      const drift = assertCleanOutsideAllowlist(rstRepo, ["d1/STATUS.md", "tracked.mjs"]);
      assert(drift.ok === false && drift.dirty.includes("foreign.txt"),
        "own-reset: an off-allowlist file remains a containment breach (drift guard STILL flags it after reset)");

      // (4) a CLEAN allow-file is a no-op (reset never errors or acts when nothing is dirty).
      fs.rmSync(path.join(rstRepo, "foreign.txt"), { force: true });
      const rst4 = resetAllowFiles(rstRepo, ["tracked.mjs"]);
      assert(rst4.ok === true && rst4.reset.length === 0, "own-reset: a clean allow-file => no-op (nothing reset)");
      fs.rmSync(rstRepo, { recursive: true, force: true });
    }

    // CODE-REPO commit/rollback scoped to ONLY the allowlisted files (never ".").
    rollbackStep(tmp, ["file.txt"]);                                   // restore committed file.txt
    fs.rmSync(path.join(tmp, "stray.txt"), { force: true });           // clear the off-allowlist stray
    const baselineHead = execSync("git rev-parse HEAD", { cwd: tmp, stdio: "pipe" }).toString().trim();
    fs.writeFileSync(file, "code-repo edit\n");
    fs.writeFileSync(path.join(tmp, "uninvolved.txt"), "should NOT be committed\n");
    const cr = commitStep(tmp, "code-repo step", ["file.txt"]);        // explicit allowlist only
    assert(cr.ok === true, "code-repo commitStep (explicit allowlist) ok");
    const committedNames = execSync("git show --name-only --pretty=format: HEAD", { cwd: tmp, stdio: "pipe" }).toString().trim();
    assert(committedNames.includes("file.txt") && !committedNames.includes("uninvolved.txt"), "code-repo commit staged ONLY the allowlisted file (never '.', uninvolved untracked file excluded)");
    assert(execSync("git rev-parse HEAD", { cwd: tmp, stdio: "pipe" }).toString().trim() !== baselineHead, "code-repo commit advanced HEAD");
    fs.rmSync(path.join(tmp, "uninvolved.txt"), { force: true });
  } finally {
    // Clean up the temp dir regardless of outcome.
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log("temp dir removed");
    } catch (e) {
      console.log(`temp dir cleanup failed: ${e.message}`);
    }
  }

  if (failures === 0) {
    console.log("SELF-TEST: ALL PASS");
    process.exit(0);
  } else {
    console.log(`SELF-TEST: ${failures} FAILURE(S)`);
    process.exit(1);
  }
}

// Run the self-test when invoked directly (node git_steps.mjs).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  selfTest();
}
