// dispatch-tool-lint.mjs — PreToolUse gate on Bash/PowerShell, enforcing QUEUE ITEM 16:
// raw `agy` CLI dispatch (agy/agy.exe invoked with --print/-p/--model) must go through the
// engine's dispatch layer (agy_dispatch.mjs / seat_dispatch.mjs), never a hand-rolled
// shell invocation. Structurally mirrors hooks/tool-first-lint.mjs (sixth law gate).
//
// Bypass: include the token TOOL-CANNOT-SERVE: <reason> in the command as a comment.
// The bypass is visible in the transcript — that IS the receipt the law demands.
//
// Exit codes: 0 = allow; 2 = block with reason on stderr (Claude Code PreToolUse contract).
import { readFileSync } from 'fs';

let input = '';
try { input = readFileSync(0, 'utf8'); } catch { process.exit(0); }
let cmd = '';
try {
  const j = JSON.parse(input);
  if (j.tool_name !== 'Bash' && j.tool_name !== 'PowerShell') process.exit(0);
  cmd = String(j.tool_input?.command || '');
} catch { process.exit(0); }

if (/TOOL-CANNOT-SERVE:/.test(cmd)) process.exit(0);   // receipted bypass — visible in transcript

// Signature: a raw `agy`/`agy.exe` CLI invocation carrying a dispatch flag (--print, -p,
// --model) within 300 chars — i.e. someone hand-invoking the agy CLI directly instead of
// routing through the engine's dispatch layer.
const rawAgyDispatch = /\bagy(\.exe)?\b[\s\S]{0,300}?(--print\b|-p\s|--model\b)/i.test(cmd);

// Evidence the command is already going through the sanctioned dispatch layer (either a
// direct reference to it, or a wrapper script that itself calls into it).
const hasDispatchLayerEvidence = /agy_dispatch\.mjs|seat_dispatch\.mjs/i.test(cmd);

if (rawAgyDispatch && !hasDispatchLayerEvidence) {
  console.error(
    'DISPATCH TOOL LINT (QUEUE ITEM 16, conductor-core.md) — BLOCKED.\n\n' +
    'This Bash/PowerShell command is a raw `agy` CLI dispatch (agy/agy.exe with a\n' +
    '--print/-p/--model flag) that does not route through the engine\'s dispatch layer\n' +
    '(agy_dispatch.mjs / seat_dispatch.mjs). Per QUEUE ITEM 16, hand-rolled agy invocations\n' +
    'bypass the dispatch layer\'s receipts, healing, and serialization.\n\n' +
    'Use the purpose-built tool instead:\n' +
    '  - dispatching an agy seat -> the engine\'s agy_dispatch.mjs / seat_dispatch.mjs layer\n\n' +
    'If the dispatch layer GENUINELY cannot serve, re-run with a visible receipt in the command:\n' +
    '  # TOOL-CANNOT-SERVE: <why the dispatch layer is unfit>\n' +
    'The bypass is transcript-visible — that IS the receipt the law demands.'
  );
  process.exit(2);
}

process.exit(0);
