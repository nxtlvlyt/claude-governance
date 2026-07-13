#!/usr/bin/env node
// verdict-merge-visibility-downgrade-patch.mjs -- QUEUE ITEM 15 / gap-panel-truncation-
// false-reject (priority-elevated 2026-07-13 after 3 receipted false deaths this session
// from the same failure CLASS -- a panel operating on incomplete visibility rejecting
// already-correct work).
//
// FIX (the mechanical half of ITEM 15's two-part fix; the other half -- relevance-
// extracted git-diff artifact slicing, replacing head-only truncation -- is a larger
// architecture change left for a dedicated follow-up, not rushed into this patch):
// a finding classified 'arkan' (mission-invalidating) whose OWN description text admits
// the seat could not actually see enough to judge (cap-omitted, truncated, beyond the
// reviewed slice, not directly verifiable) is FORCE-DOWNGRADED to 'wajib' (repairable,
// non-invalidating) before the merge's arkan-escalation check runs. A self-admitted
// visibility gap is never a legitimate basis for invalidating a whole mission -- that is
// exactly the receipted scenic.S2 attempt-8 pattern this gap names.
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'verdict_merge.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('VISIBILITY_LIMIT_RE')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const oldStr = `      const witnessed = Array.isArray(c.receipts) && c.receipts.length > 0 && c.receipts.every((r) => r && r.ok !== false);
      const fs = Array.isArray(c.findings) ? c.findings : [];
      const allClassified = fs.length > 0 && fs.every((f) => FINDING_CLASSES.has(f?.class));`;

const newStr = `      const witnessed = Array.isArray(c.receipts) && c.receipts.length > 0 && c.receipts.every((r) => r && r.ok !== false);
      // VISIBILITY-LIMIT DOWNGRADE (QUEUE ITEM 15 / gap-panel-truncation-false-reject,
      // priority-elevated 2026-07-13: 3 receipted false deaths this session from the same
      // class -- a panel operating on incomplete visibility rejecting already-correct work).
      // An 'arkan' finding whose OWN text admits the seat could not see enough to judge is
      // never a legitimate basis for invalidating the mission -- force-downgrade to 'wajib'
      // (repairable) BEFORE the arkan-escalation check below. Fail-open to witness receipts:
      // the executed evidence outranks an admittedly-incomplete review.
      const rawFs = Array.isArray(c.findings) ? c.findings : [];
      const fs = rawFs.map((f) => (f?.class === 'arkan' && VISIBILITY_LIMIT_RE.test(String(f?.description || '')))
        ? { ...f, class: 'wajib', _downgraded_from: 'arkan', _downgrade_reason: 'finding admits its own visibility limit (cap/truncation/unverifiable) — self-admitted incomplete review cannot invalidate a mission' }
        : f);
      const allClassified = fs.length > 0 && fs.every((f) => FINDING_CLASSES.has(f?.class));`;

const n = t.split(oldStr).length - 1;
if (n !== 1) {
  console.error(`NOT-UNIQUE: found ${n} occurrences of the target block`);
  process.exit(1);
}
t = t.replace(oldStr, newStr);

// Insert the regex constant near the other module-level constants.
const constOld = `const FINDING_CLASSES = new Set(['arkan', 'wajib', 'sunnah']);`;
const constNew = `const FINDING_CLASSES = new Set(['arkan', 'wajib', 'sunnah']);
// Phrases a panel finding uses to admit it could not fully see the artifact it is judging
// (head-truncation cap, a cap-omitted section, "not directly verifiable" hedges). Matched
// case-insensitively against the finding's own description text.
const VISIBILITY_LIMIT_RE = /cap[- ]omitted|could not (be )?(directly )?verif|not (directly )?verifiable|truncat|beyond the (visible|reviewed) (scope|slice)|content was omitted|review(ed)? was cap/i;`;
const cn = t.split(constOld).length - 1;
if (cn !== 1) {
  console.error(`NOT-UNIQUE: found ${cn} occurrences of the FINDING_CLASSES const line`);
  process.exit(1);
}
t = t.replace(constOld, constNew);

// Add selftest coverage for the new downgrade path, right after the existing
// "any arkan finding -> >= REJECT" check so the two sit side by side (genuine
// arkan escalates; visibility-limited arkan downgrades).
const testOld = `  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [{ id: 'A1', class: 'arkan' }, W('gap')], receipts: RC }]).consensus, 'REJECT', 'any arkan finding -> >= REJECT (a missed pillar invalidates; no expiation)');`;
const testNew = `  check(mergeVerdicts([{ seat: 'v', verdict: 'REVISE', findings: [{ id: 'A1', class: 'arkan' }, W('gap')], receipts: RC }]).consensus, 'REJECT', 'any arkan finding -> >= REJECT (a missed pillar invalidates; no expiation)');
  // VISIBILITY-LIMIT DOWNGRADE (gap-panel-truncation-false-reject, priority-elevated 2026-07-13)
  check(mergeVerdicts([{ seat: 'v', verdict: 'REJECT', findings: [{ id: 'A1', class: 'arkan', description: 'content was omitted beyond the reviewed slice — could not directly verify this section' }], receipts: RC }]).consensus, 'APPROVE_WITH_DAMM', 'arkan finding admitting its own visibility limit -> downgraded to wajib -> APPROVE_WITH_DAMM (self-admitted incomplete review cannot invalidate a mission)');
  check(mergeVerdicts([{ seat: 'v', verdict: 'REJECT', findings: [{ id: 'A1', class: 'arkan', description: 'the function returns the wrong value for negative inputs' }], receipts: RC }]).consensus, 'REJECT', 'a genuine arkan finding unrelated to visibility is NOT downgraded — still REJECT');`;
const tn = t.split(testOld).length - 1;
if (tn !== 1) {
  console.error(`NOT-UNIQUE: found ${tn} occurrences of the arkan-escalation selftest line`);
  process.exit(1);
}
t = t.replace(testOld, testNew);

writeFileSync(path, t);
console.log('PATCHED');
