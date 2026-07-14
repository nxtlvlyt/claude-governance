// Proves the OTHER witness type: a CODE claim passes the gate only on an exec deed that actually ran (exit 0).
import { execReceipt } from './seat_dispatch.mjs';
import { mergeVerdicts } from './verdict_merge.mjs';

const good = execReceipt('node -c verdict_merge.mjs');          // lint a real, valid file -> exit 0
const bad = execReceipt('node -c __does_not_exist__.mjs');      // a deed that fails -> non-zero exit

const okMerge = mergeVerdicts([{ seat: 'executor', verdict: 'APPROVE', findings: [], receipts: [good] }]).consensus;
const badMerge = mergeVerdicts([{ seat: 'executor', verdict: 'APPROVE', findings: [], receipts: [bad] }]).consensus;
const noReceipt = mergeVerdicts([{ seat: 'executor', verdict: 'APPROVE', findings: [] }]).consensus;

let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
ck(good.ok === true && good.exit === 0, `exec receipt of a valid file: ran, exit 0 (${good.ref})`);
ck(bad.ok === false, `exec receipt of a failing deed: not ok (exit ${bad.exit})`);
ck(okMerge === 'APPROVE', 'code APPROVE witnessed by a PASSING exec deed -> APPROVE');
ck(badMerge === 'BLOCK', 'code APPROVE witnessed by a FAILING exec deed -> BLOCK');
ck(noReceipt === 'BLOCK', 'code APPROVE with NO deed at all -> BLOCK');
console.log(fails === 0 ? '\nEXEC-WITNESS OK — code claims pass only on a deed that actually ran' : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
