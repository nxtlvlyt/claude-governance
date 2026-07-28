// conduct-beat-local.mjs — the harness-agnostic conductor beat (intake N5; succession
// plan 5b "this process needs to be so good a LOCAL model could be in your seat",
// operator 2026-06-10; re-affirmed 2026-07-07 "a local model like qwen 3.6 27b could be
// the conductor... I feel like you're forgetting?").
//
// THE INVERSION: rails live in THIS SCRIPT, not in any agent harness. The model seat
// only RELAYS — it reads the sweep's own required actions and picks; the script executes
// nothing but ALLOWLISTED verbs. A wrong model can waste a beat; it cannot fire a
// mission, deploy, or edit anything. Receipts: the qwen3.6:27b audition (QUEUE 2026-07-07,
// 5/5 on a real board state, 70.5s/beat) proved the relay pattern; the agy junior-conductor
// eval (memory 2026-06-26) proved advice-without-enforcement fails — hence GATES, not advice.
//
// Backends: --backend ollama (default; nxtbeast /api/chat, GR10-checked) is live today.
// --backend agy is a stub slot for the sibling system (agy -p print-mode) — same contract,
// wired when the agy fork lands (approved plan step 4).
//
// Allowlisted verbs (everything else -> PROPOSED, logged, never executed):
//   record   — conduct-cycle.mjs --record --class <c> --fix <text> --requeue <stems>
//   restart-daemon — only when daemon-status lanes[] is EMPTY (idle boundary)
//   hold     — write/refresh a hold marker note into the rijal log (no file side effects)
//   report   — a report line into the rijal log (the "nothing needed" complete ending)
//
// Every turn appends one JSONL rijal record: prompt hash, model, chosen verb, args,
// executed|proposed|refused, and the raw model text — the per-turn attribution the
// conductor-rijal queue item has wanted since 2026-06-10.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RIJAL = path.join(HERE, 'missions', '_logs', 'conductor-rijal.jsonl');
const STATUS = path.join(HERE, 'missions', '_logs', 'daemon-status.json');
const OLLAMA = process.env.MUEZZIN_OLLAMA_URL || 'http://nxtbeast:11434';

const LAWS = `You are the muezzin CONDUCTOR (relay seat). Laws: five verbs only (construct/fire/judge/report/write-state); never hand-implement; receipts never summaries; never blind-requeue FAILED x2; product missions hold while GAP-PRIORITY-HOLD is set; stamps are yours only after reading the mission's own diagnostics; reports are outcome-only.
You will receive the sweep's REQUIRED ACTIONS. Choose EXACTLY ONE next action as strict JSON:
{"verb":"record|restart-daemon|hold|report","args":{...},"why":"one line"}
- record: {"class":"...","fix":"...","requeue":"stem1,stem2"} — only for a fix-landed/requeue-once action the sweep itself lists.
- restart-daemon: {} — only if the sweep says the daemon is dead/stale AND no lane is running.
- hold: {"note":"..."} — when every action is judgment-class you cannot perform as a relay.
- report: {"line":"..."} — when the board is clean ("nothing needed" is a complete ending).
Output ONLY the JSON object.`;

export function condenseSweep(sweepJson, maxChars = 6000) {
  const j = typeof sweepJson === 'string' ? JSON.parse(sweepJson) : sweepJson;
  const acts = (j.actions || []).map((a) => ({ id: a.id, class: a.class, why: String(a.why || '').slice(0, 140), fix: a.fix ? String(a.fix).slice(0, 140) : undefined }));
  const rep = (j.report || []).filter((l) => /^ledger:|BEAT-COMPLETE|DONENESS|ADVISORY/.test(l)).slice(0, 8);
  return JSON.stringify({ report: rep, actions: acts }).slice(0, maxChars);
}

// Pure gate: is this exact parsed action executable under the allowlist, in this state?
export function gateAction(action, { lanes = [], sweepActionIds = [] } = {}) {
  if (!action || typeof action !== 'object' || !action.verb) return { allow: false, status: 'refused', reason: 'unparseable action' };
  const v = String(action.verb);
  if (v === 'report') return { allow: true, status: 'executed', reason: 'report line' };
  if (v === 'hold') return { allow: true, status: 'executed', reason: 'hold note' };
  if (v === 'restart-daemon') {
    if (lanes.length) return { allow: false, status: 'refused', reason: 'lane running — never restart mid-lane' };
    return { allow: true, status: 'executed', reason: 'idle restart' };
  }
  if (v === 'record') {
    const stems = String(action.args?.requeue || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!action.args?.class || !stems.length) return { allow: false, status: 'refused', reason: 'record needs class + requeue stems' };
    // the sweep must itself have ordered a requeue for at least one of these stems —
    // the relay can echo the machine's order, never invent one (deed-over-claim gate).
    const ordered = stems.some((st) => sweepActionIds.some((id) => id.includes(st)));
    if (!ordered) return { allow: false, status: 'proposed', reason: 'requeue not ordered by the sweep — proposed for conductor review, not executed' };
    return { allow: true, status: 'executed', reason: 'sweep-ordered requeue' };
  }
  return { allow: false, status: 'proposed', reason: `verb '${v}' outside the allowlist` };
}

export function parseModelAction(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function ollamaBackend(model, prompt) {
  const ps = await (await fetch(`${OLLAMA}/api/ps`)).json();
  const big = (ps.models || []).filter((x) => (x.size || 0) > 12e9);
  if (big.length) throw new Error(`GR10: big model resident (${big[0].name}) — yield the beat`);
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    // think:false (2026-07-28): the laguna-xs-2.1 re-push defaults to thinking-mode and floods
    // content with reasoning prose on the NATIVE endpoints (probe receipt: default = rambling
    // preamble; think:false = exactly "CLEAN", 5 chars). /api/chat honors the flag
    // (self_witness.mjs:203 precedent). The /v1 endpoint is DIFFERENT — qwen3.6 ignores
    // think:false there and is budget-mitigated instead (orchestrate.mjs:600-603).
    body: JSON.stringify({ model, stream: false, think: false, options: { temperature: 0.1, num_ctx: 16384 }, messages: [{ role: 'system', content: LAWS }, { role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(300000),
  });
  if (!r.ok) throw new Error(`ollama HTTP_${r.status}`);
  return (await r.json()).message?.content || '';
}

// agy backend stub — same contract; wired when the agy-muezzin fork lands (plan step 4).
async function agyBackend(model, prompt) {
  const out = execFileSync('agy', ['--model', model, '--print', `${LAWS}\n\n${prompt}`, '--print-timeout', '5m'], { timeout: 320000 }).toString();
  return out;
}

export async function runBeat({ backend = 'ollama', model = 'qwen3.6:27b', backendFn = null, sweepFn = null, execFn = null, lanesFn = null } = {}) {
  const sweepRaw = sweepFn ? sweepFn() : execSync(`node "${path.join(HERE, 'conduct-cycle.mjs')}" --json`, { timeout: 300000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const condensed = condenseSweep(sweepRaw);
  const sweepActionIds = (JSON.parse(typeof sweepRaw === 'string' ? sweepRaw : JSON.stringify(sweepRaw)).actions || []).map((a) => String(a.id || ''));
  const lanes = lanesFn ? lanesFn() : (() => { try { return JSON.parse(readFileSync(STATUS, 'utf8')).lanes || []; } catch { return []; } })();

  const call = backendFn || (backend === 'agy' ? agyBackend : ollamaBackend);
  const raw = await call(model, `CURRENT SWEEP (machine-computed):\n${condensed}\n\nChoose the one next action.`);
  const action = parseModelAction(raw);
  const gate = gateAction(action, { lanes, sweepActionIds });

  let execResult = null;
  if (gate.allow && action.verb === 'record' && gate.status === 'executed') {
    const doExec = execFn || ((args) => execFileSync('node', [path.join(HERE, 'conduct-cycle.mjs'), '--record', '--class', args.class, '--fix', String(args.fix || 'relay-beat requeue'), '--requeue', args.requeue], { timeout: 120000 }).toString());
    execResult = doExec(action.args);
  } else if (gate.allow && action.verb === 'restart-daemon' && gate.status === 'executed') {
    const doExec = execFn || (() => { execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq muezzin*" 2>nul & powershell -Command "Start-Process node -ArgumentList \'muezzin-daemon.mjs\' -WorkingDirectory \'' + HERE + '\' -WindowStyle Hidden"', { timeout: 60000 }); return 'restarted'; });
    execResult = doExec(action.args || {});
  }

  const rec = { ts: new Date().toISOString(), backend, model, verb: action?.verb || null, args: action?.args || null, why: action?.why || null, gate: gate.status, gateReason: gate.reason, execResult: execResult ? String(execResult).slice(0, 200) : null, rawModelText: String(raw).slice(0, 500) };
  try { appendFileSync(RIJAL, JSON.stringify(rec) + '\n'); } catch { /* rijal must never break the beat */ }
  return rec;
}

// ---------------------------------------------------------------- selftest (stubbed model)
const _self = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (_self && process.argv.includes('--selftest')) {
  (async () => {
    let fails = 0;
    const ck = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };
    const sweep = JSON.stringify({ report: ['ledger: x'], actions: [{ id: 'REQUEUE-my-stem', class: 'mechanical', why: 'fix landed' }] });

    // polarity 1: allowlisted, sweep-ordered record -> EXECUTED via stub
    let executed = null;
    const r1 = await runBeat({ sweepFn: () => sweep, lanesFn: () => [], execFn: (a) => { executed = a; return 'ok'; }, backendFn: async () => '{"verb":"record","args":{"class":"c1","fix":"f","requeue":"my-stem"},"why":"sweep ordered it"}' });
    ck(r1.gate === 'executed' && executed?.requeue === 'my-stem', 'allowlisted sweep-ordered record EXECUTES through the stub');

    // polarity 2: verb outside the allowlist -> PROPOSED only, exec stub untouched
    executed = null;
    const r2 = await runBeat({ sweepFn: () => sweep, lanesFn: () => [], execFn: (a) => { executed = a; return 'ok'; }, backendFn: async () => '{"verb":"fire-mission","args":{"stem":"anything"},"why":"model overreach"}' });
    ck(r2.gate === 'proposed' && executed === null, 'non-allowlisted verb is PROPOSED, never executed');

    // polarity 3: record for a stem the sweep never ordered -> proposed
    const r3 = await runBeat({ sweepFn: () => sweep, lanesFn: () => [], execFn: () => 'ok', backendFn: async () => '{"verb":"record","args":{"class":"c1","fix":"f","requeue":"invented-stem"},"why":"model invented it"}' });
    ck(r3.gate === 'proposed', 'record for a stem the sweep never ordered is PROPOSED (deed-over-claim gate)');

    // polarity 4: restart while a lane runs -> refused
    const r4 = await runBeat({ sweepFn: () => sweep, lanesFn: () => [{ path: 'missions/x.mission.txt' }], execFn: () => 'ok', backendFn: async () => '{"verb":"restart-daemon","args":{},"why":"looks stale"}' });
    ck(r4.gate === 'refused', 'restart-daemon with a lane running is REFUSED');

    // polarity 5: garbage model output -> refused, beat survives
    const r5 = await runBeat({ sweepFn: () => sweep, lanesFn: () => [], execFn: () => 'ok', backendFn: async () => 'I think we should probably deploy everything now' });
    ck(r5.gate === 'refused', 'unparseable model output is REFUSED, beat records it and survives');

    console.log(fails === 0 ? '\nALL PASS — conduct-beat-local relay rails sound' : `\n${fails} FAIL`);
    process.exit(fails === 0 ? 0 : 1);
  })();
}
