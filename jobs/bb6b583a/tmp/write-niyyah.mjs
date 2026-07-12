import { writeFileSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const niyyah_text = "niyyah:\n  source: engine-item25-reset-quarantine.mission.txt (mission shape precedent) + conductor-core.md five-verb law + the operator's explicit ruling that engine option 2 (fix conduct-cycle.mjs) is the governance-correct path, not a routed decision.\n  failure_mode: hand-editing daemon beat-execution machinery directly instead of constructing a mission for the daemon to fire, exactly the drift the operator named tonight.\n  work: write missions/engine-srcsha-anchor-fix.mission.txt wrapping the already-verified missions/_logs/srcsha-anchor-patch.mjs patcher, matching the item25 mission's 4-step shape, so the daemon applies the srcSha anchor fix rather than me editing conduct-cycle.mjs by hand.";

const obj = { ts: Date.now(), niyyah_text };
const p = path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json');
writeFileSync(p, JSON.stringify(obj), 'utf8');

// verify by re-reading raw bytes, no console.log of the number
const raw = readFileSync(p, 'utf8');
const hasEscape = /\x1b\[/.test(raw);
const parsed = JSON.parse(raw);
process.stdout.write('WROTE-AND-VERIFIED hasAnsiEscape=' + hasEscape + ' niyyahMatch=' + /\bniyyah\s*:/i.test(parsed.niyyah_text) + '\n');
