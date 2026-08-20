import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const prismaDir = path.join(rootDir, 'prisma');
const e2eDb = path.join(prismaDir, 'prisma-e2e.db');

try {
  for (const file of [e2eDb, `${e2eDb}-journal`, `${e2eDb}-wal`, `${e2eDb}-shm`]) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
  fs.closeSync(fs.openSync(e2eDb, 'w'));
} catch (error) {
  console.error('Failed to prepare E2E database:', error);
  process.exit(1);
}

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const nodeCmd = process.execPath;
const env = {
  ...process.env,
  DATABASE_URL: 'file:./prisma-e2e.db',
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

const seedScript = path.join(rootDir, 'server', 'dist', 'prisma', 'seed.js');
if (fs.existsSync(seedScript)) {
  const seedResult = spawnSync(nodeCmd, [seedScript], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: isWin,
  });
  if (seedResult.status !== 0) {
    process.exit(seedResult.status ?? 1);
  }
}

process.exit(0);
