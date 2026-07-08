// Purge inherited (non-fork) SPLIT-CHILD lines from the fork queue.
// Fork-native missions keep: sota-smoketest-agy, atv-1-*. Everything else -> backup.
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
const AU = 'C:/Users/marka/agy-muezzin/missions/AUTORUN.md';
const BK = 'C:/Users/marka/agy-muezzin/missions/_logs/AUTORUN.inherited-backup-20260708.md';
const FORK_NATIVE = /(sota-smoketest-agy|atv-1-)/;
const lines = readFileSync(AU, 'utf8').split(/\r?\n/);
const keep = [], purge = [];
for (const l of lines) {
  if (/^missions\//.test(l.trim()) || /^(DONE|FAILED|RUNNING|SPLIT) missions\//.test(l.trim())) {
    if (FORK_NATIVE.test(l)) keep.push(l); else purge.push(l);
  } else keep.push(l);
}
writeFileSync(AU, keep.join('\n'));
appendFileSync(BK, '\n# SPLIT-CHILD purge 2026-07-08 (second pass — child lines missed by the parent purge):\n' + purge.join('\n') + '\n');
console.log('purged', purge.length, 'inherited lines; kept queue:');
console.log(keep.filter(l => l.includes('missions/')).map(l => l.slice(0, 90)).join('\n'));
