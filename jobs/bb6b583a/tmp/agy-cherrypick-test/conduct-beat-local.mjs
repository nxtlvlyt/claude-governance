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
// --backend agy is LIVE in this fork (2026-07-07, plan step: beat-harness CLI): it rides
// agy_dispatch.mjs's dispatchAgy, whose argv is built by the exported buildAgyArgs — the
// receipted-correct shape (flags first, prompt LAST as the --print value; research §2.2/S1)
// stays single-sourced there. Default agy seat = "Gemini 3.5 Flash (High)" (display label
// IS the --model id; the conductor's own label per seat_modes' agy-hybrid note).
//
// CLI: node conduct-beat-local.mjs --backend agy|ollama --model "<name>"
//   runs ONE runBeat with those options and prints the rijal record JSON to stdout.
//   parseBeatCliArgs is PURE + exported (selftest fixture); unknown backends fail closed.
//
// Allowlisted verbs (everything else -> PROPOSED, logged, never executed):
//   record   — conduct-cycle.mjs --record --class <c> --fix <text> --requeue <stems>
//   restart-daemon — only when daemon-status lanes[] is EMPTY (idle boundary; a status
//                    whose ts is older than STATUS_DEAD_MS counts as empty — a dead
//                    daemon's ghost lanes must not refuse the restart, fork intake 2)
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
// dispatchAgy is the fork's ONE agy spawn path: it builds its argv via the exported
// buildAgyArgs (the receipted-correct shape), closes stdin, fails closed on oversize
// prompts, and tree-kills on timeout. Hand-rolling execFileSync('agy', ...) here would
// re-buy every one of those paid-for fixes (sixth law: use the purpose-built tool).
import { dispatchAgy } from './agy_dispatch.mjs';

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

// STATUS_DEAD_MS — mirror of conduct-cycle.mjs's T.STATUS_DEAD_MS (5 * 60 * 1000), the
// sweep's own daemon-dead heartbeat limit ("status heartbeat older than 5 min -> daemon
// DEAD/HUNG"). MIRRORED, not imported: this file deliberately never imports
// conduct-cycle.mjs (it shells to it as a subprocess), keeping the relay's import graph
// flat. If the sweep's constant ever changes, change this with it — a cross-comment sits
// on the source constant.
export const STATUS_DEAD_MS = 5 * 60 * 1000;

// liveLanesFromStatus — ghost-lane staleness filter (fork intake 2). Receipt: during the
// Gemini Flash conductor audition, the beat gate refused a CORRECT restart-daemon because
// daemon-status.json still listed a lane from a KILLED daemon — the file was stale, the
// gate read it as live. A dead daemon has no live lanes: when the status heartbeat ts is
// older than STATUS_DEAD_MS (or missing/unparseable — freshness that cannot be proven is
// not freshness), lanes[] is a ghost claim and is treated as EMPTY. Polarity note: this
// filter only ever UNBLOCKS a refusal-gate (restarting an already-dead daemon); nothing
// downstream of it FIRES work, so stale-empty is the safe direction here. PURE + exported
// for the selftest.
export function liveLanesFromStatus(status, now = Date.now()) {
  if (!status || !Array.isArray(status.lanes)) return [];
  const ts = Date.parse(status.ts || '');
  const fresh = Number.isFinite(ts) && now - ts < STATUS_DEAD_MS;
  return fresh ? status.lanes : [];
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
    body: JSON.stringify({ model, stream: false, options: { temperature: 0.1, num_ctx: 16384 }, messages: [{ role: 'system', content: LAWS }, { role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(300000),
  });
  if (!r.ok) throw new Error(`ollama HTTP_${r.status}`);
  return (await r.json()).message?.content || '';
}

// agy backend — LIVE (fork, 2026-07-07). Same contract as ollamaBackend: return the raw
// model text or THROW (a throw is a failed beat, never a silent empty verdict). The old
// stub hand-rolled execFileSync('agy', ['--model', m, '--print', prompt, '--print-timeout',
// '5m']) — flags AFTER the --print value, exactly the receipted flag-parsing trap shape.
// Argv now comes from buildAgyArgs via dispatchAgy (ONE source of truth for the shape).
async function agyBackend(model, prompt) {
  const r = await dispatchAgy(`${LAWS}\n\n${prompt}`, { model, printTimeout: '5m', timeoutMs: 320000 });
  if (!r.ok) throw new Error(`agy ${r.error?.kind || 'FAILED'}: ${String(r.error?.detail || '').slice(0, 200)}`);
  if (!r.stdout.trim()) throw new Error('agy EMPTY_CONTENT: empty stdout (planner-loop swallow) — empty content is an error, never a result');
  return r.stdout;
}

// Per-backend model defaults. agy takes DISPLAY LABELS (the label IS the --model id);
// "Gemini 3.5 Flash (High)" is the conductor-seat label (seat_modes agy-hybrid note).
export const BACKEND_DEFAULT_MODEL = {
  ollama: 'qwen3.6:27b',
  agy: 'Gemini 3.5 Flash (High)',
};

// parseBeatCliArgs — PURE argv parse for the beat CLI (exported for the selftest fixture).
// `--backend agy|ollama` picks the backend (default ollama); `--model "<name>"` overrides
// that backend's default model. Unknown backends fail CLOSED via .error (the CLI exits 2)
// rather than silently riding the ollama default with an agy label or vice versa.
export function parseBeatCliArgs(argv, defaults = BACKEND_DEFAULT_MODEL) {
  const out = { backend: 'ollama', model: null, error: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--backend') out.backend = String(argv[++i] ?? '');
    else if (argv[i] === '--model') out.model = String(argv[++i] ?? '');
  }
  if (!Object.prototype.hasOwnProperty.call(defaults, out.backend)) {
    out.error = `unknown backend '${out.backend}' — allowed: ${Object.keys(defaults).join('|')}`;
    return out;
  }
  if (!out.model) out.model = defaults[out.backend];
  return out;
}

export async function runBeat({ backend = 'ollama', model = null, backendFn = null, sweepFn = null, execFn = null, lanesFn = null } = {}) {
  // per-backend default (an agy beat must never inherit an ollama tag as its --model —
  // agy would log a resolve failure and SILENTLY run the settings.json default)
  model = model || BACKEND_DEFAULT_MODEL[backend] || BACKEND_DEFAULT_MODEL.ollama;
  const sweepRaw = sweepFn ? sweepFn() : execSync(`node "${path.join(HERE, 'conduct-cycle.mjs')}" --json`, { timeout: 300000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const condensed = condenseSweep(sweepRaw);
  const sweepActionIds = (JSON.parse(typeof sweepRaw === 'string' ? sweepRaw : JSON.stringify(sweepRaw)).actions || []).map((a) => String(a.id || ''));
  // default lanesFn is staleness-aware (fork intake 2): a stale daemon-status.json is a
  // dead daemon's last words, not a live lane claim — liveLanesFromStatus() treats it as
  // empty so a correct restart-daemon is never refused on ghost lanes. An INJECTED
  // lanesFn (tests) bypasses the filter unchanged — fixtures state lanes directly.
  const lanes = lanesFn ? lanesFn() : (() => { try { return liveLanesFromStatus(JSON.parse(readFileSync(STATUS, 'utf8'))); } catch { return []; } })();

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

    // polarity 6 (fork CLI fixture, 2026-07-07): the PURE argv parse maps --backend/--model
    // correctly, fills per-backend defaults (agy -> the display label), and fails closed on
    // an unknown backend. No dispatch, no fs — dry by construction.
    const p1 = parseBeatCliArgs(['--backend', 'agy']);
    const p2 = parseBeatCliArgs(['--backend', 'ollama', '--model', 'llama4:scout']);
    ck(p1.backend === 'agy' && p1.model === 'Gemini 3.5 Flash (High)' && p1.error === null
      && p2.backend === 'ollama' && p2.model === 'llama4:scout' && p2.error === null,
      'CLI parse maps --backend/--model (agy default = display label "Gemini 3.5 Flash (High)"; explicit --model wins)');
    ck(parseBeatCliArgs(['--backend', 'gpt5']).error !== null, 'CLI parse fails CLOSED on an unknown backend (never silently rides a wrong default)');

    // polarity 7 (fork intake 2): ghost-lane staleness — the audition receipt. Composed
    // through gateAction, the exact gate that refused the audition's correct restart.
    // fresh ts + lane -> RUNNING (refused); stale ts + same lane -> GHOST/empty (allowed);
    // fresh ts + no lanes -> empty (allowed). Pure fixtures, no fs, no dispatch.
    const tNow = Date.now();
    const freshLane = { ts: new Date(tNow - 60000).toISOString(), lanes: [{ path: 'missions/x.mission.txt' }] };
    const staleLane = { ts: new Date(tNow - STATUS_DEAD_MS - 60000).toISOString(), lanes: [{ path: 'missions/x.mission.txt' }] };
    const freshEmpty = { ts: new Date(tNow - 60000).toISOString(), lanes: [] };
    const gFresh = gateAction({ verb: 'restart-daemon', args: {} }, { lanes: liveLanesFromStatus(freshLane, tNow) });
    const gStale = gateAction({ verb: 'restart-daemon', args: {} }, { lanes: liveLanesFromStatus(staleLane, tNow) });
    const gEmpty = gateAction({ verb: 'restart-daemon', args: {} }, { lanes: liveLanesFromStatus(freshEmpty, tNow) });
    ck(liveLanesFromStatus(freshLane, tNow).length === 1 && gFresh.status === 'refused', 'fresh ts + lane -> treated as RUNNING (restart REFUSED — live-lane protection unchanged)');
    ck(liveLanesFromStatus(staleLane, tNow).length === 0 && gStale.status === 'executed', 'stale ts + lane -> GHOST, treated as EMPTY (restart ALLOWED — the audition receipt)');
    ck(liveLanesFromStatus(freshEmpty, tNow).length === 0 && gEmpty.status === 'executed', 'fresh ts + no lanes -> empty (idle restart allowed)');
    ck(liveLanesFromStatus({ lanes: [{ path: 'missions/x.mission.txt' }] }, tNow).length === 0, 'missing/unparseable ts -> freshness unprovable -> ghost for refusal-gates');

    console.log(fails === 0 ? '\nALL PASS — conduct-beat-local relay rails sound' : `\n${fails} FAIL`);
    process.exit(fails === 0 ? 0 : 1);
  })();
}

// ---------------------------------------------------------------- CLI (fork, 2026-07-07)
// node conduct-beat-local.mjs --backend agy|ollama --model "<name>"
// Runs ONE beat with those options and prints the rijal record JSON (the same record
// appended to missions/_logs/conductor-rijal.jsonl). Exit 0 = beat completed (whatever the
// gate ruled — refused/proposed ARE completed beats); exit 1 = the beat itself failed
// (sweep/backend threw); exit 2 = bad argv (fail closed, nothing dispatched).
if (_self && !process.argv.includes('--selftest')) {
  (async () => {
    const parsed = parseBeatCliArgs(process.argv.slice(2));
    if (parsed.error) { console.error(parsed.error); process.exit(2); }
    try {
      const rec = await runBeat({ backend: parsed.backend, model: parsed.model });
      console.log(JSON.stringify(rec, null, 2));
      process.exit(0);
    } catch (e) {
      console.error(JSON.stringify({ error: String(e?.message || e).slice(0, 400), backend: parsed.backend, model: parsed.model }));
      process.exit(1);
    }
  })();
}
