#!/usr/bin/env node
// muezzin-stream-test.mjs
//
// Self-contained unit test for the NDJSON line-buffering logic extracted from
// dispatchOllama() in muezzin.mjs.
//
// No live Ollama needed. Feeds chunked input through the same buf/split/pop
// logic and asserts that JSON objects split across chunk boundaries are
// reassembled intact.
//
// Run: node muezzin-stream-test.mjs

// ---------------------------------------------------------------------------
// The buffering logic under test — extracted verbatim from muezzin.mjs
// so this test proves exactly what ships in the dispatch path.
// ---------------------------------------------------------------------------
function processStream(chunks) {
  let content = '';
  let thinkingChars = 0;
  let buf = '';

  for (const chunk of chunks) {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop(); // incomplete tail carried to next chunk
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        const msg = parsed.message || {};
        const piece = msg.content || parsed.response || '';
        const thinkPiece = msg.thinking || '';
        if (thinkPiece) thinkingChars += thinkPiece.length;
        if (piece) content += piece;
      } catch { /* skip genuinely malformed */ }
    }
  }

  // flush remaining buf (end event)
  if (buf.trim()) {
    try {
      const parsed = JSON.parse(buf);
      const msg = parsed.message || {};
      const piece = msg.content || parsed.response || '';
      const thinkPiece = msg.thinking || '';
      if (thinkPiece) thinkingChars += thinkPiece.length;
      if (piece) content += piece;
    } catch { /* incomplete final line */ }
  }

  return { content, thinkingChars };
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    console.error(`        expected: ${JSON.stringify(expected)}`);
    console.error(`        actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

console.log('\n[1] Single complete chunk — baseline');
{
  const line1 = JSON.stringify({ message: { content: 'Hello ' }, done: false });
  const line2 = JSON.stringify({ message: { content: 'world' }, done: true });
  const { content } = processStream([line1 + '\n' + line2 + '\n']);
  assert('content assembled', content, 'Hello world');
}

console.log('\n[2] JSON object split exactly at chunk boundary');
{
  const full = JSON.stringify({ message: { content: 'split token' }, done: false }) + '\n';
  // Split in the middle of the JSON string
  const mid = Math.floor(full.length / 2);
  const chunk1 = full.slice(0, mid);
  const chunk2 = full.slice(mid);
  const { content } = processStream([chunk1, chunk2]);
  assert('content from split-line chunk', content, 'split token');
}

console.log('\n[3] Multiple objects split across three chunks');
{
  const obj1 = JSON.stringify({ message: { content: 'alpha' }, done: false }) + '\n';
  const obj2 = JSON.stringify({ message: { content: ' beta' }, done: false }) + '\n';
  const obj3 = JSON.stringify({ message: { content: ' gamma' }, done: true }) + '\n';
  const full = obj1 + obj2 + obj3;
  // Split at two arbitrary positions that cut across newlines
  const a = Math.floor(full.length * 0.3);
  const b = Math.floor(full.length * 0.65);
  const { content } = processStream([full.slice(0, a), full.slice(a, b), full.slice(b)]);
  assert('content from 3-chunk split', content, 'alpha beta gamma');
}

console.log('\n[4] Thinking field accumulation across split chunks');
{
  const obj1 = JSON.stringify({ message: { content: '', thinking: 'think1' }, done: false }) + '\n';
  const obj2 = JSON.stringify({ message: { content: 'answer', thinking: '' }, done: true }) + '\n';
  const full = obj1 + obj2;
  const mid = Math.floor(full.length / 2);
  const { content, thinkingChars } = processStream([full.slice(0, mid), full.slice(mid)]);
  assert('content after thinking', content, 'answer');
  assert('thinkingChars counted', thinkingChars, 6); // 'think1' = 6 chars
}

console.log('\n[5] OLD broken pattern — proves the bug (no buffer, per-chunk split)');
{
  // Replicate the old broken code: split each chunk independently, no buf
  function brokenProcessStream(chunks) {
    let content = '';
    for (const chunk of chunks) {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const msg = parsed.message || {};
          const piece = msg.content || parsed.response || '';
          if (piece) content += piece;
        } catch { /* drops partial lines silently */ }
      }
    }
    return { content };
  }

  const full = JSON.stringify({ message: { content: 'dropped' }, done: false }) + '\n';
  const mid = Math.floor(full.length / 2);
  const { content: broken } = brokenProcessStream([full.slice(0, mid), full.slice(mid)]);
  const { content: fixed  } = processStream([full.slice(0, mid), full.slice(mid)]);

  // The broken path should fail to parse both half-chunks → empty content
  assert('OLD code loses split-line content (empty)', broken, '');
  // The fixed path should reassemble correctly
  assert('NEW code reassembles split-line content', fixed, 'dropped');
}

console.log('\n[6] Final line with no trailing newline (server omits it)');
{
  // Ollama spec says each NDJSON line ends with \n, but guard the edge case.
  const obj = JSON.stringify({ message: { content: 'no-newline' }, done: true });
  // No trailing \n — buf flush handles it
  const { content } = processStream([obj]);
  assert('content from unterminated final line', content, 'no-newline');
}

console.log('\n[7] Empty lines and blank chunks are skipped cleanly');
{
  const obj = JSON.stringify({ message: { content: 'clean' }, done: false }) + '\n';
  const { content } = processStream(['', '\n', obj, '', '\n']);
  assert('content ignores empty chunks', content, 'clean');
}

console.log('\n[8] response field (non-chat endpoint format)');
{
  const obj = JSON.stringify({ response: 'generate-style', done: false }) + '\n';
  const { content } = processStream([obj]);
  assert('response field extracted', content, 'generate-style');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
  process.exit(0);
}
