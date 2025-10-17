import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function fileExists(relativePath) {
  try {
    await access(path.resolve(relativePath), constants.F_OK);
    return true;
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }

    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      reject(Object.assign(error, { exitCode: typeof error.code === 'number' ? error.code : 1 }));
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const message = signal
        ? `Command "${command} ${args.join(' ')}" exited with signal ${signal}`
        : `Command "${command} ${args.join(' ')}" exited with code ${code}`;

      const error = new Error(message);
      error.exitCode = typeof code === 'number' ? code : 1;
      reject(error);
    });
  });
}

async function ensureBuild() {
  const hasDist = await fileExists(path.join('dist', 'index.html'));

  if (hasDist) {
    console.log('Reusing existing build output in dist/.');
    return;
  }

  console.log('No dist/ build detected. Building the site before running Playwright tests...');
  await run(pnpmCommand, ['build']);
}

async function ensureBrowsers() {
  console.log('Ensuring Playwright browser binaries and required dependencies are installed...');
  await run(pnpmCommand, ['exec', 'playwright', 'install', '--with-deps', 'chromium']);
}

async function main() {
  try {
    await ensureBuild();
    await ensureBrowsers();
    const extraArgs = process.argv.slice(2);
    await run(pnpmCommand, ['exec', 'playwright', 'test', ...extraArgs]);
  } catch (error) {
    if (error) {
      console.error(error.message ?? error);
      if (error.stack) {
        console.error(error.stack);
      }
    }

    const exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1;
    process.exit(exitCode);
  }
}

await main();
