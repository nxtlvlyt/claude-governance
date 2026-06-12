// One-off: run the hook trimmer against the operator's graded batch (mirrors processor.mjs logic)
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';

const out = 'N:\\web\\vanlife\\map\\post\\queue\\20260612034222-iot1l2\\out';
const srtPath = `${out}\\transcript.srt`;
const segments = readFileSync(srtPath, 'utf8').split(/\r?\n\r?\n/).map((blk) => {
  const m = blk.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*/);
  if (!m) return null;
  const s = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
  const text = blk.split(/\r?\n/).slice(2).join(' ').trim();
  return text ? { start: s, text } : null;
}).filter(Boolean);

const ps = await (await fetch('http://localhost:11434/api/ps')).json();
const resident = (ps.models || []).map((m) => m.name);
if (resident.length && !resident.some((n) => n.startsWith('laguna'))) { console.log(`GR10 skip: ${resident.join(',')}`); process.exit(1); }

const head = segments.slice(0, 12).map((s, i) => `[${i}] ${s.start.toFixed(1)}s: ${s.text}`).join('\n');
const sys = 'You are a ruthless social-video hook editor. FILLER (always cut): greetings ("hey guys","what\'s up","welcome back"), personal-state warm-up ("I\'m super excited","I think I finally"), meta-talk ("in this video","so today","before we start"), hedges ("okay so","um"). The first KEPT segment must deliver proof, a promise, or the payoff in its first clause. Cut ONLY at a segment start. Never cut more than 25% of the listed span or past the first proof-statement. If the opening is already strong, trim_to_s is 0. Output STRICT JSON only: {"trim_to_s": <number, a listed segment start or 0>, "filler_found": ["..."], "reason": "..."}';
const r = await fetch('http://localhost:11434/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'laguna-xs.2:q4_K_M', stream: false, format: 'json', options: { temperature: 0 }, messages: [
    { role: 'system', content: sys },
    { role: 'user', content: `Transcript opening (segment starts in seconds):\n${head}\n\nWhere does the real hook start?` },
  ] }),
});
const outp = JSON.parse((await r.json()).message?.content || '{}');
console.log('MODEL:', JSON.stringify(outp));
const t = Number(outp.trim_to_s);
const seg = segments.find((s) => Math.abs(s.start - t) < 0.3);
if (!seg || t <= 0.4) { console.log('no trim applied'); process.exit(0); }
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seg.start), '-i', `${out}\\render-9x16.mp4`, '-c:v', 'h264_nvenc', '-preset', 'p5', '-b:v', '10M', '-c:a', 'aac', `${out}\\render-9x16-trimmed.mp4`], { stdio: 'inherit' });
console.log(`TRIMMED at ${seg.start}s -> render-9x16-trimmed.mp4`);
