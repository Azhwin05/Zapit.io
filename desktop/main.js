// Zapit desktop app — Electron main process.
//
// Double-click, and this machine becomes both the signaling server AND a
// full peer, with zero prerequisites: no Node.js install needed on the end
// user's machine, because child processes run using Electron's OWN embedded
// Node runtime (the ELECTRON_RUN_AS_NODE trick below), not a system Node.
//
// Secure LAN mode (mirrors host/start.mjs): guest devices load the app over
// the network at this machine's LAN IP, which is a NON-secure origin over
// http:// — and browsers make window.crypto.subtle (Zapit's whole ECDH/AES
// layer) UNDEFINED there. So we serve HTTPS/WSS using a cached self-signed
// cert (see cert.mjs). This machine's OWN window loads https://localhost —
// a secure context, so crypto works — and we trust our own cert for it via
// setCertificateVerifyProc, so the host never sees a warning. Guests see the
// usual one-time "not private" warning and click through (it's the price of
// a secure context for a random LAN IP with no CA). The QR/share link the
// app shows is built from this machine's LAN address (via /api/lan-ip) and
// carries the signaling override, so a scanning phone reaches the right host.

const { app, BrowserWindow, Tray, Menu, shell, dialog, session } = require('electron');
const { spawn } = require('node:child_process');
const { networkInterfaces, tmpdir } = require('node:os');
const { readFileSync } = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const SIGNALING_PORT = 8787;
const FRONTEND_PORT = 3210;

const isPackaged = app.isPackaged;
const resourcesPath = isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');

const children = [];
let tray = null;
let mainWindow = null;
let quitting = false;
// Set once the TLS cert is ready; used by startServers, the window URL, and
// the certificate-verify hook. Stays null only if cert generation failed, in
// which case we degrade to http://localhost (still a secure context for the
// host's own window — guests just can't join).
let tls = null; // { certFile, keyFile, certPem }
const scheme = () => (tls ? 'https' : 'http');
const wsScheme = () => (tls ? 'wss' : 'ws');

function killChildren() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

function spawnBundledNode(scriptPath, args, cwd, extraEnv) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1', // run this child as plain Node, not as another Electron instance
      ...extraEnv,
    },
    stdio: 'pipe',
  });
  child.stdout?.on('data', (d) => console.log(`[${path.basename(scriptPath)}]`, d.toString().trim()));
  child.stderr?.on('data', (d) => console.error(`[${path.basename(scriptPath)}]`, d.toString().trim()));
  children.push(child);
  return child;
}

function waitForHttp(url, timeoutMs = 30_000) {
  const start = Date.now();
  // rejectUnauthorized:false — our LAN cert is self-signed, so the health
  // probe must not reject it (the browser warning is the guest's to accept;
  // the host window trusts it via setCertificateVerifyProc).
  const client = url.startsWith('https:') ? https : http;
  const opts = url.startsWith('https:') ? { rejectUnauthorized: false } : {};
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = client.get(url, opts, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(tick, 400);
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

  // Nothing looked physical — fall back to whatever's there rather than
  // reporting no LAN address at all.
  return candidates[0]?.address ?? null;
}

// Generate (or reuse) the self-signed LAN cert. cert.mjs is ESM, so it's
// loaded via dynamic import from this CommonJS entry point. Returns null on
// any failure so startup can degrade to plain http://localhost rather than
// refusing to launch.
async function prepareTls(lanIp) {
  try {
    const { ensureCert } = await import('./cert.mjs');
    const { certFile, keyFile } = await ensureCert(path.join(tmpdir(), 'zapit-cert'), lanIp);
    return { certFile, keyFile, certPem: readFileSync(certFile, 'utf8') };
  } catch (err) {
    console.error('[zapit] TLS cert generation failed — falling back to http://localhost:', err);
    return null;
  }
}

// Trust ONLY our own self-signed cert, and only for our own hostnames, so the
// host's window (and its wss:// socket to the local signaling server) loads
// without a warning. Everything else defers to Chromium's normal verification
// — this is not a blanket "accept all certs".
function installCertTrust(lanIp) {
  if (!tls) return;
  const ourHosts = new Set(['localhost', '127.0.0.1']);
  if (lanIp) ourHosts.add(lanIp);
  const normalize = (pem) => pem.replace(/\s+/g, '');
  const ourCert = normalize(tls.certPem);

  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    const matchesOurCert = request.certificate && normalize(request.certificate.data ?? '') === ourCert;
    if (ourHosts.has(request.hostname) && matchesOurCert) {
      callback(0); // 0 = success: trust our cert
    } else {
      callback(-3); // -3 = use Chromium's own verification result
    }
  });
}

async function startServers(lanIp) {
  const tlsEnv = tls ? { TLS_CERT_FILE: tls.certFile, TLS_KEY_FILE: tls.keyFile } : {};

  // The signaling server refuses to start in production without
  // ALLOWED_ORIGINS (a deliberate boot-time guard — see
  // signaling-server/src/index.ts — so a real cloud deployment can't run as
  // an open relay for any website). Every client (this window, and any guest
  // device that joins) loads the frontend from the same place; include both
  // localhost and the LAN address so the app still starts with no LAN found.
  const origins = [`${scheme()}://localhost:${FRONTEND_PORT}`];
  if (lanIp) origins.push(`${scheme()}://${lanIp}:${FRONTEND_PORT}`);

  const signalingEntry = path.join(resourcesPath, 'signaling-server', 'dist', 'index.js');
  const signalingCwd = path.join(resourcesPath, 'signaling-server');
  spawnBundledNode(signalingEntry, [], signalingCwd, {
    PORT: String(SIGNALING_PORT),
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: origins.join(','),
    LAN_MODE: '1', // live room browser — see every room on the network, click to join
    ...tlsEnv,
  });
  await waitForHttp(`${scheme()}://localhost:${SIGNALING_PORT}/health`);

  // Serve the frontend via the custom server (server.mjs) so it can speak
  // HTTPS when a cert is present — `next start` is HTTP-only. Falls back to
  // HTTP transparently when tls is null.
  const frontendEntry = path.join(resourcesPath, 'frontend', 'server.mjs');
  const frontendCwd = path.join(resourcesPath, 'frontend');
  spawnBundledNode(frontendEntry, [], frontendCwd, {
    NODE_ENV: 'production',
    PORT: String(FRONTEND_PORT),
    HOSTNAME: '0.0.0.0',
    ...tlsEnv,
  });
  await waitForHttp(`${scheme()}://localhost:${FRONTEND_PORT}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 480,
    minHeight: 600,
    title: 'Zapit',
    backgroundColor: '#faf8f4', // matches the app's own background token — avoids a white flash on load
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // Load via localhost (a secure context, so crypto works) rather than the
  // LAN IP — the app's own /api/lan-ip call rewrites the share link/QR to the
  // LAN address for us, so loading via localhost costs nothing. The
  // ?signaling= override points this window at the local WSS signaling server
  // and is remembered on the device (see lib/signaling-url.ts).
  const windowUrl = `${scheme()}://localhost:${FRONTEND_PORT}/?signaling=${wsScheme()}://localhost:${SIGNALING_PORT}`;
  mainWindow.loadURL(windowUrl);

  // Closing the window hides to tray instead of quitting — the signaling
  // server should keep running for any peers still connected to it. Real
  // exit is via the tray menu's Quit item (or app.quit() below).
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Open external links (e.g. the privacy/terms pages' outbound links) in
  // the system browser rather than inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray(lanIp) {
  const iconPath = path.join(isPackaged ? process.resourcesPath : __dirname, 'tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Zapit — running');

  const menu = Menu.buildFromTemplate([
    { label: 'Show Zapit', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: lanIp ? `On your network: ${scheme()}://${lanIp}:${FRONTEND_PORT}` : 'No LAN address detected',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => mainWindow?.show());
}

app.whenReady().then(async () => {
  const lanIp = getLanIp();

  // Order matters: the cert must exist (and carry the LAN IP in its SAN)
  // before any server starts or any window loads over https.
  tls = await prepareTls(lanIp);
  installCertTrust(lanIp);

  try {
    await startServers(lanIp);
  } catch (err) {
    dialog.showErrorBox(
      'Zapit failed to start',
      `The bundled signaling server or frontend didn't come up in time.\n\n${err.message}`,
    );
    app.quit();
    return;
  }

  createWindow();
  createTray(lanIp);

  if (!lanIp) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'No network address detected',
      message: "Couldn't detect a LAN IP for this machine — other devices on your network may not be able to join. Zapit will still work on this device alone.",
    });
  }
});

app.on('window-all-closed', () => {
  // Intentionally do nothing — this app lives in the tray. Real quit is via
  // the tray menu (sets `quitting` then calls app.quit(), which triggers
  // before-quit below).
});

app.on('before-quit', () => {
  quitting = true;
  killChildren();
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});
