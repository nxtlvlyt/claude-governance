// muezzin dry-run test — step 1 helper
// Writes a substantive text artifact to the test run directory.
const fs = require('fs');
const dir = 'C:\\Users\\marka\\AppData\\Local\\Temp\\muezzin-test-run';
fs.mkdirSync(dir, { recursive: true });
const content = [
  'This artifact was produced by step 1 of the muezzin dry-run test pipeline.',
  'It contains enough content to satisfy the checkpoint_verify density gate.',
  'The require-regex gate checks for the string "checkpoint_verify" — present.',
  'The orchestration loop confirms this file exists and has substantive content',
  'before advancing to step 2. This proves the PASS path through the checkpoint gate.',
].join('\n');
fs.writeFileSync(`${dir}\\step1-output.txt`, content, 'utf8');
console.log('step1: wrote step1-output.txt');
