// _proof_mission.mjs — real end-to-end proof: run a non-trivial mission through orchestrate() with the
// REAL cloud seats (real architect decomposes, real executor implements, the muezzin witnesses by running
// `node --test` ITSELF, repairs on failure, commits/rolls back). Harder than fizzbuzz: an LRU cache with
// recency semantics, which a one-shot model commonly gets subtly wrong (so it exercises the self-heal loop).
import { orchestrate } from './orchestrate.mjs';
import { execSync } from 'node:child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof_mission_'));
const git = (c) => execSync(`git ${c}`, { cwd: dir, stdio: 'pipe' });
git('init -q'); git('config user.email t@t.local'); git('config user.name t');
fs.writeFileSync(path.join(dir, 'README.md'), '# proof mission sandbox\n'); git('add -A'); git('commit -q --no-verify -m init');

const mission = `Niyyah: a small, reliable, well-tested utility a caller can trust without re-checking.
Maqsad: a Node.js ESM module lru.mjs that exports a class LRUCache constructed with a positive integer capacity, exposing get(key) (returns the value or undefined and marks the key most-recently-used), set(key, value) (inserts/updates and marks most-recently-used, evicting the least-recently-used entry when the number of entries would exceed capacity), and a read-only size getter; plus a test file lru.test.mjs using the built-in node:test and node:assert/strict that verifies: a set then get returns the value; size never exceeds capacity; when capacity is exceeded the least-recently-used key is the one evicted; and a get() on an existing key refreshes its recency so it survives a subsequent eviction that would otherwise remove it.
Context: a bare Node.js 20+ ESM project, no dependencies. Tests run with the command \`node --test\`. Keep it to at most these two files.`;

console.log('[proof] orchestrating a REAL mission with real cloud seats in', dir, '\n');
const t0 = process.hrtime.bigint();
const r = await orchestrate(mission, dir, { maxRepairs: 1 });
const secs = Number(process.hrtime.bigint() - t0) / 1e9;
console.log('\n[proof] result:', JSON.stringify(r, null, 2));
console.log('[proof] files written:', fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).join(', ') || '(none)');
console.log(`[proof] wall time: ${secs.toFixed(1)}s; self-heals: ${(r.steps || []).filter((s) => s.repaired).length}`);
if (r.ok) {
  // independent re-witness: run the tests OURSELVES, outside the muezzin, on the committed result.
  try {
    const out = execSync('node --test', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
    // node's default test reporter prints "ℹ pass 4" / "ℹ fail 0" (not TAP "# pass"). exit 0 already means
    // all passed (execSync throws otherwise); we extract the counts only to report them.
    const pass = /pass[^\d]*(\d+)/.exec(out)?.[1] ?? '?';
    const fail = /fail[^\d]*(\d+)/.exec(out)?.[1] ?? '?';
    console.log(`[proof] INDEPENDENT re-test of committed code: pass=${pass} fail=${fail} (exit 0)`);
    console.log('\nPROOF OK — a real mission ran end-to-end on its own AND the committed code passes an independent test run.');
  } catch (e) {
    console.log('[proof] INDEPENDENT re-test FAILED:', String(e.stdout || e.message).slice(0, 600));
    console.log('\nPROOF PARTIAL — muezzin reported ok but independent re-test disagrees (investigate).');
  }
} else {
  console.log(`\nPROOF stopped at phase '${r.phase}'${r.stoppedAt ? ' step ' + r.stoppedAt : ''} — last: ${JSON.stringify((r.steps || []).slice(-1))}`);
}
console.log('[proof] sandbox:', dir);
process.exit(r.ok ? 0 : 1);
