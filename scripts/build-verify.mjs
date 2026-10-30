import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('1. Running TypeScript verification...');
const tc = spawnSync(process.execPath, ['scripts/typecheck.mjs'], { stdio: 'inherit' });
if (tc.status !== 0) process.exit(tc.status ?? 1);

console.log('2. Running Unit, Firestore Rules, and Serverless API Security Tests...');
const tests = spawnSync(process.execPath, ['scripts/run-tests.mjs'], { stdio: 'inherit' });
if (tests.status !== 0) process.exit(tests.status ?? 1);

const distDir = path.resolve(process.cwd(), 'dist');
fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync('artifacts/file_generation/ttl=63d/output/small-wonders.html')) {
  fs.copyFileSync(
    'artifacts/file_generation/ttl=63d/output/small-wonders.html',
    path.join(distDir, 'index.html')
  );
}
console.log('3. Build verification complete.');
