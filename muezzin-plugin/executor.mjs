// executor.mjs — the EXECUTOR SEAT (task #31). Implements ONE micro-action from the micro_queue:
// it reads the step's declared context_dependencies, asks the executor seat to emit the FULL contents
// of the step's single target file, extracts that code block, and WRITES it to disk.
//
// Division of labor (Directive 1 — substrate is truth; the keystone/engine writes the record, but the
// executor IS the producer half of a step's edit): the EXECUTOR writes the implementation file; the
// RUNNER (runner.mjs) then witnesses it via the step's validation_command and commits/rolls-back. The
// executor never self-certifies — it only produces the artifact; the runner's receipt is the deed.
//
// A micro-action (from deconstructor.mjs) =
//   { step_index, description, action_type, target_files, context_dependencies, validation_command }
//
// dispatch contract (seat_dispatch.mjs): dispatchSeat(seat, framing, { wantVerdict:false }) -> { content }.
// dispatch is injected for testability; the default is the real dispatchSeat.

import { readFileSync, mkdirSync, writeFileSync, statSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { dispatchSeat } from './seat_dispatch.mjs';
import { badalSelect } from './seat_record.mjs';
import { pickSeat } from './seat_modes.mjs';
import { resolveRepoTarget } from './mission_class.mjs';

// PROSE-TARGET PREDICATE (R2 de-dup, 2026-06-17): the single source of truth for "is this
// a prose/content target (.html/.md/.markdown/.txt) vs code/config?". Both the executor
// floor (route prose -> faithful seat) and orchestrate's escalation seat-picker keyed off a
// verbatim-duplicated /\.(html?|md|markdown|txt)$/i — two copies that could silently drift.
// One exported predicate, imported by both, makes drift impossible. Behavior is identical to
// the prior inline regex (same pattern, same /i flag, same String() coercion).
export function isProseTarget(p) {
  return /\.(html?|md|markdown|txt)$/i.test(String(p || ''));
}

// Read a context dependency. Relative = inside the sandbox; ABSOLUTE = allowed READ-ONLY
// (research-class missions read external sources like .agents/* — the validator only
// admits absolute paths in context_dependencies for research missions, never in targets).
// Missing/unreadable deps are surfaced inline (not fatal): the executor seat is told the
// dep could not be read rather than silently dropping it.
function readDep(cwd, rel) {
  try {
    const p = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
    // DIRECTORY dep (card-vanlife EISDIR receipt 2026-06-10): a directory is a valid
    // research source — give the seat its listing, not an error string.
    if (statSync(p).isDirectory()) {
      const entries = readdirSync(p, { withFileTypes: true })
        .map((d) => (d.isDirectory() ? `${d.name}/` : d.name)).slice(0, 200);
      return `<<directory listing of ${rel}>>\n${entries.join('\n')}`;
    }
    return readFileSync(p, 'utf8').slice(0, 30000);
  }
  catch (e) { return `<<unreadable: ${e.message}>>`; }
}

// Build the framing: the dependencies as labeled context, then the explicit instruction to output ONLY
// the FULL contents of the single target file in one code block (no prose, no diff, no partial edit).
function buildFraming(step, cwd) {
  const target = step.target_files?.[0];
  const deps = (step.context_dependencies || [])
    .map((rel) => `--- BEGIN ${rel} ---\n${readDep(cwd, rel)}\n--- END ${rel} ---`)
    .join('\n\n');
  const contextBlock = deps
    ? `CONTEXT DEPENDENCIES (read-only — for your reference while writing the target):\n\n${deps}\n\n`
    : 'CONTEXT DEPENDENCIES: none declared.\n\n';

  return [
    `You are implementing ONE micro-action from a validated micro_queue.`,
    `Step ${step.step_index}: ${step.description}`,
    `action_type: ${step.action_type}`,
    `validation_command (how this step will be witnessed): ${step.validation_command}`,
    ``,
    contextBlock +
    `TARGET FILE: ${target}`,
    ``,
    `Output ONLY the FULL, COMPLETE contents of ${target} in a SINGLE code block. ` +
    `Do not output a diff, a partial edit, prose, or explanation. ` +
    `The code block must be the entire file as it should exist on disk so that \`${step.validation_command}\` passes.`,
    ``,
    // Receipts 2026-06-10: seats emitted a niyyah/intent declaration instead of code
    // (get-upgrade), a source/failure_mode/work preamble instead of the deliverable
    // (sources-tools), and silently reduced an 8-requirement spec to 1. Name the
    // failure modes — generic "no prose" did not stop them.
    `YOUR OUTPUT IS THE LITERAL FILE BYTES. Automatic failures: ` +
    `(1) declaring intent (e.g. a "niyyah:" block) instead of the file's content; ` +
    `(2) meta-preamble in place of the deliverable's required sections; ` +
    `(3) silently covering fewer requirements than the step states — ONLY if the step demands more than one file's worth of content, output exactly "SPLIT-NEEDED: <reason>" instead. ` +
    `A dep marked <<unreadable>> means: author from what IS present; note that one gap inside the artifact.`,
    ``,
    // CONTINUATION PROTOCOL (2026-06-11: the dominant content-failure class is oversized
    // emissions — truncated mid-sentence, dropped final lines, or a smaller artifact
    // performed in place of the asked one. The sentinel makes truncation DETECTABLE in
    // code; the engine then continues the emission instead of failing the step.)
    `COMPLETION SENTINEL: the LAST line inside your code block must be exactly:\n` +
    `ARTIFACT-COMPLETE\n` +
    `The engine strips it before writing. It proves your emission finished rather than ` +
    `being cut off. If you near your output limit, STOP at a clean boundary — the engine ` +
    `will ask you to continue from where you stopped.`,
    ``,
    // ANTI-FABRICATION (2026-06-11: the witness repeatedly caught the executor INVENTING
    // component/package names and attaching fake file citations, and asserting things the
    // staged files never said. The witness is right; this targets the hallucination.)
    `GROUNDING — every factual claim must trace to text you ACTUALLY have: a staged dependency above, or a file you Read this dispatch. NEVER invent a name, version, component, package, or value. NEVER attach a citation to a file you did not open. If the goal asks for something the available files do not support, write "not evidenced in <files checked>" — do NOT fabricate it. A plausible invention is a FAILURE; an honest gap is correct.`,
  ].join('\n');
}

// Extract the deliverable's fenced code block body, returned VERBATIM (the newline before the
// closing fence is the file's terminating newline and is KEPT).
// LARGEST non-empty fence, NOT the first (root-cause receipt 2026-06-10: models returned real
// content — attempt-ok chars=6596 — yet wrote EMPTY files, because they led with a stray empty
// fence ```\n``` and the old first-match regex took it. Scanning all blocks and keeping the
// biggest defeats that: a leading empty/label fence can never shadow the real deliverable.)
export function extractCodeBlock(text) {
  const t = String(text ?? '');
  const re = /```[^\n]*\n([\s\S]*?)```/g;
  let best = null, m;
  while ((m = re.exec(t)) !== null) {
    const body = m[1];
    if (body && body.trim() && (best === null || body.length > best.length)) best = body;
  }
  // No non-empty fence = no artifact. A seat's refusal/explanation prose is NOT file content
  // (gr10 canary: "BLOCK — Discovery Gate Failed" was once written over a file). The caller's
  // empty-content guard also backstops this.
  return best;
}

// ---- CONTINUATION PROTOCOL helpers (emission-truncation class, 2026-06-11) ----
export const SENTINEL = 'ARTIFACT-COMPLETE';

// Detect + strip the completion sentinel: the artifact is complete iff its last
// non-whitespace line is exactly the sentinel. Returns { body, complete }.
export function stripSentinel(s) {
  const t = String(s ?? '');
  const m = t.match(/(?:^|\n)[ \t]*ARTIFACT-COMPLETE[ \t]*\s*$/);
  if (!m) return { body: t, complete: false };
  return { body: t.slice(0, m.index) + (m.index > 0 ? '\n' : ''), complete: true };
}

// Append a continuation, de-duplicating any overlap (models often re-emit the tail
// they were shown). Largest suffix of `a` that prefixes `b` is dropped from `b`.
export function joinContinuation(a, b) {
  const max = Math.min(a.length, b.length, 800);
  for (let k = max; k > 0; k--) {
    if (a.endsWith(b.slice(0, k))) return a + b.slice(k);
  }
  return a + b;
}

// ---- SEARCH/REPLACE EDIT PRIMITIVE (2026-06-15; deepseek-v3.2 cloud code-witnessed) ----
// ROOT FIX for code-repo 0/11: editing an EXISTING file by re-emitting it WHOLE fails on large
// files (truncation/empty-emission). In edit-mode the seat emits ONLY conflict-style blocks and
// the engine applies them deterministically + fail-closed — the model emits CHANGED bytes, not 44KB.
// \r?\n tolerates Windows line endings (witness-caught); empty REPLACE = deletion (allowed).
export function extractEditBlocks(text) {
  const re = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n?>>>>>>> REPLACE/g;
  const blocks = []; let m;
  while ((m = re.exec(String(text ?? ''))) !== null) blocks.push({ search: m[1], replace: m[2] });
  return blocks;
}

// Apply blocks deterministically. PRE-FLIGHT (witness fix): each search must be found AND UNIQUE in
// the ORIGINAL before any edit — uniqueness-only-in-current lets a prior edit shift a later match.
// Then apply sequentially. Empty replace = deletion. Any miss/ambiguity => fail-closed, NO write.
export function applyEditBlocks(orig, blocks) {
  for (const b of blocks) {
    if (b.search === '') return { ok: false, error: 'empty SEARCH block' };
    if (b.search.length > 1_000_000) return { ok: false, error: 'SEARCH block exceeds 1MB sanity cap' };
    const first = orig.indexOf(b.search);
    if (first === -1) return { ok: false, error: `SEARCH not found in original: ${JSON.stringify(b.search.slice(0, 60))}` };
    if (orig.indexOf(b.search, first + b.search.length) !== -1) return { ok: false, error: `SEARCH matches >1 place in original (ambiguous): ${JSON.stringify(b.search.slice(0, 60))}` };
  }
  let content = orig;
  for (const b of blocks) {
    const i = content.indexOf(b.search);
    if (i === -1) return { ok: false, error: `SEARCH vanished after a prior edit (overlapping blocks): ${JSON.stringify(b.search.slice(0, 60))}` };
    content = content.slice(0, i) + b.replace + content.slice(i + b.search.length);
  }
  return { ok: true, content };
}

// Edit-mode framing: show the seat the CURRENT file + ask for SEARCH/REPLACE blocks ONLY.
// EDIT-DISCIPLINE HARDENING (2026-06-15, engine-badal proof receipt): the primitive ENGAGED
// and fail-closed correctly, but the seat (kimi-k2.6 especially) emitted OVERLAPPING /
// non-unique / over-padded SEARCH blocks, so applyEditBlocks fail-closed ("SEARCH vanished
// after a prior edit (overlapping blocks)" / ">1 place (ambiguous)"). The cure is FRAMING,
// not parser changes: state the block-discipline rules explicitly AND show one correct
// few-shot block + the common mistakes, so the seat emits CLEAN, MINIMAL, NON-OVERLAPPING,
// UNIQUE blocks. These discipline phrases are asserted by selftest (do not silently drop them).
// EXPORTED so the selftest can assert the discipline phrases are present (no behavior change).
const EDIT_FULL_FILE_MAX_BYTES = 180000;  // files larger than this are WINDOWED for edit (model-context guard)

// WINDOWED-EDIT helper (M-ENGINE.WINDOWED-EDIT-LARGE-FILE, bootstrap hand-apply 2026-06-16, laguna-reviewed):
// return only the +/-40-line regions around step-derived anchor terms (merged, budget-capped), or null if no
// anchor locates a region (caller then fails honestly — never a silent whole-file send). applyEditBlocks still
// validates SEARCH against the FULL original, so edit correctness / fail-closed is unchanged.
export function windowLargeFileForEdit(current, step, maxBytes = EDIT_FULL_FILE_MAX_BYTES) {
  if (!current) return null;
  const lines = current.split('\n');
  if (!lines.length) return null;
  const STOP = new Set(['const', 'function', 'export', 'return', 'this', 'that', 'with', 'from', 'file', 'code', 'step', 'edit', 'search', 'replace', 'target', 'validation', 'command', 'description', 'exist', 'exists']);
  const terms = [...new Set(((step?.description || '') + ' ' + (step?.validation_command || '')).match(/[A-Za-z_][\w-]{3,}/g) || [])]
    .filter((t) => !STOP.has(t.toLowerCase()));
  const WIN = 40, ranges = [];
  for (const a of terms) { const i = lines.findIndex((l) => l.includes(a)); if (i !== -1) ranges.push([Math.max(0, i - WIN), Math.min(lines.length - 1, i + WIN)]); }
  if (!ranges.length) return null;
  ranges.sort((x, y) => x[0] - y[0]);
  const merged = [ranges[0]];
  for (const [s, e] of ranges.slice(1)) { const last = merged[merged.length - 1]; if (s <= last[1] + 1) last[1] = Math.max(last[1], e); else merged.push([s, e]); }
  let out = '', bytes = 0;
  for (const [s, e] of merged) {
    const c = `--- lines ${s + 1}-${e + 1} of ${lines.length} ---\n` + lines.slice(s, e + 1).join('\n') + '\n';
    if (out && bytes + c.length > maxBytes) break;   // first (most-relevant) window always shows; budget-bound the rest
    out += c; bytes += c.length;
  }
  return out || null;
}

export function buildEditFraming(step, cwd, current) {
  const deps = (step.context_dependencies || [])
    .map((rel) => `--- BEGIN ${rel} ---\n${readDep(cwd, rel)}\n--- END ${rel} ---`).join('\n\n');
  const contextBlock = deps ? `CONTEXT DEPENDENCIES (read-only):\n\n${deps}\n\n` : '';
  // WINDOWED-EDIT: a file larger than a model's context can't be embedded whole (HTTP 400 prompt-too-long).
  // Show only the regions the edit needs to anchor against; correctness is preserved by applyEditBlocks.
  let shown = current, windowNote = '';
  if (typeof current === 'string' && current.length > EDIT_FULL_FILE_MAX_BYTES) {
    const win = windowLargeFileForEdit(current, step);
    if (win === null) return `EDIT ABORTED: ${step.target_files?.[0]} is ${current.length} bytes (over the ${EDIT_FULL_FILE_MAX_BYTES}-byte edit budget) and no anchor term from the step located an editable region. Cannot window for edit — failing honestly.`;
    shown = win;
    windowNote = `NOTE: ${step.target_files?.[0]} is large (${current.length} bytes); only the regions relevant to this edit are shown below (with line-range markers). Your SEARCH text MUST be copied verbatim from a shown region; the engine validates SEARCH uniqueness against the WHOLE file.\n`;
  }
  return [
    `You are EDITING an existing file via SEARCH/REPLACE blocks (do NOT re-emit the whole file).`,
    `Step ${step.step_index}: ${step.description}`,
    `validation_command (how this step is witnessed): ${step.validation_command}`,
    ``,
    windowNote + contextBlock + `CURRENT CONTENTS of ${step.target_files?.[0]} (edit against THIS exact text):`,
    '```',
    shown,
    '```',
    ``,
    `Output ONLY one or more edit blocks in EXACTLY this format (no prose, no full file, no code fence):`,
    `<<<<<<< SEARCH`,
    `(verbatim bytes that currently exist in the file — enough to be UNIQUE)`,
    `=======`,
    `(the replacement bytes)`,
    `>>>>>>> REPLACE`,
    ``,
    // BLOCK-DISCIPLINE RULES — the engine applies these blocks DETERMINISTICALLY and
    // FAIL-CLOSES (writes NOTHING) if any rule is broken. A broken block does not "mostly
    // work" — it discards the WHOLE edit. Obey every rule:
    `RULES (each one is enforced; breaking any one discards the entire edit and writes nothing):`,
    `1. UNIQUE: each SEARCH text must appear EXACTLY ONCE in the current file above. If your chosen text appears more than once, ADD adjacent lines until the whole SEARCH is unique. If it appears zero times, you copied it wrong.`,
    `2. VERBATIM: copy the SEARCH bytes EXACTLY from the file above — same indentation, same whitespace, same line endings. Do not retype from memory, do not reformat, do not "fix" spacing.`,
    `3. MINIMAL: include only as many lines as you need to be unique — just the line(s) you are changing plus the minimum surrounding context. Do NOT paste large regions you are not editing.`,
    `4. NON-OVERLAPPING: the SEARCH regions of two different blocks must not share any text. If two changes are close together, MERGE them into ONE block whose SEARCH spans both. Overlapping blocks are the #1 cause of a discarded edit.`,
    `5. ONE LOGICAL CHANGE PER BLOCK: one edit = one block. Keep blocks small and independent.`,
    `6. DELETION: to delete code, copy it into SEARCH and leave the REPLACE side EMPTY (nothing between ======= and >>>>>>> REPLACE).`,
    ``,
    // FEW-SHOT — a correct block, then the three failures the parser rejects. Concrete
    // examples close the gap that abstract rules alone left open (engine-badal receipt).
    `EXAMPLE — suppose the file contains the line \`  const max = 3;\` exactly once. To change the 3 to a 1, the CORRECT block is:`,
    `<<<<<<< SEARCH`,
    `  const max = 3;`,
    `=======`,
    `  const max = 1;`,
    `>>>>>>> REPLACE`,
    ``,
    `COMMON MISTAKES THAT GET YOUR EDIT DISCARDED (do not do these):`,
    `- NON-UNIQUE: SEARCH of just \`3;\` — appears in many places, ambiguous, rejected. Include the whole line.`,
    `- OVERLAPPING: two blocks whose SEARCH texts both contain the line \`  const max = 3;\` — the second can no longer be found after the first applies, rejected. Merge them into one block.`,
    `- TOO MUCH CONTEXT: pasting 40 unchanged lines around a 1-line change — wasteful and more likely to mis-copy. Keep it minimal.`,
    ``,
    `Emit only the change(s) that make \`${step.validation_command}\` pass.`,
  ].join('\n');
}

// implementStep(step, cwd, opts) -> { ok, path, bytes, framing, content }.
// (a) reads each context dependency from cwd; (b) builds the "emit the full target file" framing;
// (c) dispatches the EXECUTOR seat (role 'executor') via the injected dispatch; (d) extracts the code
// block and writes it to path.join(cwd, step.target_files[0]) (mkdir -p the parent dir).
export async function implementStep(step, cwd, { dispatch = dispatchSeat, model = null, today = '2026-06-09', maxContinuations = Number(process.env.MUEZZIN_MAX_CONTINUATIONS) || 6, codeRepo = false, repoRoot = null, allowFiles = [] } = {}) {
  const target = step?.target_files?.[0];
  if (!target) return { ok: false, error: 'step has no target_files[0] to write' };

  // BADAL SWITCH (dispatch-time, 2026-06-11): unless a model is explicitly forced, the
  // emission seat is chosen from the track record — a disqualified default escalates to
  // a PROVEN proxy only; an untested candidate is never promoted (badal rule).
  // DEFAULT SEAT: kimi-k2.7-code (seated 2026-06-14 for audition — token-efficient SOTA
  // coder; +21.8% Kimi Code Bench v2, ~30% fewer reasoning tokens vs K2.6). It runs as
  // default with an EMPTY record; once it earns passes and its weighted-strike ratio
  // crosses 0.5, badal escalates to the proven floor (qwen3-coder-next, ratio 0.40 on
  // 2026-06-14). REVERT: change both strings below back to 'qwen3-coder-next'.
  let badal = null;
  if (!model) {
    // REVERTED to the proven floor 2026-06-15 (operator direction): kimi-k2.7-code (auditioning
    // 2026-06-14) produced EMPTY_CONTENT_THINKING + TOOL_LOOP_CAP this session and did not deliver
    // completions; the right move per the badal principle is the proven floor, not an Opus escalation.
    // SEATING MODE (seating-modes build, 2026-06-15): the active mode picks the executor FLOOR —
    // anthropic-heavy -> 'sonnet' (Sonnet executes), local-heavy -> a local coder, balance ->
    // today's 'qwen3-coder-next'. No mode / unknown mode -> 'qwen3-coder-next' (safe default,
    // byte-for-byte). badal still escalates ON TOP of this floor from the track record (the
    // mode sets which seat is the floor; badal's reliability rule is unchanged). An explicit
    // `model` arg (tests, code-repo e2e) still wins — this path runs only when !model.
    // PROSE-FAITHFUL FLOOR (2026-06-17; guardian+laguna APPROVE): content-FABRICATION (guides invented topics, about invented
    // stats) traced to CODE models (qwen/kimi) authoring PROSE. seat-record: sonnet emission = 0 fab; qwen 5, kimi 2. Route PROSE
    // targets (.html/.md/.txt) to the faithful seat (sonnet) — removes the fabrication surface for content; CODE/config emission
    // stays on the local coder (kimi via the mode) to conserve Claude budget. Per-seat record auto-separates prose vs code quality.
    const proseTarget = isProseTarget(step.target_files?.[0]);
    const floor = proseTarget ? 'sonnet' : pickSeat('executor', 'kimi-k2.7-code');
    try { badal = badalSelect(path.join(path.dirname(cwd), '_logs', 'seat-record.json'), 'emission', floor); model = badal.model; }
    catch { model = floor; }
  }
  // CODE-REPO (Foundation 0.4): deps + the Read-tool root live in the REPO-ROOT, not the
  // sandbox cwd — the executor authors against the real project tree. Sandbox/research keep
  // cwd unchanged (byte-for-byte prior behavior).
  const readBase = codeRepo && repoRoot ? repoRoot : cwd;
  const seat = { role: 'executor', model, today, cwd: readBase };  // cwd → Claude-tier Read tool root

  // CODE-REPO SOURCE-DEP GUARD (2026-06-17 root-cause fix; laguna APPROVE): the silent
  // "empty-emission/fabrication gremlin" traced to the executor AUTHORING BLIND when a declared
  // context_dependency could not be read from readBase. Receipt: migrate-about-1 step 2 — the seat
  // emitted "No about.php found at expected paths ... active discovery failed" (766 chars of prose,
  // 0 fenced blocks) → logged as empty → heal fabricated. The OUTPUT guard (below) never checked the
  // INPUTS were readable. Fail CLOSED with a precise receipt (readBase + which dep) instead of letting
  // the seat hallucinate a source it never received. Gated on codeRepo (research/sandbox unchanged).
  if (codeRepo && (step.context_dependencies || []).length) {
    const depReport = (step.context_dependencies || []).map((rel) => {
      const txt = readDep(readBase, rel);
      const bad = (typeof txt !== 'string') || txt.startsWith('<<unreadable') || !txt.trim();
      return { rel, bytes: bad ? 0 : txt.length, bad };
    });
    process.stderr.write(`executor dep-check readBase=${readBase} :: ` + depReport.map((d) => `${d.rel}=${d.bad ? 'MISSING' : d.bytes + 'b'}`).join(', ') + '\n');
    const missing = depReport.filter((d) => d.bad);
    if (missing.length) {
      return { ok: false, error: `code-repo source dependency unreadable at readBase=${readBase}: ${missing.map((m) => m.rel).join(', ')} — refusing to author blind (the silent-fabrication root cause: the seat never received this source). Fix the dep path or stage the file before authoring.` };
    }
  }

  // EDIT-MODE BRANCH (search/replace primitive, 2026-06-15): for a codeRepo EDIT of a file that
  // EXISTS, emit only SEARCH/REPLACE blocks and apply them deterministically — the cure for the
  // whole-file-emission wall (code-repo 0/11). New-file create + non-edit + sandbox/research fall
  // THROUGH to the UNCHANGED whole-file path below (byte-for-byte prior behavior).
  if (codeRepo && repoRoot && step.action_type === 'edit') {
    const rt = resolveRepoTarget(repoRoot, allowFiles, target);
    if (rt.ok && existsSync(rt.absPath)) {
      let orig;
      try { orig = readFileSync(rt.absPath, 'utf8'); }
      catch (e) { return { ok: false, error: `edit-mode: cannot read existing target ${target}: ${e.message}` }; }
      // FULL-RE-AUTHOR ESCAPE (2026-06-17; laguna APPROVE; receipt migrate-about-1 FAILED x2: "edit-mode: seat emitted no
      // SEARCH/REPLACE blocks ... raw 30606 chars"). SEARCH/REPLACE edit-mode is for SURGICAL edits and LARGE files. A step
      // whose intent is a FULL re-author of a SMALL existing file ("author/render the fully-evaluated ... complete in ONE
      // pass") makes the seat correctly emit the WHOLE file, not blocks -> 0 blocks -> fail-closed. For a small file
      // (<= EDIT_FULL_FILE_MAX_BYTES, where whole-file emission is safe) with full-author intent, fall through to the
      // WHOLE-FILE path below. Large files (> threshold) ALWAYS stay in edit-mode (never whole-emit). Dual guard (size AND
      // intent) keeps surgical edits of small files in edit-mode; surgical language (change/add/fix/update X) does NOT match.
      const fullReauthorIntent = /\b(?:author|render|rewrite|re-?write|regenerate|recreate|rebuild|fully[- ]evaluated|from scratch|entire file|complete(?:ly)?\s+(?:static\s+)?(?:render|rewrite|re-?author)|in ONE pass)\b/i.test(String(step.description || ''));
      const wholeFileSafe = orig.length <= EDIT_FULL_FILE_MAX_BYTES;
      if (!(fullReauthorIntent && wholeFileSafe)) {
        const editFraming = buildEditFraming(step, readBase, orig);
        const er = await dispatch(seat, editFraming, { wantVerdict: false });
        const blocks = extractEditBlocks(er?.content);
        if (!blocks.length) return { ok: false, error: `edit-mode: seat emitted no SEARCH/REPLACE blocks for ${target} (raw ${String(er?.content ?? '').length} chars) — refusing to write (fail-closed, no whole-file fallback)` };
        const applied = applyEditBlocks(orig, blocks);
        if (!applied.ok) return { ok: false, error: `edit-mode: ${applied.error} — write refused (fail-closed)` };
        writeFileSync(rt.absPath, applied.content, 'utf8');
        return { ok: true, path: rt.absPath, bytes: Buffer.byteLength(applied.content, 'utf8'), framing: editFraming, content: applied.content, mode: 'edit', editBlocks: blocks.length, model, escalated: badal?.escalated || false };
      }
      // full re-author of a small existing file → fall through to the whole-file path below
    }
    // target absent or not-allowlisted → fall through to whole-file path (create, or its own containment refusal)
  }

  const framing = buildFraming(step, readBase);

  const r = await dispatch(seat, framing, { wantVerdict: false });
  const content = extractCodeBlock(r?.content);
  // EMPTY-ARTIFACT GREMLIN — FOUND IN CODE 2026-06-10: extractCodeBlock returns '' (an
  // EMPTY STRING, not null) for an empty fenced block ```\n``` — and `content == null`
  // is false for '', so the old guard let a ZERO-BYTE FILE be written (then the witness
  // correctly rejected it, costing a whole cycle to learn nothing). Treat empty/whitespace
  // as no-artifact, same as no-fence, and SURFACE what the seat actually emitted so the
  // cause is a receipt, not a mystery.
  if (content == null || !content.trim()) {
    const head = String(r?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    // BLOCK-CENSUS (CLASS 2, additive): distinguish "0 fenced blocks" (the seat wrote
    // prose/refusal, no code block at all) from "N blocks, largest 0 chars" (the seat
    // emitted only empty/whitespace fences). The cause is then a receipt, not a guess —
    // the witness-halt that follows no longer hides WHY the emission was unusable.
    const raw = String(r?.content ?? '');
    let blockCount = 0, largest = 0, mm;
    const reCensus = /```[^\n]*\n([\s\S]*?)```/g;
    while ((mm = reCensus.exec(raw)) !== null) { blockCount++; if (mm[1].length > largest) largest = mm[1].length; }
    return { ok: false, error: `seat produced NO usable file content (${blockCount} fenced block(s) seen, largest ${largest} chars) — refusing to write an empty artifact (deeds-not-claims). Raw seat output (${raw.length} chars): "${head || '(completely empty)'}"` };
  }

  // SPLIT-NEEDED handled in CODE (the framing has ordered it since 2026-06-10, but nothing
  // code-side caught it — a fenced "SPLIT-NEEDED: ..." would have been WRITTEN AS THE FILE
  // and burned a witness cycle). An explicit refusal is a planning signal, not an artifact.
  if (/^\s*SPLIT-NEEDED:/i.test(content)) {
    return { ok: false, error: `SPLIT-NEEDED (seat refused oversize single emission): ${content.trim().slice(0, 250)} — re-plan this step as part-files.` };
  }

  // CONTINUATION LOOP (emission-truncation class — the dominant content failure: 13
  // "incomplete" + truncated-mid-sentence + dropped-final-lines receipts). No sentinel =
  // the emission was cut off; instead of failing the step (or worse, writing a silently
  // incomplete artifact for the witness to spend a cycle rejecting), the engine shows the
  // seat its own tail and asks for the REMAINING bytes, up to maxContinuations rounds.
  let { body, complete } = stripSentinel(content);
  let rounds = 0;
  while (!complete && rounds < maxContinuations) {
    rounds++;
    const tail = body.slice(-800);
    const contFraming =
      `You were emitting the COMPLETE contents of ${target} and your output was CUT OFF mid-emission.\n` +
      `The last bytes you produced were:\n\`\`\`\n${tail}\n\`\`\`\n` +
      `Continue EXACTLY from the cut point. Output ONLY the REMAINING bytes of the file in a single code block — ` +
      `do NOT repeat bytes already emitted, do NOT restart the file. ` +
      `End with the line ${SENTINEL} as the last line inside the block. ` +
      `If the file was ALREADY complete, output a code block containing ONLY the line ${SENTINEL}.`;
    const cr = await dispatch(seat, contFraming, { wantVerdict: false });
    const cBody = extractCodeBlock(cr?.content);
    if (cBody == null) break;                       // continuation refused/empty — stop, fail below with receipt
    const s = stripSentinel(cBody);
    if (s.body.trim()) body = joinContinuation(body, s.body);
    complete = s.complete;
  }
  if (!complete) {
    return { ok: false, error: `EMISSION-TRUNCATED: no ${SENTINEL} sentinel after ${rounds} continuation round(s) — refusing to write a possibly-incomplete artifact (${Buffer.byteLength(body, 'utf8')} bytes so far). The step is likely oversized: re-plan as part-files.` };
  }
  const finalContent = body;

  // INTENT-HEADER SHAPE REFUSAL (4b receipt 2026-06-11 18:29: the class fired through THE
  // PRIMARY EXECUTOR door while the repair-side guard was live — same tell, second door.
  // A niyyah/work-block opening (source:/failure_mode:/work: fields) is the seat performing
  // ceremony absorbed from framings, never the artifact. Refuse with a named error so the
  // repair/badal path gets a precise receipt instead of the witness burning a cycle.)
  const head = finalContent.trim().slice(0, 400);
  if (/^\s*(#+ )?(niyyah|repair[- ]inten\w*)\b/i.test(head) || (/^\s*source\s*:/im.test(head) && /^\s*failure[_ ]?mode\s*:/im.test(head) && /^\s*work\s*:/im.test(head)))
    return { ok: false, error: `INTENT-INSTEAD-OF-ARTIFACT: emission opens with the seat's own intention fields (niyyah/source/failure_mode/work), not ${target}'s content — write refused` };

  // PATH CONTAINMENT (fail-closed, defense-in-depth behind the validator).
  // CODE-REPO branch (Foundation 0.4, ADDITIVE): a code-repo mission writes a REAL file
  // into the declared REPO-ROOT, so the write path is resolved by the never-weaken kernel
  // (resolveRepoTarget) — under root, allowlisted, no '..'/.git/secret. The DEFAULT branch
  // below (sandbox/research) is byte-for-byte the prior behavior: the resolved path must
  // stay inside the mission sandbox cwd (an absolute/traversal target escapes rollback +
  // witness — found live: gr10-rebuild canary, 2026-06-09).
  let outPath;
  if (codeRepo) {
    const r = resolveRepoTarget(repoRoot, allowFiles, target);
    if (!r.ok) return { ok: false, error: `path containment violation (code-repo) — ${r.reason}; write refused` };
    outPath = r.absPath;
  } else {
    outPath = path.resolve(cwd, target);
    const sandboxRoot = path.resolve(cwd) + path.sep;
    if (!outPath.startsWith(sandboxRoot))
      return { ok: false, error: `path containment violation — '${target}' resolves outside the mission sandbox (${outPath}); write refused` };
  }
  mkdirSync(path.dirname(outPath), { recursive: true });   // mkdir -p the parent
  writeFileSync(outPath, finalContent, 'utf8');

  return { ok: true, path: outPath, bytes: Buffer.byteLength(finalContent, 'utf8'), framing, content: finalContent, continuations: rounds, model, escalated: badal?.escalated || false };
}

// --------------------------------------------------------------------------- self-test (OFFLINE, argv-guarded)
if (process.argv[1]?.endsWith('executor.mjs')) {
  const fs = await import('fs'); const os = await import('os');
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'executor_test_'));

  // a context dependency the executor should be able to read and have folded into the framing.
  const DEP_REL = 'lib/dep.mjs';
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, DEP_REL), 'export const SECRET = 42;\n', 'utf8');

  // the KNOWN code block the MOCK dispatch will return as the executor seat's output.
  const KNOWN = "import { SECRET } from './dep.mjs';\nexport const doubled = SECRET * 2;\n";

  let seenSeat = null, seenFraming = null, seenOpts = null;
  const mockDispatch = async (seat, framing, opts) => {
    seenSeat = seat; seenFraming = framing; seenOpts = opts;
    return { content: 'Here is the file you asked for:\n\n```js\n' + KNOWN + 'ARTIFACT-COMPLETE\n```\nDone.' };
  };

  // target lives in a NOT-YET-EXISTING subdir to prove mkdir -p.
  const step = {
    step_index: 1,
    description: 'write the doubled module',
    action_type: 'edit',
    target_files: ['src/nested/out.mjs'],
    context_dependencies: [DEP_REL],
    validation_command: 'node -c src/nested/out.mjs',
  };

  const res = await implementStep(step, dir, { dispatch: mockDispatch });

  ck(res.ok === true, 'implementStep reports ok');
  ck(seenSeat?.role === 'executor', "dispatched the EXECUTOR seat (role 'executor')");
  ck(seenOpts?.wantVerdict === false, 'dispatched with { wantVerdict:false } (content mode, no verdict)');
  ck(seenFraming?.includes('export const SECRET = 42;'), 'framing INCLUDES the context dependency content');
  ck(seenFraming?.includes('src/nested/out.mjs'), 'framing names the target file');

  const outPath = path.join(dir, 'src/nested/out.mjs');
  ck(fs.existsSync(outPath), 'target file was created (mkdir -p the new parent dir worked)');
  const written = fs.readFileSync(outPath, 'utf8');
  ck(written === KNOWN, 'wrote the EXACT extracted code-block content (no fences, no surrounding prose)');
  ck(res.path === outPath, 'returned path matches path.join(cwd, target)');

  // unit check on the extractor itself: fences + surrounding prose are stripped; the body (incl. its
  // trailing newline, the last line's terminator) is preserved verbatim.
  ck(extractCodeBlock('pre\n```python\nX=1\n```\npost') === 'X=1\n', 'extractCodeBlock strips fences/prose, keeps body verbatim');
  ck(extractCodeBlock('BLOCK — Discovery Gate Failed. Escalation required.') === null, 'no fence -> null (a refusal is never file content)');
  const refusal = await implementStep(step, dir, { dispatch: async () => ({ content: 'I cannot verify the target path. Escalation required per Directive 1.' }) });
  ck(refusal.ok === false && /fenced block/.test(refusal.error || ''), 'prose-only seat output FAILS the step (no write, named cause)');

  // ---- CLASS 2 BLOCK-CENSUS: the empty-artifact error names fence count + largest block
  // length, distinguishing "0 blocks" (prose/refusal) from "N blocks, largest 0 chars"
  // (the seat emitted only empty/whitespace fences).
  ck(refusal.ok === false && /0 fenced block\(s\) seen/.test(refusal.error || ''), 'CLASS 2: prose-only (no fence) error reports "0 fenced block(s) seen"');
  const emptyFence = await implementStep({ ...step, target_files: ['census/empty.mjs'] }, dir, { dispatch: async () => ({ content: 'lead\n```\n\n```\nand\n```js\n   \n```' }) });
  ck(emptyFence.ok === false && /2 fenced block\(s\) seen/.test(emptyFence.error || '') && !fs.existsSync(path.join(dir, 'census/empty.mjs')), 'CLASS 2: only-empty-fences error reports the block count (N blocks, all empty/whitespace), nothing written');

  // ---- INTENT-HEADER SHAPE REFUSAL (4b 18:29: the class fired through the PRIMARY door) ----
  const intentEmission = 'niyyah:\n  source: the mission text, read carefully and in full before beginning this implementation work.\n  failure_mode: producing a card that does not quote the staged HTML and so fails the witness evidence bar.\n  work: author the six-section card with quoted excerpts.\nARTIFACT-COMPLETE';
  const intentRes = await implementStep(step, dir, { dispatch: async () => ({ content: '```\n' + intentEmission + '\n```' }) });
  ck(intentRes.ok === false && /INTENT-INSTEAD-OF-ARTIFACT/.test(intentRes.error || ''), 'PRIMARY-DOOR intent-header emission REFUSED with named error (never written)');
  ck(fs.readFileSync(outPath, 'utf8') === KNOWN, 'prior good artifact untouched by the refused intent emission');

  // ---- CONTINUATION PROTOCOL (emission-truncation class, 2026-06-11) ----
  // units
  ck(stripSentinel('X=1\nARTIFACT-COMPLETE\n').complete === true && stripSentinel('X=1\nARTIFACT-COMPLETE\n').body === 'X=1\n', 'stripSentinel: detects + strips, preserves trailing newline');
  ck(stripSentinel('X=1\n').complete === false, 'stripSentinel: no sentinel = incomplete');
  ck(joinContinuation('abcdef', 'defghi') === 'abcdefghi', 'joinContinuation: overlap de-duplicated');
  ck(joinContinuation('abc', 'xyz') === 'abcxyz', 'joinContinuation: no overlap = plain append');
  // truncated emission -> ONE continuation completes it; written file is the JOINED whole.
  let calls = 0;
  const truncDispatch = async () => {
    calls++;
    if (calls === 1) return { content: '```md\n# Card\nPart one of the content\n```' };           // cut off, no sentinel
    return { content: '```md\nPart two, the rest.\nARTIFACT-COMPLETE\n```' };                      // continuation + sentinel
  };
  const tstep = { ...step, target_files: ['cont/joined.md'], validation_command: 'node -e "0"' };
  const tres = await implementStep(tstep, dir, { dispatch: truncDispatch });
  ck(tres.ok === true && tres.continuations === 1, 'truncated emission HEALED by one continuation round');
  ck(fs.readFileSync(path.join(dir, 'cont/joined.md'), 'utf8').includes('Part one') && fs.readFileSync(path.join(dir, 'cont/joined.md'), 'utf8').includes('Part two'), 'written file is the JOINED whole (both parts)');
  // never completes -> EMISSION-TRUNCATED failure, NO file written.
  const neverDone = await implementStep({ ...step, target_files: ['cont/never.md'] }, dir, { dispatch: async () => ({ content: '```md\nendless\n```' }) });
  ck(neverDone.ok === false && /EMISSION-TRUNCATED/.test(neverDone.error || '') && !fs.existsSync(path.join(dir, 'cont/never.md')), 'sentinel never arrives -> EMISSION-TRUNCATED, nothing written');
  // already-complete rescue: continuation returns sentinel-only -> zero extra bytes, done.
  calls = 0;
  const rescueDispatch = async () => { calls++; return calls === 1 ? { content: '```md\nWhole thing.\n```' } : { content: '```\nARTIFACT-COMPLETE\n```' }; };
  const rres = await implementStep({ ...step, target_files: ['cont/rescue.md'] }, dir, { dispatch: rescueDispatch });
  ck(rres.ok === true && fs.readFileSync(path.join(dir, 'cont/rescue.md'), 'utf8') === 'Whole thing.\n', 'sentinel-forgotten emission rescued by sentinel-only continuation (no junk appended)');
  // SPLIT-NEEDED is a refusal handled in CODE, never written as the artifact.
  const splitRes = await implementStep({ ...step, target_files: ['cont/split.md'] }, dir, { dispatch: async () => ({ content: '```\nSPLIT-NEEDED: six sections exceed one emission\n```' }) });
  ck(splitRes.ok === false && /SPLIT-NEEDED/.test(splitRes.error || '') && !fs.existsSync(path.join(dir, 'cont/split.md')), 'SPLIT-NEEDED caught in code as a planning signal (not written as the file)');

  // CONTAINMENT: absolute/escaping targets are REFUSED with no write (sandbox-escape guard,
  // found live in the gr10-rebuild canary 2026-06-09).
  const evilAbs = await implementStep({ ...step, target_files: ['C:\\Windows\\Temp\\escape.mjs'] }, dir, { dispatch: mockDispatch });
  ck(evilAbs.ok === false && /containment/i.test(evilAbs.error || ''), 'absolute target REFUSED (path containment, fail-closed)');
  const evilTrav = await implementStep({ ...step, target_files: ['../escape.mjs'] }, dir, { dispatch: mockDispatch });
  ck(evilTrav.ok === false && /containment/i.test(evilTrav.error || ''), 'traversal (../) target REFUSED (path containment)');

  // ---- CODE-REPO WRITE BRANCH (Foundation 0.4): a real file is written into a throwaway
  // repo via the kernel; a non-allowlisted target is REFUSED with no write.
  {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'executor_coderepo_'));
    const allow = ['src/mod.mjs'];
    const repoStep = {
      step_index: 1, description: 'write a module into the repo', action_type: 'edit',
      target_files: ['src/mod.mjs'], context_dependencies: [], validation_command: 'node -c src/mod.mjs',
    };
    const repoRes = await implementStep(repoStep, dir, { dispatch: mockDispatch, codeRepo: true, repoRoot: repo, allowFiles: allow });
    ck(repoRes.ok === true, 'code-repo: implementStep reports ok for an allowlisted target');
    const wrote = path.join(repo, 'src/mod.mjs');
    ck(fs.existsSync(wrote) && fs.readFileSync(wrote, 'utf8') === KNOWN, 'code-repo: REAL file written INTO the repo (under REPO-ROOT, mkdir -p), exact content');
    ck(repoRes.path === wrote, 'code-repo: returned path is the kernel-resolved repo path (not the sandbox cwd)');

    // non-allowlisted target -> refused, nothing written.
    const badRes = await implementStep({ ...repoStep, target_files: ['src/other.mjs'], validation_command: 'node -c src/other.mjs' }, dir, { dispatch: mockDispatch, codeRepo: true, repoRoot: repo, allowFiles: allow });
    ck(badRes.ok === false && /containment/i.test(badRes.error || ''), 'code-repo: NON-ALLOWLISTED target REFUSED (kernel)');
    ck(!fs.existsSync(path.join(repo, 'src/other.mjs')), 'code-repo: refused write produced no file');

    // a '..' escape via code-repo branch is still refused.
    const escRes = await implementStep({ ...repoStep, target_files: ['../escape.mjs'] }, dir, { dispatch: mockDispatch, codeRepo: true, repoRoot: repo, allowFiles: allow });
    ck(escRes.ok === false && /containment/i.test(escRes.error || ''), "code-repo: '..' escape REFUSED");
    fs.rmSync(repo, { recursive: true, force: true });
  }

  // ---- EDIT-DISCIPLINE FRAMING (2026-06-15): buildEditFraming must carry the explicit
  // block-discipline rules + the few-shot example that stop overlapping/non-unique/over-padded
  // SEARCH blocks (the engine-badal gap). Assert the load-bearing phrases are present so a future
  // refactor cannot silently drop them.
  {
    const efStep = { step_index: 1, description: 'tweak a constant', action_type: 'edit', target_files: ['cfg.mjs'], context_dependencies: [], validation_command: 'node -c cfg.mjs' };
    const ef = buildEditFraming(efStep, dir, 'export const max = 3;\n');
    const phrases = ['UNIQUE', 'VERBATIM', 'MINIMAL', 'NON-OVERLAPPING', 'ONE LOGICAL CHANGE PER BLOCK', 'DELETION', 'EXAMPLE', 'COMMON MISTAKES', 'discards the entire edit'];
    ck(phrases.every((p) => ef.includes(p)), `edit-framing: carries all block-discipline phrases (${phrases.filter((p) => !ef.includes(p)).join(',') || 'all present'})`);
    ck(ef.includes('<<<<<<< SEARCH') && ef.includes('=======') && ef.includes('>>>>>>> REPLACE'), 'edit-framing: shows the exact SEARCH/REPLACE block format');
    ck(/EXAMPLE[\s\S]*<<<<<<< SEARCH[\s\S]*const max = 3;[\s\S]*const max = 1;[\s\S]*>>>>>>> REPLACE/.test(ef), 'edit-framing: includes a CONCRETE correct few-shot block');
    ck(ef.includes('OVERLAPPING:') && ef.includes('NON-UNIQUE:') && ef.includes('TOO MUCH CONTEXT:'), 'edit-framing: names the three common mistakes (overlapping / non-unique / too-much-context)');
    ck(ef.includes('export const max = 3;'), 'edit-framing: embeds the CURRENT file contents to edit against');
  }

  // ---- SEARCH/REPLACE EDIT PRIMITIVE selftests (2026-06-15; the cure for code-repo 0/11) ----
  ck(extractEditBlocks('pre\n<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE\npost').length === 1, 'extractEditBlocks: parses one block');
  { const b = extractEditBlocks('<<<<<<< SEARCH\nA\n=======\nB\n>>>>>>> REPLACE')[0]; ck(!!b && b.search === 'A' && b.replace === 'B', 'extractEditBlocks: search/replace captured verbatim'); }
  { const b = extractEditBlocks('<<<<<<< SEARCH\ndel\n=======\n>>>>>>> REPLACE')[0]; ck(!!b && b.search === 'del' && b.replace === '', 'extractEditBlocks: empty REPLACE = deletion'); }
  { const bs = extractEditBlocks('<<<<<<< SEARCH\r\nX\r\n=======\r\nY\r\n>>>>>>> REPLACE'); ck(bs.length === 1 && bs[0].search === 'X' && bs[0].replace === 'Y', 'extractEditBlocks: tolerates CRLF (\\r\\n)'); }
  ck(applyEditBlocks('hello world', [{ search: 'world', replace: 'there' }]).content === 'hello there', 'applyEditBlocks: single edit applied');
  ck(applyEditBlocks('abc', [{ search: 'zzz', replace: 'q' }]).ok === false, 'applyEditBlocks: SEARCH not found = fail-closed');
  ck(applyEditBlocks('a x a x', [{ search: 'x', replace: 'y' }]).ok === false, 'applyEditBlocks: ambiguous (>1 match in original) = fail-closed');
  ck(applyEditBlocks('keep', [{ search: '', replace: 'q' }]).ok === false, 'applyEditBlocks: empty SEARCH = fail-closed');
  ck(applyEditBlocks('axbxc', [{ search: 'a', replace: '1' }, { search: 'c', replace: '3' }]).content === '1xbx3', 'applyEditBlocks: multiple distinct edits apply sequentially');
  // end-to-end: codeRepo EDIT of an EXISTING file -> patched via blocks, mode 'edit', rest byte-identical
  {
    const repo2 = fs.mkdtempSync(path.join(os.tmpdir(), 'executor_editmode_'));
    const rel = 'big.txt';
    fs.writeFileSync(path.join(repo2, rel), 'line1\nTARGET\nline3\n', 'utf8');
    const editDispatch = async () => ({ content: 'sure:\n<<<<<<< SEARCH\nTARGET\n=======\nREPLACED\n>>>>>>> REPLACE\n' });
    const eStep = { step_index: 1, description: 'swap TARGET', action_type: 'edit', target_files: [rel], context_dependencies: [], validation_command: 'node -e "0"' };
    const eRes = await implementStep(eStep, dir, { dispatch: editDispatch, codeRepo: true, repoRoot: repo2, allowFiles: [rel] });
    ck(eRes.ok === true && eRes.mode === 'edit' && eRes.editBlocks === 1, 'edit-mode: existing-file edit via SEARCH/REPLACE -> ok + mode edit');
    ck(fs.readFileSync(path.join(repo2, rel), 'utf8') === 'line1\nREPLACED\nline3\n', 'edit-mode: only the matched span changed (rest byte-identical)');
    const badDispatch = async () => ({ content: '<<<<<<< SEARCH\nNOPE\n=======\nX\n>>>>>>> REPLACE' });
    const bRes = await implementStep(eStep, dir, { dispatch: badDispatch, codeRepo: true, repoRoot: repo2, allowFiles: [rel] });
    ck(bRes.ok === false && fs.readFileSync(path.join(repo2, rel), 'utf8') === 'line1\nREPLACED\nline3\n', 'edit-mode: unmatched blocks = fail-closed, file unchanged');
    // a NEW file (does not exist) with action_type edit falls through to whole-file create path
    const newRes = await implementStep({ ...eStep, target_files: ['fresh.mjs'], validation_command: 'node -c fresh.mjs' }, dir, { dispatch: mockDispatch, codeRepo: true, repoRoot: repo2, allowFiles: ['fresh.mjs'] });
    ck(newRes.ok === true && newRes.mode !== 'edit' && fs.readFileSync(path.join(repo2, 'fresh.mjs'), 'utf8') === KNOWN, 'edit-mode: NON-existent target falls through to whole-file create (unchanged path)');
    fs.rmSync(repo2, { recursive: true, force: true });
  }

  // SEATING MODE picks the executor FLOOR (seating-modes build): with no explicit model arg,
  // anthropic-heavy seats the executor as 'sonnet' (Sonnet executes); no mode -> the today
  // default 'qwen3-coder-next'. The mode sets the floor badalSelect starts from; with an empty
  // seat-record (the selftest's fresh sandbox) badal returns that floor unchanged. An explicit
  // model arg still wins (every test above passes one, so all are unaffected).
  {
    const capModel = async () => { throw new Error('stop after seat is built'); };   // we only need the seat.model the dispatch is called with
    const captureSeatModel = async (env, target = 'mode-exec.mjs') => {
      const saved = process.env.MUEZZIN_MODE;
      if (env) process.env.MUEZZIN_MODE = env; else delete process.env.MUEZZIN_MODE;
      let seenModel = null;
      const dispatch = async (seat) => { seenModel = seat.model; return { content: '```\n' + KNOWN + '\n```' }; };
      await implementStep({ step_index: 1, description: 'w', action_type: 'edit', target_files: [target], context_dependencies: [], validation_command: 'node -e "0"' }, dir, { dispatch });
      if (saved === undefined) delete process.env.MUEZZIN_MODE; else process.env.MUEZZIN_MODE = saved;
      return seenModel;
    };
    // CODE targets (.mjs) test the MODE's executor floor:
    ck(await captureSeatModel('anthropic-heavy') === 'sonnet', 'SEATING MODE anthropic-heavy: the executor floor is sonnet (Sonnet executes) when no explicit model is forced');
    // "absent mode": an INVALID sentinel env value -> readMode null (env-set-but-invalid -> default).
    ck(await captureSeatModel('__none__') === 'kimi-k2.7-code', 'SEATING MODE absent: executor floor falls back to kimi-k2.7-code (2026-06-17 qwen->kimi: better-recorded coder)');
    ck(await captureSeatModel('local-heavy') === 'kimi-k2.7-code', 'SEATING MODE local-heavy: executor floor is the local coder kimi-k2.7-code (≈zero Claude)');
    // PROSE targets route to the faithful seat (sonnet) REGARDLESS of mode (2026-06-17 prose-split, fabrication fix):
    ck(await captureSeatModel('local-heavy', 'page.md') === 'sonnet', 'PROSE-FAITHFUL FLOOR: a .md target -> sonnet even under local-heavy');
    ck(await captureSeatModel('__none__', 'index.html') === 'sonnet', 'PROSE-FAITHFUL FLOOR: a .html target -> sonnet even with no mode');
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${fails === 0 ? 'ALL PASS — executor seat: reads deps -> framing -> dispatch -> extract -> WRITE (exact)' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
