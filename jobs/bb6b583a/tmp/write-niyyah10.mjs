import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: atv-11b-vocab-bridge.mission.txt (agy-muezzin's own mission-shape convention, read directly this turn) plus the sibling engine's already-verified item25 mission (read earlier this session) -- confirming REPO-ROOT/ALLOW-FILES shape matches, so the cherry-pick mission can follow the identical pattern.\n  failure_mode: hand-editing agy-muezzin's git_steps.mjs directly instead of constructing a mission for its own daemon to fire.\n  work: write missions/engine-reset-quarantine-cherrypick.mission.txt wrapping the verified reset-quarantine-cherrypick-patch.mjs, matching the sibling engine's item25 mission shape, then lint and queue it on agy's own AUTORUN.md.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
