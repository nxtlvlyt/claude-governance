#!/usr/bin/env node
// ~/.claude/hooks/session-hash-chain.mjs
// Stop hook — SHA-256 rolling hash chain + RFC 3161 TSA anchoring.
// Node.js .mjs port of session-hash-chain.ps1 (Phase C migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// At session end:
//   1. Reads JSONL transcript line by line, computes rolling SHA-256 hash chain:
//      chain_hash_n = SHA256(line_n_utf8 || chain_hash_{n-1}_hex_utf8)
//   2. Sends the final chain_hash to a public TSA (RFC 3161) — only the hash leaves the machine.
//   3. Writes .hash-chain.json manifest with hash chain entries + TSA token.
//
// TSA endpoints (verified 2026-05-13, C2 concern: multiple fallbacks for SPoF):
//   Primary:   https://freetsa.org/tsr
//   Fallback1: http://timestamp.digicert.com
//   Fallback2: http://timestamp.acs.microsoft.com
//   Fallback3: http://timestamp.globalsign.com/tsa/r6advanced1
//
// Failure behavior: fail-OPEN. TSA unavailability logs WARNING but does not block session end.
// Per IETF draft-sharif-agent-audit-trail (2025) + EU AI Act (Aug 2026).

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as https from 'https';
import * as http from 'http';
import os from 'os';

let inp;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inp) process.exit(0);

// Locate transcript
let transcriptPath = null;
if (inp.transcript_path) {
  transcriptPath = inp.transcript_path;
} else if (inp.session_id) {
  const cwd = inp.cwd || process.cwd();
  const sanitized = cwd.replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}

if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

function computeHash(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// Build RFC 3161 TimeStampReq ASN.1 DER (SHA-256, fixed structure)
// SHA-256 OID: 2.16.840.1.101.3.4.2.1
function buildTSARequest(hexHash) {
  const hashBytes = Buffer.from(hexHash, 'hex');
  const header = Buffer.from([
    0x30, 0x39,                                                                // SEQUENCE (57)
    0x02, 0x01, 0x01,                                                          // version INTEGER 1
    0x30, 0x31,                                                                // MessageImprint SEQUENCE (49)
      0x30, 0x0d,                                                              // AlgorithmIdentifier SEQUENCE (13)
        0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,  // SHA-256 OID
        0x05, 0x00,                                                            // NULL
      0x04, 0x20,                                                              // OCTET STRING (32)
  ]);
  const footer = Buffer.from([0x01, 0x01, 0xff]); // certReq BOOLEAN TRUE
  return Buffer.concat([header, hashBytes, footer]);
}

function tryTSAEndpoint(ep, reqBody) {
  return new Promise((resolve) => {
    try {
      const url = new URL(ep);
      const transport = url.protocol === 'https:' ? https : http;
      const req = transport.request({
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/timestamp-query',
          'Content-Length': reqBody.length,
        },
        timeout: 8000,
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if (body.length > 10) {
            resolve({ status: 'OK', endpoint: ep, token: body.toString('base64') });
          } else {
            resolve(null);
          }
        });
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(reqBody);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

async function requestTSA(hexHash) {
  const reqBody = buildTSARequest(hexHash);
  const endpoints = [
    'https://freetsa.org/tsr',
    'http://timestamp.digicert.com',
    'http://timestamp.acs.microsoft.com',
    'http://timestamp.globalsign.com/tsa/r6advanced1',
  ];
  for (const ep of endpoints) {
    const result = await tryTSAEndpoint(ep, reqBody);
    if (result) return result;
  }
  return { status: 'FAILED_OPEN', endpoint: null, token: null };
}

let ctx;
try {
  // Read transcript lines, filter null/empty (same as PS1: Where-Object { $_ -ne $null })
  const lines = readFileSync(transcriptPath, 'utf8').split('\n').filter(l => l !== '');
  const genesis = '0'.repeat(64);
  let prev = genesis;
  const entries = [];

  for (const line of lines) {
    const lh = computeHash(Buffer.from(line, 'utf8'));
    const ch = computeHash(Buffer.from(line + prev, 'utf8'));
    entries.push({ lh, ch });
    prev = ch;
  }

  // Request TSA token for the final chain hash
  const tsa = await requestTSA(prev);

  const ts = new Date().toISOString().replace(/(\.\d+)?Z$/, (_, ms) => {
    const offset = -(new Date().getTimezoneOffset());
    const sign = offset >= 0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const mm = String(Math.abs(offset) % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}`;
  });

  const manifest = {
    v:            2,
    transcript:   transcriptPath,
    ts,
    session_id:   inp.session_id,
    n:            lines.length,
    final:        prev,
    tsa_status:   tsa.status,
    tsa_endpoint: tsa.endpoint,
    tsa_token:    tsa.token,
    entries,
  };

  const manifestPath = transcriptPath.replace(/\.jsonl$/, '') + '.hash-chain.json';
  writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');

  const short = prev.length >= 16 ? prev.slice(0, 16) + '...' : prev;
  ctx = tsa.status === 'OK'
    ? `P6 hash chain + TSA token written: ${manifestPath} (${lines.length} entries, final=${short}, tsa=${tsa.endpoint})`
    : `P6 hash chain written (TSA FAILED_OPEN): ${manifestPath} (${lines.length} entries, final=${short}) — non-repudiation gap for this session`;

} catch (e) {
  ctx = `P6 hash chain: FAILED (${e.message}) — fail-open, session end not blocked`;
}

process.stdout.write(JSON.stringify({ decision: 'approve', reason: ctx }));
process.exit(0);
