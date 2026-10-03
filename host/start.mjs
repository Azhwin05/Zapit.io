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
import { networkInterfaces, tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode';
import { ensureCert } from './cert.mjs';

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
  // rejectUnauthorized:false — our LAN cert is self-signed, so the health
  // probe must not reject it (the browser warning is the user's to accept).
  const client = url.startsWith('https:') ? https : http;
  const opts = url.startsWith('https:') ? { rejectUnauthorized: false } : {};
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = client.get(url, opts, (res) => {
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

// Picking "the first non-internal IPv4" is wrong in practice — confirmed by
// a real test on a real second device: on a machine with WSL/Hyper-V,
// Docker Desktop, VirtualBox, VMware, or a VPN installed, that naive scan
// usually finds a VIRTUAL adapter first (e.g. "vEthernet (WSL)" at
// 172.17.x.x), which is invisible to every other physical device on the
// network — the exact failure mode "site can't be reached" from a phone
// scanning the QR code. Prefer interfaces that look like a real Wi-Fi/
// Ethernet connection; only fall back to the naive scan if none match.
const VIRTUAL_ADAPTER_PATTERN = /docker|vethernet|virtualbox|vmware|hyper-v|wsl|loopback|tailscale|zerotier|tun|tap/i;
const PHYSICAL_ADAPTER_PATTERN = /wi-?fi|ethernet|^en\d|^eth\d|^wlan\d/i;

function getLanIp() {
  const nets = networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push({ name, address: net.address });
    }
  }

  const physical = candidates.find((c) => PHYSICAL_ADAPTER_PATTERN.test(c.name) && !VIRTUAL_ADAPTER_PATTERN.test(c.name));
  if (physical) return physical.address;

  const nonVirtual = candidates.find((c) => !VIRTUAL_ADAPTER_PATTERN.test(c.name));
  if (nonVirtual) return nonVirtual.address;

  return candidates[0]?.address ?? null;
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

  // ── Work out the LAN IP + TLS cert BEFORE starting anything ─────────────
  // Order matters: guests load the app over HTTPS at this LAN IP (an http://
  // LAN origin has no window.crypto.subtle — see cert.mjs), and the cert must
  // carry the IP in its SAN, so we need the IP first.
  const lanIp = getLanIp();
  log('Preparing a local HTTPS certificate…');
  const { certFile, keyFile } = await ensureCert(path.join(tmpdir(), 'zapit-cert'), lanIp);
  const tlsEnv = { TLS_CERT_FILE: certFile, TLS_KEY_FILE: keyFile };

  // ── Start both servers (HTTPS / WSS, LAN room browser on) ───────────────
  log(`Starting signaling server on port ${SIGNALING_PORT}…`);
  spawnLong('node', ['dist/index.js'], SIGNALING_DIR, {
    PORT: String(SIGNALING_PORT),
    LAN_MODE: '1',
    ...tlsEnv,
  });
  await waitForHttp(`https://localhost:${SIGNALING_PORT}/health`).catch(() =>
    fail(`Signaling server never came up on port ${SIGNALING_PORT}. Is something else already using it? Set ZAPIT_SIGNALING_PORT to change it.`),
  );
  log('Signaling server is up.');

  log(`Starting frontend on port ${FRONTEND_PORT}…`);
  spawnLong(NPM, ['run', 'start:custom'], FRONTEND_DIR, {
    PORT: String(FRONTEND_PORT),
    HOSTNAME: '0.0.0.0',
    ...tlsEnv,
  });
  await waitForHttp(`https://localhost:${FRONTEND_PORT}`).catch(() =>
    fail(`Frontend never came up on port ${FRONTEND_PORT}. Is something else already using it? Set ZAPIT_FRONTEND_PORT to change it.`),
  );
  log('Frontend is up.');

  // ── Show the guest join link + QR, open the host's own browser ─────────
  console.log('');
  if (!lanIp) {
    warn("Couldn't detect a LAN IP — other devices may not be able to reach this machine.");
    warn('This can happen on some VPN/virtual-adapter setups; check your network settings.');
  } else {
    const joinUrl = `https://${lanIp}:${FRONTEND_PORT}/?signaling=wss://${lanIp}:${SIGNALING_PORT}`;
    console.log('\x1b[1mOther devices on your network — scan or open this to join:\x1b[0m');
    console.log('');
    console.log(await qrcode.toString(joinUrl, { type: 'terminal', small: true }));
    console.log(`  ${joinUrl}`);
    console.log('');
    warn('First time on each device you\'ll see a "connection not private" warning —');
    warn('that\'s the self-signed LAN certificate; choose Advanced → Proceed. It\'s');
    warn('required so browsers allow the encryption Zapit uses. One tap, once.');
    console.log('');
  }

  const hostUrl = `https://localhost:${FRONTEND_PORT}/?signaling=wss://localhost:${SIGNALING_PORT}`;
  log(`Opening your own browser at ${hostUrl}`);
  openBrowser(hostUrl);

  console.log('');
  log('Running. Press Ctrl+C to stop both servers.');
}

main().catch((err) => fail(err.message ?? String(err)));
