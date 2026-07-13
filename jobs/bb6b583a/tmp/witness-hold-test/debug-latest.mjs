import * as m from './self_witness.mjs';
import fs from 'fs';
const wlog = './test-witness2.jsonl';
try { fs.unlinkSync(wlog); } catch {}
fs.appendFileSync(wlog, JSON.stringify({ ts: '2026-07-13T10:00:00.000Z', kind: 'self-witness', pass: 'before', artifact: 'mystem', ok: true }) + '\n');
fs.appendFileSync(wlog, JSON.stringify({ ts: '2026-07-13T11:00:00.000Z', kind: 'self-witness', pass: 'before', artifact: 'mystem', ok: false }) + '\n');
console.log('file contents:', fs.readFileSync(wlog, 'utf8'));
const w = m.latestBeforeWitness('mystem', { logPath: wlog });
console.log('latestBeforeWitness result:', JSON.stringify(w));
fs.unlinkSync(wlog);
