// Zapit desktop app — Electron main process.
//
// Double-click, and this machine becomes both the signaling server AND a
// full peer, with zero prerequisites: no Node.js install needed on the end
// user's machine, because child processes run using Electron's OWN embedded
// Node runtime (the ELECTRON_RUN_AS_NODE trick below), not a system Node.
//
// Key design decision: the BrowserWindow loads the app via this machine's
// LAN IP (e.g. http://192.168.1.42:3210), not http://localhost:3210. This
// is deliberate — the web app's own "Share Link"/QR features build their
// join URL from `window.location.origin`, so loading via the LAN-reachable
// address means those features correctly produce a link other devices on
// the network can actually use, with ZERO changes needed in the frontend
// itself. Falls back to localhost only if no LAN interface is found (the
// user just can't invite others in that case, but the app still works
// standalone).

const { app, BrowserWindow, Tray, Menu, shell, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { networkInterfaces } = require('node:os');
const http = require('node:http');
const path = require('node:path');

const SIGNALING_PORT = 8787;
const FRONTEND_PORT = 3210;

const isPackaged = app.isPackaged;
const resourcesPath = isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');

const children = [];
let tray = null;
let mainWindow = null;
let quitting = false;

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
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(); });
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

async function startServers(lanIp) {
  // The signaling server refuses to start in production without
  // ALLOWED_ORIGINS (a deliberate boot-time guard — see
  // signaling-server/src/index.ts — that exists so a real cloud deployment
  // can't accidentally run as an open relay for any website). For this app,
  // every client (this window, and any guest device that joins) loads the
  // frontend from the same place: this machine's LAN address if one was
  // found, otherwise localhost. Both are included so the app still starts
  // even when no LAN interface is detected.
  const origins = [`http://localhost:${FRONTEND_PORT}`];
  if (lanIp) origins.push(`http://${lanIp}:${FRONTEND_PORT}`);

  const signalingEntry = path.join(resourcesPath, 'signaling-server', 'dist', 'index.js');
  const signalingCwd = path.join(resourcesPath, 'signaling-server');
  spawnBundledNode(signalingEntry, [], signalingCwd, {
    PORT: String(SIGNALING_PORT),
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: origins.join(','),
  });
  await waitForHttp(`http://localhost:${SIGNALING_PORT}/health`);

  const nextEntry = path.join(resourcesPath, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next');
  const frontendCwd = path.join(resourcesPath, 'frontend');
  spawnBundledNode(nextEntry, ['start', '-p', String(FRONTEND_PORT)], frontendCwd, {
    NODE_ENV: 'production',
  });
  await waitForHttp(`http://localhost:${FRONTEND_PORT}`);
}

function createWindow(loadHost) {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 480,
    minHeight: 600,
    title: 'Zapit',
    backgroundColor: '#faf8f4', // matches the app's own background token — avoids a white flash on load
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  mainWindow.loadURL(`http://${loadHost}:${FRONTEND_PORT}`);

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
      label: lanIp ? `On your network: http://${lanIp}:${FRONTEND_PORT}` : 'No LAN address detected',
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

  createWindow(lanIp ?? 'localhost');
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
