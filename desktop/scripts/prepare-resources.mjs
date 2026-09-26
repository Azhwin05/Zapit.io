#!/usr/bin/env node
// Builds a fully self-contained copy of the signaling server + frontend into
// desktop/resources/, with PRODUCTION-ONLY node_modules (no devDependencies —
// keeps the installer size sane and avoids shipping test tooling). The
// Electron app never needs the end user to have Node.js installed at all:
// it runs these bundled scripts using Electron's own embedded Node runtime
// (via the ELECTRON_RUN_AS_NODE trick — see main.js), which is the actual
// mechanism that makes this a true double-click installer.

import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RESOURCES_DIR = path.resolve(__dirname, '..', 'resources');

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, cwd, extraEnv) {
  console.log(`[prepare] (${path.relative(REPO_ROOT, cwd)}) ${cmd} ${args.join(' ')}`);
  // npm ships as npm.cmd on Windows, a batch file — not a real PE executable,
  // so it needs shell:true to run at all (same EINVAL issue already found
  // and fixed in host/start.mjs). Args here are always fixed literals
  // (subcommands, flags), never user input, so shell-quoting risk doesn't apply.
  execFileSync(cmd, args, {
    cwd, stdio: 'inherit', shell: true,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
}

function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function prepareSignalingServer() {
  const src = path.join(REPO_ROOT, 'signaling-server');
  const dest = path.join(RESOURCES_DIR, 'signaling-server');
  freshDir(dest);

  run(NPM, ['run', 'build'], src);

  cpSync(path.join(src, 'dist'), path.join(dest, 'dist'), { recursive: true });
  cpSync(path.join(src, 'package.json'), path.join(dest, 'package.json'));
  cpSync(path.join(src, 'package-lock.json'), path.join(dest, 'package-lock.json'));

  // Production-only install, isolated from the source tree's dev node_modules
  // (which has vitest, ts-node-dev, etc — none of that belongs in the installer).
  run(NPM, ['ci', '--omit=dev'], dest);
}

function prepareFrontend() {
  const src = path.join(REPO_ROOT, 'frontend');
  const dest = path.join(RESOURCES_DIR, 'frontend');
  freshDir(dest);

  // Baked to match main.js's local signaling server port — the desktop app
  // is always both the server and a peer, so this is always correct for it
  // (unlike the hosted-deployment case, where the URL varies per deployer).
  run(NPM, ['run', 'build'], src, { NEXT_PUBLIC_SIGNALING_URL: 'ws://localhost:8787' });

  cpSync(path.join(src, '.next'), path.join(dest, '.next'), { recursive: true });
  cpSync(path.join(src, 'public'), path.join(dest, 'public'), { recursive: true });
  cpSync(path.join(src, 'package.json'), path.join(dest, 'package.json'));
  cpSync(path.join(src, 'package-lock.json'), path.join(dest, 'package-lock.json'));
  cpSync(path.join(src, 'next.config.mjs'), path.join(dest, 'next.config.mjs'));
  cpSync(path.join(src, 'middleware.ts'), path.join(dest, 'middleware.ts'));
  cpSync(path.join(src, 'tsconfig.json'), path.join(dest, 'tsconfig.json'));

  run(NPM, ['ci', '--omit=dev'], dest);
}

console.log('[prepare] Building signaling server...');
prepareSignalingServer();

console.log('[prepare] Building frontend...');
prepareFrontend();

console.log('[prepare] Done — desktop/resources/ is ready to package.');
