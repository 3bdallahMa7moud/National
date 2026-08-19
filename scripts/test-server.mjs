import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const prismaDir = path.join(rootDir, 'prisma');
const appDb = path.join(prismaDir, 'app.db');
const testDb = path.join(prismaDir, 'prisma-test.db');

try {
  if (fs.existsSync(testDb)) {
    fs.rmSync(testDb, { force: true });
  }
  if (fs.existsSync(appDb)) {
    fs.copyFileSync(appDb, testDb);
  }
} catch (error) {
  console.error('Failed to prepare test database:', error);
  process.exit(1);
}

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  DATABASE_URL: 'file:./prisma-test.db',
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://127.0.0.1:5173',
  SESSION_SECRET: 'test-session-secret-1234567890',
  ENABLE_DEV_PASSWORD_RESET_CODES: 'true',
  ENABLE_DEV_SIGNUP_OTP_CODES: 'true',
};

const pushResult = spawnSync(npxCmd, ['prisma', 'db', 'push', '--skip-generate'], {
  cwd: rootDir,
  env,
  stdio: 'inherit',
  shell: isWin,
});

if (pushResult.status !== 0) {
  process.exit(pushResult.status ?? 1);
}

const extraArgs = process.argv.slice(2);
const vitestArgs = ['vitest', 'run', '--config', 'vitest.server.config.ts', '--maxWorkers=1', ...extraArgs];

const testResult = spawnSync(npxCmd, vitestArgs, {
  cwd: rootDir,
  env,
  stdio: 'inherit',
  shell: isWin,
});

process.exit(testResult.status ?? 0);
