// Scratch e2e replay for hunt-item #23 audit (read-only, deleted after use).
// Fires the fifth law's two RECEIPTED 2026-07-02 kill-shapes (the operator-caught
// ungated causal narratives) at the exported findUngatedCausalClaims(), plus the
// gated counterparts the law demands be allowed through.
import { findUngatedCausalClaims } from 'file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} :: ${detail}`); }
}

// Error 1's shape (2026-07-02): "failing because cloud models" — an "X is why Y fails" claim, no receipt.
const e1 = findUngatedCausalClaims('The cloud models is why the chain has been failing for three days.');
check('error-1 kill-shape flagged (ungated "is why" claim)', e1.length === 1, JSON.stringify(e1));

// Error 2's shape (2026-07-02): "minimax lab gone, restore cloud seats" — a "Z is gone" claim, no probe receipt.
const e2 = findUngatedCausalClaims('The minimax lab is gone from the roster; we should restore the cloud seats.');
check('error-2 kill-shape flagged (ungated "is gone" claim)', e2.length === 1, JSON.stringify(e2));

// The law's literal escalation target: a "root cause" sentence lacking a receipt or HYPOTHESIS tag.
const e3 = findUngatedCausalClaims('The root cause is the daemon skipping product fires during holds.');
check('bare "root cause is" sentence flagged', e3.length === 1, JSON.stringify(e3));

// Gated variants must NOT be flagged (the law allows receipted or HYPOTHESIS-tagged claims):
const g1 = findUngatedCausalClaims('The cloud models is why the chain has been failing (HYPOTHESIS, untested).');
check('HYPOTHESIS tag gates the same claim', g1.length === 0, JSON.stringify(g1));

const g2 = findUngatedCausalClaims('The minimax lab is gone — probed :cloud/:latest tags, census in heartbeat-2026-07-02.json.');
check('file-reference receipt gates the same claim', g2.length === 0, JSON.stringify(g2));

const g3 = findUngatedCausalClaims('The root cause is the witness cap, fixed in commit 854b31a.');
check('commit-sha receipt gates the same claim', g3.length === 0, JSON.stringify(g3));

// Non-causal prose must never be flagged (no alarm fatigue):
const n1 = findUngatedCausalClaims('Mission landed cleanly; all selftests pass; board refreshed.');
check('ordinary non-causal prose not flagged', n1.length === 0, JSON.stringify(n1));

// Robustness: empty / null input never throws.
const n2 = findUngatedCausalClaims('');
const n3 = findUngatedCausalClaims(null);
check('empty + null input safe', n2.length === 0 && n3.length === 0, JSON.stringify({ n2, n3 }));

console.log(`\nreplay result: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
