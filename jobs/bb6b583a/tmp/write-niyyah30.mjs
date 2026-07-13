import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: the completed sub-agent report for RULE 14 (personally reviewed this turn, including its exact mission-shape recommendation and dry-run selftest output showing 40/40 PASS) plus mission_lint.mjs's own RULE 13 precedent I read earlier this session.\n  failure_mode: hand-editing mission_lint.mjs directly instead of constructing the mission the sub-agent's PREPARE work was explicitly scoped to feed into.\n  work: write M-ENGINE.ITEM26B.RULE14-CONTENT-CONTRACT mission wrapping the verified mission-lint-rule14-content-contract-patch.mjs, matching the recommended shape, lint it, and queue it.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
