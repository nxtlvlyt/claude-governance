import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: mt-integrate-poi-dedup-audit.S2.mission.txt (read directly this turn) plus its result.json and retro (read directly this turn) -- confirming the mission text's vague Done-means (a broken template placeholder) and step 9's unspecified verification language invited the executor to invent a brittle SHA-in-log-window witness, which the plan-validation gate correctly rejected.\n  failure_mode: leaving a mission text defect unfixed while a diagnosis correctly names it, letting the same executor invent the same brittle pattern on the next blind re-fire.\n  work: amend mt-integrate-poi-dedup-audit.S2.mission.txt's Done-means and step 9 to pin an explicit, correct verification method (Test-Path + git log -1 content check, never a multi-commit log window), preflight covering FAILED(plan), then re-bare.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
