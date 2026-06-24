#!/usr/bin/env node
// One-off: for missions whose FIX has been performed (named via argv), flip the
// AUTORUN annotation FIX: -> RESOLVED: so conduct-cycle classifies them as closed
// instead of emitting PERFORM-NAMED-FIX every beat.

import { readFileSync, writeFileSync } from 'fs';

const missions = process.argv.slice(2);
if (missions.length === 0) {
  console.error('usage: node _flip-perform-to-resolved.mjs <mission-id> [more...]');
  process.exit(2);
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

let a = readFileSync('missions/AUTORUN.md', 'utf8');
let flipped = 0;
const notFound = [];
for (const m of missions) {
  const escaped = esc(m);
  const re = new RegExp(`((?:FAILED|BLOCKED|HELD)\\s+missions/${escaped}\\.mission\\.txt\\s+<!--[^>]*?)FIX:\\s*`, 'm');
  if (re.test(a)) {
    a = a.replace(re, `$1RESOLVED: fix performed + recorded in fix-ledger; was FIX: `);
    flipped++;
  } else {
    notFound.push(m);
  }
}
writeFileSync('missions/AUTORUN.md', a);
console.log(`flipped ${flipped}/${missions.length} annotations`);
if (notFound.length) console.log(`not-found (no FAILED FIX: line for): ${notFound.join(', ')}`);
