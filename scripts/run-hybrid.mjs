#!/usr/bin/env node
// run-hybrid.mjs — launch one full local+sonnet hybrid deliberation cycle.
// Usage: node run-hybrid.mjs <question_file> [--dry-run] [--resume]
// Substitutes __QUESTION_FILE__ and __OUTPUT_DIR__ in hybrid-cycle.pipeline.json,
// writes the instantiated pipeline to a temp file, then launches the muezzin.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename, extname, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import os from 'os';
import * as tmp from 'os';

const __dir = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) {
  console.error('Usage: node run-hybrid.mjs <question_file> [--dry-run] [--resume]');
  process.exit(1);
}

const questionFile = resolve(args[0]);
const flags = args.slice(1);

// Derive slug and output dir (same convention as deliberate.py)
const slug = basename(questionFile, extname(questionFile));
// deliberate.py uses the Claude-managed temp dir (claude/ subdir), not raw tmpdir
const outputDir = join(os.tmpdir(), 'claude', 'deliberate', slug);
mkdirSync(outputDir, { recursive: true });

const runDir = join(os.tmpdir(), 'muezzin-runs', slug);
mkdirSync(runDir, { recursive: true });

// Load and instantiate the pipeline template
const templatePath = join(__dir, 'hybrid-cycle.pipeline.json');
let pipeline = readFileSync(templatePath, 'utf8');
pipeline = pipeline.replaceAll('__QUESTION_FILE__', questionFile.replace(/\\/g, '/'));
pipeline = pipeline.replaceAll('__OUTPUT_DIR__', outputDir.replace(/\\/g, '/'));

const instancePath = join(runDir, 'pipeline.json');
writeFileSync(instancePath, pipeline);

console.log(`[run-hybrid] question: ${questionFile}`);
console.log(`[run-hybrid] output:   ${outputDir}`);
console.log(`[run-hybrid] run-dir:  ${runDir}`);
console.log(`[run-hybrid] pipeline: ${instancePath}`);
console.log('');

// Launch muezzin
const muezzin = join(__dir, 'muezzin.mjs');
const muezzinArgs = [muezzin, instancePath, '--run-dir', runDir, ...flags];
console.log(`[run-hybrid] node ${muezzinArgs.join(' ')}\n`);

const result = spawnSync('node', muezzinArgs, { stdio: 'inherit', encoding: 'utf8' });
process.exit(result.status ?? 0);
