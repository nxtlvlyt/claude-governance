import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: the already-landed, already-verified reset-quarantine fix (read directly this turn) in the sibling engine's git_steps.mjs, plus agy-muezzin's own git_steps.mjs (the unpatched fork, read directly this turn) -- confirmed byte-identical surrounding structure, both use uniform LF line endings (verified via direct byte scan), so a direct cherry-pick is safe.\n  failure_mode: hand-editing agy-muezzin's git_steps.mjs directly instead of a committed patcher script, or porting the fix without verifying the two files' surrounding context actually matches closely enough for a safe cherry-pick.\n  work: author an agy-side patcher script applying the identical quarantine-not-destroy fix already proven in the sibling engine, dry-run verify, then construct the agy-side mission.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
