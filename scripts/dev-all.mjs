import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function terminateAll(signal = 'SIGTERM') {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

function runScript(scriptName) {
  const child = spawn(npmCommand, ['run', scriptName], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.error(`${scriptName} stopped with signal ${signal}`);
      terminateAll();
      process.exit(1);
      return;
    }

    if (code !== 0) {
      console.error(`${scriptName} exited with code ${code ?? 1}`);
      terminateAll();
      process.exit(code ?? 1);
      return;
    }

    terminateAll();
    process.exit(0);
  });

  child.on('error', (error) => {
    console.error(`Failed to start ${scriptName}:`, error);
    terminateAll();
    process.exit(1);
  });

  return child;
}

process.on('SIGINT', () => {
  terminateAll('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  terminateAll('SIGTERM');
  process.exit(0);
});

function main() {
  const frontendUrl = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
  const backendUrl = `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '3000'}`;

  runScript('dev:server');
  runScript('dev');

  console.log(`Frontend: ${frontendUrl}`);
  console.log(`Backend API: ${backendUrl}`);
}

main();
