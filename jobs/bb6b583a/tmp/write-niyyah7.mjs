import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: missions/_logs/heal-selftest-crash-diagnosis.md, just read directly this turn -- the investigation agent's confirmed EXECUTED-grade root cause and exact proposed old/new strings for the selftest tmp-path race.\n  failure_mode: hand-editing conduct-cycle.mjs directly instead of committing a patcher script and constructing a mission, the exact drift already corrected once this session.\n  work: author missions/_logs/heal-selftest-race-patch.mjs applying Fix 1 (PID-suffixed tmp path) plus Fix 2 (thread sight/worktree/git stubs into 9 heal() call sites), dry-run verify in a scratch copy, then construct engine-heal-selftest-race-fix.mission.txt.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
