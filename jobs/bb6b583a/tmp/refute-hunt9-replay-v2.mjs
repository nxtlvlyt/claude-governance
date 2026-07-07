// Independent adversarial replay of hunt-9 kill-shape against buildLagunaPrompt.
// No model dispatch. Pure function exercise only.
import { buildLagunaPrompt } from 'file:///C:/Users/marka/.claude/muezzin-plugin/self_witness.mjs';

const MARKER = 'FINAL-SENTENCE-MARKER-THE-CONCLUSION-STANDS-9dq7';
// Kill-shape per QUEUE.md:1026 -- "mission text over ~7-9KB" false-flagged as
// 'incomplete / cuts off mid-sentence' because the old 9000/7000 caps sliced it.
const artifact = 'A'.repeat(11900) + ' ' + MARKER;            // > old 9000 cap
const context = 'C'.repeat(9900);                             // > old 7000 cap

let pass = 0, fail = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// 1. NEW defaults: full artifact including its ending must survive.
const pNew = buildLagunaPrompt(artifact, context);
ck(pNew.includes(MARKER), `new defaults keep the >9KB artifact ending (marker present); prompt len=${pNew.length}`);
ck(pNew.includes('C'.repeat(9900)), 'new defaults keep the full >7KB context');

// 2. OLD caps reproduce the original kill: ending sliced off mid-text.
const pOld = buildLagunaPrompt(artifact, context, { maxArt: 9000, maxCtx: 7000 });
ck(!pOld.includes(MARKER), 'old caps (9000/7000) cut the artifact ending -> the receipted false-"incomplete" kill-shape');
ck(pOld.includes('A'.repeat(9000)) && !pOld.includes('A'.repeat(9001)), 'old cap slices artifact at exactly 9000 chars (mid-text cut confirmed)');

// 3. New caps still bound pathological input (matches selftest bound < 61000).
const pHuge = buildLagunaPrompt('x'.repeat(200000), 'y'.repeat(200000));
ck(pHuge.length < 61000, `pathological 200K input still bounded; len=${pHuge.length}`);

// 4. Boundary of the gap's own wording: a ~9.5KB mission text (the named 7-9KB+ class)
// survives whole under new defaults, and WAS truncated under old caps.
const nine5 = 'B'.repeat(9400) + ' ' + MARKER;
ck(buildLagunaPrompt(nine5, '').includes(MARKER), 'a 9.5KB mission text (the gap\'s named class) reaches the witness un-truncated under new defaults');
ck(!buildLagunaPrompt(nine5, '', { maxArt: 9000, maxCtx: 7000 }).includes(MARKER), 'the same 9.5KB text WAS truncated under the old caps');

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES: ' + fail} (${pass} pass / ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
