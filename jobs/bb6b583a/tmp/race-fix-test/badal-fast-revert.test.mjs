import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { badalSelect, recordSeatOutcome, loadSeatRecord, ESCALATION_LADDER } from './seat_record.mjs';

let pass = 0;
let fail = 0;
const check = (condition, message) => {
  if (condition) {
    pass++;
    console.log(`PASS  ${message}`);
  } else {
    fail++;
    console.log(`FAIL  ${message}`);
  }
};

const makeRecord = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'badal-fast-revert-'));
  return path.join(dir, 'seat-record.json');
};

const cleanup = (recordPath) => {
  rmSync(path.dirname(recordPath), { recursive: true, force: true });
};

// (a) default with 0 pass + 1 miss + an eligible floor candidate (first ladder member given a pass)
//     → escalated:true, model is the floor, why contains 'untested-and-failing fast-revert'
{
  const rec = makeRecord();
  const defaultModel = 'default-a';
  const floor = ESCALATION_LADDER[0];
  recordSeatOutcome(rec, defaultModel, 'rite', 'miss');
  recordSeatOutcome(rec, floor, 'rite', 'pass');
  const result = badalSelect(rec, 'rite', defaultModel);
  check(result.escalated === true, '(a) escalated:true for untested-and-failing default with eligible floor');
  check(result.model === floor, '(a) model is the first ladder member');
  check(/untested-and-failing fast-revert/.test(result.why || ''), '(a) why contains "untested-and-failing fast-revert"');
  cleanup(rec);
}

// (b) default with 0 pass + 0 failure (empty record, t undefined)
//     → escalated:false, model stays default (audition gets first shot)
{
  const rec = makeRecord();
  const defaultModel = 'default-b';
  const result = badalSelect(rec, 'rite', defaultModel);
  check(result.escalated === false, '(b) escalated:false for empty record');
  check(result.model === defaultModel, '(b) model stays default (audition gets first shot)');
  cleanup(rec);
}

// (c) default with passes and ratio<0.5
//     → escalated:false, model stays default
{
  const rec = makeRecord();
  const defaultModel = 'default-c';
  recordSeatOutcome(rec, defaultModel, 'rite', 'pass');
  recordSeatOutcome(rec, defaultModel, 'rite', 'pass');
  recordSeatOutcome(rec, defaultModel, 'rite', 'miss');
  const result = badalSelect(rec, 'rite', defaultModel);
  check(result.escalated === false, '(c) escalated:false when ratio < 0.5');
  check(result.model === defaultModel, '(c) model stays default when ratio < 0.5');
  cleanup(rec);
}

// (d) default with ratio>=0.5 (existing path, e.g. 1 pass + 1 fabrication)
//     → escalated:true, why contains 'strike ratio'
{
  const rec = makeRecord();
  const defaultModel = 'default-d';
  recordSeatOutcome(rec, defaultModel, 'rite', 'pass');
  recordSeatOutcome(rec, defaultModel, 'rite', 'fabrication');
  // Add ladder candidate record so escalation can occur
  recordSeatOutcome(rec, ESCALATION_LADDER[0], 'rite', 'pass');
  const result = badalSelect(rec, 'rite', defaultModel);
  check(result.escalated === true, '(d) escalated:true when ratio >= 0.5');
  check(/strike ratio/.test(result.why || ''), '(d) why contains "strike ratio"');
  cleanup(rec);
}

// (e) untested-failing default but NO ladder candidate is proxyEligible
//     → escalated:false, model stays default, blocked contains 'NO eligible proxy'
{
  const rec = makeRecord();
  const defaultModel = 'default-e';
  recordSeatOutcome(rec, defaultModel, 'rite', 'miss');
  const result = badalSelect(rec, 'rite', defaultModel);
  check(result.escalated === false, '(e) escalated:false when no eligible proxy');
  check(result.model === defaultModel, '(e) model stays default when no eligible proxy');
  check(/NO eligible proxy/.test(result.blocked || ''), '(e) blocked contains "NO eligible proxy"');
  cleanup(rec);
}

if (fail > 0) {
  console.log(`\n${fail} FAIL / ${pass} PASS`);
  process.exit(1);
} else {
  console.log(`\nALL PASS — badal fast-revert assertions sound`);
  process.exit(0);
}
