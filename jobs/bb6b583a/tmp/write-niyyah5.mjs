import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: muezzin-daemon.mjs retroRepeatBlocked (line 740), read directly this turn -- the mechanical preflight-receipt requirement before any requeue of a stem with a prior FAILED retro, and the PARKED annotation's own UNPARK SEQUENCE on mt-integrate-poi-dedup-audit.S2's AUTORUN line.\n  failure_mode: re-bareing a DONE-but-hollow mission line without satisfying the engine's own preflight gate, which would make the daemon silently refuse the fire (or worse, satisfying it with a hollow/mismatched receipt just to clear the gate mechanically rather than an honest one).\n  work: write missions/_logs/preflight/mt-integrate-poi-dedup-audit.S1.md with an honest COVERS: FAILED(verify) receipt (the class is already proven fixed by S1's own subsequent successful DONE run), then re-bare the S1 AUTORUN.md line per the documented unpark sequence.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
