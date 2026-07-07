// Independent adversarial replay of hunt-25: fire the receipted daemon-events.log
// kill-shape (2026-07-03T17:24:12) at the exported parseLagunaVerdict and verify
// (a) verdict still extracts, (b) leaked preamble absent from notes, (c) real
// concern text survives. Also simulate the PRE-FIX notes path to confirm the fix
// is load-bearing (i.e. without stripThinkingLeak the notes WOULD be pure leak).
import { parseLagunaVerdict } from 'file:///C:/Users/marka/.claude/muezzin-plugin/self_witness.mjs';

const killShape =
  '<antThinking> The user wants me to review an ARTIFACT (a mission spec) and its CONTEXT. ' +
  'I need to judge ONLY the REASONING: is it sound, correctly scoped, and are the cited receipts real. ' +
  'Let me walk each cited sha against the repo history one by one before deciding. </antThinking>\n' +
  '<verdict>REJECT</verdict> mission cites a receipt sha that does not exist in the repo';

const r = parseLagunaVerdict(killShape);
let fail = 0;
const ck = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg); if (!cond) fail++; };

ck(r.verdict === 'REJECT', 'verdict extracts as REJECT (got: ' + r.verdict + ')');
ck(!r.notes.includes('antThinking') && !r.notes.includes('wants me to review'), 'leaked preamble absent from notes');
ck(r.notes.includes('receipt sha that does not exist'), 'post-verdict concern text survives');
console.log('notes = ' + JSON.stringify(r.notes));

// pre-fix simulation: old notes path was whole-text collapse+truncate WITHOUT the strip
const preFixNotes = killShape.replace(/\s+/g, ' ').trim().slice(0, 400);
ck(preFixNotes.includes('antThinking') && preFixNotes.startsWith('<antThinking>'), 'pre-fix path WOULD have recorded the leak (fix is load-bearing)');

// unclosed-tag guard from the gap's own design
const unclosed = parseLagunaVerdict('<antThinking> cut off mid-thought never closed');
ck(unclosed.verdict === null && unclosed.notes.includes('cut off mid-thought'), 'unclosed tag left alone, no verdict -> re-ask path');

process.exit(fail ? 1 : 0);
