// seat_record.mjs — the Badal Hajj track record (reviewer-shaped, 2026-06-11).
// Rule: a proxy may perform a rite ONLY if it has completed that rite itself, and
// fabrication-class failures weigh heavier than ordinary misses in eligibility —
// "a seat that fabricates negative existence claims shouldn't be eligible as a proxy
// for verification rites." Fed per outcome (the retro corpus already auto-writes;
// this is the scoring rule, not new plumbing). Path: missions/_logs/seat-record.json
//
// Also home of the DETECTOR for the receipted 4a class: a verdict seat claiming a
// file is ABSENT (ENOENT / does not exist / not found) when the sandbox demonstrably
// CONTAINS it. That is not a judgment call — it is mechanically checkable, and it is
// recorded as a fabrication strike against the seat.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { collectAllowedBasenames } from './citation_guard.mjs';

export const FABRICATION_WEIGHT = 3;   // a fabrication counts as 3 ordinary misses

export function loadSeatRecord(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { seats: {} }; }
}

export function recordSeatOutcome(p, seat, rite, outcome /* 'pass' | 'miss' | 'fabrication' */) {
  const r = loadSeatRecord(p);
  const s = (r.seats[seat] ??= {});
  const t = (s[rite] ??= { pass: 0, miss: 0, fabrication: 0 });
  if (!(outcome in t)) return r;                       // unknown outcome: never corrupt the record
  t[outcome]++;
  try { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(r, null, 2)); } catch { /* scoring must never crash a mission */ }
  return r;
}

// Badal eligibility: pass >= 1 for the rite (the proxy completed its own Hajj) AND the
// weighted strike ratio stays under 0.5 (fabrications x3).
export function proxyEligible(record, seat, rite) {
  const t = record?.seats?.[seat]?.[rite];
  if (!t || !t.pass) return { eligible: false, reason: `no passed '${rite}' on record — badal rule: the proxy must have completed its own Hajj first` };
  const strikes = (t.miss || 0) + (t.fabrication || 0) * FABRICATION_WEIGHT;
  const ratio = strikes / (t.pass + strikes);
  return ratio < 0.5
    ? { eligible: true, ratio }
    : { eligible: false, ratio, reason: `weighted strike ratio ${ratio.toFixed(2)} >= 0.5 (fabrications weigh x${FABRICATION_WEIGHT})` };
}

// DETECTOR (4a receipt): findings asserting a file's ABSENCE while the sandbox contains
// its basename. Detection only — the finding is NOT dropped (a seat may phrase a real
// finding as an existence claim); it is flagged and the strike recorded. The merge still
// takes the seat's verdict at face value; the track record pays the price.
export function findFabricatedAbsenceClaims(findings, cwd) {
  const out = [];
  let sandbox = null;
  for (const f of (findings || [])) {
    const txt = String(f?.description || f || '');
    if (!/ENOENT|does not exist|not found|no such file|file_read (?:fails|returns|unavailable)/i.test(txt)) continue;
    for (const m of (txt.match(/[\w.\- ()&]{1,60}\.(?:txt|md|json|html|csv|ya?ml|mjs|tsx?|jsx?)/gi) || [])) {
      const full = m.trim().split(/[\\/]/).pop().toLowerCase();        // may carry sentence prefix (space-named files are legit)
      const tail = full.split(/\s+/).pop();                            // last space-token, e.g. "vanlife-tree.txt"
      sandbox ??= collectAllowedBasenames(cwd, {});                    // one bounded walk, lazily
      const hit = sandbox.has(full) ? full : (sandbox.has(tail) ? tail : null);
      if (hit) { out.push({ finding: String(f?.id || txt.slice(0, 60)), file: hit }); break; }
    }
  }
  return out;
}

// CORPUS-READING CAVEAT (reviewer 2026-06-11, encoded where the record is READ): the
// fabrication tally counts DETECTABLE fabrications only — false ABSENCE claims, which
// have a mechanical oracle (the sandbox). False CONTENT claims (invented hex values,
// stats) have no oracle and are caught only by witnesses. "Zero fabrication strikes"
// means zero DETECTABLE — a seat that fabricates only in unverifiable territory looks
// clean here. Tightening path (queued): spot-check sampling — a witness re-derives a
// random fraction of value-claims per mission for a statistical bound.

// BADAL SWITCH (dispatch-time consumption — "the record's worthless until something
// consumes it at routing"). Ladder order respects the budget ruling (L4 seats last,
// never for jobs the default can hold). Escalation fires when the default seat is
// DISQUALIFIED on the rite (weighted ratio >= 0.5, OR untested-and-failing: 0 passes
// and >=1 miss/fabrication) AND a ladder candidate is proxyEligible (has completed
// that rite itself). An untested candidate is never promoted to proxy — if nobody
// qualifies, the default keeps the rite (visible in the record; the conductor's beat
// can see a disqualified seat with no eligible proxy).
export const ESCALATION_LADDER = ['kimi-k2.7-code', 'kimi-k2.6', 'deepseek-v4-pro'];
export function badalSelect(recordPath, rite, defaultModel) {
  const record = loadSeatRecord(recordPath);
  const own = proxyEligible(record, defaultModel, rite);
  const t = record?.seats?.[defaultModel]?.[rite];
  const strikeRatioDisq = t && !own.eligible && own.reason && /strike ratio/.test(own.reason);
  const untestedFailingDisq = t && (t.pass || 0) === 0 && ((t.miss || 0) + (t.fabrication || 0)) >= 1;
  const disqualified = strikeRatioDisq || untestedFailingDisq;
  if (!disqualified) return { model: defaultModel, escalated: false };
  for (const cand of ESCALATION_LADDER) {
    if (cand === defaultModel) continue;
    if (proxyEligible(record, cand, rite).eligible) {
      const why = strikeRatioDisq ? own.reason : `untested-and-failing fast-revert (0 passes + recorded failure for '${rite}')`;
      return { model: cand, escalated: true, from: defaultModel, why };
    }
  }
  return { model: defaultModel, escalated: false, blocked: `default disqualified (${own.reason}) but NO eligible proxy on record — badal refused an untested substitute` };
}

// ---- selftests: node seat_record.mjs
if (process.argv[1] && process.argv[1].endsWith('seat_record.mjs')) {
  const { mkdtempSync, writeFileSync: wf, rmSync } = await import('fs');
  const os = await import('os');
  let pass = 0, fail = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

  const dir = mkdtempSync(path.join(os.tmpdir(), 'seatrec_'));
  const rec = path.join(dir, 'seat-record.json');

  // badal rule: no pass on record -> ineligible regardless of size of model
  recordSeatOutcome(rec, 'big-model', 'verdict', 'miss');
  ck(proxyEligible(loadSeatRecord(rec), 'big-model', 'verdict').eligible === false, 'no completed rite -> INELIGIBLE (untested proxy refused, however big)');
  // passes earn eligibility
  recordSeatOutcome(rec, 'good-model', 'verdict', 'pass');
  ck(proxyEligible(loadSeatRecord(rec), 'good-model', 'verdict').eligible === true, 'one clean pass -> eligible');
  // fabrications weigh x3: 1 pass + 1 fabrication = ratio 3/4 -> ineligible; 1 pass + 1 miss = 1/2... boundary
  recordSeatOutcome(rec, 'liar-model', 'verdict', 'pass');
  recordSeatOutcome(rec, 'liar-model', 'verdict', 'fabrication');
  ck(proxyEligible(loadSeatRecord(rec), 'liar-model', 'verdict').eligible === false, 'one fabrication outweighs one pass (x3 weight) -> ineligible');
  recordSeatOutcome(rec, 'meh-model', 'verdict', 'pass'); recordSeatOutcome(rec, 'meh-model', 'verdict', 'pass'); recordSeatOutcome(rec, 'meh-model', 'verdict', 'miss');
  ck(proxyEligible(loadSeatRecord(rec), 'meh-model', 'verdict').eligible === true, '2 passes + 1 ordinary miss -> still eligible (misses are not fabrications)');

  // absence-claim detector: the 4a shape — seat claims ENOENT on a file the sandbox HAS
  wf(path.join(dir, 'vanlife-tree.txt'), 'tree');
  const fabs = findFabricatedAbsenceClaims([{ id: 'F1', description: 'Section 1 cites vanlife-tree.txt but file_read returns ENOENT at that path.' }], dir);
  ck(fabs.length === 1 && fabs[0].file === 'vanlife-tree.txt', 'detector: ENOENT claim on an EXISTING sandbox file -> fabrication flagged (the 4a receipt)');
  const honest = findFabricatedAbsenceClaims([{ id: 'F2', description: 'ghost-data.csv does not exist in the sandbox.' }], dir);
  ck(honest.length === 0, 'detector: absence claim on a genuinely absent file -> NOT flagged (honest finding)');
  const noClaim = findFabricatedAbsenceClaims([{ id: 'F3', description: 'Section 2 lacks citations for its color values.' }], dir);
  ck(noClaim.length === 0, 'detector: non-existence findings ignored (no false positives on ordinary findings)');

  // badal switch: healthy default stays; disqualified default escalates ONLY to a proven proxy
  const rec2 = path.join(dir2(), 'r.json');
  function dir2() { const d = mkdtempSync(path.join(os.tmpdir(), 'badal_')); return d; }
  recordSeatOutcome(rec2, 'qwen3-coder-next', 'emission', 'pass');
  ck(badalSelect(rec2, 'emission', 'qwen3-coder-next').escalated === false, 'badal: healthy default keeps the rite (no gratuitous escalation)');
  recordSeatOutcome(rec2, 'qwen3-coder-next', 'emission', 'fabrication');   // 1 pass + 1 fab = ratio 0.75 -> disqualified
  const noProxy = badalSelect(rec2, 'emission', 'qwen3-coder-next');
  ck(noProxy.escalated === false && /NO eligible proxy/.test(noProxy.blocked || ''), 'badal: disqualified default + UNTESTED candidates -> refuse substitution (visible block, no blind promotion)');
  recordSeatOutcome(rec2, 'kimi-k2.6', 'emission', 'pass');                  // kimi completes its own Hajj
  const esc = badalSelect(rec2, 'emission', 'qwen3-coder-next');
  ck(esc.escalated === true && esc.model === 'kimi-k2.6', 'badal: disqualified default + PROVEN proxy -> escalate to the proxy');

  // fast-revert: an untested failing default (0 passes + any failure) auto-reverts
  recordSeatOutcome(rec2, 'fresh-model', 'emission', 'miss');
  const untestedFailing = badalSelect(rec2, 'emission', 'fresh-model');
  ck(untestedFailing.escalated === true && untestedFailing.model === 'kimi-k2.6', 'badal: untested-and-failing default (0 passes + miss) -> escalate to first eligible proxy');

  rmSync(dir, { recursive: true, force: true });
  console.log(`\n${fail ? fail + ' FAIL' : 'ALL PASS — badal track record + absence-claim detector sound'}`);
  process.exit(fail ? 1 : 0);
}
