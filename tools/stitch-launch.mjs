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
//
// GOOGLE_CLOUD_PROJECT added 2026-08-09 (this laptop's copy predated nxtbeast's
// 2026-07-12 fix and would 403 on every call without it — the proxy sends this as
// X-Goog-User-Project, the quota project; ADC alone does not supply it to the
// proxy). Same project id nxtbeast uses, already verified ENABLED for
// stitch.googleapis.com.
const child = spawn('npx.cmd -y @_davideast/stitch-mcp@latest proxy', {
  stdio: 'inherit',
  env: { ...process.env, STITCH_ACCESS_TOKEN: j.access_token, GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'project-95424c56-ddf2-4f9a-a6b' },
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
