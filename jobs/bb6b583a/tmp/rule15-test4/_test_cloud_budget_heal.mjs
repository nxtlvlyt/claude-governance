// Proves the cloud-budget cut (M-ENGINE.RELIABILITY.1): a TIMEOUT cloud error fails over after
// exactly ONE extend-and-retry, while the FIXING heals (HTTP_400 ctx-drop, think:false retry)
// keep their original behavior. The waste was the timeout retry-storm (up to 4 cloud dispatches);
// the fixing heals are NOT waste and must survive.
import { healDispatch } from './seat_dispatch.mjs';

const E = (kind, msg = '') => ({ kind, message: msg });
let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

// ---------- 1. TIMEOUT: first heal extends, second fails over ----------
const body = { model: 'kimi-k2.6', max_tokens: 8192, options: {} };
const p1 = healDispatch(E('TIMEOUT', 'timeout 180000ms'), body, 0, {});                 // 0 prior timeouts
ck(p1 && p1.extendTimeout === true, 'TIMEOUT heal #1: extend+retry (one healing chance preserved)');
const p2 = healDispatch(E('TIMEOUT', 'timeout 360000ms'), body, 1, { TIMEOUT: 1 });     // 1 prior timeout
ck(p2 === null, 'TIMEOUT heal #2: returns null -> fails over (NO retry-storm)');

// ---------- 2. simulate the loop exactly (kindCounts increment AFTER decision) ----------
// mirrors dispatchWithWaterfall: plan = healDispatch(...); kindCounts[kind]++ ; null => break.
function simulate(errKindSeq, MAX = 3) {
  const kindCounts = {}; let extends_ = 0; let cloudDispatches = 1; // heal=0 is the first dispatch
  for (let heal = 0; heal <= MAX; heal++) {
    if (heal === MAX) break;
    const e = E(errKindSeq[Math.min(heal, errKindSeq.length - 1)]);
    const plan = healDispatch(e, body, heal, kindCounts);
    kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
    if (!plan) break;
    if (plan.extendTimeout && e.kind === 'TIMEOUT') extends_++;
    cloudDispatches++; // a heal that returns a plan triggers another cloud attempt
  }
  return { extends_, cloudDispatches };
}
const allTimeouts = simulate(['TIMEOUT', 'TIMEOUT', 'TIMEOUT', 'TIMEOUT']);
ck(allTimeouts.extends_ === 1, `all-TIMEOUT run: exactly 1 timeout-extend (was up to 3) — got ${allTimeouts.extends_}`);
ck(allTimeouts.cloudDispatches === 2, `all-TIMEOUT run: 2 cloud dispatches total (was up to 4) — got ${allTimeouts.cloudDispatches}`);

// ---------- 3. HTTP_400 ctx-drop STILL heals (FIXING heal preserved) ----------
const big = { model: 'kimi-k2.6', max_tokens: 8192, options: { num_ctx: 32768 } };
const p400 = healDispatch(E('HTTP_400', '400: context length exceeded'), big, 0, {});
ck(p400 && p400.body.options.num_ctx === 16384, `HTTP_400 ctx-drop still heals: num_ctx 32768 -> ${p400?.body?.options?.num_ctx}`);
// and it can heal AGAIN under the global budget (not per-kind capped)
const p400b = healDispatch(E('HTTP_400', '400: context length exceeded'), p400.body, 1, { HTTP_400: 1 });
ck(p400b && p400b.body.options.num_ctx === 8192, `HTTP_400 ctx-drop heals AGAIN (not per-kind capped): -> ${p400b?.body?.options?.num_ctx}`);

// ---------- 4. think:false retry STILL heals (FIXING heal preserved) ----------
const pThink = healDispatch(E('EMPTY_CONTENT_THINKING', 'reasoning consumed budget'), body, 0, {});
ck(pThink && pThink.body.think === false && pThink.extendTimeout === true,
   `EMPTY_CONTENT_THINKING still heals: think=${pThink?.body?.think}, extend=${pThink?.extendTimeout}`);

// ---------- 5. message-pattern context error (no HTTP_400 kind) STILL heals ----------
const pMsg = healDispatch(E('API_ERROR', 'num_ctx too long, exceed maximum'), big, 0, {});
ck(pMsg && pMsg.body.options.num_ctx === 16384, 'context error via MESSAGE pattern still ctx-drops');

// ---------- 6. HTTP_404 model-suffix fix STILL heals ----------
const p404 = healDispatch(E('HTTP_404', 'unknown model'), { model: 'kimi-k2.6:cloud', options: {} }, 0, {});
ck(p404 && p404.body.model === 'kimi-k2.6', `HTTP_404 model-suffix fix still heals: -> ${p404?.body?.model}`);

// ---------- 7b. HTTP_503 saturation heal (2026-07-03: eval saturated Ollama; gpx.S2 burned both attempts) ----------
const p503 = healDispatch(E('HTTP_503', '503: server busy, please try again. maximum pending requests'), body, 0, {});
ck(p503 && p503.waitMs === 5000 && p503.body === body, `HTTP_503 saturation: backoff heal (waitMs=${p503?.waitMs}), never a burned attempt`);
const p503msg = healDispatch(E('API_ERROR', 'server busy, please try again'), body, 1, {});
ck(p503msg && p503msg.waitMs === 20000, `server-busy via MESSAGE pattern heals with growing backoff (waitMs=${p503msg?.waitMs})`);

// ---------- 7. WEEKLY-QUOTA circuit breaker (audit 2026-07-02: 92 repeats over 31h) ----------
// A 429 naming the WEEKLY usage limit is an unhealable wall — backoff seconds cannot heal a
// weekly reset. First hit must return null (immediate failover), never a backoff plan.
const pWk = healDispatch(E('HTTP_429', '429: you have reached your weekly usage limit for qwen3.6'), body, 0, {});
ck(pWk === null, 'HTTP_429 weekly-limit: null on FIRST hit (no backoff against a weekly wall)');
// ...while an ordinary transient 429 (rate spike, no weekly wording) still gets its backoff heal.
const pTr = healDispatch(E('HTTP_429', '429: too many requests'), body, 0, {});
ck(pTr && pTr.waitMs === 800 && pTr.body === body, `transient HTTP_429 still backs off: waitMs=${pTr?.waitMs}`);

console.log(fails === 0
  ? '\nCLOUD-BUDGET CUT OK — TIMEOUT fails over after 1 heal; every FIXING heal (ctx-drop, think:false, model-fix) preserved.'
  : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
