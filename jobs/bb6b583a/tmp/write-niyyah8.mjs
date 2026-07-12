import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: missions/engine-srcsha-anchor-fix.mission.txt (shape precedent, just read directly this turn) plus missions/_logs/heal-selftest-crash-diagnosis.md (the EXECUTED-grade confirmed root cause and exact fix strings).\n  failure_mode: hand-editing conduct-cycle.mjs directly instead of constructing a mission for the daemon to fire, the exact drift corrected earlier this session and now doubly reinforced.\n  work: write missions/engine-heal-selftest-race-fix.mission.txt wrapping the verified missions/_logs/heal-selftest-race-patch.mjs patcher, matching engine-srcsha-anchor-fix's 4-step shape, so the daemon applies the race fix -- this must land BEFORE engine-srcsha-anchor-fix can be re-fired, since the race bug is what killed its baseline step.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
