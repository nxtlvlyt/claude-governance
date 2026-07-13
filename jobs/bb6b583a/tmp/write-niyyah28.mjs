import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: agy-muezzin/missions/AUTORUN.md's stitch-atv14-reference annotation (personally grepped this turn), which explicitly names the niyyah-gate CLASS 2 defect as fixed and the mission as RESOLVED-LANDED, satisfying the gap's own stated closes_when condition.\n  failure_mode: leaving a gap open indefinitely after its actual bite is resolved, when the remaining item is a distinct lower-urgency design decision, not live blocking work -- this both overstates open debt and risks losing track of the real, still-open policy question by burying it under a closed bite.\n  work: close gap-niyyah-gate-headless-relays in GAP-REGISTER.jsonl (the bite is resolved, verified no other live mission depends on the same headless-relay pattern) and carry the longer-term scoped print-mode policy decision forward as a dormant-class follow-on, not bite-class.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
