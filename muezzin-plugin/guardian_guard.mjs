// guardian_guard.mjs — semantic groundedness gate (companion to citation_guard.mjs).
//
// citation_guard catches fabricated FILE citations deterministically. This catches the
// class it CAN'T: fabricated CONTENT claims — invented numbers, versions, names, stats —
// which seat_record.mjs:66-72 documents as having NO mechanical oracle (caught today only
// by the probabilistic witness). It runs IBM Granite Guardian 4.1 (local,
// granite4.1-guardian:8b) as a fast risk classifier: given the staged CONTEXT the seat
// HAD and the RESPONSE it wrote, decide whether every factual claim is supported.
//
// FAIL-SOFT + NON-BLOCKING by design: a new probabilistic gate must not halt missions on
// its own verdict. It surfaces a flag into the receipts (mission-events.jsonl) so the
// witness/operator can act; any transport error is swallowed (grounded:null, ran:false).
// Pure parser + injected dispatch = unit-testable without a live model. Promotion to a
// repair-trigger (like citation_guard) is a later, evidence-backed step.

// OPERATOR RULING 2026-06-26: local guardian model runs on nxtbeast, not the laptop.
// 2026-07-01: both env-overridable together -- the laptop's own Ollama pull of this model
// resolved under a DIFFERENT tag (ibm/granite4.1-guardian:8b, with the registry org prefix)
// than whatever bare tag nxtbeast has it under, confirmed by direct /api/tags comparison.
// Changing the URL without also correcting the model name 404s against the wrong target.
const GUARDIAN_MODEL = process.env.MUEZZIN_GUARDIAN_MODEL || 'granite4.1-guardian:8b';
const OLLAMA_URL = process.env.MUEZZIN_GUARDIAN_OLLAMA_URL || 'http://nxtbeast:11434/api/chat';

export const GUARDIAN_SYSTEM =
  'You are a groundedness checker. Given CONTEXT (the only sources available) and a ' +
  'RESPONSE, decide whether every factual claim in the RESPONSE is supported by the ' +
  'CONTEXT. Reply with <score>yes</score> if fully grounded, or <score>no</score> if it ' +
  'contains any unsupported or invented claim, then one short line naming the claim.';

// PURE: extract the guardian verdict from its (prose-wrapped) output. The model wraps a
// <score>yes|no</score> tag in prose (observed live 2026-06-14). Tag first; fall back to a
// leading bare yes/no. Returns { grounded: true|false|null, raw }. null = unparseable =
// "no signal" (never a block).
export function parseGuardianVerdict(text) {
  const t = String(text ?? '');
  const tag = t.match(/<score>\s*(yes|no)\s*<\/score>/i);
  if (tag) return { grounded: /yes/i.test(tag[1]), raw: t.replace(/\s+/g, ' ').trim().slice(0, 400) };
  const bare = t.trim().match(/^[^A-Za-z]*(yes|no)\b/i);
  if (bare) return { grounded: /yes/i.test(bare[1]), raw: t.replace(/\s+/g, ' ').trim().slice(0, 400) };
  return { grounded: null, raw: t.replace(/\s+/g, ' ').trim().slice(0, 400) };
}

// PURE: build the guardian user prompt from context + response (bounded — the verdict does
// not need the whole artifact, and a huge prompt risks the 8B model's context).
// CAP RAISED 2026-07-04 (Fable's own 2026-07-03 note, QUEUE.md: "identical class to the
// FIXED witness-truncation bug (witness went 12K->48K; guardian never followed)" — flagged,
// never landed, until this pass): 8000 chars alone was never the real ceiling. guardianDispatch
// serves this model at num_ctx:4096 TOKENS (below, raised alongside this) -- 8000 chars of
// context + 8000 chars of response already approached that limit before the model's own
// output had room. Raised together: num_ctx 4096->16384, maxCtx 8000->24000 (~6000 tokens),
// maxResp left at 8000 (~2000 tokens) -- ctx+resp+system prompt fits with headroom inside the
// new window. granite4.1-guardian:8b's native context is 131072 (verified via /api/show);
// 16384 is a deliberate 4x increase, not a max-out, since this model shares nxtbeast's VRAM
// with the same big-model contention this session's gap #10 work is about -- raising it
// further than needed would recreate the problem this session spent hours fixing elsewhere.
export function buildGuardianPrompt(contextText, responseText, { maxCtx = 24000, maxResp = 8000 } = {}) {
  const ctx = String(contextText ?? '').slice(0, maxCtx) || '(no context provided)';
  const resp = String(responseText ?? '').slice(0, maxResp);
  return `CONTEXT:\n${ctx}\n\nRESPONSE:\n${resp}`;
}

// real local dispatch to granite4.1-guardian (streaming-accumulate, bounded). Throws on
// transport error; the caller is fail-soft and swallows it.
export async function guardianDispatch(system, prompt, { model = GUARDIAN_MODEL, num_predict = 120, timeoutMs = 180000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        stream: true, think: false, options: { num_predict, temperature: 0, num_ctx: 16384 },
      }),
      signal: ctrl.signal,
    });
    let content = '', buf = '';
    const dec = new TextDecoder();
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let obj; try { obj = JSON.parse(line); } catch { continue; }
        content += obj?.message?.content ?? '';
        if (obj.done) return content;
      }
    }
    return content;
  } finally { clearTimeout(timer); }
}

// checkGroundedness(context, response, opts) -> { grounded, raw, ran }. dispatch injected
// for testability. Fail-soft: any throw -> { grounded: null, ran: false } (never blocks).
export async function checkGroundedness(contextText, responseText, { dispatch = guardianDispatch, system = GUARDIAN_SYSTEM } = {}) {
  try {
    const raw = await dispatch(system, buildGuardianPrompt(contextText, responseText));
    return { ...parseGuardianVerdict(raw), ran: true };
  } catch (e) {
    return { grounded: null, raw: `guardian-unavailable: ${String(e?.message).slice(0, 120)}`, ran: false };
  }
}

// ---- selftests: node guardian_guard.mjs  (MOCK dispatch — no live model) ----
if (process.argv[1] && process.argv[1].endsWith('guardian_guard.mjs')) {
  let pass = 0, fail = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

  // parser: the REAL prose-wrapped formats observed live 2026-06-14
  ck(parseGuardianVerdict('\n<score> yes </score> The response accurately reflects the context.').grounded === true, 'parse: prose-wrapped <score>yes</score> -> grounded true');
  ck(parseGuardianVerdict('\n<score> no </score> The response claims port 9090 which the context never states.').grounded === false, 'parse: prose-wrapped <score>no</score> -> grounded false');
  ck(parseGuardianVerdict('No. The value 42 is not in the context.').grounded === false, 'parse: bare leading "No" -> grounded false');
  ck(parseGuardianVerdict('yes, fully supported').grounded === true, 'parse: bare leading "yes" -> grounded true');
  ck(parseGuardianVerdict('the model rambled with no verdict token').grounded === null, 'parse: no verdict -> null (no signal, never a block)');
  ck(parseGuardianVerdict(null).grounded === null, 'parse: null input -> null, no throw');

  // prompt builder: bounded + labels present
  const p = buildGuardianPrompt('ctx here', 'resp here');
  ck(p.includes('CONTEXT:\nctx here') && p.includes('RESPONSE:\nresp here'), 'prompt: labels CONTEXT and RESPONSE present');
  ck(buildGuardianPrompt('x'.repeat(50000), 'y').length < 25000, 'prompt: context bounded at the raised 24000-char cap (no unbounded blowup)');

  // checkGroundedness with MOCK dispatch — grounded path
  const grounded = await checkGroundedness('port=8080', 'listens on 8080', { dispatch: async () => '<score>yes</score> matches' });
  ck(grounded.grounded === true && grounded.ran === true, 'check: mock grounded -> {grounded:true, ran:true}');
  // hallucinated path
  const hallu = await checkGroundedness('port=8080', 'listens on 9090', { dispatch: async () => '<score>no</score> 9090 invented' });
  ck(hallu.grounded === false && hallu.ran === true, 'check: mock hallucinated -> {grounded:false, ran:true}');
  // FAIL-SOFT: dispatch throws -> never blocks, ran:false
  const dead = await checkGroundedness('ctx', 'resp', { dispatch: async () => { throw new Error('ECONNREFUSED'); } });
  ck(dead.grounded === null && dead.ran === false, 'check: dispatch throw -> {grounded:null, ran:false} (fail-soft, no throw out)');

  console.log(`\n${fail ? fail + ' FAIL' : 'ALL PASS — guardian groundedness gate: parser + fail-soft check sound'}`);
  process.exit(fail ? 1 : 0);
}
