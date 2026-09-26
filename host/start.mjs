#!/usr/bin/env node
// Zapit "host launcher" — one command to become the server.
//
// Runs the signaling server and the frontend on this machine, works out
// this machine's LAN address, and prints a scannable QR code + link that
// gets other devices on the same network straight into the app, already
// pointed at this local signaling server (via the ?signaling= override
// added in frontend/lib/signaling-url.ts — no rebuild, no manual config on
// the guest's side).
//
// This machine's own browser is opened automatically too, so the "host" is
// a full peer in the mesh, not just a server.

import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(REPO_ROOT, 'frontend');
const SIGNALING_DIR = path.join(REPO_ROOT, 'signaling-server');

const SIGNALING_PORT = Number(process.env.ZAPIT_SIGNALING_PORT ?? 8787);
const FRONTEND_PORT  = Number(process.env.ZAPIT_FRONTEND_PORT ?? 3000);

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function log(msg) {
  console.log(`\x1b[32m[zapit-host]\x1b[0m ${msg}`);
}
function warn(msg) {
  console.log(`\x1b[33m[zapit-host]\x1b[0m ${msg}`);
}
function fail(msg) {
  console.error(`\x1b[31m[zapit-host]\x1b[0m ${msg}`);
  cleanup();
  process.exit(1);
}

function cleanup() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}
process.on('SIGINT', () => { log('shutting down…'); cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// npm ships as npm.cmd on Windows, which isn't a real PE executable — it
// needs the shell to interpret it. spawn() with shell:false throws EINVAL
// for it (confirmed by actually running this launcher). `node` itself is a
// real executable and works fine either way, so it's simplest/safest to
// just always use shell:true here — every arg in this file is a fixed,
// controlled literal (ports, fixed subcommands), never user input, so
// shell-quoting risk doesn't apply.
function run(cmd, args, cwd, label) {
  return new Promise((resolve, reject) => {
    log(`${label}: ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function spawnLong(cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

function waitForHttp(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(tick, 500);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tick();
  });
}

function getLanIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      // Skip internal (loopback) and non-IPv4 addresses.
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'cmd'
    : process.platform === 'darwin' ? 'open'
    : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore', shell: false }).unref();
  } catch {
    warn(`Couldn't auto-open a browser — open this URL manually: ${url}`);
  }
}

async function main() {
  console.log('');
  log('Zapit host launcher — this machine will act as the server + a peer.');
  console.log('');

  // ── Build step (skipped if already built) ──────────────────────────────
  if (!existsSync(path.join(SIGNALING_DIR, 'dist', 'index.js'))) {
    log('Signaling server not built yet — building (one-time)…');
    await run(NPM, ['install'], SIGNALING_DIR, 'signaling-server install').catch(fail);
    await run(NPM, ['run', 'build'], SIGNALING_DIR, 'signaling-server build').catch(fail);
  }
  if (!existsSync(path.join(FRONTEND_DIR, '.next'))) {
    log('Frontend not built yet — building (one-time, this can take a minute)…');
    await run(NPM, ['install'], FRONTEND_DIR, 'frontend install').catch(fail);
    await run(NPM, ['run', 'build'], FRONTEND_DIR, 'frontend build').catch(fail);
  }

  // ── Start both servers ──────────────────────────────────────────────────
  log(`Starting signaling server on port ${SIGNALING_PORT}…`);
  spawnLong('node', ['dist/index.js'], SIGNALING_DIR, { PORT: String(SIGNALING_PORT) });
  await waitForHttp(`http://localhost:${SIGNALING_PORT}/health`).catch(() =>
    fail(`Signaling server never came up on port ${SIGNALING_PORT}. Is something else already using it? Set ZAPIT_SIGNALING_PORT to change it.`),
  );
  log('Signaling server is up.');

  log(`Starting frontend on port ${FRONTEND_PORT}…`);
  spawnLong(NPM, ['run', 'start', '--', '-p', String(FRONTEND_PORT)], FRONTEND_DIR);
  await waitForHttp(`http://localhost:${FRONTEND_PORT}`).catch(() =>
    fail(`Frontend never came up on port ${FRONTEND_PORT}. Is something else already using it? Set ZAPIT_FRONTEND_PORT to change it.`),
  );
  log('Frontend is up.');

  // ── Show the guest join link + QR, open the host's own browser ─────────
  const lanIp = getLanIp();
  console.log('');
  if (!lanIp) {
    warn("Couldn't detect a LAN IP — other devices may not be able to reach this machine.");
    warn('This can happen on some VPN/virtual-adapter setups; check your network settings.');
  } else {
    const joinUrl = `http://${lanIp}:${FRONTEND_PORT}/?signaling=ws://${lanIp}:${SIGNALING_PORT}`;
    console.log('\x1b[1mOther devices on your network — scan or open this to join:\x1b[0m');
    console.log('');
    console.log(await qrcode.toString(joinUrl, { type: 'terminal', small: true }));
    console.log(`  ${joinUrl}`);
    console.log('');
  }

  const hostUrl = `http://localhost:${FRONTEND_PORT}/?signaling=ws://localhost:${SIGNALING_PORT}`;
  log(`Opening your own browser at ${hostUrl}`);
  openBrowser(hostUrl);

  console.log('');
  log('Running. Press Ctrl+C to stop both servers.');
}

main().catch((err) => fail(err.message ?? String(err)));
