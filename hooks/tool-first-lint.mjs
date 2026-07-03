// tool-first-lint.mjs — PreToolUse gate on Bash/PowerShell, enforcing the SIXTH LAW
// (conductor-core.md, paid for 2026-07-03: "the tool-refusal night").
//
// The advisory stage failed 103 ratchet fires in one session; per the governance's own
// escalation ladder (advisory -> guaranteed-delivery law -> BLOCKING GATE), this makes the
// law mechanical. It blocks the CODE-SURGERY signature only — inline `node -e` bodies that
// carry multi-statement code or write to engine files — never small one-line receipts
// (JSON reads, version prints, quick probes stay legal).
//
// Bypass, per the law's own text ("hand-rolling is permitted ONLY after receipting why the
// tool cannot serve"): include the token TOOL-CANNOT-SERVE: <reason> in the command as a
// comment. The bypass is visible in the transcript = the receipt the law demands.
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

// Signature: inline node -e / python -c whose body is CODE SURGERY (multi-statement or
// file-writing), not a one-line receipt. Heuristics tuned on tonight's four real mangles:
// every one was node -e with replace()/writeFileSync/splice over an .mjs/.md target.
const inlineEval = cmd.match(/\b(node\s+(-e|--eval)|python3?\s+-c)\s+["']([\s\S]{0,4000})/);
if (inlineEval) {
  const body = inlineEval[3] || '';
  // Write-evidence REQUIRED (tuned 2026-07-03 after two read-only inspection one-liners were
  // false-blocked): surgery = read-modify-write or in-place mutation. Pure console.log
  // reporting, however long, is a receipt-maker, not a file edit — it stays legal.
  const writesFiles = /writeFileSync|Set-Content|appendFileSync|fs\.write|splice\(/.test(body) && /readFileSync|Get-Content/.test(body);
  const replaceSurgery = /\.replace\(/.test(body) && /writeFileSync|Set-Content/.test(body);
  if (writesFiles || replaceSurgery) {
    console.error(
      'TOOL-FIRST LINT (sixth law, conductor-core.md 2026-07-03) — BLOCKED.\n\n' +
      'This Bash body is inline code surgery (node -e/python -c with read-modify-write or\n' +
      'multi-statement logic). Tonight\'s receipts: four inline mangles, two broken engine files.\n\n' +
      'Use the purpose-built tool instead:\n' +
      '  - editing a file            -> Edit tool (exact-match replace) or Write tool\n' +
      '  - generating a script       -> Write the script to scratchpad, then run it\n' +
      '  - dispatching a model       -> the engine seat_dispatch/orchestrate layer\n\n' +
      'If the tool GENUINELY cannot serve, re-run with a visible receipt in the command:\n' +
      '  # TOOL-CANNOT-SERVE: <why the tool is unfit>\n' +
      'The bypass is transcript-visible — that IS the receipt the law demands.'
    );
    process.exit(2);
  }
}

process.exit(0);
