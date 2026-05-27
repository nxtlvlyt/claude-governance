#!/usr/bin/env node
import { execSync } from 'child_process';
import { platform } from 'os';

const BOOTSTRAP_URL = 'https://nxtlvl.studio/get';

if (platform() !== 'win32') {
  console.error('Claude OS currently supports Windows only.');
  process.exit(1);
}

console.log('');
console.log('==========================================');
console.log('  Claude OS — Bootstrap');
console.log('==========================================');
console.log('');

execSync(
  `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm ${BOOTSTRAP_URL} | iex"`,
  { stdio: 'inherit' }
);
