import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: the completed sub-agent report for gap-attempt2-validation-replay (personally reviewed) plus my own independent re-verification in fresh scratch copies of both deconstructor.mjs files (patch applied cleanly, syntax valid, anchor text present exactly once, matching the sub-agent's claims with zero discrepancy).\n  failure_mode: hand-editing deconstructor.mjs in either jurisdiction instead of constructing the two missions this PREPARE work was explicitly scoped to feed into.\n  work: write two missions (muezzin-plugin and agy-muezzin) wrapping the verified deconstructor-archframing-validation-command-patch.mjs, matching the sub-agent's recommended per-repo shape, lint each, and queue both.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
