// muezzin dry-run test — step 3 helper
// Reads back state.json to confirm it was persisted after step 2.
const fs = require('fs');
const dir = 'C:\\Users\\marka\\AppData\\Local\\Temp\\muezzin-test-run';
const raw = fs.readFileSync(`${dir}\\state.json`, 'utf8');
const obj = JSON.parse(raw);
if (!obj.completed_steps || obj.completed_steps.length < 2) {
  throw new Error('expected at least 2 completed steps in state.json, got: ' + JSON.stringify(obj.completed_steps));
}
console.log('step3: state.json OK — completed_steps: ' + JSON.stringify(obj.completed_steps));
console.log('step3: next_action = ' + obj.next_action);
console.log('step3: last_updated = ' + obj.last_updated);
