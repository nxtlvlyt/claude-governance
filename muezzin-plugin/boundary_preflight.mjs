#!/usr/bin/env node
// boundary_preflight.mjs — THE BOUNDARY MIQAT (2026-08-01).
//
// WHY THIS EXISTS. In one session (2026-08-01) the conductor asserted six times that
// something worked ACROSS A BOUNDARY without testing the boundary, and missions died:
//   1. `<` inside `ssh nxtbeast "wsl -d Ubuntu -- wc -c < FILE"` — consumed by nxtbeast's
//      *Windows* shell before WSL ever saw it ("The system cannot find the path specified").
//   2. `>` same mechanism -> the script landed on the WINDOWS filesystem, WSL read nothing
//      -> TRAP6-ZERO-BYTE-SCRIPT.
//   3. `& disown` same mechanism -> "'disown' is not recognized".
//   4. `MISSION-CLASS: remote-compute` — an INVENTED class. command_queue.mjs matches ONLY
//      /MISSION-CLASS:\s*ops-deploy/i or the literal token `command-class`; anything else
//      fail-opens to the architect panel and never runs from REPO-ROOT. Cost: 2 missions.
//   5. A fresh BARE line appended to AUTORUN.md beside an existing status line for the same
//      path -> QUEUE-DUP skipped x4. The convention is RE-BARE THE ORIGINAL LINE IN PLACE.
//   6. A byte-equality assertion across a transfer "that normalises line endings" — 31 CR =
//      the whole 4371-vs-4340 delta; the content was identical and the CHECK was wrong.
//
// Every one of those is mechanically testable in seconds. This file tests them and prints a
// receipt. It is not documentation; it runs the real commands.
//
// Conductor-core laws this serves:
//   - FIRST LAW ("read before you claim"): a boundary assertion now carries a probe receipt.
//   - FOURTH LAW ("a named bug is not a handled bug"): the six failures become a gate.
//   - FIFTH LAW ("grade it or refute it"): every causal line below is EXECUTED with the probe
//     that produced it, never a remembered mechanism.
//   - SIXTH LAW ("name the purpose-built tool"): B6/B8 IMPORT command_queue.mjs and
//     mission_lint.mjs rather than re-deriving what the engine already decides.
//   - NINTH LAW ("the dry-run is conductor work"): this IS the dry-run, runnable in-session.
//
// USAGE
//   node boundary_preflight.mjs                      # B1-B5, environment only
//   node boundary_preflight.mjs --mission missions/x.mission.txt   # + B6-B9
//   node boundary_preflight.mjs --selftest           # parsing logic, no ssh, no network
//   node boundary_preflight.mjs --json               # machine-readable receipt
// Flags: --host <name> (default nxtbeast) · --distro <name> (default Ubuntu)
//        --skip-remote (B1/B2/B5 -> SKIP) · --strict-remote (remote WARN -> FAIL)
//        --allow-wsl-shutdown (permit the B5 recovery attempt; refused while a lane runs)
//
// EXIT: non-zero if any check FAILs, so it can gate a fire.
//
// WRITE DISCIPLINE: read-only against missions/, AUTORUN.md and every project repo. The only
// things it writes are its own probe files (os.tmpdir() locally, %TEMP% on the remote Windows
// side, /tmp inside WSL) and it deletes each one it creates.

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { isCommandClassMission, buildLiteralCommandQueue } from './command_queue.mjs';
import { lintMission } from './mission_lint.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTORUN = path.join(HERE, 'missions', 'AUTORUN.md');
const DAEMON_STATUS = path.join(HERE, 'missions', '_logs', 'daemon-status.json');

// ═══════════════════════════════════════════════════════════════════ pure helpers (selftested)

// WSL writes its own diagnostics as UTF-16LE, so `Failed to attach disk ...` arrives as
// "F a i l e d   t o ..." when read as utf8. Decode by NUL-density rather than by guessing:
// a real utf8 stream from these probes never carries NUL bytes.
export function decodeMaybeUtf16(buf) {
  if (!buf || !buf.length) return '';
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8');
  const head = b.subarray(0, Math.min(b.length, 128));
  let nuls = 0;
  for (const byte of head) if (byte === 0) nuls++;
  if (nuls > head.length / 4) return b.toString('utf16le').replace(/\u0000/g, '');
  return b.toString('utf8');
}

export function countCR(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8');
  let n = 0;
  for (const byte of b) if (byte === 13) n++;
  return n;
}

// Did the redirect survive to the far side, or did the near shell eat it?
// baseline = output of the redirect-FREE equivalent (must be the same value the redirect
// form would print). redirect = output of the redirect form.
export function classifyRedirect(baseline, redirect) {
  const bl = String(baseline || '').trim();
  const rd = String(redirect || '').trim();
  if (!/^\d+$/.test(bl)) return 'INDETERMINATE';           // no trustworthy baseline
  if (rd === bl) return 'SURVIVES';
  return 'EATEN';
}

// A Windows Store execution-alias stub: a 0-byte reparse point under WindowsApps that opens
// the Microsoft Store instead of running anything. `python`/`python3` are the usual victims.
export function isAliasStub(sourcePath) {
  return /[\\/]AppData[\\/]Local[\\/]Microsoft[\\/]WindowsApps[\\/]/i.test(String(sourcePath || ''));
}

// ── AUTORUN semantics ────────────────────────────────────────────────────────────────────
// MIRRORED (deliberately, not imported) from muezzin-daemon.mjs:488-541 — statusOf /
// missionPath / readQueue's QUEUE-DUP guard. IMPORTING THE DAEMON IS UNSAFE FROM HERE:
// muezzin-daemon.mjs:1839 is a TOP-LEVEL `if (process.argv.includes('--selftest'))` block, so
// `node boundary_preflight.mjs --selftest` would execute the DAEMON's whole selftest suite on
// import. (That is itself a boundary this file exists to respect.) The selftest below locks
// the mirrored semantics against fixtures taken from the daemon's own test cases.
const STATUS_RE = /^(DONE|FAILED|RUNNING|SPLIT|PARKED)\b/;
export function statusOfLine(line) { const m = String(line).trim().match(STATUS_RE); return m ? m[1] : null; }
export function missionPathOfLine(line) {
  let s = String(line).replace(/<!--.*?-->/g, '').trim();
  while (STATUS_RE.test(s)) s = s.replace(STATUS_RE, '').trim();
  return s;
}

// analyzeAutorun(autorunText, missionRel) -> { rows, verdict, detail }
// verdict: 'WILL-FIRE' | 'QUEUE-DUP' | 'NOT-QUEUED' | 'ABSENT'
export function analyzeAutorun(autorunText, missionRel) {
  const want = String(missionRel || '').replace(/\\/g, '/').trim();
  const rows = [];
  const lines = String(autorunText || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const s = raw.trim();
    if (!s) continue;
    const commented = s.startsWith('#');
    const body = commented ? s.replace(/^#+\s*/, '') : s;
    const p = missionPathOfLine(body).replace(/\\/g, '/');
    if (p !== want && !(commented && body.includes(want))) continue;
    const note = (s.match(/<!--([\s\S]*?)-->/) || [])[1]?.trim() || '';
    rows.push({
      n: i + 1,
      raw: s,
      commented,
      status: commented ? null : statusOfLine(body),
      bare: !commented && !statusOfLine(body),
      splitChild: raw.includes('<!-- SPLIT-CHILD -->'),
      note,
    });
  }
  const bares = rows.filter((r) => r.bare);
  const statuses = rows.filter((r) => !r.commented && r.status);
  if (!rows.length) return { rows, verdict: 'ABSENT', detail: 'no AUTORUN line references this mission path' };
  if (!bares.length) {
    return {
      rows,
      verdict: 'NOT-QUEUED',
      detail: `only status line(s) [${statuses.map((r) => `L${r.n} ${r.status}`).join(', ') || 'none'}] — nothing will fire. To requeue, RE-BARE THE EXISTING LINE IN PLACE (strip its status token); appending a fresh bare line is the QUEUE-DUP anti-pattern.`,
    };
  }
  const first = bares[0];
  const dupBare = bares.length > 1;
  const statusElsewhere = statuses.length > 0;
  if (dupBare) {
    return {
      rows,
      verdict: 'QUEUE-DUP',
      detail: `${bares.length} BARE lines for this path (L${bares.map((r) => r.n).join(', L')}) — daemon fires only the FIRST (muezzin-daemon.mjs readQueue seen-set); the rest are skipped as QUEUE-DUP and are a stealth attempt-counter reset. DUPLICATE-RETIRE the extras.`,
    };
  }
  if (statusElsewhere && !first.splitChild) {
    return {
      rows,
      verdict: 'QUEUE-DUP',
      detail: `bare line L${first.n} shares its path with status line(s) [${statuses.map((r) => `L${r.n} ${r.status}`).join(', ')}] and carries no <!-- SPLIT-CHILD --> marker — readQueue SKIPS it (QUEUE-DUP) and it will NEVER fire. Delete the appended bare line and RE-BARE L${statuses[0].n} in place.`,
    };
  }
  return {
    rows,
    verdict: 'WILL-FIRE',
    detail: `single actionable bare line L${first.n}${first.splitChild ? ' (SPLIT-CHILD exempt from the status-elsewhere check)' : ''} — the daemon will pick it up on its next poll.`,
  };
}

// A diagnosis appended as its own `#` line is INVISIBLE: parseAutorun (conduct-cycle.mjs:70)
// skips '#'-prefixed lines entirely, so the FAILED line re-flags as undiagnosed forever. The
// diagnosis must live INSIDE the FAILED line's own <!-- --> comment with a disposition token.
const DISPOSITION_RE = /RESOLVED|SUPERSEDED|DUPLICATE-RETIRED|PARKED|pending[- ]engine|DIAGNOSED/i;
export function diagnosisVisibility(rows) {
  const failed = rows.filter((r) => !r.commented && /^(FAILED|PARKED)$/.test(r.status || ''));
  if (!failed.length) return { ok: true, detail: 'no FAILED/PARKED line to diagnose' };
  const undiagnosed = failed.filter((r) => !DISPOSITION_RE.test(r.note || ''));
  // a disposition written on a '#'-prefixed line: parseAutorun never sees it.
  const commentedNotes = rows.filter((r) => r.commented && DISPOSITION_RE.test(r.raw || ''));
  if (!undiagnosed.length) return { ok: true, detail: `all ${failed.length} FAILED/PARKED line(s) carry a disposition token inside their own comment` };
  return {
    ok: false,
    detail: `L${undiagnosed.map((r) => r.n).join(', L')} FAILED/PARKED with NO disposition token (RESOLVED/SUPERSEDED/DUPLICATE-RETIRED/PARKED/pending-engine/DIAGNOSED) inside the line's OWN <!-- --> comment${commentedNotes.length ? ` — note ${commentedNotes.length} '#'-prefixed line(s) here, which parseAutorun skips entirely (conduct-cycle.mjs:70), so a diagnosis written there is invisible` : ''}. It re-flags as undiagnosed debt every beat (seventh law).`,
  };
}

// ── mission class ────────────────────────────────────────────────────────────────────────
// The ONLY MISSION-CLASS values anything in the engine recognizes:
//   command_queue.mjs:20    -> /MISSION-CLASS:\s*ops-deploy/i  or the literal token command-class
//   mission_class.mjs:62-67 -> 'code-repo' | 'research' | 'code'; ANYTHING ELSE silently
//                              defaults to 'research'.
// An invented class is therefore never rejected — it is silently reinterpreted. Failure #4.
const RECOGNIZED_CLASSES = ['ops-deploy', 'code-repo', 'research', 'code'];
export function classifyMissionClass(text) {
  const t = String(text || '');
  const m = t.match(/MISSION-CLASS:\s*([^\r\n]+)/i);
  const declared = m ? m[1].trim() : null;
  const recognized = declared ? RECOGNIZED_CLASSES.includes(declared.toLowerCase()) : null;
  const commandClass = isCommandClassMission(t);
  const queue = commandClass ? buildLiteralCommandQueue(t) : { ok: false, reason: 'not a command-class mission (no "MISSION-CLASS: ops-deploy", no literal "command-class" token)' };
  const effective = declared && RECOGNIZED_CLASSES.includes(declared.toLowerCase())
    ? (declared.toLowerCase() === 'ops-deploy' ? 'ops-deploy (command-class)' : declared.toLowerCase())
    : 'research (SILENT DEFAULT — mission_class.mjs:62-67)';
  return { declared, recognized, commandClass, queue, effective };
}

// ── fenced command extraction ────────────────────────────────────────────────────────────
// MIRROR of command_queue.mjs:35 FENCE (that regex is module-private). The selftest asserts
// this extractor agrees step-for-step with buildLiteralCommandQueue on a command-class
// fixture, so a drift in either one fails the suite rather than passing silently.
const FENCE_RE = /```(?:sh|bash|shell|pwsh|powershell|ps1|cmd|console)[ \t]*\r?\n([\s\S]*?)```/gi;
export function extractFencedCommands(text) {
  const t = String(text || '');
  const cmds = [];
  FENCE_RE.lastIndex = 0;
  let m;
  while ((m = FENCE_RE.exec(t)) !== null) {
    for (const lineRaw of m[1].split(/\r?\n/)) {
      const line = lineRaw.replace(/^\s*\$\s+/, '').trim();
      if (!line || line.startsWith('#')) continue;
      cmds.push(line);
    }
  }
  return cmds;
}

// Relative-path tokens inside fenced commands. They resolve ONLY if the engine hands the
// mission REPO-ROOT as cwd — which is exactly what B6 determines.
const PATHY_EXT = /\.(mjs|cjs|js|json|sh|bash|ps1|psm1|md|txt|py|html|css|yml|yaml|toml|sql|gguf|jsonl|csv)$/i;
export function scanRelativePaths(text) {
  const hits = [];
  for (const cmd of extractFencedCommands(text)) {
    for (const rawTok of cmd.split(/\s+/)) {
      const tok = rawTok.replace(/^["']|["'],?$/g, '');
      if (!tok || tok.startsWith('-')) continue;
      if (tok.includes('://')) continue;                       // URL
      if (/^[A-Za-z]:[\\/]/.test(tok)) continue;               // C:\... absolute
      if (/^[\\/]/.test(tok)) continue;                        // /abs or \\unc
      if (/^[%$]/.test(tok) || /^\$env:/i.test(tok)) continue; // %TEMP%, $env:X, $var
      // PATH-SHAPED, not merely slash-containing. Live receipt 2026-08-01: a first cut flagged
      // `pending/0` and `PASS/0` out of a PowerShell status string, drowning the real finding.
      // A token counts as a relative path only when it is EXPLICITLY relative (./ ../ .\),
      // ends in a directory slash, or carries a file extension on its last segment.
      if (/^[sy]\/[^/]*\/[^/]*\/[gimpIe]*$/.test(tok)) continue;   // sed s/a/b/ , y/a/b/ — an expression, not a path
      const explicitlyRel = /^\.{1,2}[\\/]/.test(tok);
      const trailingSlash = /[\\/]$/.test(tok);
      const lastSeg = tok.split(/[\\/]/).filter(Boolean).pop() || '';
      const hasSep = tok.includes('/') || tok.includes('\\');
      const extOnLast = PATHY_EXT.test(lastSeg) || (hasSep && /^[\w.-]+\.[A-Za-z][\w]{0,5}$/.test(lastSeg));
      if (!(explicitlyRel || trailingSlash || extOnLast)) continue;
      if (/^\d+$/.test(tok)) continue;
      hits.push({ cmd, token: tok });
    }
  }
  return hits;
}

// Does the mission itself carry the shape B1/B2 prove is broken — a redirect or a bare `&`
// inside a QUOTED ssh payload? (`bash -c '...'` does NOT protect: cmd ignores single quotes.)
export function scanSshRedirectAntipattern(text) {
  const hits = [];
  for (const cmd of extractFencedCommands(text)) {
    if (!/\bssh\b/.test(cmd)) continue;
    const quoted = cmd.match(/"([^"]*)"/g) || [];
    for (const q of quoted) {
      if (/[<>]/.test(q) && !/>>?\s*\$null/i.test(q)) hits.push({ cmd, kind: 'redirect', evidence: q });
      else if (/(^|[^&])&(?!&)/.test(q)) hits.push({ cmd, kind: 'ampersand', evidence: q });
    }
  }
  return hits;
}

export function missionUsesWsl(text) { return /\bwsl\s+(-d\b|--)/i.test(String(text || '')); }

// ═══════════════════════════════════════════════════════════════════════════ runners

function runLocal(exe, args, timeout = 60000) {
  try {
    const out = execFileSync(exe, args, { encoding: 'buffer', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: decodeMaybeUtf16(out), err: '' };
  } catch (e) {
    return {
      ok: false,
      out: decodeMaybeUtf16(e.stdout || Buffer.alloc(0)),
      err: decodeMaybeUtf16(e.stderr || Buffer.alloc(0)) || String(e.message || e),
    };
  }
}

// The ONE-ARG form is the boundary under test: ssh hands `remoteCmd` to the REMOTE shell
// (Windows OpenSSH default = cmd.exe), which parses < > & itself before wsl ever runs.
function ssh(host, remoteCmd, timeout = 60000) {
  const r = runLocal('ssh', ['-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes', host, remoteCmd], timeout);
  return { ...r, combined: `${r.out}\n${r.err}`.trim(), cmd: `ssh ${host} "${remoteCmd}"` };
}

// The shell the ENGINE actually uses for every command/validation line
// (seat_dispatch.mjs:288 — pwsh.exe -NoProfile -NonInteractive -Command <cmd>).
function pwsh(cmd, timeout = 60000) {
  return runLocal('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], timeout);
}

const oneline = (s, n = 200) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// ═══════════════════════════════════════════════════════════════════════════ checks

const results = [];
const add = (id, name, result, evidence, cure) => results.push({ id, name, result, evidence, cure: cure || null });

function checkB1(host, distro, mission) {
  const probe = `/tmp/bp-probe-${process.pid}.txt`;
  const winProbe = `%TEMP%\\bp-redirect-${process.pid}.txt`;
  const CURE = [
    'redirect-free equivalents that DO work across ssh->cmd->wsl:',
    '  size of a file      : ssh host "wsl -d D -- stat -c %s FILE"        (NOT `wc -c < FILE`)',
    '  edit a file in place: ssh host "wsl -d D -- cp SRC DST" then "wsl -d D -- sed -i -e ... DST"   (NOT `sed ... > out`)',
    '  read a file         : ssh host "wsl -d D -- cat FILE"               (NOT `< FILE`)',
    '  anything needing < > & | : put it in a .sh FILE, scp the file up, then `wsl -d D -- bash /path/script.sh`',
    'NOTE (probed live): bash -c \'...\' does NOT protect — cmd.exe does not honour single quotes.',
  ].join('\n      ');

  ssh(host, `wsl -d ${distro} -- cp /etc/hostname ${probe}`);
  const baseline = ssh(host, `wsl -d ${distro} -- stat -c %s ${probe}`);
  const redirect = ssh(host, `wsl -d ${distro} -- wc -c < ${probe}`);
  const quoted = ssh(host, `wsl -d ${distro} -- bash -c 'wc -c < ${probe}'`);

  // output-redirect half: if the WINDOWS side gets the file, cmd performed the redirect.
  ssh(host, `wsl -d ${distro} -- echo BP_REDIRECT_PROBE > ${winProbe}`);
  const winCheck = ssh(host, `if exist ${winProbe} (for %I in (${winProbe}) do @echo WINDOWS_FILE_CREATED size=%~zI) else (@echo NO_WINDOWS_FILE)`);
  ssh(host, `del ${winProbe}`);
  ssh(host, `wsl -d ${distro} -- rm -f ${probe}`);

  const verdict = classifyRedirect(baseline.combined, redirect.combined);
  const winMade = /WINDOWS_FILE_CREATED/.test(winCheck.combined);
  const quotedEaten = classifyRedirect(baseline.combined, quoted.combined) === 'EATEN';

  const ev = [
    `baseline \`stat -c %s\` = ${oneline(baseline.combined, 60) || '(empty)'}`,
    `\`wc -c < FILE\` -> ${verdict}: ${oneline(redirect.combined, 80) || '(empty)'}`,
    `bash -c 'wc -c < FILE' -> ${quotedEaten ? 'ALSO EATEN (single quotes do not protect)' : 'differs'}`,
    `\`echo X > %TEMP%\\f\` -> ${winMade ? 'WINDOWS-side file created (cmd did the redirect, WSL never saw it)' : oneline(winCheck.combined, 60)}`,
  ].join(' | ');

  if (verdict === 'INDETERMINATE') return add('B1', 'SHELL-REDIRECT', 'WARN', `INDETERMINATE — no numeric baseline (${oneline(baseline.combined, 90) || 'no output'}); WSL may be down, see B5`, CURE);
  if (verdict === 'SURVIVES') return add('B1', 'SHELL-REDIRECT', 'WARN', `REDIRECT SURVIVES on this host — the documented cure text is STALE for ${host}. ${ev}`, CURE);

  // EATEN is the expected, correct-for-the-architecture answer. FAIL only if the CURE itself
  // is broken (the redirect-free form must work, or the prescribed workaround is a lie).
  const missionHits = mission ? scanSshRedirectAntipattern(mission.text).filter((h) => h.kind === 'redirect') : [];
  if (missionHits.length) {
    return add('B1', 'SHELL-REDIRECT', 'FAIL',
      `redirect is EATEN by the remote Windows shell AND this mission carries the broken shape: ${missionHits.map((h) => oneline(h.evidence, 90)).join(' ;; ')}. ${ev}`, CURE);
  }
  return add('B1', 'SHELL-REDIRECT', 'PASS', `EATEN (expected). ${ev}`, CURE);
}

function checkB2(host, distro, mission) {
  const CURE = [
    'ampersand across ssh->cmd->wsl:',
    '  cmd.exe splits the payload at `&` and runs the tail ITSELF — `& disown`, `& sleep`, `&&`',
    '  chains and background launches never reach the far shell.',
    '  Detached launch that works: write the whole thing to a .sh file, scp it up, then',
    '    ssh host "wsl -d D -- bash -c \\"nohup bash /path/run.sh >/dev/null 2>&1 &\\"" is STILL unsafe;',
    '    the reliable form is a FILE that self-backgrounds: script contains `nohup ... &` and you run',
    '    ssh host "wsl -d D -- bash /path/run.sh"  (no & anywhere in the ssh payload).',
  ].join('\n      ');

  const disown = ssh(host, `wsl -d ${distro} -- true & disown`);
  const split = ssh(host, `wsl -d ${distro} -- echo BP_A & echo BP_B_FROM_CMD`);
  const eaten = /is not recognized as an internal or external command/i.test(disown.combined)
    || /BP_B_FROM_CMD/.test(split.combined);

  const ev = [
    `\`... & disown\` -> ${oneline(disown.combined, 90) || '(empty)'}`,
    `\`echo BP_A & echo BP_B_FROM_CMD\` -> ${/BP_B_FROM_CMD/.test(split.combined) ? 'cmd.exe ran the tail itself (payload SPLIT at &)' : oneline(split.combined, 60)}`,
  ].join(' | ');

  if (!disown.combined && !split.combined) return add('B2', 'AMPERSAND', 'WARN', `INDETERMINATE — no output from either probe (host reachable? see B5)`, CURE);
  if (!eaten) return add('B2', 'AMPERSAND', 'WARN', `& appears to SURVIVE on this host — the documented cure text is STALE. ${ev}`, CURE);

  const missionHits = mission ? scanSshRedirectAntipattern(mission.text).filter((h) => h.kind === 'ampersand') : [];
  if (missionHits.length) {
    return add('B2', 'AMPERSAND', 'FAIL',
      `& is EATEN by the remote Windows shell AND this mission carries the broken shape: ${missionHits.map((h) => oneline(h.evidence, 90)).join(' ;; ')}. ${ev}`, CURE);
  }
  return add('B2', 'AMPERSAND', 'PASS', `EATEN (expected). ${ev}`, CURE);
}

function checkB3(host, missionRepoRoot) {
  const CURE = [
    'before asserting byte-equality across a transfer:',
    '  1. count CR on BOTH sides — a delta exactly equal to the LINE COUNT is CRLF, not content;',
    '  2. compare content-normalised (strip \\r) as well as raw;',
    '  3. write files with node fs.writeFileSync (LF-exact). PowerShell Set-Content/Out-File',
    '     inject CRLF (probed below), and `git config core.autocrlf true` re-injects CR on checkout.',
  ].join('\n      ');

  const tmp = os.tmpdir();
  const lfPath = path.join(tmp, `bp-lf-${process.pid}.txt`);
  const backPath = path.join(tmp, `bp-lf-back-${process.pid}.txt`);
  const psPath = path.join(tmp, `bp-ps-${process.pid}.txt`);
  const remoteRel = `AppData/Local/Temp/bp-lf-${process.pid}.txt`;
  const parts = [];
  let verdict = 'PASS';

  try {
    writeFileSync(lfPath, 'alpha\nbeta\ngamma\n');
    const localBytes = readFileSync(lfPath);
    parts.push(`local write (node fs) = ${localBytes.length}B CR=${countCR(localBytes)}`);

    // hop 1 — scp round trip (skipped when there is no remote host to test against)
    const up = host ? runLocal('scp', ['-q', lfPath, `${host}:${remoteRel}`], 45000) : null;
    if (!host) {
      parts.push('scp hop SKIPPED (--skip-remote)');
    } else if (up.ok) {
      if (existsSync(backPath)) unlinkSync(backPath);
      const down = runLocal('scp', ['-q', `${host}:${remoteRel}`, backPath], 45000);
      ssh(host, `del %TEMP%\\bp-lf-${process.pid}.txt`, 30000);
      if (down.ok && existsSync(backPath)) {
        const back = readFileSync(backPath);
        parts.push(`scp round-trip = ${back.length}B CR=${countCR(back)}`);
        if (countCR(back) !== countCR(localBytes) || back.length !== localBytes.length) {
          verdict = 'FAIL';
          parts.push('scp INJECTED CR — every byte-equality assertion across scp is unsound on this host');
        } else {
          parts.push('scp is BYTE-EXACT (no CR injected)');
        }
      } else {
        verdict = 'WARN';
        parts.push(`scp download INDETERMINATE: ${oneline(down.err, 80)}`);
      }
    } else {
      verdict = 'WARN';
      parts.push(`scp upload INDETERMINATE: ${oneline(up.err, 80)}`);
    }

    // hop 2 — the LOCAL WRITER, which is where the CR actually comes from
    const ps = pwsh(`Set-Content -Path '${psPath}' -Value @('alpha','beta','gamma')`, 45000);
    if (ps.ok && existsSync(psPath)) {
      const psBytes = readFileSync(psPath);
      parts.push(`pwsh Set-Content = ${psBytes.length}B CR=${countCR(psBytes)}`);
      if (countCR(psBytes) > 0) {
        if (verdict === 'PASS') verdict = 'WARN';
        parts.push(`PowerShell writers inject 1 CR PER LINE — a "size delta == line count" is CRLF, not content`);
      }
    } else {
      parts.push('pwsh writer probe INDETERMINATE (pwsh.exe absent or refused)');
    }
  } finally {
    for (const f of [lfPath, backPath, psPath]) { try { if (existsSync(f)) unlinkSync(f); } catch { /* best effort */ } }
  }

  // hop 3 — git autocrlf, per DISTINCT repo (a mission whose REPO-ROOT is the plugin itself
  // must not be probed twice — live receipt 2026-08-01, duplicated evidence string)
  const repos = [...new Set([HERE, missionRepoRoot].filter(Boolean).map((r) => path.resolve(r)))];
  for (const repo of repos) {
    const g = runLocal('git', ['-C', repo, 'config', '--get', 'core.autocrlf'], 20000);
    const val = (g.out || '').trim() || '(unset)';
    parts.push(`core.autocrlf[${path.basename(repo)}] = ${val}`);
    if (/^true$/i.test(val) && verdict === 'PASS') verdict = 'WARN';
  }

  add('B3', 'LINE-ENDINGS', verdict, parts.join(' | '), CURE);
}

function checkB4() {
  const CURE = 'a WindowsApps path is a 0-byte Store execution-alias stub: it opens the Microsoft Store instead of running. Call the real interpreter by absolute path, or use node.';
  const names = ['ssh', 'scp', 'node', 'wsl', 'git', 'python', 'python3', 'pwsh'];
  const script = names.map((n) => `$c = Get-Command '${n}' -ErrorAction SilentlyContinue; if ($c) { Write-Output ('${n}=' + $c.Source) } else { Write-Output '${n}=ABSENT' }`).join('; ');
  const r = pwsh(script, 45000);
  if (!r.ok && !r.out) return add('B4', 'EXEC-RESOLUTION', 'FAIL', `could not run pwsh.exe -NoProfile -NonInteractive (the shell seat_dispatch.mjs:288 uses for EVERY command line): ${oneline(r.err, 120)}`, CURE);

  const map = {};
  for (const line of String(r.out).split(/\r?\n/)) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m) map[m[1]] = m[2].trim();
  }
  const REQUIRED = ['ssh', 'node', 'git'];
  const missingRequired = REQUIRED.filter((n) => !map[n] || map[n] === 'ABSENT');
  const stubs = Object.entries(map).filter(([, src]) => isAliasStub(src)).map(([n, src]) => `${n} -> ${src} (STORE ALIAS STUB)`);
  const ev = Object.entries(map).map(([n, src]) => `${n}=${src === 'ABSENT' ? 'ABSENT' : path.basename(src)}${isAliasStub(src) ? ' [STUB]' : ''}`).join(' ');

  if (missingRequired.length) return add('B4', 'EXEC-RESOLUTION', 'FAIL', `REQUIRED exe absent from the engine's shell: ${missingRequired.join(', ')}. ${ev}`, CURE);
  if (stubs.length) return add('B4', 'EXEC-RESOLUTION', 'WARN', `${stubs.join(' ; ')} — ${ev}`, CURE);
  return add('B4', 'EXEC-RESOLUTION', 'PASS', ev, CURE);
}

function laneRunning() {
  try {
    const st = JSON.parse(readFileSync(DAEMON_STATUS, 'utf8'));
    return Array.isArray(st.lanes) && st.lanes.length ? st.lanes.map((l) => (typeof l === 'string' ? l : l?.path)).filter(Boolean) : [];
  } catch { return []; }
}

function checkB5(host, distro, mission, allowShutdown) {
  const CURE = [
    'nxtbeast WSL intermittently fails to attach its ext4.vhdx:',
    '  "Failed to attach disk \'D:\\WSL\\Ubuntu\\ext4.vhdx\' to WSL2: Access is denied."',
    '  (Wsl/Service/CreateInstance/MountDisk/HCS/E_ACCESSDENIED)',
    '  Recovery: ssh <host> "wsl --shutdown"  then re-probe. It is NOT run by default here —',
    '  a shutdown kills every running distro, so it is gated behind --allow-wsl-shutdown AND a',
    '  zero-lane check (conductor-direct condition 3: no lane running against the target).',
  ].join('\n      ');

  const probe = () => ssh(host, `wsl -d ${distro} -- echo BP_WSL_ALIVE`, 60000);
  let r = probe();
  if (/BP_WSL_ALIVE/.test(r.combined)) return add('B5', 'WSL-LIVENESS', 'PASS', `wsl -d ${distro} responded: BP_WSL_ALIVE`, CURE);

  const attachFail = /Failed to attach disk|E_ACCESSDENIED/i.test(r.combined);
  const lanes = laneRunning();
  let recovered = false;
  let note = '';
  if (allowShutdown) {
    if (lanes.length) {
      note = ` — recovery REFUSED: ${lanes.length} lane(s) running (${lanes.join(', ')}); wsl --shutdown would kill them`;
    } else {
      ssh(host, 'wsl --shutdown', 60000);
      r = probe();
      recovered = /BP_WSL_ALIVE/.test(r.combined);
      note = recovered ? ' — RECOVERED by `wsl --shutdown`' : ' — `wsl --shutdown` did NOT recover it';
    }
  } else {
    note = lanes.length
      ? ` — recovery not attempted (no --allow-wsl-shutdown; ${lanes.length} lane(s) running anyway)`
      : ' — recovery not attempted (pass --allow-wsl-shutdown to try `wsl --shutdown`)';
  }

  if (recovered) return add('B5', 'WSL-LIVENESS', 'PASS', `was DOWN (${attachFail ? 'ext4.vhdx attach denied' : oneline(r.combined, 70)}), recovered by wsl --shutdown`, CURE);
  const severity = mission && missionUsesWsl(mission.text) ? 'FAIL' : 'WARN';
  return add('B5', 'WSL-LIVENESS', severity,
    `wsl -d ${distro} DOWN: ${oneline(r.combined, 130) || 'no output'}${note}${severity === 'FAIL' ? ' — and THIS MISSION invokes wsl, so firing it is doomed' : ''}`, CURE);
}

function checkB6(mission) {
  const CURE = `the ONLY recognized MISSION-CLASS values are: ${RECOGNIZED_CLASSES.join(' | ')} (command_queue.mjs:20 + mission_class.mjs:62-67). Any other string is NOT rejected — it silently defaults to research and the fenced command block is re-planned by the architect panel from a sandbox cwd, absolute paths rewritten to relative.`;
  const c = classifyMissionClass(mission.text);

  if (c.declared && !c.recognized && !c.commandClass) {
    return add('B6', 'MISSION-CLASS', 'FAIL',
      `declared "MISSION-CLASS: ${c.declared}" is NOT a recognized class — effective class ${c.effective}. The literal command queue will NOT be used; the mission fail-opens to the architect panel and never runs from REPO-ROOT.`, CURE);
  }
  if (!c.commandClass) {
    const fenced = extractFencedCommands(mission.text);
    if (fenced.length) {
      return add('B6', 'MISSION-CLASS', 'WARN',
        `declared "${c.declared || '(none)'}" -> effective ${c.effective}; NOT command-class, yet the mission carries ${fenced.length} fenced shell command(s). Those commands will be RE-PLANNED by the architect panel (absolute paths rewritten relative), not run verbatim.`, CURE);
    }
    return add('B6', 'MISSION-CLASS', 'PASS', `declared "${c.declared || '(none)'}" -> effective ${c.effective}; no fenced command block, planner path is correct for this mission.`, CURE);
  }
  if (!c.queue.ok) {
    return add('B6', 'MISSION-CLASS', 'FAIL',
      `command-class detected but buildLiteralCommandQueue FAIL-OPENS: ${c.queue.reason}. The mission silently falls back to the architect panel instead of running its literal commands.`, CURE);
  }
  const steps = c.queue.queue.steps;
  return add('B6', 'MISSION-CLASS', 'PASS',
    `declared "${c.declared || '(implicit command-class token)'}" -> literal queue WILL be used: ${steps.length} verbatim step(s), mission_id=${c.queue.queue.mission_id}, step1="${oneline(steps[0].validation_command, 90)}"`, CURE);
}

function checkB7(mission) {
  const CURE = 'to requeue a mission, RE-BARE THE EXISTING LINE IN PLACE (strip its DONE/FAILED/RUNNING token). Appending a fresh bare line beside a status line for the same path is skipped as QUEUE-DUP (muezzin-daemon.mjs readQueue) and never fires. A diagnosis belongs INSIDE the FAILED line\'s own <!-- --> comment — a separate "#" line is invisible to parseAutorun.';
  if (!existsSync(AUTORUN)) return add('B7', 'AUTORUN-DUP', 'WARN', `AUTORUN.md not found at ${AUTORUN}`, CURE);
  const text = readFileSync(AUTORUN, 'utf8');
  const a = analyzeAutorun(text, mission.rel);
  const rowsEv = a.rows.length
    ? a.rows.map((r) => `L${r.n}:${r.commented ? '#COMMENT' : (r.status || 'BARE')}${r.splitChild ? '+SPLIT-CHILD' : ''}`).join(' ')
    : '(none)';
  const diag = diagnosisVisibility(a.rows);

  const evidence = `${a.verdict} — ${a.detail} [lines: ${rowsEv}]${diag.ok ? '' : ` || DIAGNOSIS-INVISIBLE: ${diag.detail}`}`;
  if (a.verdict === 'QUEUE-DUP') return add('B7', 'AUTORUN-DUP', 'FAIL', evidence, CURE);
  if (a.verdict === 'ABSENT' || a.verdict === 'NOT-QUEUED') return add('B7', 'AUTORUN-DUP', 'WARN', evidence, CURE);
  if (!diag.ok) return add('B7', 'AUTORUN-DUP', 'WARN', evidence, CURE);
  return add('B7', 'AUTORUN-DUP', 'PASS', evidence, CURE);
}

function checkB8(mission) {
  const CURE = 'mission_lint.mjs is the miqat — every rule is a museum of a paid-for failure. Fix the mission text; never fire past a lint problem.';
  const v = lintMission(mission.text);
  if (v.ok) return add('B8', 'LINT', 'PASS', 'lintMission ok:true, 0 problems', CURE);
  return add('B8', 'LINT', 'FAIL', `${v.problems.length} problem(s): ${v.problems.map((p) => `[${p.rule}] ${oneline(p.detail, 110)}`).join(' ;; ')}`, CURE);
}

function checkB9(mission) {
  const CURE = 'a relative path in a fenced command resolves ONLY if the engine hands the mission REPO-ROOT as its cwd — which happens ONLY on the literal command-class path (B6). Under the planner path the cwd is a sandbox/worktree. Write absolute paths; command_queue.mjs preserves them verbatim by design.';
  const hits = scanRelativePaths(mission.text);
  const c = classifyMissionClass(mission.text);
  const literalQueueUsed = c.commandClass && c.queue.ok;
  if (!hits.length) return add('B9', 'PATHS', 'PASS', `no relative path tokens in ${extractFencedCommands(mission.text).length} fenced command(s)`, CURE);
  const ev = hits.slice(0, 8).map((h) => `"${h.token}" in \`${oneline(h.cmd, 70)}\``).join(' ;; ') + (hits.length > 8 ? ` (+${hits.length - 8} more)` : '');
  if (literalQueueUsed) return add('B9', 'PATHS', 'WARN', `${hits.length} relative token(s); the literal queue runs from REPO-ROOT (${c.queue.queue.mission_id}) so they resolve ONLY if relative to it: ${ev}`, CURE);
  return add('B9', 'PATHS', 'FAIL', `${hits.length} relative token(s) AND B6 says the literal queue will NOT be used — cwd is not REPO-ROOT and the planner rewrites paths: ${ev}`, CURE);
}

// ═══════════════════════════════════════════════════════════════════════════ selftest

function selftest() {
  let fails = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  // --- decodeMaybeUtf16 -------------------------------------------------------------
  ck(decodeMaybeUtf16(Buffer.from('plain utf8', 'utf8')) === 'plain utf8', 'decode: utf8 passthrough');
  ck(decodeMaybeUtf16(Buffer.from('Failed to attach disk', 'utf16le')) === 'Failed to attach disk', 'decode: UTF-16LE (WSL error stream) decoded, not left as "F a i l e d"');

  // --- countCR ----------------------------------------------------------------------
  ck(countCR(Buffer.from('a\nb\nc\n')) === 0, 'countCR: LF file = 0');
  ck(countCR(Buffer.from('a\r\nb\r\nc\r\n')) === 3, 'countCR: CRLF file = 1 per line (the "31 CR == 31 lines" signature)');

  // --- classifyRedirect -------------------------------------------------------------
  ck(classifyRedirect('9', 'The system cannot find the file specified.') === 'EATEN', 'classifyRedirect: cmd error => EATEN (live nxtbeast receipt)');
  ck(classifyRedirect('9', '9') === 'SURVIVES', 'classifyRedirect: same value => SURVIVES');
  ck(classifyRedirect('Failed to attach disk', 'whatever') === 'INDETERMINATE', 'classifyRedirect: no numeric baseline => INDETERMINATE');

  // --- isAliasStub ------------------------------------------------------------------
  ck(isAliasStub('C:\\Users\\marka\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe'), 'isAliasStub: WindowsApps python => stub');
  ck(!isAliasStub('C:\\Program Files\\nodejs\\node.exe'), 'isAliasStub: real node.exe => not a stub');

  // --- analyzeAutorun (mirrors muezzin-daemon.mjs readQueue) ------------------------
  const A = (t, p) => analyzeAutorun(t, p).verdict;
  ck(A('missions/x.mission.txt\n', 'missions/x.mission.txt') === 'WILL-FIRE', 'autorun: lone bare line => WILL-FIRE');
  ck(A('FAILED missions/x.mission.txt  <!-- diag -->\nmissions/x.mission.txt\n', 'missions/x.mission.txt') === 'QUEUE-DUP',
    'autorun: appended bare line beside a FAILED status line => QUEUE-DUP (failure #5 exactly)');
  ck(A('FAILED missions/x.mission.txt\nmissions/x.mission.txt  <!-- SPLIT-CHILD -->\n', 'missions/x.mission.txt') === 'WILL-FIRE',
    'autorun: SPLIT-CHILD marker exempts from the status-elsewhere check (daemon hunt-item #13)');
  ck(A('missions/x.mission.txt\nmissions/x.mission.txt\n', 'missions/x.mission.txt') === 'QUEUE-DUP', 'autorun: two bare lines => QUEUE-DUP (only the first fires)');
  ck(A('FAILED missions/x.mission.txt  <!-- RESOLVED -->\n', 'missions/x.mission.txt') === 'NOT-QUEUED', 'autorun: status line only => NOT-QUEUED (re-bare it in place)');
  ck(A('missions/y.mission.txt\n', 'missions/x.mission.txt') === 'ABSENT', 'autorun: path not present => ABSENT');
  ck(A('DONE FAILED missions/x.mission.txt\n', 'missions/x.mission.txt') === 'NOT-QUEUED', 'autorun: STACKED status tokens still resolve to the same path (daemon missionPath while-loop)');
  {
    const r = analyzeAutorun('# DIAGNOSED: missions/x.mission.txt was a false death\nmissions/x.mission.txt\n', 'missions/x.mission.txt');
    ck(r.verdict === 'WILL-FIRE' && r.rows.some((x) => x.commented),
      'autorun: a "#"-prefixed line is recorded but never counted as actionable (parseAutorun skips it)');
  }

  // --- diagnosisVisibility ----------------------------------------------------------
  {
    const rows1 = analyzeAutorun('FAILED missions/x.mission.txt  <!-- 2026-08-01 -->\n', 'missions/x.mission.txt').rows;
    ck(diagnosisVisibility(rows1).ok === false, 'diagnosis: FAILED with no disposition token in its own comment => undiagnosed debt');
    const rows2 = analyzeAutorun('FAILED missions/x.mission.txt  <!-- FAILED-DIAGNOSED: network -->\n', 'missions/x.mission.txt').rows;
    ck(diagnosisVisibility(rows2).ok === true, 'diagnosis: disposition token inside the FAILED line\'s own comment => visible');
    const rows3 = analyzeAutorun('# RESOLVED-LANDED: missions/x.mission.txt\nFAILED missions/x.mission.txt  <!-- ts -->\n', 'missions/x.mission.txt').rows;
    ck(diagnosisVisibility(rows3).ok === false, 'diagnosis: RESOLVED written on a separate "#" line is INVISIBLE — still undiagnosed');
  }

  // --- classifyMissionClass ---------------------------------------------------------
  const OPS = ['MISSION-CLASS: ops-deploy', 'MISSION-ID: M-T.1', 'REPO-ROOT: C:\\repo', '```sh', 'node C:\\repo\\x.mjs', '```'].join('\n');
  {
    const c = classifyMissionClass(OPS);
    ck(c.commandClass && c.queue.ok && c.queue.queue.steps.length === 1, 'class: ops-deploy + REPO-ROOT + fence => literal queue built');
    ck(c.recognized === true, 'class: ops-deploy recognized');
  }
  {
    const c = classifyMissionClass(OPS.replace('ops-deploy', 'remote-compute'));
    ck(c.recognized === false && c.commandClass === false, 'class: INVENTED "remote-compute" is unrecognized AND not command-class (failure #4)');
    ck(/SILENT DEFAULT/.test(c.effective), 'class: invented class reports the SILENT research default, not a rejection');
  }
  {
    const c = classifyMissionClass(OPS.replace('REPO-ROOT: C:\\repo\n', ''));
    ck(c.commandClass === true && c.queue.ok === false && /REPO-ROOT/i.test(c.queue.reason), 'class: ops-deploy without REPO-ROOT fail-opens to the planner (named reason)');
  }
  ck(classifyMissionClass('MISSION-CLASS: code-repo').recognized === true, 'class: code-repo recognized');
  ck(classifyMissionClass('MISSION-CLASS: research').recognized === true, 'class: research recognized');

  // --- extractFencedCommands agrees with command_queue.mjs (drift guard) ------------
  {
    const multi = ['MISSION-CLASS: ops-deploy', 'MISSION-ID: M-T.2', 'REPO-ROOT: C:\\r', '```sh', '$ node C:\\r\\a.mjs', '# comment', '', 'node C:\\r\\b.mjs', '```'].join('\n');
    const mine = extractFencedCommands(multi);
    const theirs = buildLiteralCommandQueue(multi);
    ck(theirs.ok && mine.length === theirs.queue.steps.length && mine.every((c, i) => c === theirs.queue.steps[i].validation_command),
      'fence: local extractor agrees step-for-step with buildLiteralCommandQueue (mirror drift guard)');
  }

  // --- scanRelativePaths ------------------------------------------------------------
  {
    const rel = ['```sh', 'node scripts/run.mjs --out C:\\abs\\out.json', 'wrangler deploy -c C:\\r\\w.toml', '```'].join('\n');
    const hits = scanRelativePaths(rel);
    ck(hits.length === 1 && hits[0].token === 'scripts/run.mjs', 'paths: relative token flagged, absolute tokens ignored');
    ck(scanRelativePaths(['```sh', 'curl https://example.com/x.json', '```'].join('\n')).length === 0, 'paths: URLs are not relative paths');
    ck(scanRelativePaths(['```sh', 'echo %TEMP%\\x.txt', '```'].join('\n')).length === 0, 'paths: %TEMP% expansion is not a relative path');
    ck(scanRelativePaths(['```sh', 'git commit -m "x" -- src/a.mjs', '```'].join('\n')).length === 1, 'paths: repo-relative pathspec still flagged (resolves only from REPO-ROOT)');
    // live receipt 2026-08-01: the first cut flagged PowerShell status strings as paths
    ck(scanRelativePaths(['```sh', "if ($x) { 'PASS/0' } else { 'pending/0' }", '```'].join('\n')).length === 0,
      'paths: slash-containing NON-path tokens (PASS/0, pending/0) are NOT flagged — the receipt stays readable');
    ck(scanRelativePaths(['```sh', 'node ./scripts/build', '```'].join('\n')).length === 1, 'paths: explicitly-relative ./x flagged even without an extension');
    ck(scanRelativePaths(['```sh', 'node conduct-cycle.mjs --selftest', '```'].join('\n')).length === 1, 'paths: bare relative script filename flagged');
    ck(scanRelativePaths(['```sh', 'wrangler pages deploy --branch=preview', '```'].join('\n')).length === 0, 'paths: subcommand words are not paths');
    ck(scanRelativePaths(['```sh', 'sed -i s/a/b/ C:\\r\\f.txt', '```'].join('\n')).length === 0, 'paths: a sed s/a/b/ expression is not a path (acceptance-run false positive)');
  }

  // --- scanSshRedirectAntipattern ---------------------------------------------------
  {
    const bad = ['```sh', 'ssh nxtbeast "wsl -d Ubuntu -- wc -c < /tmp/f"', '```'].join('\n');
    const h = scanSshRedirectAntipattern(bad);
    ck(h.length === 1 && h[0].kind === 'redirect', 'antipattern: redirect inside a quoted ssh payload detected');
    const amp = ['```sh', 'ssh nxtbeast "wsl -d Ubuntu -- bash run.sh & disown"', '```'].join('\n');
    ck(scanSshRedirectAntipattern(amp).some((x) => x.kind === 'ampersand'), 'antipattern: bare & inside a quoted ssh payload detected');
    const ok = ['```sh', 'ssh nxtbeast "wsl -d Ubuntu -- stat -c %s /tmp/f"', '```'].join('\n');
    ck(scanSshRedirectAntipattern(ok).length === 0, 'antipattern: the redirect-free cure form is clean');
    const localOnly = ['```sh', 'node x.mjs > out.txt', '```'].join('\n');
    ck(scanSshRedirectAntipattern(localOnly).length === 0, 'antipattern: a LOCAL redirect (no ssh) is not flagged — the boundary is what breaks it');
  }

  // --- missionUsesWsl ---------------------------------------------------------------
  ck(missionUsesWsl('ssh nxtbeast "wsl -d Ubuntu -- ls"') === true, 'wsl-detect: `wsl -d` found');
  ck(missionUsesWsl('run wslconfig later') === false, 'wsl-detect: "wslconfig" prose is not an invocation');

  console.log(`\n${fails === 0 ? 'ALL PASS — boundary_preflight parsing logic (redirect classification, UTF-16 decode, CR counting, AUTORUN QUEUE-DUP mirror, mission-class recognition, fence drift guard, path + antipattern scanners)' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════ main

function loadMission(argPath) {
  const abs = path.isAbsolute(argPath) ? argPath : path.resolve(HERE, argPath);
  if (!existsSync(abs)) {
    console.error(`boundary_preflight: mission not found: ${abs}`);
    process.exit(2);
  }
  const rel = path.relative(HERE, abs).replace(/\\/g, '/');
  const text = readFileSync(abs, 'utf8');
  const rr = text.match(/REPO-ROOT:\s*([^\r\n]+)/i);
  return { abs, rel, text, repoRoot: rr ? rr[1].trim().replace(/^["']|["']$/g, '') : null };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name, dflt = null) => { const i = argv.indexOf(name); return i >= 0 ? (argv[i + 1] ?? dflt) : dflt; };
  const has = (name) => argv.includes(name);

  if (has('--selftest')) return selftest();

  const host = flag('--host', 'nxtbeast');
  const distro = flag('--distro', 'Ubuntu');
  const missionArg = flag('--mission');
  const mission = missionArg ? loadMission(missionArg) : null;
  const skipRemote = has('--skip-remote');
  const strictRemote = has('--strict-remote');

  if (has('--json') === false) {
    console.log(`BOUNDARY PREFLIGHT  ${new Date().toISOString()}  host=${host}  distro=${distro}  mission=${mission ? mission.rel : '-'}`);
    const lanes = laneRunning();
    if (lanes.length) console.log(`LANES RUNNING: ${lanes.join(', ')}  (destructive recovery is refused while a lane runs)`);
    console.log('');
  }

  if (skipRemote) {
    add('B1', 'SHELL-REDIRECT', 'SKIP', '--skip-remote');
    add('B2', 'AMPERSAND', 'SKIP', '--skip-remote');
    add('B5', 'WSL-LIVENESS', 'SKIP', '--skip-remote');
  } else {
    checkB1(host, distro, mission);
    checkB2(host, distro, mission);
  }
  checkB3(skipRemote ? null : host, mission?.repoRoot && existsSync(mission.repoRoot) ? mission.repoRoot : null);
  checkB4();
  if (!skipRemote) checkB5(host, distro, mission, has('--allow-wsl-shutdown'));

  if (mission) {
    checkB6(mission);
    checkB7(mission);
    checkB8(mission);
    checkB9(mission);
  } else {
    for (const [id, name] of [['B6', 'MISSION-CLASS'], ['B7', 'AUTORUN-DUP'], ['B8', 'LINT'], ['B9', 'PATHS']]) {
      add(id, name, 'SKIP', 'no --mission <path> given');
    }
  }

  // promote remote WARNs under --strict-remote
  if (strictRemote) {
    for (const r of results) if (['B1', 'B2', 'B5'].includes(r.id) && r.result === 'WARN') r.result = 'FAIL';
  }

  results.sort((a, b) => a.id.localeCompare(b.id));   // stable B1..B9 receipt order
  const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0 };
  for (const r of results) counts[r.result]++;

  if (has('--json')) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), host, distro, mission: mission?.rel || null, counts, results }, null, 2));
  } else {
    const w = Math.max(...results.map((r) => r.name.length));
    for (const r of results) {
      console.log(`${r.id}  ${r.name.padEnd(w)}  ${r.result.padEnd(4)}  ${r.evidence}`);
    }
    const cures = results.filter((r) => r.cure && (r.result === 'FAIL' || r.result === 'WARN'));
    if (cures.length) {
      console.log('\nCURES');
      for (const r of cures) console.log(`  ${r.id}  ${r.cure}`);
    }
    console.log(`\nRESULT  ${counts.PASS} PASS / ${counts.WARN} WARN / ${counts.FAIL} FAIL / ${counts.SKIP} SKIP`);
  }
  process.exit(counts.FAIL > 0 ? 1 : 0);
}

main();
