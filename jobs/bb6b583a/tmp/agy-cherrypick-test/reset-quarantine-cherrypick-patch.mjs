#!/usr/bin/env node
// reset-quarantine-cherrypick-patch.mjs — cherry-pick patcher porting the sibling
// muezzin engine's already-landed, already-verified fix for gap-reset-allowfiles-data-loss
// into agy-muezzin's own git_steps.mjs. Committed as a mission input artifact per the
// established precedent: literal scripted precision, never an LLM edit-step on a
// multi-region change. Idempotent: exits 0 with ALREADY-PATCHED if already present.
//
// Root cause (ported receipt): resetAllowFiles' untracked branch used fs.rmSync to
// PERMANENTLY destroy a mission's own prior-attempt output with no recovery path — two
// bite receipts on the sibling engine (a design doc destroyed at fire time; a mission's
// three uncommitted deliverables destroyed by a sibling mission's own-output reset).
// Fix: untracked allow-files are QUARANTINED (moved to a temp directory outside the
// repo, rename-first, copy+delete only as a locked/cross-device fallback) instead of
// deleted, so a retry stays idempotent (pre-flight sees the allow-file clean) while the
// discarded content remains recoverable.
import { readFileSync, writeFileSync } from 'fs';

const path = 'git_steps.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('RESET-QUARANTINE (engine-item25-reset-quarantine')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const edits = [
  {
    old: ` * Scope is EXACTLY the mission's own allowlist — nothing else is touched, so this NEVER
 * reaches foreign dirt. Tracked allow-files are \`git checkout\`-restored to HEAD; untracked
 * allow-files (the mission's own prior creation) are deleted. After this, the containment`,
    new: ` * Scope is EXACTLY the mission's own allowlist — nothing else is touched, so this NEVER
 * reaches foreign dirt. Tracked allow-files are \`git checkout\`-restored to HEAD; untracked
 * allow-files (the mission's own prior creation) are QUARANTINED — moved to a temp directory
 * outside the repo, never deleted (engine-item25-reset-quarantine, 2026-07-12; two bite
 * receipts paid for the change on the sibling engine: this branch's fs.rmSync PERMANENTLY
 * destroyed a mission's own prior-attempt output with no recovery path, and the same night's
 * ownerless-park audit (eighth law) found deletion-as-cleanup silently erasing evidence a
 * conductor later needed to diagnose a failure — Directive 6 requires a reversible move over
 * a destructive delete). After this, the containment`,
  },
  {
    old: `      if (tracked) {
        execSync(\`git checkout -- \${quote(rel)}\`, gitOpts(repoRoot));   // restore committed version
      } else {
        try { fs.rmSync(abs, { force: true }); } catch { /* locked/gone — best effort */ }
      }`,
    new: `      if (tracked) {
        execSync(\`git checkout -- \${quote(rel)}\`, gitOpts(repoRoot));   // restore committed version
      } else {
        // RESET-QUARANTINE (engine-item25-reset-quarantine, 2026-07-12 — cherry-picked from
        // the sibling engine's own two-bite-receipt fix): this branch used fs.rmSync to
        // PERMANENTLY destroy a mission's own prior-attempt output with no recovery path.
        // Directive 6: prefer a reversible move over a destructive delete. Untracked
        // allow-files are MOVED to a quarantine directory OUTSIDE the repo (never deleted),
        // so a retry's own-output reset stays idempotent — the pre-flight sees the allow-file
        // clean — while the discarded content remains recoverable.
        const quarantineDir = path.join(os.tmpdir(), "agy-muezzin-reset-quarantine", path.basename(repoRoot));
        try {
          fs.mkdirSync(quarantineDir, { recursive: true });
          const dest = path.join(quarantineDir, \`\${rel.replace(/[\\\\/]/g, "__")}.\${Date.now()}\`);
          try { fs.renameSync(abs, dest); }
          catch { fs.copyFileSync(abs, dest); fs.rmSync(abs, { force: true }); }
        } catch { /* quarantine dir unwritable — leave the untracked file in place rather than lose it */ }
      }`,
  },
];

for (const [i, e] of edits.entries()) {
  const n = t.split(e.old).length - 1;
  if (n !== 1) {
    console.error(`EDIT-${i}-NOT-UNIQUE: found ${n} occurrences`);
    process.exit(1);
  }
  t = t.replace(e.old, e.new);
}

writeFileSync(path, t);
console.log('PATCHED');
