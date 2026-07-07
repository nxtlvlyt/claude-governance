// Adversarial re-check of item #9 audit evidence (read-only replay).
// Imports the LIVE module + LIVE seat-record.json; no writes, no dispatches.
import { loadSeatRecord, proxyEligible, badalSelect, ESCALATION_LADDER } from 'file:///C:/Users/marka/.claude/muezzin-plugin/seat_record.mjs';

const LIVE = 'C:/Users/marka/.claude/muezzin-plugin/missions/_logs/seat-record.json';
const rec = loadSeatRecord(LIVE);
let pass = 0, fail = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// (a) _era_note present, names both eras + honest name; report its length
const note = rec?.seats?.['kimi-k2.7-code']?._era_note || '';
ck(note.length > 0 && /cloud-era/.test(note) && /local-era/.test(note) && /north-mini-code-toolcall/.test(note),
   `_era_note present, names both eras + honest name (len=${note.length})`);

// (b) honest name has NO borrowed credit -> ineligible/untested for emission
const honest = proxyEligible(rec, 'north-mini-code-toolcall', 'emission');
ck(honest.eligible === false && /must have completed its own Hajj first/.test(honest.reason || ''),
   `north-mini-code-toolcall emission -> ineligible/untested (reason: ${honest.reason})`);

// (c) legacy blended key: tally intact 101/24/2, ratio ~0.229, still eligible on its own math
const t = rec?.seats?.['kimi-k2.7-code']?.emission || {};
const legacy = proxyEligible(rec, 'kimi-k2.7-code', 'emission');
ck(t.pass === 101 && t.miss === 24 && t.fabrication === 2,
   `blended tally intact (${t.pass}/${t.miss}/${t.fabrication})`);
ck(legacy.eligible === true && Math.abs((legacy.ratio ?? 99) - 0.229) < 0.001,
   `kimi-k2.7-code legacy ratio = ${(legacy.ratio ?? NaN).toFixed(3)} (expected ~0.229), eligible=${legacy.eligible}`);

// (d) KILL-SHAPE: a disqualified default offered escalation must NOT hand the rite to the
// untested honest name on the blended alias's borrowed credit. 'opus' emission on the live
// record is 3/11/5 -> ratio 26/29 = 0.897 -> disqualified. Ladder rung #1 is the honest name.
const ks = badalSelect(LIVE, 'emission', 'opus');
ck(ks.escalated === false && ks.model === 'opus' && /NO eligible proxy/.test(ks.blocked || ''),
   `kill-shape rejected: badalSelect(disqualified 'opus') -> ${JSON.stringify(ks)}`);
ck(ESCALATION_LADDER[0] === 'north-mini-code-toolcall',
   `ladder rung #1 IS the honest name (${ESCALATION_LADDER[0]}) — so the refusal above is the exact kill-shape, not a vacuous one`);

console.log(`\n${fail ? fail + ' FAIL' : `ALL ${pass} PASS`}`);
process.exit(fail ? 1 : 0);
