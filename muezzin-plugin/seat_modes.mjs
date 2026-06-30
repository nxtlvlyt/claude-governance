// seat_modes.mjs — the ONE toggle that remaps WHICH model fills each engine seat, per phase.
//
// WHY (operator ruling "use the two budgets TOGETHER intelligently", operator-rulings.md
// 2026-06-10): the route file already flips Claude-first per-seat/per-window, but the
// operator ratified THREE NAMED MODES as a single switchable dial — "these modes ARE that
// ruling made switchable" (mode-build dispatch, 2026-06-15). One `mode` field in
// muezzin-route.json (env override MUEZZIN_MODE) remaps the seat DEFINITIONS for every
// phase. It does NOT touch phase LOGIC — only which model name each seat is handed; the
// existing seat_dispatch waterfall (ollama-cloud -> 3 heals -> CLAUDE tier -> local) then
// resolves THAT name to a provider, so the safe default + per-seat fallback are preserved
// for free, every mode.
//
// THE THREE MODES (operator-ratified table, 2026-06-15):
//   balance         — stretch Claude: P1 architects = ollama-cloud (kimi/deepseek/minimax),
//                     integrator = Opus, executor = ollama-cloud kimi-coder (Sonnet fallback
//                     via CLAUDE_SEAT_MAP), verdict = ollama-cloud + Opus witness.
//   anthropic-heavy — Claude IN the phases, CHECKED BY ollama cloud: P1 architects = the
//                     outage Claude panel opus/sonnet/haiku (SEAT-PLAN-OPERATOR-ORIGINAL.md
//                     lines 81-87), integrator = Opus, executor = Sonnet, verdict = ollama
//                     cloud models verify the Claude work (deepseek/minimax) + strong witness.
//                     Diversity is the point: Sonnet executes, OPEN models verify.
//   local-heavy     — ~zero Claude when usage is high: P1 architects = local+cloud ollama
//                     (qwen3.6:27b / granite4.1:8b / nemotron-3-super), integrator =
//                     ollama-cloud deepseek-v4-pro, executor = local kimi-coder/qwen,
//                     verdict + witness = local/cloud ollama.
//
// SAFE DEFAULT: an absent or unknown `mode` returns null from resolveMode(); every consumer
// treats null as "use today's hardcoded seats" — the engine behaves EXACTLY as before this
// file existed. The mode is a REMAP of existing defaults, never a rewrite of the phases.
//
// GR10 (no two LOCAL models concurrently): local-heavy names three local/cloud architects,
// but the panel already authors architects SERIALLY (deconstructor.mjs deconstructPanel's
// for..of loop) — this file changes the model NAMES, not that serialization. Verified at
// build time; the serialization lives in the panel, not here.
//
// Pure + side-effect-free (except readMode's single state-file read): the selftest exercises
// every mode's per-phase resolution with no network and no dispatch.

import { readFileSync } from 'fs';

const ROUTE_FILE = 'C:/Users/marka/.claude/state/muezzin-route.json';

export const MODES = ['balance', 'anthropic-heavy', 'local-heavy', 'reasoning-heavy', 'gemini-heavy'];

// THE TABLE. Each mode -> the model NAME each seat is handed. seat_dispatch resolves the
// name to a provider via its waterfall, so a Claude name (opus/sonnet/haiku) dispatches
// Claude-first (recognizeClaude in seat_dispatch) and an ollama name dispatches cloud-first.
// architects = the 3 BLIND phase-1 seats (order = A,B,C). executor = the single phase-2
// writer's default. validator/auditor = the phase-3 verdict panel. witness = the per-step
// phase-2 smell-test seat (its Claude fallback is governed by CLAUDE_SEAT_MAP, kept strong).
const TABLE = {
  'balance': {
    architects: ['kimi-k2.6', 'deepseek-v4-pro', 'minimax-m3'],   // ollama-cloud, 3 labs (today's PANEL_ARCHITECTS)
    integrator: 'nemotron-3-ultra',                                // CLAUDE_SEAT_MAP-routed: Opus-first window (today's PANEL_INTEGRATOR_MODEL)
    executor: 'kimi-k2.7-code',                                    // 2026-06-17: qwen3-coder-next->kimi-k2.7-code (guardian+laguna APPROVE). seat-record: kimi ratio 0.43 (5 fewer fab) beats qwen 0.484; canon/bake-off = reliable Phase-2 executor; the 2026-06-15 qwen-revert ("kimi auditioning, no completions") is stale — kimi now has 16 recorded. Sonnet fallback via CLAUDE_SEAT_MAP
    validator: 'deepseek-v4-pro',                                  // ollama-cloud verdict (today)
    auditor: 'minimax-m3',                                         // ollama-cloud verdict (today)
    witness: 'gemini-3-flash-preview',                             // Google Gemini (superior Witness per benchmark)
  },
  'anthropic-heavy': {
    // CLAUDE IN THE PHASES (SEAT-PLAN-OPERATOR-ORIGINAL.md outage panel = the anthropic-heavy
    // architect set): A=opus, B=sonnet, C=haiku — three INDEPENDENT blind plans on the Claude
    // family (diversity by tier). seat_dispatch recognizes these as Claude models -> Claude-first.
    architects: ['opus', 'sonnet', 'haiku'],
    integrator: 'opus',                                            // Opus synthesis (the heaviest-context job)
    executor: 'sonnet',                                            // SONNET executes (operator: Sonnet executes, open models verify)
    // CHECKED BY OLLAMA CLOUD: the verdict panel stays OPEN-weight so Anthropic work is
    // verified by a DIFFERENT lab/infrastructure (diversity is the point; producer != verifier).
    validator: 'deepseek-v4-pro',
    auditor: 'minimax-m3',
    // 2026-06-22: aligned with model_rijal.mjs:359 — ultra is the CHOSEN cloud
    // witness (operator's 2026-06-09 ruling); super stays as established LOCAL
    // fallback for the final-verdict channel. Prior 'nemotron-3-super' name here
    // was a stale assignment from before the rijal cloud/local split.
    witness: 'nemotron-3-ultra',
  },
  'local-heavy': {
    // ~ZERO CLAUDE: local + cloud ollama only. Architects = the 4090's locals + nemotron
    // super (cloud) as the breadth seat; all ollama names -> cloud-first, local fallback,
    // NEVER the Claude tier (no name here maps to a Claude model as PRIMARY).
    architects: ['glm-5.1', 'deepseek-v4-pro', 'nemotron-3-super'],
    integrator: 'deepseek-v4-pro',                                 // ollama-cloud integrator
    executor: 'kimi-k2.7-code',                                    // Ollama Cloud executor (ornith:35b local fallback)
    validator: 'deepseek-v4-pro',                                  // ollama verdict
    auditor: 'minimax-m3',                                         // ollama verdict
    witness: 'laguna-xs.2:q4_K_M',                                // OPERATOR 2026-06-26: laguna IS the structural witness (self_witness.mjs:43 "spec: structural witness"; rulings = code review/structural analysis). qwen3.5:9b was a drift. 33B structural reviewer, local on nxtbeast. The old "no Opus pull" rationale is moot — Claude tier is disabled this session, so there is no Opus to pull.
  },
  'reasoning-heavy': {
    // HARDER-WORK PROFILE (operator design 2026-06-17). EXECUTOR CORRECTED glm-5.2 -> kimi-k2.7-code after the operator's
    // three-way hard battery (Kimi2.7 vs GLM5.2 vs Sonnet): all three are CAPABILITY-EQUAL at the ceiling, but GLM-5.2
    // INTERMITTENTLY EMITS EMPTY content on hard tasks (1 empty in 3 semver retries + earlier low-budget empties) — a real
    // liability for a per-step executor that must produce an artifact EVERY step (my earlier single-task head-to-head missed
    // this). Kimi-2.7 is co-best with Sonnet AND reliable (clean every run) AND cheap/fast. GLM-5.2 stays a PHASE-3 AUDIT
    // seat (tested strong there; a rare empty is cheap to retry once per mission). Bigger reasoning everywhere; Opus on the
    // JUDGMENT seats (witness/auditor); a reliable open coder GRINDS the executor to save Claude on the highest-token seat.
    architects: ['opus', 'sonnet', 'minimax-m3'],                  // haiku -> minimax-m3: bigger open reasoner + cross-lab diversity on the blind plans
    integrator: 'opus',                                            // Opus synthesis (heaviest-context job)
    executor: 'kimi-k2.7-code',                                    // Kimi-2.7 (ollama-cloud coder) — co-best+RELIABLE per bake-off; Sonnet fallback via CLAUDE_SEAT_MAP
    validator: 'sonnet',                                           // Claude verdict (stronger per-seat than open deepseek for hard work)
    auditor: 'opus',                                               // Opus final auditor (sharpest judgment on difficult work)
    witness: 'opus',                                               // Opus per-step witness (catch bad steps early) — producer(glm)!=verifier(Claude), diversity preserved
  },
  'gemini-heavy': {
    // ALL SIX SEATS route to gemini-3-flash-preview. The architects seat uses three
    // identical preview instances so the entire phase-1 panel, synthesis, execution,
    // verdict, and smell-test are driven by the same Gemini model.
    architects: ['gemini-3-flash-preview', 'gemini-3-flash-preview', 'gemini-3-flash-preview'],
    integrator: 'gemini-3-flash-preview',
    executor: 'gemini-3-flash-preview',
    validator: 'gemini-3-flash-preview',
    auditor: 'gemini-3-flash-preview',
    witness: 'gemini-3-flash-preview',
  },
};

// resolveMode(modeName) -> the seat table for that mode, or NULL for absent/unknown (safe
// default: consumers fall back to their own hardcoded seats = today's behavior, byte-for-byte).
export function resolveMode(modeName) {
  if (!modeName || typeof modeName !== 'string') return null;
  return TABLE[modeName] || null;
}

// readMode() -> the ACTIVE mode name. Precedence: MUEZZIN_MODE env (operator override) >
// route file `mode` field > null (default). A bad/unknown value anywhere falls through to
// null so the engine never hard-fails on a typo — it just runs today's seats.
// readFn injectable for the offline selftest (no real file read).
export function readMode(env = process.env, readFn = () => readFileSync(ROUTE_FILE, 'utf8')) {
  const envMode = env.MUEZZIN_MODE;
  if (envMode && MODES.includes(envMode)) return envMode;
  if (envMode) return null;   // an env value that is set but invalid -> default (never a silent wrong mode)
  try {
    const r = JSON.parse(readFn());
    if (r && typeof r.mode === 'string' && MODES.includes(r.mode)) return r.mode;
  } catch { /* absent/invalid route file -> default */ }
  return null;
}

// activeSeats() -> the resolved seat table for the active mode, or null (default).
// One call the consumers make: const seats = activeSeats(); seats?.architects ?? <today's default>.
export function activeSeats(env = process.env, readFn) {
  return resolveMode(readMode(env, readFn));
}

// pickSeat(role, fallbackModel, env, readFn) -> the model name for one seat under the active
// mode, or fallbackModel if no mode / the mode doesn't name that role. The single-seat
// convenience the executor/witness/verdict sites use so a missing role degrades cleanly.
export function pickSeat(role, fallbackModel, env = process.env, readFn) {
  const seats = activeSeats(env, readFn);
  const v = seats?.[role];
  return (typeof v === 'string' && v) ? v : fallbackModel;
}

// pickArchitects(fallbackArr, fallbackInteg, env, readFn) -> { architects, integrator } for
// the active mode, or the passed fallbacks (today's PANEL defaults) when no mode is active.
export function pickArchitects(fallbackArr, fallbackInteg, env = process.env, readFn) {
  const seats = activeSeats(env, readFn);
  return {
    architects: (Array.isArray(seats?.architects) && seats.architects.length === 3) ? seats.architects : fallbackArr,
    integrator: (typeof seats?.integrator === 'string' && seats.integrator) ? seats.integrator : fallbackInteg,
  };
}

// ------------------------------------------------------------- OFFLINE selftest (no fetch, no file)
// `node seat_modes.mjs --selftest`: proves each mode resolves the right provider-CLASS per
// phase (architects->Claude in anthropic-heavy; ->ollama in local-heavy; executor->sonnet in
// anthropic-heavy) and that an unknown/absent mode -> today's behavior (null = use defaults).
if (process.argv[1]?.endsWith('seat_modes.mjs') && process.argv.includes('--selftest')) {
  let pass = 0, fail = 0;
  const ck = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got=${JSON.stringify(got)} want=${JSON.stringify(want)})`}`); ok ? pass++ : fail++; };
  const ckT = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? pass++ : fail++; };

  // provider-CLASS oracle: a Claude family name vs an ollama name (mirrors seat_dispatch's recognizer).
  const isClaude = (m) => /^(opus|sonnet|haiku|claude-)/i.test(String(m));
  const noRead = () => { throw new Error('route file must NOT be read when MUEZZIN_MODE is set'); };

  console.log('[selftest] MODES =', MODES.join(', '));

  // 1. BALANCE: architects all ollama-cloud, integrator ollama (Opus via map), executor ollama.
  {
    const s = resolveMode('balance');
    ckT('balance: 3 architects, NONE a Claude model (ollama-cloud, stretch Claude only at fallback)', s.architects.length === 3 && s.architects.every((m) => !isClaude(m)));
    ck('balance: executor = kimi-k2.7-code (2026-06-17: better-recorded than qwen, canon Phase-2 executor)', s.executor, 'kimi-k2.7-code');
    ckT('balance: witness = gemini-3-flash-preview (Google Gemini witness)', s.witness === 'gemini-3-flash-preview');
  }

  // 2. ANTHROPIC-HEAVY: architects = Claude opus/sonnet/haiku; executor = sonnet; verdict = OPEN.
  {
    const s = resolveMode('anthropic-heavy');
    ck('anthropic-heavy: architects = the Claude outage panel opus/sonnet/haiku', s.architects, ['opus', 'sonnet', 'haiku']);
    ckT('anthropic-heavy: ALL 3 architects resolve to Claude (Claude IN the phases)', s.architects.every(isClaude));
    ck('anthropic-heavy: executor = sonnet (Sonnet EXECUTES)', s.executor, 'sonnet');
    ckT('anthropic-heavy: integrator = opus (Claude)', isClaude(s.integrator));
    ckT('anthropic-heavy: verdict panel is OPEN-weight (ollama CHECKS the Claude work — diversity)', !isClaude(s.validator) && !isClaude(s.auditor));
  }

  // 3. LOCAL-HEAVY: NO seat is a Claude PRIMARY anywhere (≈zero Claude); witness is local.
  {
    const s = resolveMode('local-heavy');
    ckT('local-heavy: NO architect is a Claude model (local+cloud ollama only)', s.architects.every((m) => !isClaude(m)));
    ckT('local-heavy: executor is NOT a Claude primary (the 4090 / cloud ollama)', !isClaude(s.executor));
    ckT('local-heavy: integrator + verdict + witness are all NON-Claude (≈zero Claude)', [s.integrator, s.validator, s.auditor, s.witness].every((m) => !isClaude(m)));
    ckT('local-heavy: witness = laguna-xs.2:q4_K_M (LOCAL, no Opus pull)', s.witness === 'laguna-xs.2:q4_K_M');
  }

  // 4. SAFE DEFAULT: unknown / absent mode -> null (consumers keep today's hardcoded seats).
  ck('unknown mode -> null (default = today behavior)', resolveMode('turbo'), null);
  ck('empty mode -> null', resolveMode(''), null);
  ck('undefined mode -> null', resolveMode(undefined), null);

  // 5. readMode precedence: env override > route file > null; invalid env -> default (never a silent wrong mode).
  ck('readMode: MUEZZIN_MODE=anthropic-heavy wins (route file NOT read)', readMode({ MUEZZIN_MODE: 'anthropic-heavy' }, noRead), 'anthropic-heavy');
  ck('readMode: MUEZZIN_MODE=local-heavy wins', readMode({ MUEZZIN_MODE: 'local-heavy' }, noRead), 'local-heavy');
  ck('readMode: invalid MUEZZIN_MODE -> null (default, not a guessed mode)', readMode({ MUEZZIN_MODE: 'bogus' }, noRead), null);
  ck('readMode: no env, route file mode=balance -> balance', readMode({}, () => JSON.stringify({ mode: 'balance' })), 'balance');
  ck('readMode: no env, route file with NO mode field -> null (today behavior)', readMode({}, () => JSON.stringify({ standing_prefer: ['x'] })), null);
  ck('readMode: no env, route file unknown mode -> null', readMode({}, () => JSON.stringify({ mode: 'turbo' })), null);
  ck('readMode: unreadable route file -> null (never crash)', readMode({}, () => { throw new Error('ENOENT'); }), null);

  // 6. pickSeat / pickArchitects degrade to the passed fallback when no mode is active.
  ck('pickSeat: no mode -> the fallback model (today default)', pickSeat('executor', 'qwen3-coder-next', {}, () => '{}'), 'qwen3-coder-next');
  ck('pickSeat: anthropic-heavy executor -> sonnet', pickSeat('executor', 'qwen3-coder-next', { MUEZZIN_MODE: 'anthropic-heavy' }, noRead), 'sonnet');
  ck('pickSeat: unknown role under a mode -> fallback', pickSeat('nonseat', 'FB', { MUEZZIN_MODE: 'balance' }, noRead), 'FB');
  {
    const fb = pickArchitects(['a', 'b', 'c'], 'INTEG', {}, () => '{}');
    ck('pickArchitects: no mode -> passed fallbacks (PANEL defaults)', fb, { architects: ['a', 'b', 'c'], integrator: 'INTEG' });
    const ah = pickArchitects(['a', 'b', 'c'], 'INTEG', { MUEZZIN_MODE: 'anthropic-heavy' }, noRead);
    ck('pickArchitects: anthropic-heavy -> opus/sonnet/haiku + opus integrator', ah, { architects: ['opus', 'sonnet', 'haiku'], integrator: 'opus' });
  }

  // 7. GEMINI-HEAVY: every named seat maps to gemini-3-flash-preview.
  {
    const s = resolveMode('gemini-heavy');
    ck('gemini-heavy: architects = all gemini-3-flash-preview', s.architects, ['gemini-3-flash-preview', 'gemini-3-flash-preview', 'gemini-3-flash-preview']);
    ck('gemini-heavy: integrator = gemini-3-flash-preview', s.integrator, 'gemini-3-flash-preview');
    ck('gemini-heavy: executor = gemini-3-flash-preview', s.executor, 'gemini-3-flash-preview');
    ck('gemini-heavy: validator = gemini-3-flash-preview', s.validator, 'gemini-3-flash-preview');
    ck('gemini-heavy: auditor = gemini-3-flash-preview', s.auditor, 'gemini-3-flash-preview');
    ck('gemini-heavy: witness = gemini-3-flash-preview', s.witness, 'gemini-3-flash-preview');
    ck('readMode: MUEZZIN_MODE=gemini-heavy wins', readMode({ MUEZZIN_MODE: 'gemini-heavy' }, noRead), 'gemini-heavy');
    ck('pickSeat: gemini-heavy validator -> gemini-3-flash-preview', pickSeat('validator', 'FB', { MUEZZIN_MODE: 'gemini-heavy' }, noRead), 'gemini-3-flash-preview');
  }

  console.log(`[selftest] ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
