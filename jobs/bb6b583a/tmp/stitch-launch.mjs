#!/usr/bin/env node
// stitch-launch.mjs — mint a fresh Google access token from the system gcloud ADC
// (refresh token, long-lived) and exec the Stitch MCP proxy with it. Solves the
// phone-auth problem (2026-06-11): the operator's existing ADC at
// %APPDATA%/gcloud/application_default_credentials.json authenticates Stitch —
// verified live: "Connected to Stitch, discovered 14 tools". Access tokens expire
// ~1h; each session launch re-mints, so the MCP is fresh every boot.
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

const adcPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'gcloud', 'application_default_credentials.json');
const c = JSON.parse(readFileSync(adcPath, 'utf8'));
const body = new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token, grant_type: 'refresh_token' });
const j = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })).json();
if (!j.access_token) { console.error('stitch-launch: token mint failed: ' + JSON.stringify(j).slice(0, 200)); process.exit(1); }

// shell:true — Windows .cmd shims throw spawn EINVAL on modern Node without it (the
// same class as the claude.cmd fix in seat_dispatch, 2026-06-10).
const child = spawn('npx.cmd -y @_davideast/stitch-mcp@latest proxy', {
  stdio: 'inherit',
  // GOOGLE_CLOUD_PROJECT -> the proxy sends it as X-Goog-User-Project (quota project).
  // Without it stitch.googleapis.com 403s every call (receipts 2026-07-12: two relay
  // runs, identical ADC quota error; ADC-file set-quota-project alone does NOT reach
  // the proxy because this wrapper mints the token manually). Project verified
  // ENABLED for stitch.googleapis.com via serviceusage probe 2026-07-12.
  env: { ...process.env, STITCH_ACCESS_TOKEN: j.access_token, GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'project-95424c56-ddf2-4f9a-a6b' },
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
