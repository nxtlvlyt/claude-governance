// command_queue.mjs — VERBATIM command-class queue (2026-06-18).
//
// A MISSION-CLASS: ops-deploy / command-class mission carries EXACT operator commands.
// Re-planning them through the architect panel is BOTH a cost sink (~5 min Opus/attempt) AND a
// correctness hazard: the planning prompt (deconstructor.mjs:169 QUEUE_INSTRUCTION) is INSTRUCTED
// to make all paths cwd-relative -> a verbatim `--file "E:\...\schema.sql"` was rewritten to a
// relative `d1/schema.sql` that did not resolve, failing mt-accounts-deploy-1 three times.
//
// This module builds the micro_queue VERBATIM from a fenced shell block in the mission body —
// no LLM in the loop, absolute paths preserved. orchestrate runs these steps from REPO-ROOT
// WITHOUT the code-repo containment/reset/commit machinery (a deploy runs commands; it does not
// edit+commit tracked files). FAIL-OPEN: any parse miss returns {ok:false} so orchestrate falls
// back to the normal architect panel — current behavior, never a silent mis-plan.
//
// Pure + side-effect-free. Inline selftest: `node command_queue.mjs`.

// Same predicate the split exemption uses (mission_split.mjs:255).
export function isCommandClassMission(text) {
  const t = String(text || '');
  return /MISSION-CLASS:\s*ops-deploy/i.test(t) || /\bcommand-class\b/i.test(t);
}

function missionIdOf(text) {
  const m = String(text || '').match(/MISSION-ID:\s*([^\r\n]+)/i);
  return m ? m[1].trim() : null;
}

// Extract command lines from fenced code blocks whose info-string is an explicit shell language
// (sh/bash/shell/pwsh/powershell/ps1/cmd/console). An explicit shell lang is REQUIRED so we never
// grab a ```json micro_queue or a ```md prose block. Blank lines and # comments are dropped; a
// leading "$ " prompt is stripped. Returns an ordered array of command strings.
function extractFencedCommands(text) {
  const t = String(text || '');
  const cmds = [];
  const FENCE = /```(?:sh|bash|shell|pwsh|powershell|ps1|cmd|console)[ \t]*\r?\n([\s\S]*?)```/gi;
  let m;
  while ((m = FENCE.exec(t)) !== null) {
    for (const lineRaw of m[1].split(/\r?\n/)) {
      const line = lineRaw.replace(/^\s*\$\s+/, '').trim();   // strip a leading "$ " prompt
      if (!line) continue;
      if (line.startsWith('#')) continue;                      // comment
      cmds.push(line);
    }
  }
  return cmds;
}

// buildLiteralCommandQueue(mission) -> { ok:true, queue } | { ok:false, reason }
// queue shape matches what orchestrate's phase-2 loop consumes (step_index, description,
// action_type:'command', target_files, context_dependencies, validation_command).
export function buildLiteralCommandQueue(mission) {
  const t = String(mission || '');
  if (!isCommandClassMission(t)) return { ok: false, reason: 'not a command-class mission' };

  const missionId = missionIdOf(t);
  if (!missionId) return { ok: false, reason: 'command-class mission has no MISSION-ID' };

  // A verbatim command run needs a REPO-ROOT for a safe CWD (deploys reference repo files by
  // path). No REPO-ROOT -> fail-open to the planner rather than run from an unknown cwd.
  const rr = t.match(/REPO-ROOT:\s*([^\r\n]+)/i);
  const repoRoot = rr ? rr[1].trim().replace(/^["']|["']$/g, '') : null;
  if (!repoRoot) return { ok: false, reason: 'command-class mission has no REPO-ROOT (no safe CWD for verbatim commands)' };

  const cmds = extractFencedCommands(t);
  if (!cmds.length) return { ok: false, reason: 'no fenced shell command block (```sh / ```pwsh / ...) found — falling back to the planner' };

  const steps = cmds.map((cmd, i) => ({
    step_index: i + 1,
    description: `run: ${cmd.slice(0, 70)}`,
    action_type: 'command',
    target_files: [],
    context_dependencies: [],
    validation_command: cmd,   // VERBATIM — absolute paths preserved, no LLM rewrite
  }));

  return { ok: true, queue: { mission_id: missionId, steps } };
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('command_queue.mjs')) {
  let fails = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  ck(isCommandClassMission('MISSION-CLASS: ops-deploy'), 'isCommandClass: ops-deploy -> true');
  ck(isCommandClassMission('this is command-class work'), 'isCommandClass: "command-class" in body -> true');
  ck(!isCommandClassMission('MISSION-CLASS: research'), 'isCommandClass: research -> false');
  ck(!isCommandClassMission('MISSION-CLASS: code-repo\nedit a file'), 'isCommandClass: code-repo -> false');

  const m = [
    'MISSION-CLASS: ops-deploy',
    'MISSION-ID: M-TEST.DEPLOY',
    'REPO-ROOT: E:\\AI_Storage\\proj',
    'Steps:',
    '```sh',
    '$ wrangler d1 execute db --remote --file "E:\\AI_Storage\\proj\\d1\\schema.sql"',
    '# a comment line is dropped',
    '',
    'wrangler deploy -c "E:\\AI_Storage\\proj\\workers\\w.toml"',
    '```',
  ].join('\n');
  const q = buildLiteralCommandQueue(m);
  ck(q.ok === true, 'build: ok on a fenced shell block');
  ck(q.ok && q.queue.steps.length === 2, 'build: 2 commands extracted (comment + blank dropped, "$ " prompt stripped)');
  ck(q.ok && /E:\\AI_Storage\\proj\\d1\\schema\.sql/.test(q.queue.steps[0].validation_command), 'build: ABSOLUTE path PRESERVED verbatim (THE regression guard — no abs->rel rewrite)');
  ck(q.ok && q.queue.steps[0].action_type === 'command', 'build: action_type = command');
  ck(q.ok && q.queue.mission_id === 'M-TEST.DEPLOY', 'build: mission_id captured');

  ck(buildLiteralCommandQueue('MISSION-CLASS: ops-deploy\nMISSION-ID: X\nREPO-ROOT: E:\\x\nno fenced block').ok === false, 'build: FAIL-OPEN when no fenced block (-> planner)');
  ck(buildLiteralCommandQueue('MISSION-CLASS: ops-deploy\nMISSION-ID: X\n```sh\nwrangler x\n```').ok === false, 'build: fail-closed when no REPO-ROOT');
  ck(buildLiteralCommandQueue('MISSION-CLASS: research\nMISSION-ID: X\nREPO-ROOT: E:\\x\n```sh\nls\n```').ok === false, 'build: research mission is not command-class');
  ck(buildLiteralCommandQueue('MISSION-CLASS: ops-deploy\nREPO-ROOT: E:\\x\n```sh\nls\n```').ok === false, 'build: no MISSION-ID -> fail');

  console.log(`\n${fails === 0 ? 'ALL PASS — command_queue: verbatim command extraction, abs-path preserved, fail-open to planner' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}
