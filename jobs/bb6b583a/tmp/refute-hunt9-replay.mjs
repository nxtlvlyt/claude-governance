// Independent adversarial replay for hunt-9 (self-witness prompt truncation).
// Read-only, no model dispatch. Imports the exported buildLagunaPrompt from HEAD.
import { buildLagunaPrompt } from 'file:///C:/Users/marka/.claude/muezzin-plugin/self_witness.mjs';

let fail = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++; };

// Kill-shape per GAP-HUNT-2026-07-03.json: mission text over ~7-9KB passed as BOTH
// artifact and contextText (muezzin-daemon.mjs:1082); receipted victims were 9404 and
// 11012 bytes. Build an 11012-char mission text with a distinctive final sentence.
const ENDER = 'FINAL-SENTENCE-MARKER: the mission contract closes here, fully intact.';
const body = 'Step analysis sentence padding. '.repeat(Math.ceil((11012 - ENDER.length) / 32)).slice(0, 11012 - ENDER.length);
const mission = body + ENDER;
ck(mission.length === 11012, `fixture is exactly the receipted 11012-char kill size (got ${mission.length})`);

// 1. NEW defaults: same text in both slots (the daemon's exact call shape) survives whole.
const pNew = buildLagunaPrompt(mission, mission);
ck(pNew.includes(ENDER), 'NEW defaults: ARTIFACT slot keeps the ending (marker present at least once)');
ck(pNew.indexOf(ENDER) !== pNew.lastIndexOf(ENDER), 'NEW defaults: CONTEXT slot ALSO keeps the ending (marker present twice — both slots un-truncated)');

// 2. OLD caps reproduce the receipted kill: context sliced at 7000 (mid-sentence), artifact at 9000.
const pOld = buildLagunaPrompt(mission, mission, { maxArt: 9000, maxCtx: 7000 });
ck(!pOld.includes(ENDER), 'OLD caps (9000/7000): the ending is sliced off BOTH slots (kill-shape reproduced)');

// 3. Larger-than-new-cap artifact (12013 chars, the audit fixture size) still fits under new default.
const art12k = 'z'.repeat(12013 - ENDER.length) + ENDER;
const p12k = buildLagunaPrompt(art12k, 'c'.repeat(9900));
ck(p12k.includes(ENDER), 'NEW defaults: 12013-char artifact (audit fixture size) keeps its ending');

// 4. Pathological 200KB input still bounded.
const pPath = buildLagunaPrompt('x'.repeat(200000), 'y'.repeat(200000));
ck(pPath.length < 61000, `pathological 200KB input bounded (len=${pPath.length} < 61000)`);
ck(pPath.length >= 60000, `bound actually reflects the raised 36000+24000 caps (len=${pPath.length} >= 60000)`);

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
