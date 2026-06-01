#!/usr/bin/env node
// PROPOSAL — awaiting chain witness + phase-3 verification; not wired live
//
// muezzin.mjs — General, topology-agnostic orchestrator
//
// Reads a pipeline definition from a JSON config file passed as the first argument.
// Each step is either a shell command, a model dispatch, or an instance-action
// (conductor-required pause). After every step, checkpoint_verify.mjs gates
// advancement. Cycle-state is persisted to disk after every step so a
// post-compaction instance can resume.
//
// Usage:
//   node muezzin.mjs <pipeline.json> [--run-dir <dir>] [--resume] [--dry-run]
//
// Pipeline config schema (JSON):
//   {
//     "name": "string — pipeline name for logs",
//     "run_dir": "optional default run dir (override with --run-dir)",
//     "steps": [
//       {
//         "id": "unique step id",
//         "type": "shell" | "model" | "instance-action",
//         "description": "human-readable what this step does",
//
//         // shell step
//         "command": "shell command string",
//         "cwd": "optional working directory",
//         "env": { "KEY": "value" },       // optional env vars
//
//         // model step
//         "model": "ollama model name",
//         "prompt": "prompt text, or @/abs/path/to/file.txt to read from file",
//         "think": true | false | null,    // null = omit key
//         "num_predict": 4096,
//         "num_ctx": 16384,
//         "num_gpu": 0,
//
//         // instance-action step
//         "instruction": "what the conductor must do",
//         "produces": "/abs/path/to/expected/artifact.txt",
//
//         // gate (all step types)
//         "checkpoint": {
//           "file": "/abs/path/to/artifact",   // required
//           "schema": "json|jsonl|text",        // default: text
//           "keys": ["key1","key2"],            // json schema check
//           "min_chars": 200,                   // default: 200
//           "require": "regex",                 // optional content probe
//           "forbid": "regex"                   // optional content veto
//         }
//       }
//     ]
//   }
//
// Cycle-state file: {run_dir}/state.json
//   { pipeline, completed_steps, current_step_index, next_action, last_verdict, last_updated }
//
// Resume: node muezzin.mjs <pipeline.json> --run-dir <dir> --resume
//   Reads state.json from run_dir, skips completed steps, continues from current_step_index.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import * as http from 'http';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MUEZZIN_VERSION = '0.1.0-proposal';
const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const OLLAMA_EXE = join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe');
const CHECKPOINT_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'checkpoint_verify.mjs');

// How many consecutive 500s from Ollama before we kill+restart the server
const NEMOTRON_500_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
  console.log('Usage: node muezzin.mjs <pipeline.json> [--run-dir <dir>] [--resume] [--dry-run]');
  process.exit(0);
}

const pipelineConfigPath = resolve(argv[0]);
const flagResume  = argv.includes('--resume');
const flagDryRun  = argv.includes('--dry-run');
let   flagRunDir  = null;
{
  const i = argv.indexOf('--run-dir');
  if (i !== -1 && argv[i + 1]) flagRunDir = resolve(argv[i + 1]);
}

// ---------------------------------------------------------------------------
// Load pipeline config
// ---------------------------------------------------------------------------
if (!existsSync(pipelineConfigPath)) {
  fatal(`Pipeline config not found: ${pipelineConfigPath}`);
}
let pipeline;
try {
  pipeline = JSON.parse(readFileSync(pipelineConfigPath, 'utf8'));
} catch (e) {
  fatal(`Cannot parse pipeline config: ${e.message}`);
}
if (!pipeline.steps || !Array.isArray(pipeline.steps)) {
  fatal('Pipeline config must have a "steps" array');
}

// ---------------------------------------------------------------------------
// Run directory
// ---------------------------------------------------------------------------
const runDir = flagRunDir
  || (pipeline.run_dir ? resolve(pipeline.run_dir) : null)
  || join(os.tmpdir(), 'muezzin', slugify(pipeline.name || 'run'), dateStamp());

mkdirSync(runDir, { recursive: true });

const stateFile = join(runDir, 'state.json');
log(`Muezzin ${MUEZZIN_VERSION}  pipeline="${pipeline.name}"  run_dir=${runDir}`);
if (flagDryRun) log('[DRY-RUN mode — no real model dispatches]');

// ---------------------------------------------------------------------------
// Load or init cycle-state
// ---------------------------------------------------------------------------
let state = loadState();

if (flagResume) {
  log(`Resuming from step index ${state.current_step_index} (${state.next_action || 'continue'})`);
} else if (state.completed_steps && state.completed_steps.length > 0) {
  log(`WARNING: run_dir already has state with ${state.completed_steps.length} completed step(s).`);
  log(`Pass --resume to continue, or use a fresh --run-dir.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function main() {
  const steps = pipeline.steps;
  let startIdx = flagResume ? (state.current_step_index || 0) : 0;

  // If we're resuming after an instance-action, that step is complete; advance.
  if (flagResume && state.next_action === 'instance-action-waiting') {
    // The conductor said "go" — the artifact should now exist. Re-gate it.
    const resumeStep = steps[startIdx];
    log(`\n[RESUME] Re-gating instance-action step: ${resumeStep.id}`);
    if (resumeStep && resumeStep.type === 'instance-action') {
      const gateResult = runCheckpoint(resumeStep.checkpoint, resumeStep.id);
      if (!gateResult.pass) {
        writeState({
          current_step_index: startIdx,
          next_action: 'instance-action-waiting',
          last_verdict: `CHECKPOINT_FAIL: ${gateResult.failures.join('; ')}`,
        });
        fatal(
          `Instance-action step "${resumeStep.id}" gate still failing after resume.\n` +
          `  Failures: ${gateResult.failures.join('; ')}\n` +
          `  Artifact: ${resumeStep.checkpoint?.file}\n` +
          `  Complete the action, then resume again.`
        );
      }
      state.completed_steps.push(resumeStep.id);
      startIdx += 1;
      writeState({
        current_step_index: startIdx,
        next_action: 'continue',
        last_verdict: 'PASS',
      });
    }
  }

  for (let i = startIdx; i < steps.length; i++) {
    const step = steps[i];
    if (!step.id) fatal(`Step at index ${i} missing required "id" field`);
    if (!step.type) fatal(`Step "${step.id}" missing required "type" field`);

    log(`\n${'─'.repeat(60)}`);
    log(`STEP [${i + 1}/${steps.length}]  id=${step.id}  type=${step.type}`);
    if (step.description) log(`  ${step.description}`);

    writeState({
      current_step_index: i,
      next_action: 'executing',
      last_verdict: null,
    });

    // -----------------------------------------------------------------------
    // Dispatch by type
    // -----------------------------------------------------------------------
    let stepResult; // { ok: bool, output?: string, error?: string }

    try {
      if (step.type === 'shell') {
        stepResult = await runShellStep(step);
      } else if (step.type === 'model') {
        stepResult = await runModelStep(step);
      } else if (step.type === 'instance-action') {
        handleInstanceAction(step, i, steps.length);
        // handleInstanceAction exits; we never reach here
      } else {
        fatal(`Unknown step type "${step.type}" in step "${step.id}"`);
      }
    } catch (e) {
      writeState({
        current_step_index: i,
        next_action: 'error',
        last_verdict: `UNHANDLED_ERROR: ${e.message}`,
        error_step: step.id,
        error_message: e.message,
        error_stack: e.stack,
      });
      process.stderr.write(`\nFATAL error in step "${step.id}": ${e.message}\n`);
      process.exit(1);
    }

    if (!stepResult.ok) {
      writeState({
        current_step_index: i,
        next_action: 'step-failed',
        last_verdict: `STEP_FAILED: ${stepResult.error || 'non-zero exit'}`,
        error_step: step.id,
        error_message: stepResult.error,
      });
      fatal(
        `Step "${step.id}" failed.\n` +
        `  Error: ${stepResult.error || 'non-zero exit'}\n` +
        `  Output: ${(stepResult.output || '').slice(0, 400)}\n` +
        `  Resume: node muezzin.mjs ${pipelineConfigPath} --run-dir ${runDir} --resume`
      );
    }

    log(`  Step execution OK. Output: ${(stepResult.output || '').slice(0, 200)}`);

    // -----------------------------------------------------------------------
    // Checkpoint gate
    // -----------------------------------------------------------------------
    if (step.checkpoint) {
      log(`  Checkpoint gate: ${step.checkpoint.file}`);
      const gate = runCheckpoint(step.checkpoint, step.id);
      if (!gate.pass) {
        writeState({
          current_step_index: i,
          next_action: 'checkpoint-failed',
          last_verdict: `CHECKPOINT_FAIL: ${gate.failures.join('; ')}`,
          error_step: step.id,
          checkpoint_failures: gate.failures,
        });
        fatal(
          `Checkpoint FAIL for step "${step.id}".\n` +
          `  Failures: ${gate.failures.join('; ')}\n` +
          `  File: ${step.checkpoint.file}\n` +
          `  NOT advancing. Fix the artifact, then resume.\n` +
          `  Resume: node muezzin.mjs ${pipelineConfigPath} --run-dir ${runDir} --resume`
        );
      }
      log(`  Checkpoint PASS (${gate.denseChars} chars)`);
    } else {
      log(`  No checkpoint defined for this step — advancing without content gate.`);
    }

    // -----------------------------------------------------------------------
    // Advance state
    // -----------------------------------------------------------------------
    state.completed_steps.push(step.id);
    writeState({
      current_step_index: i + 1,
      next_action: i + 1 < steps.length ? 'continue' : 'pipeline-complete',
      last_verdict: 'PASS',
    });
    log(`  State persisted. Completed: [${state.completed_steps.join(', ')}]`);
  }

  // All steps complete
  writeState({
    current_step_index: steps.length,
    next_action: 'pipeline-complete',
    last_verdict: 'PASS',
  });
  log(`\n${'═'.repeat(60)}`);
  log(`PIPELINE COMPLETE: ${pipeline.name}`);
  log(`Run dir: ${runDir}`);
  log(`State: ${stateFile}`);
  log(`Steps completed: ${state.completed_steps.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Shell step
// ---------------------------------------------------------------------------
async function runShellStep(step) {
  const cmd = step.command;
  if (!cmd) return { ok: false, error: 'shell step missing "command"' };

  log(`  Shell: ${cmd}`);
  if (flagDryRun) {
    log(`  [DRY-RUN] would execute: ${cmd}`);
    return { ok: true, output: '[dry-run: not executed]' };
  }

  const env = { ...process.env, ...(step.env || {}) };
  const cwd = step.cwd ? resolve(step.cwd) : process.cwd();

  // shell:true lets the platform shell handle quoting, built-ins, and pipes correctly
  const result = spawnSync(cmd, [], {
    cwd,
    env,
    encoding: 'utf8',
    shell: true,
    timeout: 120_000,
    windowsHide: true,
  });

  const combined = (result.stdout || '') + (result.stderr || '');
  if (result.error) return { ok: false, error: result.error.message, output: combined };
  if (result.status !== 0) return { ok: false, error: `exit ${result.status}`, output: combined };
  return { ok: true, output: combined };
}

// ---------------------------------------------------------------------------
// Model step
// ---------------------------------------------------------------------------
async function runModelStep(step) {
  if (!step.model) return { ok: false, error: 'model step missing "model"' };

  // 1. Serial discipline — check api/ps, stop anything loaded
  if (!flagDryRun) {
    const clear = await ensureOllamaIdle(step.model);
    if (!clear) return { ok: false, error: 'Could not clear Ollama — api/ps blocked after stop attempts' };
  }

  // 2. Build prompt
  let prompt = step.prompt || '';
  if (prompt.startsWith('@')) {
    const promptFile = resolve(prompt.slice(1));
    if (!existsSync(promptFile)) return { ok: false, error: `Prompt file not found: ${promptFile}` };
    prompt = readFileSync(promptFile, 'utf8');
  }

  log(`  Model: ${step.model}  prompt_len=${prompt.length}`);
  if (flagDryRun) {
    log(`  [DRY-RUN] would dispatch to ${step.model}`);
    return { ok: true, output: '[dry-run: no dispatch]' };
  }

  // 3. Build request body (replicating deliberate.py pattern)
  const opts = {
    num_predict: step.num_predict ?? 4096,
    temperature: 0.1,
  };
  if (step.num_ctx  != null) opts.num_ctx  = step.num_ctx;
  if (step.num_gpu  != null) opts.num_gpu  = step.num_gpu;

  const body = {
    model: step.model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
    options: opts,
  };
  // think goes top-level, not in options — per rijal qwen + nemotron pattern
  if (step.think != null) body.think = step.think;

  // 4. Dispatch with nemotron-cascade-deadlock recovery
  const outputFile = join(runDir, `${step.id}-output.txt`);
  const result = await dispatchOllama(body, step.model, outputFile);

  if (!result.ok) return result;

  // 5. Always safe-stop after dispatch
  await safeStop(step.model);

  // 6. Extract JSON if model step declares checkpoint uses json schema
  //    (caller gates via checkpoint; we just return raw)
  return { ok: true, output: result.content };
}

// ---------------------------------------------------------------------------
// Instance-action step — emit structured handoff block, exit 0
// ---------------------------------------------------------------------------
function handleInstanceAction(step, idx, total) {
  const artifact = step.checkpoint?.file || step.produces || '(not specified)';
  const resumeCmd = `node muezzin.mjs ${pipelineConfigPath} --run-dir ${runDir} --resume`;

  writeState({
    current_step_index: idx,
    next_action: 'instance-action-waiting',
    last_verdict: null,
    instance_action_step: step.id,
  });

  const border = '═'.repeat(60);
  console.log(`\n${border}`);
  console.log(`NEXT-CALL REQUIRED — step [${idx + 1}/${total}]: ${step.id}`);
  console.log(border);
  console.log(`\nINSTRUCTION:`);
  console.log(step.instruction || '(no instruction provided)');
  console.log(`\nEXPECTED ARTIFACT:`);
  console.log(`  ${artifact}`);
  console.log(`\nWHEN DONE, RESUME WITH:`);
  console.log(`  ${resumeCmd}`);
  console.log(`\nSTATE FILE (persisted):`);
  console.log(`  ${stateFile}`);
  console.log(border);

  // Exit 0 — this is a planned pause, not an error
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Checkpoint gate — shells out to checkpoint_verify.mjs
// ---------------------------------------------------------------------------
function runCheckpoint(ckpt, stepId) {
  if (!ckpt || !ckpt.file) {
    return { pass: false, failures: ['checkpoint.file not specified'], denseChars: 0 };
  }
  if (!existsSync(CHECKPOINT_SCRIPT)) {
    return { pass: false, failures: [`checkpoint_verify.mjs not found: ${CHECKPOINT_SCRIPT}`], denseChars: 0 };
  }

  const args = [CHECKPOINT_SCRIPT, ckpt.file, '--json'];
  if (ckpt.schema)    args.push('--schema', ckpt.schema);
  if (ckpt.keys)      args.push('--keys',   Array.isArray(ckpt.keys) ? ckpt.keys.join(',') : ckpt.keys);
  if (ckpt.min_chars) args.push('--min-chars', String(ckpt.min_chars));
  if (ckpt.require)   args.push('--require', ckpt.require);
  if (ckpt.forbid)    args.push('--forbid',  ckpt.forbid);

  if (flagDryRun) {
    log(`  [DRY-RUN] checkpoint_verify ${ckpt.file}`);
    // In dry run, simulate based on whether file actually exists
    if (!existsSync(ckpt.file)) {
      return { pass: false, failures: [`[dry-run] file does not exist: ${ckpt.file}`], denseChars: 0 };
    }
    return { pass: true, failures: [], denseChars: 999 };
  }

  const r = spawnSync('node', args, { encoding: 'utf8', timeout: 30_000 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout || ''); } catch { /* ignore */ }

  if (!parsed) {
    return {
      pass: false,
      failures: [`checkpoint_verify produced no parseable output; stderr: ${(r.stderr || '').slice(0, 200)}`],
      denseChars: 0,
    };
  }
  return { pass: parsed.pass, failures: parsed.failures || [], denseChars: parsed.denseChars || 0 };
}

// ---------------------------------------------------------------------------
// Ollama helpers (replicating deliberate.py's serial discipline)
// ---------------------------------------------------------------------------

async function apiPs() {
  return new Promise((resolve) => {
    const req = http.request({ host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/ps', method: 'GET', timeout: 10_000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const models = data.models || [];
          resolve({ clear: models.length === 0, models: models.map(m => m.name) });
        } catch {
          resolve({ clear: false, models: ['parse-error'] });
        }
      });
    });
    req.on('error', () => resolve({ clear: false, models: ['connection-error'] }));
    req.on('timeout', () => { req.destroy(); resolve({ clear: false, models: ['timeout'] }); });
    req.end();
  });
}

async function safeStop(modelName) {
  // Unload via REST keep_alive. Replicates deliberate.py safe_stop().
  // Uses keep_alive:"0s" (string not int) — avoids the keep_alive:0 deadlock.
  for (const [endpoint, bodyObj] of [
    ['/api/generate', { model: modelName, prompt: '', keep_alive: '0s' }],
    ['/api/chat',     { model: modelName, messages: [], keep_alive: '0s' }],
  ]) {
    const ok = await new Promise((resolve) => {
      const payload = JSON.stringify(bodyObj);
      const req = http.request({
        host: OLLAMA_HOST, port: OLLAMA_PORT, path: endpoint,
        method: 'POST', timeout: 25_000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, (res) => {
        res.resume();
        res.on('end', () => resolve(true));
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(payload);
      req.end();
    });
    if (ok) {
      await sleep(2000);
      return;
    }
  }
  // keep_alive timed out — restart Ollama as in deliberate.py
  log(`  safe_stop: keep_alive timed out for ${modelName} — restarting Ollama`);
  await restartOllamaServer();
}

async function ensureOllamaIdle(forModel) {
  log(`  Wudu check before ${forModel}...`);
  const { clear, models } = await apiPs();
  if (clear) { log(`  api/ps clear`); return true; }

  log(`  Still loaded: ${models.join(', ')} — stopping...`);
  for (const m of models) await safeStop(m);
  await sleep(5000);

  const after = await apiPs();
  if (after.clear) { log(`  api/ps clear after stop`); return true; }
  log(`  STILL BLOCKED: ${after.models.join(', ')}`);
  return false;
}

async function restartOllamaServer() {
  // Kill all ollama processes — replicates deliberate.py _restart_ollama_server()
  spawnSync('taskkill', ['/F', '/IM', 'ollama.exe'], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  await sleep(3000);
  const env = { ...process.env, OLLAMA_LLM_LIBRARY: 'cuda_v12' };
  // Start ollama serve in background via cmd /c start /b (detached, inherits cuda_v12 env)
  spawnSync('cmd', ['/c', 'start', '/b', OLLAMA_EXE, 'serve'], {
    env, windowsHide: true, timeout: 5_000
  });
  // Wait up to 60s for server to respond to /api/ps
  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = spawnSync('node', ['-e',
      `const h=require('http');const r=h.request({host:'localhost',port:11434,path:'/api/ps'},` +
      `res=>{process.exit(0)});r.on('error',()=>process.exit(1));r.end();`
    ], { timeout: 6_000 });
    if (ready.status === 0) { await sleep(1000); return; }
    await sleep(2000);
  }
  log(`  WARNING: Ollama server may not have restarted cleanly`);
}

// Dispatch with retry on 500 (nemotron cache-deadlock pattern from deliberate.py)
async function dispatchOllama(body, modelName, outputFile) {
  let consecutiveErrors500 = 0;

  const attempt = async () => new Promise((resolve) => {
    const payload = JSON.stringify(body);
    let content = '';
    let thinkingChars = 0;

    const req = http.request({
      host: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/chat',
      method: 'POST', timeout: 32_768 * 1000, // very long — model inference
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      if (res.statusCode === 500) {
        res.resume();
        resolve({ ok: false, status500: true, error: `Ollama 500` });
        return;
      }
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (chunk) => {
        // Cross-chunk line buffering: Ollama NDJSON lines split across TCP chunks
        // constantly. Splitting each chunk independently drops every partial line.
        // buf carries the incomplete tail of the last chunk into the next event.
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop(); // last element is the incomplete (or empty) tail
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const msg = parsed.message || {};
            const piece = msg.content || parsed.response || '';
            const thinkPiece = msg.thinking || '';
            if (thinkPiece) thinkingChars += thinkPiece.length;
            if (piece) content += piece;
            if (parsed.done) {
              if (thinkingChars) log(`  [thinking: ${thinkingChars} chars]`);
            }
          } catch { /* skip genuinely malformed */ }
        }
      });
      res.on('end', () => {
        // Flush any remaining buffered content (should be empty for well-formed
        // NDJSON but guard against a server that omits the trailing newline).
        if (buf.trim()) {
          try {
            const parsed = JSON.parse(buf);
            const msg = parsed.message || {};
            const piece = msg.content || parsed.response || '';
            const thinkPiece = msg.thinking || '';
            if (thinkPiece) thinkingChars += thinkPiece.length;
            if (piece) content += piece;
          } catch { /* incomplete final line — discard */ }
        }
        // Write output file
        try { writeFileSync(outputFile, content, 'utf8'); } catch { /* best effort */ }
        resolve({ ok: true, content });
      });
      res.on('error', (e) => resolve({ ok: false, error: e.message }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'dispatch timeout' }); });
    req.write(payload);
    req.end();
  });

  // Retry loop — nemotron cache-deadlock recovery
  while (true) {
    const result = await attempt();
    if (result.ok) return result;

    if (result.status500) {
      consecutiveErrors500++;
      log(`  Ollama 500 (${consecutiveErrors500}/${NEMOTRON_500_THRESHOLD}) for ${modelName}`);
      if (consecutiveErrors500 >= NEMOTRON_500_THRESHOLD) {
        log(`  Nemotron cache-deadlock threshold hit — killing+restarting Ollama`);
        await restartOllamaServer();
        consecutiveErrors500 = 0;
        await sleep(5000);
        continue;
      }
      // Try CPU fallback first (deliberate.py pattern)
      if ((body.options?.num_gpu || 0) !== 0) {
        log(`  Retrying ${modelName} with num_gpu=0 (CPU fallback)`);
        body.options.num_gpu = 0;
        continue;
      }
      await sleep(3000);
      continue;
    }

    return result; // non-500 error — let caller handle
  }
}

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------
function loadState() {
  if (existsSync(stateFile)) {
    try {
      return JSON.parse(readFileSync(stateFile, 'utf8'));
    } catch { /* corrupt state — start fresh */ }
  }
  return {
    pipeline: pipeline.name || 'unnamed',
    pipeline_config: pipelineConfigPath,
    run_dir: runDir,
    completed_steps: [],
    current_step_index: 0,
    next_action: 'start',
    last_verdict: null,
    last_updated: null,
    muezzin_version: MUEZZIN_VERSION,
  };
}

function writeState(patch) {
  Object.assign(state, patch);
  state.last_updated = new Date().toISOString();
  try {
    writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`WARNING: could not write state file: ${e.message}\n`);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
  process.stdout.write(`[${ts}] ${msg}\n`);
}

function fatal(msg) {
  process.stderr.write(`\nFATAL: ${msg}\n`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
main().catch((e) => {
  writeState({
    next_action: 'error',
    last_verdict: `UNHANDLED_TOP_LEVEL: ${e.message}`,
    error_message: e.message,
    error_stack: e.stack,
  });
  process.stderr.write(`\nFATAL (unhandled): ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
