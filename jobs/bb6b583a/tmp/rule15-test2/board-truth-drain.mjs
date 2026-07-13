// board-truth-drain.mjs — the survey+refute drain as an ENGINE script (intake N6).
// Ports the proven Claude-workflow pattern (~/.claude/workflows/board-truth-drain.js,
// 19/19 refute-upheld on 2026-07-07's gap-#7 drain) off the Claude harness so ANY
// conductor — local qwen, the agy sibling, a phone-driven beat — can fire the same
// audit through the engine's own dispatch layer. Local/nxtbeast models only,
// GR10-serial (one dispatch at a time by construction: plain awaited loop).
//
// Usage: node board-truth-drain.mjs missions/x.mission.txt missions/y.mission.txt
//        node board-truth-drain.mjs --stems-file list.txt
// Output: missions/_logs/board-truth-drain-<yyyy-mm-dd>.json
//
// Contract per stem (mirrors the workflow's schema): survey -> {stem, verdict
// (RESOLVED-LANDED|GENUINE-FAILED|SUPERSEDED), fixDisposition, annotationLine,
// receipts[]}; refute -> {refuted, reason}. Refuted or unparseable surveys land in
// disputed[] — the conductor stamps ONLY from upheld[] (stamp-half-never holds:
// this script produces evidence, never touches AUTORUN.md).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchWithWaterfall } from './seat_dispatch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function surveyPrompt(stem) {
  return `Board-truth survey of ONE failed muezzin mission: ${stem}
Read (paths relative to ${HERE}): missions/${stem}.mission.result.json, the newest
missions/_logs/retro/${stem}-*.md, the last ~50 lines of missions/${stem}/mission-events.jsonl,
and missions/${stem}.mission.txt (REPO-ROOT / ALLOW-FILES / Done-means). If code-repo class,
verify the Done-means markers at the target repo's CURRENT HEAD (read-only git).
Judge honestly and return ONLY strict JSON:
{"stem":"${stem}","verdict":"RESOLVED-LANDED|GENUINE-FAILED|SUPERSEDED","fixDisposition":"FIX: ...|pending engine batch: ...|SUPERSEDED/RESOLVED: ...","annotationLine":"one line, dated, required vocabulary","receipts":[{"source":"file:line or sha","quote":"exact"}]}`;
}

export function refutePrompt(survey) {
  return `Adversarially refute this board-truth verdict. Spot-check its receipts (read the quoted files;
read-only git). Refute if a receipt does not exist as quoted, the verdict contradicts current
HEAD state, or the disposition is not performable as named. Default refuted=true if the
load-bearing receipt cannot be verified.
${JSON.stringify(survey)}
Return ONLY strict JSON: {"refuted":true|false,"reason":"one line"}`;
}

export function extractJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function drain(stems, { dispatchFn = null } = {}) {
  const call = dispatchFn || (async (prompt) => {
    const r = await dispatchWithWaterfall({ messages: [{ role: 'user', content: prompt }] }, { cwd: HERE, localOnly: true, role: 'validator' });
    return typeof r === 'string' ? r : (r?.content || r?.message?.content || JSON.stringify(r));
  });
  const upheld = [], disputed = [];
  for (const stem of stems) {                      // serial by construction — GR10
    let survey = null, refute = null;
    try { survey = extractJson(await call(surveyPrompt(stem))); } catch (e) { disputed.push({ stem, stage: 'survey', error: String(e?.message || e).slice(0, 160) }); continue; }
    if (!survey || !survey.verdict) { disputed.push({ stem, stage: 'survey', error: 'unparseable survey JSON' }); continue; }
    try { refute = extractJson(await call(refutePrompt(survey))); } catch (e) { refute = null; }
    if (refute && refute.refuted === false) upheld.push({ ...survey, refuteReason: refute.reason || '' });
    else disputed.push({ stem, stage: 'refute', verdict: survey.verdict, reason: refute?.reason || 'refuter unavailable/unparseable — default refuted (fail-closed)' });
  }
  return { upheld, disputed };
}

// ---------------------------------------------------------------- selftest (stubbed dispatch)
const _self = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (_self && process.argv.includes('--selftest')) {
  (async () => {
    let fails = 0;
    const ck = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
    const goodSurvey = '{"stem":"s1","verdict":"GENUINE-FAILED","fixDisposition":"FIX: requeue","annotationLine":"x","receipts":[{"source":"a:1","quote":"q"}]}';

    const r1 = await drain(['s1'], { dispatchFn: async (p) => p.includes('refute') || p.includes('Adversarially') ? '{"refuted":false,"reason":"receipts check out"}' : goodSurvey });
    ck(r1.upheld.length === 1 && r1.upheld[0].stem === 's1', 'upheld: survey + non-refuted verdict lands in upheld[]');

    const r2 = await drain(['s2'], { dispatchFn: async (p) => p.includes('Adversarially') ? '{"refuted":true,"reason":"receipt does not exist"}' : goodSurvey.replace('s1', 's2') });
    ck(r2.disputed.length === 1 && r2.disputed[0].reason.includes('does not exist'), 'refuted: refuted verdict lands in disputed[] with the reason');

    const r3 = await drain(['s3'], { dispatchFn: async () => 'sorry, I cannot produce JSON today' });
    ck(r3.disputed.length === 1 && r3.disputed[0].stage === 'survey', 'malformed: unparseable survey is disputed, drain survives');

    const r4 = await drain(['s4'], { dispatchFn: async (p) => p.includes('Adversarially') ? 'garbled refute' : goodSurvey.replace('s1', 's4') });
    ck(r4.disputed.length === 1 && /fail-closed/.test(r4.disputed[0].reason), 'refuter-unavailable defaults to refuted (fail-closed)');

    console.log(fails === 0 ? '\nALL PASS — board-truth-drain engine port sound' : `\n${fails} FAIL`);
    process.exit(fails === 0 ? 0 : 1);
  })();
} else if (_self && process.argv.length > 2) {   // bare run = no-op (muezzin-gate convention)
  (async () => {
    const fileArgIx = process.argv.indexOf('--stems-file');
    const stems = fileArgIx > 0 ? readFileSync(process.argv[fileArgIx + 1], 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : process.argv.slice(2).map((s) => path.basename(s).replace(/\.mission\.txt$/i, '')).filter(Boolean);
    if (!stems.length) { console.error('usage: node board-truth-drain.mjs <stem...> | --stems-file <file>'); process.exit(2); }
    const out = await drain(stems);
    const dest = path.join(HERE, 'missions', '_logs', `board-truth-drain-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(dest, JSON.stringify(out, null, 1));
    console.log(`upheld ${out.upheld.length} / disputed ${out.disputed.length} -> ${dest}`);
  })();
}
