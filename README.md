<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/WebRTC-P2P-orange" alt="WebRTC" />
  <img src="https://img.shields.io/badge/encryption-ECDH%20%2B%20AES--GCM--256-green" alt="Encryption" />
  <img src="https://img.shields.io/badge/self--hostable-yes-brightgreen" alt="Self hostable" />
  <img src="https://img.shields.io/github/stars/Azhwin05/Zapit.io?style=social" alt="GitHub Stars" />
</p>

<h1 align="center">Zapit</h1>
<p align="center"><strong>AirDrop for the web. No login. No server. No limits.</strong></p>
<p align="center">
  Transfer files directly between any two browsers, end-to-end encrypted.<br/>
  <a href="#self-hosting">Self-Host in 5 Minutes</a> · <a href="SECURITY.md">Security Model</a>
</p>

<p align="center">
  There's no single official Zapit instance to sign up for — this project isn't
  centrally hosted. Instead, deploying your own copy is designed to be as close
  to one click as possible:
</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAzhwin05%2FZapit.io&root-directory=frontend&env=NEXT_PUBLIC_SIGNALING_URL&envDescription=wss%3A%2F%2F%20URL%20of%20your%20deployed%20signaling%20server%20(deploy%20that%20first%2C%20see%20the%20Koyeb%20button%20below%2C%20or%20use%20host%2F%20locally)&project-name=zapit&repository-name=zapit">
    <img src="https://vercel.com/button" alt="Deploy frontend to Vercel" />
  </a>
  &nbsp;
  <a href="https://app.koyeb.com/deploy?type=git&repository=github.com%2FAzhwin05%2FZapit.io&branch=main&workdir=signaling-server&instance_type=free&regions=fra&ports=8787%3Bhttp%3B%2F&env%5BNODE_ENV%5D=production&env%5BALLOWED_ORIGINS%5D=&env%5BMETERED_API_KEY%5D=&env%5BMETERED_API_HOST%5D=&name=zapit-signaling">
    <img src="https://www.koyeb.com/static/images/deploy/button.svg" alt="Deploy signaling server to Koyeb" height="28" />
  </a>
</p>

<p align="center">
  <sub>Deploy the signaling server first (Koyeb), then the frontend (Vercel) —
  pointing <code>NEXT_PUBLIC_SIGNALING_URL</code> at the <code>wss://</code>
  address Koyeb gives you. Full walkthrough below if you want to understand
  each step, or want to self-host with zero cloud accounts at all.</sub>
</p>

---

## Why Zapit?

| | Zapit | WeTransfer | Google Drive | AirDrop |
|---|:---:|:---:|:---:|:---:|
| No account required | ✅ | ✅ | ❌ | ❌ |
| Files never touch a server | ✅ | ❌ | ❌ | ✅ |
| Works cross-platform | ✅ | ✅ | ✅ | ❌ |
| End-to-end encrypted | ✅ | ❌ | ❌ | ✅ |
| No file size limit | ✅ | ❌ | ❌ | ✅ |
| Open source | ✅ | ❌ | ❌ | ❌ |
| Self-hostable | ✅ | ❌ | ❌ | ❌ |

## How It Works

```
Person A opens zapit.io          Person B opens zapit.io
→ gets room code: 8E3K2F    →    → types 8E3K2F
        │                               │
        └──────── WebRTC P2P ──────────┘
                  (encrypted)
         Files flow directly browser ↔ browser.
         The server is never in the data path.
```

1. **Generate** — Person A gets a 6-character room code
2. **Share** — Send the code (or the link) to Person B
3. **Connect** — Both browsers negotiate a direct WebRTC connection
4. **Transfer** — Files travel encrypted, directly between devices

> The signaling server only helps the two browsers find each other. Once connected, it has no role in the transfer. Even the encryption key never leaves either device.

## Security Model

- **ECDH P-256** key agreement — each side generates an ephemeral key pair. Only public keys pass through the signaling server. The shared AES session key is derived locally on both devices and is never transmitted anywhere.
- **AES-GCM-256** encryption — every 128 KB chunk is encrypted with a fresh random IV before leaving the browser.
- **Forward secrecy** — the ECDH private key is non-extractable and discarded after each session. Past sessions cannot be decrypted even if a future key is compromised.
- **TURN relay** — when direct P2P isn't possible (strict firewalls), traffic is relayed. The relay server sees only ciphertext.

See [SECURITY.md](SECURITY.md) for the full threat model and how to report vulnerabilities.

## Features

- 📁 **Any file type, any size** — streams straight to disk via the File System Access API when you pick a save folder (Chromium browsers); falls back to RAM otherwise, with a warning above 500 MB
- 🔐 **E2E encrypted** — ECDH key agreement, AES-GCM-256 per chunk
- 🛡️ **Safety number verification** — a 24-digit code both sides can compare to catch an active MITM on the signaling channel
- 🔁 **Chunk-level resume** — retrying a failed send skips chunks the receiver already has
- 👥 **Multi-peer rooms** — up to 6 devices in one room, full mesh, files broadcast to everyone
- 💬 **Text / clipboard messages** — send a quick message without picking a file
- ⚡ **3× parallel channels** — maximises throughput over the WebRTC data channel
- 📱 **PWA** — installable, offline-capable app shell, with Android/Chrome share-sheet integration
- 🏠 **LAN mode** — `cd host && npm start` turns your laptop into the whole system: server + a full peer, QR code and all, zero cloud, one command
- 🔍 **Nearby device detection** — auto-discovers devices on the same network
- 🔗 **Share link** — share a direct join link instead of the room code
- 📋 **QR code** — scan to join from a phone
- 🌐 **TURN fallback** — works through corporate firewalls and strict NAT
- 🛡️ **Nonce-based CSP** — per-request Content-Security-Policy with `strict-dynamic`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Transfer engine | WebRTC RTCDataChannel, custom chunked protocol |
| Encryption | WebCrypto API (ECDH P-256 + AES-GCM-256) |
| Signaling | Node.js, ws, Pino |
| TURN credentials | Metered.ca (hosted) or self-hosted coturn |
| Deployment | Vercel (frontend) + Koyeb (signaling) |

## Self-Hosting

Everything you need to run Zapit yourself, for free. Want the fastest path?
Use the **Deploy to Vercel** / **Deploy to Koyeb** buttons at the top of this
page — they pre-fill both platforms' import flow from this repo. Everything
below is the manual version of the same steps, for anyone who wants to
understand (or customize) what those buttons are doing, or who wants a
non-cloud option entirely.

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/Azhwin05/Zapit.io.git
cd Zapit.io

# Configure
cp signaling-server/.env.example signaling-server/.env
# Edit signaling-server/.env — set ALLOWED_ORIGINS to your frontend URL
# and METERED_API_KEY from https://www.metered.ca (free, no credit card)

# Run
docker compose up -d

# Signaling server is now at http://localhost:8787
# Health check: curl http://localhost:8787/health
```

Then deploy the frontend to Vercel (free):
1. Import this repo on vercel.com
2. Set `NEXT_PUBLIC_SIGNALING_URL=wss://your-server:8787`
3. Deploy

### Option B — Manual

```bash
# Signaling server
cd signaling-server
npm install
cp .env.example .env   # edit the values
npm run build
NODE_ENV=production node dist/index.js

# Frontend (separate machine or Vercel)
cd frontend
npm install
echo 'NEXT_PUBLIC_SIGNALING_URL=wss://your-signaling-server' > .env.local
npm run build && npm start
```

### Environment Variables

**Signaling server** (`signaling-server/.env.production.example`):

| Variable | Required | Description |
|---|:---:|---|
| `NODE_ENV` | Yes | Set to `production` |
| `ALLOWED_ORIGINS` | Yes | Your frontend URL (e.g. `https://zapit.io`) |
| `METERED_API_KEY` | No* | TURN relay API key from metered.ca |
| `METERED_API_HOST` | No* | Your metered.ca subdomain |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |

*Without TURN credentials, users behind symmetric NAT (~5–10%) won't be able to connect.

**Frontend** (`frontend/.env.production.example`):

| Variable | Required | Description |
|---|:---:|---|
| `NEXT_PUBLIC_SIGNALING_URL` | Yes | `wss://` URL of your signaling server |

### TURN Server (optional, for maximum compatibility)

If you want to run your own coturn instead of Metered.ca:

1. Get a server with a public IP (Oracle Cloud Always Free works)
2. Run: `apt install coturn && certbot certonly --standalone -d turn.yourdomain.com`
3. Copy `coturn/turnserver.conf` to `/etc/coturn/turnserver.conf` and fill in the placeholders
4. Start: `systemctl enable coturn && systemctl start coturn`

### Option C — LAN mode: your laptop *is* the server (no cloud, no accounts, one command)

Want zero cloud dependency at all — your laptop hosts, everyone else on the
same Wi-Fi just joins? One command does the whole thing:

```bash
cd host && npm install && npm start
```

This builds the signaling server and frontend the first time (skipped on
later runs), starts both locally, works out your machine's LAN address, and
prints a **QR code right in the terminal** plus a join link — scan it from
any phone/laptop on the same network and they're in, already pointed at
your machine. It also opens your own browser automatically, so your laptop
is both the server and a full participant. Ctrl+C stops everything.

Prefer to do it by hand, or point an *existing* deployment (e.g. the public
site) at your own server instead of running the frontend locally too? The
underlying piece is the signaling server on its own:

```bash
cd signaling-server && npm install && npm run dev
# Now at ws://localhost:8787, or ws://192.168.1.42:8787 for other devices
```

...and the **settings (⚙) icon** next to the Zapit logo in any Zapit
instance lets you point it at that URL at runtime — no rebuild. That's the
mechanism `host/` above is built on: a shareable link like
`https://your-zapit-url?signaling=ws://192.168.1.42:8787` does the same
thing the QR code does.

## Running Locally

```bash
# Terminal 1 — signaling server
cd signaling-server && npm install && cp .env.example .env && npm run dev

# Terminal 2 — frontend
cd frontend && npm install
echo 'NEXT_PUBLIC_SIGNALING_URL=ws://localhost:8787' > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in two browser tabs or on two devices on the same network.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues are labelled [`good first issue`](../../issues?q=label%3A%22good+first+issue%22).

The most wanted contributions:
- **Full reconnect resume** — current resume only survives a WebRTC-level hiccup where the signaling WebSocket (and so the peerId) stays the same; it doesn't survive a real network drop, since the signaling server assigns a fresh clientId per connection. Would need a stable device identity exchanged alongside the ECDH handshake.
- **iOS share-sheet support** — the Web Share Target integration is Android/Chrome only; iOS Safari doesn't support it
- **SFU/relay topology option** — mesh rooms are O(N²) connections; fine at small N, but a relay-based mode would scale further

## Project Structure

```
zapit/
├── frontend/               # Next.js 14 app
│   ├── app/                # Routes: /, /privacy, /terms, error boundary
│   ├── components/         # UI: rooms, transfer, discovery, safety number, footer
│   ├── public/sw.js        # PWA shell cache + Web Share Target handler
│   └── lib/
│       ├── webrtc/         # peer-connection.ts, transfer-engine.ts, crypto.ts, disk-writer.ts
│       ├── signaling-client.ts
│       ├── share-target.ts # reads files handed off from the OS share sheet
│       └── peer-label.ts
├── signaling-server/
│   └── src/
│       ├── index.ts        # WebSocket server + /health endpoint
│       ├── room-manager.ts
│       ├── turn-credentials.ts
│       └── rate-limiter.ts
├── host/start.mjs          # Self-hosting: one-command LAN launcher (see Option C)
├── coturn/turnserver.conf  # Self-hosting: coturn config template
├── docker-compose.yml      # Self-hosting: one-command cloud/Docker setup
├── .github/workflows/ci.yml
├── CONTRIBUTING.md
├── SECURITY.md
├── OPERATIONS.md
└── LICENSE (MIT)
```

## Roadmap

- [x] Streaming disk writes (File System Access API, with in-memory fallback)
- [x] Chunk-level transfer resume (same signaling connection only — see Contributing)
- [x] Text / clipboard sharing
- [x] Multi-peer rooms (full mesh, up to 6 devices)
- [x] Safety number verification
- [x] Mobile share-sheet integration (Android/Chrome)
- [ ] Full reconnect resume surviving a real network drop
- [ ] iOS share-sheet support
- [ ] SFU/relay topology for larger rooms

## License

[MIT](LICENSE) © 2026 [Ashwin Kumar Arun](https://www.linkedin.com/in/ashwinkumararun/)

---

<p align="center">
  Built with ♥ — if Zapit saved you time or keeps your files private, consider giving it a ⭐
</p>
