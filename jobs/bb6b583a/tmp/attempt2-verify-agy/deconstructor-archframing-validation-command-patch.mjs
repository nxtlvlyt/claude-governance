#!/usr/bin/env node
// deconstructor-archframing-validation-command-patch.mjs
//
// GAP: gap-attempt2-validation-replay. Root cause: deconstructor.mjs's blind-architect
// planning prompt (`archFraming`) tells architects to state "how [a step] is witnessed
// (a validation_command)" but never explains that for action_type 'command'/'verify'
// steps, validation_command IS the entire executed step (no separate main-action field
// exists in the schema). The integrator prompt (QUEUE_INSTRUCTION, ~line 330 in both
// repos) already carries this rule ("COMMAND/VERIFY STEPS ARE ENGINE-EXECUTED: ... the
// validation_command IS the step: put the COMPLETE working command there") but
// architects plan BEFORE the integrator runs and never see it — so blind architects
// routinely describe real dispatch/relay logic only in prose and leave
// validation_command as a bare existence-check, which the integrator then cannot always
// reconstruct.
//
// Real receipt: a Stitch relay-dispatch step was repeatedly planned with
// validation_command = only `Test-Path ...STITCH-RECEIPT.md`, so each ~4min re-plan's
// real dispatch never ran and the step died in <1s, four times in a row
// (459/436/625/555ms), wasting ~16 minutes total.
//
// THE FIX: insert the same engine-executed rule the integrator already has into the
// archFraming template literal, between the "...how it is witnessed (a
// validation_command)." sentence and the "Do NOT emit the final json queue..." sentence.
//
// Applies to BOTH jurisdictions (byte-identical archFraming block since commit 8729b38b):
//   - C:\Users\marka\.claude\muezzin-plugin\deconstructor.mjs   (line ~606-609)
//   - C:\Users\marka\agy-muezzin\deconstructor.mjs               (line ~772-776)
//
// Usage:
//   node deconstructor-archframing-validation-command-patch.mjs [path-to-deconstructor.mjs]
//   node deconstructor-archframing-validation-command-patch.mjs --both   (patch both known jurisdictions)
//
// With no argument, auto-detects the target from cwd: if ./deconstructor.mjs exists in
// the current working directory, that is patched. Otherwise falls back to the two known
// jurisdiction paths and patches whichever exist (same behavior as --both), so running
// this script from an unrelated cwd is still safe and deterministic.
//
// Idempotent: if the new sentence is already present, exits 0 with ALREADY-PATCHED and
// makes no change. Fails closed: if the anchor text does not appear in the file EXACTLY
// once, exits 1 with a diagnostic instead of guessing.

import fs from 'fs';
import path from 'path';

const KNOWN_JURISDICTIONS = [
  'C:\\Users\\marka\\.claude\\muezzin-plugin\\deconstructor.mjs',
  'C:\\Users\\marka\\agy-muezzin\\deconstructor.mjs',
];

// The anchor is scoped tightly (not the whole line) so the replacement survives minor
// prose drift elsewhere in the sentence, while still being verified unique before writing.
const OLD_STRING =
  'and how it is witnessed (a validation_command). Do NOT emit the final json queue';

const INSERTED_RULE =
  "COMMAND/VERIFY STEPS ARE ENGINE-EXECUTED: for action_type 'command' or 'verify' the engine runs ONLY your validation_command line (pwsh, no model dispatched) — validation_command IS the step. Write the COMPLETE working command there (the real fetch/dispatch/relay invocation AND its outcome check, as one expression) — never a bare existence-check standing in for work that happens nowhere else. A check-only validation_command on a command/verify step cannot be safely reconstructed later (receipt: gap-attempt2-validation-replay — a Stitch relay-dispatch step was repeatedly planned with validation_command = only \\`Test-Path ...STITCH-RECEIPT.md\\`, so each ~4min re-plan's real dispatch never ran and the step died in <1s).";

const NEW_STRING =
  `and how it is witnessed (a validation_command). ${INSERTED_RULE} Do NOT emit the final json queue`;

// Used only for the idempotency check. NOTE: 'COMMAND/VERIFY STEPS ARE ENGINE-EXECUTED'
// is NOT safe to use here — that exact phrase already exists verbatim in the file, in the
// PRE-EXISTING integrator rule (QUEUE_INSTRUCTION, ~line 330/331 in both jurisdictions)
// that this fix is modeled on. Using it as the marker false-reports ALREADY-PATCHED on a
// completely unpatched file (caught by this patcher's own dry-run against fresh scratch
// copies of both repos — see missions/_logs/scratch-archframing-dryrun/). The receipt
// citation below is unique to THIS insertion and does not appear anywhere else in the file.
const ALREADY_PATCHED_MARKER = 'receipt: gap-attempt2-validation-replay';

function patchOne(targetPath) {
  if (!fs.existsSync(targetPath)) {
    console.log(`SKIP  ${targetPath} — file does not exist`);
    return { path: targetPath, status: 'SKIP' };
  }

  const original = fs.readFileSync(targetPath, 'utf8');

  if (original.includes(ALREADY_PATCHED_MARKER)) {
    console.log(`ALREADY-PATCHED  ${targetPath}`);
    return { path: targetPath, status: 'ALREADY-PATCHED' };
  }

  const occurrences = original.split(OLD_STRING).length - 1;
  if (occurrences !== 1) {
    console.error(
      `FAIL  ${targetPath} — expected OLD_STRING to match EXACTLY once, found ${occurrences}.\n` +
      `  OLD_STRING: ${JSON.stringify(OLD_STRING)}\n` +
      `  This file's archFraming text has drifted from what this patcher expects — do not force it.\n` +
      `  Re-read the current archFraming template literal and update OLD_STRING before retrying.`
    );
    process.exitCode = 1;
    return { path: targetPath, status: 'FAIL-NOT-UNIQUE', occurrences };
  }

  const patched = original.split(OLD_STRING).join(NEW_STRING);
  fs.writeFileSync(targetPath, patched, 'utf8');
  console.log(`PATCHED  ${targetPath}`);
  return { path: targetPath, status: 'PATCHED' };
}

function main() {
  const args = process.argv.slice(2);
  const explicitPath = args.find((a) => a !== '--both');
  const wantBoth = args.includes('--both');

  let targets;
  if (explicitPath) {
    targets = [path.resolve(explicitPath)];
  } else if (wantBoth) {
    targets = KNOWN_JURISDICTIONS;
  } else {
    const cwdCandidate = path.resolve(process.cwd(), 'deconstructor.mjs');
    if (fs.existsSync(cwdCandidate)) {
      targets = [cwdCandidate];
    } else {
      // cwd auto-detect found nothing — fall back to patching both known jurisdictions
      // that actually exist, rather than failing with no target.
      targets = KNOWN_JURISDICTIONS.filter((p) => fs.existsSync(p));
      if (targets.length === 0) {
        console.error(
          `FAIL — no deconstructor.mjs found in cwd (${process.cwd()}) and neither known ` +
          `jurisdiction path exists:\n  ${KNOWN_JURISDICTIONS.join('\n  ')}`
        );
        process.exit(1);
      }
    }
  }

  const results = targets.map(patchOne);
  const anyFail = results.some((r) => r.status.startsWith('FAIL'));
  process.exit(anyFail ? 1 : 0);
}

main();
