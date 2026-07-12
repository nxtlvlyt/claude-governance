// wudu_niyyah_gate.mjs — WUDU + NIYYAH enforcement gate for a seat result.
//
// A seat (see seat_dispatch.mjs) carries:
//   result._tools  = tool-trace array of { tool, args }, where for tool === 'file_read'
//                    args is a JSON string {"path": "..."} (sliced to ~140 chars by the dispatcher).
//   result.niyyah  = (optional) a declared-intention string.
//   result.content = (optional) seat text that may contain a '[DECLARED NIYYAH]' marker.
//
// This gate is the wudu+niyyah check before a verdict is trusted:
//   WUDU   — the seat must have actually READ (file_read) every path in requiredReads. The deed,
//            not the word: a read it never performed is a violation, mirroring the witness-trace
//            discipline in dispatchSeat (only observed file_read deeds count).
//   NIYYAH — when required, the seat must have DECLARED its intention (a non-empty result.niyyah,
//            or a '[DECLARED NIYYAH]' marker in result.content). Absence is a violation.
//
// Pure + synchronous. No I/O, no mutation of the input.

// Pull the path out of a file_read trace entry's args. args may be a JSON object already,
// or a JSON string {"path":...} (possibly truncated by the dispatcher's .slice(0,140)).
// Returns '' when no path can be recovered.
function readPathOf(entry) {
  if (!entry) return '';
  const a = entry.args;
  if (a && typeof a === 'object') return typeof a.path === 'string' ? a.path : '';
  if (typeof a !== 'string') return '';
  try {
    const obj = JSON.parse(a);
    return obj && typeof obj.path === 'string' ? obj.path : '';
  } catch {
    // Defensive: args was truncated mid-JSON (dispatcher slices to ~140 chars), so the path
    // value may have no closing quote. Capture from the opening quote to a closing quote OR
    // to end-of-string, then JSON-unescape the captured chunk. NOTE: a truncated path is a
    // PARTIAL path — characters sliced off cannot be recovered, so it will not exact-match a
    // longer required path. That is correct: the gate must not certify a read it cannot confirm.
    const m = a.match(/"path"\s*:\s*"((?:[^"\\]|\\.)*?)("|$)/);
    if (m) { try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; } }
    return '';
  }
}

// Collect the set of paths the seat actually read (file_read deeds in the tool trace).
function readsOf(result) {
  const tools = Array.isArray(result && result._tools) ? result._tools : [];
  const paths = new Set();
  for (const t of tools) {
    if (t && t.tool === 'file_read') {
      const p = readPathOf(t);
      if (p) paths.add(p);
    }
  }
  return paths;
}

function hasNiyyah(result) {
  if (!result) return false;
  if (typeof result.niyyah === 'string' && result.niyyah.trim() !== '') return true;
  if (typeof result.content === 'string' && result.content.includes('[DECLARED NIYYAH]')) return true;
  return false;
}

/**
 * Audit a seat result for wudu (required reads) and niyyah (declared intention).
 * @param {object} result - a seat result (carrying _tools, optional niyyah, optional content).
 * @param {object} [opts]
 * @param {string[]} [opts.requiredReads=[]] - absolute paths the seat MUST have file_read'd.
 * @param {boolean} [opts.requireNiyyah=true] - whether a declared intention is required.
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function auditSeat(result, { requiredReads = [], requireNiyyah = true } = {}) {
  const violations = [];

  // WUDU: every required path must appear as an actual file_read deed.
  const read = readsOf(result);
  for (const required of requiredReads) {
    if (!read.has(required)) {
      violations.push(`WUDU: required read not performed (no file_read of "${required}")`);
    }
  }

  // NIYYAH: intention must be declared when required.
  if (requireNiyyah && !hasNiyyah(result)) {
    violations.push(`NIYYAH: no declared intention (empty result.niyyah and no '[DECLARED NIYYAH]' marker in content)`);
  }

  return { ok: violations.length === 0, violations };
}

// --------------------------------------------------------------------------- offline self-test
if (process.argv[1] && process.argv[1].endsWith('wudu_niyyah_gate.mjs')) {
  let pass = 0, fail = 0;
  const check = (name, cond) => {
    if (cond) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}`); }
  };

  // Fixture paths only (this module does no I/O) — fork-jurisdiction names: the agy rulebook
  // and this fork's own STATE (fork intake 1, 2026-07-08).
  const REQ_A = 'C:/Users/marka/.agents/AGENTS.md';
  const REQ_B = 'C:/Users/marka/agy-muezzin/STATE.md';

  // helper: build a _tools entry as the dispatcher does (args = JSON string {"path":...})
  const readTrace = (p) => ({ tool: 'file_read', args: JSON.stringify({ path: p }) });

  // (1) read both required files AND has a niyyah -> ok:true
  const good = {
    _tools: [readTrace(REQ_A), readTrace(REQ_B), { tool: 'searxng_web_search', args: '{"query":"x"}' }],
    niyyah: 'I intend to audit the boundary check honestly against substrate.',
  };
  const rGood = auditSeat(good, { requiredReads: [REQ_A, REQ_B], requireNiyyah: true });
  check('clean seat (reads + niyyah) -> ok:true, no violations', rGood.ok === true && rGood.violations.length === 0);

  // niyyah via [DECLARED NIYYAH] marker in content instead of result.niyyah
  const goodMarker = {
    _tools: [readTrace(REQ_A)],
    content: 'Some reasoning...\n[DECLARED NIYYAH] to verify against open source before ruling.',
  };
  const rMarker = auditSeat(goodMarker, { requiredReads: [REQ_A], requireNiyyah: true });
  check('niyyah via [DECLARED NIYYAH] marker -> ok:true', rMarker.ok === true && rMarker.violations.length === 0);

  // (2) missing a required read -> violation (read A but not B)
  const missRead = {
    _tools: [readTrace(REQ_A)],
    niyyah: 'declared.',
  };
  const rMiss = auditSeat(missRead, { requiredReads: [REQ_A, REQ_B], requireNiyyah: true });
  check('missing required read -> ok:false', rMiss.ok === false);
  check('missing required read -> exactly the WUDU violation for B',
    rMiss.violations.length === 1 && rMiss.violations[0].includes(REQ_B) && rMiss.violations[0].startsWith('WUDU'));

  // (3) missing the niyyah -> violation (reads fine, no intention)
  const missNiyyah = {
    _tools: [readTrace(REQ_A), readTrace(REQ_B)],
    content: 'analysis without an intention declaration',
  };
  const rNoNiyyah = auditSeat(missNiyyah, { requiredReads: [REQ_A, REQ_B], requireNiyyah: true });
  check('missing niyyah -> ok:false', rNoNiyyah.ok === false);
  check('missing niyyah -> exactly the NIYYAH violation',
    rNoNiyyah.violations.length === 1 && rNoNiyyah.violations[0].startsWith('NIYYAH'));

  // empty niyyah string counts as absent
  const emptyNiyyah = { _tools: [readTrace(REQ_A)], niyyah: '   ' };
  const rEmpty = auditSeat(emptyNiyyah, { requiredReads: [REQ_A], requireNiyyah: true });
  check('whitespace-only niyyah -> ok:false (counts as absent)', rEmpty.ok === false && rEmpty.violations[0].startsWith('NIYYAH'));

  // (4) requiredReads=[] + requireNiyyah=false -> ok:true (nothing demanded)
  const rNone = auditSeat({ _tools: [] }, { requiredReads: [], requireNiyyah: false });
  check('no requirements (reads=[], niyyah=false) -> ok:true', rNone.ok === true && rNone.violations.length === 0);

  // defensive: a path that FITS within the 140-char dispatcher slice is recovered intact -> ok:true
  const fitsPath = 'C:/Users/marka/agy-muezzin/missions/_logs/STATUS-BOARD.md';
  const fitsArgs = JSON.stringify({ path: fitsPath }).slice(0, 140);
  const rFits = auditSeat({ _tools: [{ tool: 'file_read', args: fitsArgs }], niyyah: 'x' }, { requiredReads: [fitsPath], requireNiyyah: true });
  check('file_read args within slice -> path recovered intact -> ok:true', rFits.ok === true);

  // defensive: a path GENUINELY truncated by the slice yields a partial path -> exact-match fails
  // -> WUDU violation. The gate must NOT certify a read it cannot confirm covers the required path.
  const longPath = 'C:/Users/marka/agy-muezzin/missions/_logs/retro/some-very-long-governance-document-name-that-pushes-the-args-json-past-the-truncation-boundary.md';
  const truncated = { tool: 'file_read', args: JSON.stringify({ path: longPath }).slice(0, 140) };
  const rTrunc = auditSeat({ _tools: [truncated], niyyah: 'x' }, { requiredReads: [longPath], requireNiyyah: true });
  check('genuinely truncated file_read args -> partial path -> WUDU violation (ok:false)',
    rTrunc.ok === false && rTrunc.violations.length === 1 && rTrunc.violations[0].startsWith('WUDU'));
  // and the recovered partial is a non-empty clean prefix of the real path (no crash, no garbage)
  check('truncated path recovers a non-empty clean prefix (defensive parse, no crash)',
    readPathOf(truncated) !== '' && longPath.startsWith(readPathOf(truncated)));

  // defensive: missing/non-array _tools is handled, both required -> both WUDU violations
  const noTools = auditSeat({}, { requiredReads: [REQ_A], requireNiyyah: false });
  check('absent _tools -> WUDU violation, no crash', noTools.ok === false && noTools.violations.length === 1);

  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES PRESENT'}: ${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}
