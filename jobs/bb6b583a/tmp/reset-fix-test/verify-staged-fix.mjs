import { resetAllowFiles } from './git_steps.mjs';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const repo = path.join(os.tmpdir(), 'verify-staged-fix-repo-' + process.pid);
fs.rmSync(repo, { recursive: true, force: true });
fs.mkdirSync(repo, { recursive: true });
const opts = { cwd: repo, stdio: 'pipe' };
execSync('git init -q', opts);
execSync('git config user.email a@a.com', opts);
execSync('git config user.name a', opts);
fs.writeFileSync(path.join(repo, 'tracked.mjs'), 'export const v = 0;\n');
execSync('git add tracked.mjs', opts);
execSync('git commit -q -m init', opts);

// Simulate the exact real-world bug: a prior mission attempt modified + STAGED the file
// (git add) but never committed it -- the interrupted-commit shape.
fs.writeFileSync(path.join(repo, 'tracked.mjs'), 'export const v = 999;\n');
execSync('git add tracked.mjs', opts);

const statusBefore = execSync('git status --porcelain', opts).toString().trim();
console.log('status BEFORE reset:', JSON.stringify(statusBefore));

const result = resetAllowFiles(repo, ['tracked.mjs']);
console.log('resetAllowFiles result:', JSON.stringify(result));

const statusAfter = execSync('git status --porcelain', opts).toString().trim();
console.log('status AFTER reset:', JSON.stringify(statusAfter), '(empty = FIXED)');

const content = fs.readFileSync(path.join(repo, 'tracked.mjs'), 'utf8');
console.log('file content after reset:', JSON.stringify(content.trim()), '(should be v = 0)');

fs.rmSync(repo, { recursive: true, force: true });
