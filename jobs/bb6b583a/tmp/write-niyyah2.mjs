import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: mission_lint.mjs RULE 3 (line-cite-without-numbered-source), read directly this turn at line 36 — confirmed the trigger is a regex keyword collision (cit\w* + \bline\b within 60 chars), not a real line-cited-evidence claim.\n  failure_mode: rewording to dodge a lint gate whose substantive check still applies (evasion) vs rewording when the check's premise plainly does not apply to this mission (no external evidence is cited by line number anywhere in it).\n  work: replace explicit with declared throughout engine-srcsha-anchor-fix.mission.txt to remove the accidental collision, then re-lint to confirm ALL PASS before queueing.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
