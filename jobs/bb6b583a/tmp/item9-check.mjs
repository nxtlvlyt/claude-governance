// E2E audit scratch — gap item #9 (identity hygiene), read-only replay.
// Kill-shape being replayed: the dishonest alias "kimi-k2.7-code" blended 654 cloud-era
// (real Moonshot Kimi) + 168 local-era (North blob) dispatches under one key, letting the
// blended 101/24/2 record be cited as the LOCAL seat's demonstrated quality. After the fix,
// the honest name (north-mini-code-toolcall) must start UNTESTED/ineligible and never be
// promoted as a proxy on borrowed credit.
import { loadSeatRecord, proxyEligible, badalSelect } from 'file:///C:/Users/marka/.claude/muezzin-plugin/seat_record.mjs';

const LIVE = 'C:/Users/marka/.claude/muezzin-plugin/missions/_logs/seat-record.json';
const rec = loadSeatRecord(LIVE);
let pass = 0, fail = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// 1. _era_note annotation present on the dishonest alias key, naming the split honestly
const note = rec?.seats?.['kimi-k2.7-code']?._era_note || '';
ck(/PER-ERA SPLIT/.test(note) && /654 cloud-era/.test(note) && /168 local-era/.test(note) && /north-mini-code-toolcall/.test(note),
   `_era_note present and names both eras + the honest name (len=${note.length})`);

// 2. Honest name starts untested/ineligible — NO borrowed credit (the core behavior)
const nm = proxyEligible(rec, 'north-mini-code-toolcall', 'emission');
ck(nm.eligible === false && /no passed 'emission'/.test(nm.reason || ''),
   `north-mini-code-toolcall emission -> ineligible/untested (reason: ${nm.reason})`);

// 3. Legacy key's own eligibility math unaffected (receipt claimed ratio 0.229)
const legacy = proxyEligible(rec, 'kimi-k2.7-code', 'emission');
ck(legacy.eligible === true && Math.abs(legacy.ratio - 0.229) < 0.001,
   `kimi-k2.7-code legacy ratio = ${legacy.ratio?.toFixed(3)} (expected ~0.229), eligible=${legacy.eligible}`);

// 4. Kill-shape replay: a disqualified default on 'emission' must NOT be handed to the
// untested honest name (first ESCALATION_LADDER rung). opus is disqualified on live data
// (3 pass / 11 miss / 5 fab -> ratio 0.897).
const sel = badalSelect(LIVE, 'emission', 'opus');
ck(sel.escalated === false && sel.model !== 'north-mini-code-toolcall',
   `badalSelect(disqualified default) never promotes the untested honest name -> ${JSON.stringify(sel)}`);

// 5. _era_note does not corrupt parsing / record shape (annotation-only fix is inert to the math)
ck(rec.seats['kimi-k2.7-code'].emission.pass === 101 && rec.seats['kimi-k2.7-code'].emission.miss === 24 && rec.seats['kimi-k2.7-code'].emission.fabrication === 2,
   'blended tally intact (101/24/2), annotation did not alter counters');

console.log(`\n${fail ? fail + ' FAIL' : 'ALL PASS'}`);
process.exit(fail ? 1 : 0);
