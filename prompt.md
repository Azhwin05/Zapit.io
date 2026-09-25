You are building a production-grade, P2P-first file and text sharing web app — think

"AirDrop for the web, with no login." The product must feel instant, magical, and trustworthy.

CORE ARCHITECTURE: Hybrid P2P-first with relay fallback.

1\. Primary path: direct WebRTC RTCDataChannel transfer between browsers, P2P.

2\. Fallback path: if direct P2P fails (strict NAT/firewall), relay encrypted bytes through

a self-hosted TURN server — server cannot read payload due to client-side encryption.

3\. Optional async mode: "Send even if offline" — encrypts and uploads to Cloudflare R2 with

auto-delete after first download or 24h TTL, generates a one-time link/QR for the receiver.

TECH STACK:

\- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, PWA-enabled (next-pwa or manual

service worker), installable on all platforms.

\- Signaling server: standalone Node.js process using `ws`, hosted on [Fly.io](http://Fly.io) (NOT Vercel

serverless — needs persistent WebSocket connections). Tracks active rooms, relays

SDP offers/answers and ICE candidates between paired clients, and groups clients by public

IP for auto-discovery on shared networks.

\- WebRTC: raw RTCPeerConnection + RTCDataChannel (no PeerJS/simple-peer wrapper) — need direct

control over backpressure and multi-channel parallelism.

\- TURN: self-hosted coturn instance on a small VPS, credentials issued per-session by the

signaling server (short-lived, time-limited TURN credentials, not static).

\- Optional relay storage: Cloudflare R2 with lifecycle rules for auto-expiry.

\- QR codes: `qrcode` npm package, generated client-side.

\- Zip streaming for multi-file sends: `client-zip`.

\- Large file receive: File System Access API (showSaveFilePicker + FileSystemWritableFileStream)

with fallback to StreamSaver.js for Safari/iOS where that API is unavailable.

NO-LOGIN ACCESS MODEL:

\- On page load, auto-generate a short human-readable room code (e.g. word-word-number format)

plus a QR code. No accounts, no passwords, no email collection, ever.

\- Auto-discovery: if the signaling server detects two connecting clients on the same public IP

(same WiFi/LAN), immediately surface them to each other as "Nearby devices" with zero code

entry required — this is the primary delight moment, prioritize polishing this flow.

\- Manual joining: typing the code or scanning the QR connects two devices on any network.

\- Room codes expire after \~10 minutes of inactivity or when both peers disconnect. Nothing

persists server-side beyond the active session.

TRANSFER ENGINE REQUIREMENTS (this is the core engineering challenge — get this right):

\- NEVER load an entire file into memory. Use File.slice() to lazily stream chunks via the

Streams API.

\- Chunk size 64KB-256KB per RTCDataChannel message.

\- Implement backpressure handling via the bufferedAmountLow event before sending each

subsequent chunk — do not flood the channel buffer.

\- Use 3-4 parallel RTCDataChannels per peer connection to better saturate available bandwidth.

\- Attach a CRC32 checksum per chunk and a final SHA-256 hash of the complete file. On chunk

checksum failure, request retransmission of only that chunk (never restart the full transfer).

\- Track last-acknowledged chunk index so a dropped connection (WiFi blip) can resume rather

than restart from zero.

\- Support sending multiple files/folders as a single job: stream-zip client-side via

client-zip, send a manifest first so the receiving UI can show live per-file progress.

\- Stream incoming chunks directly to disk via File System Access API (or StreamSaver.js

fallback) — receiver-side memory usage must stay flat regardless of file size.

SECURITY LAYER:

\- WebRTC's native DTLS-SRTP encryption is the baseline.

\- Additionally: generate an ephemeral AES-GCM key per session (exchanged only via the

signaling channel, never persisted), and encrypt every chunk client-side before sending —

this guarantees true end-to-end privacy even across the TURN relay fallback path, since

even your own infrastructure cannot read transferred payloads.

\- Rate-limit and validate room code lookups server-side to prevent brute-force guessing into

someone else's active session.

UX / FRONTEND REQUIREMENTS:

\- Landing page shows the room code/QR immediately on load — no buttons to click first.

\- Full-page drag-and-drop target, not a small upload box.

\- Live transfer UI: real-time throughput (MB/s), ETA, animated progress, per-file breakdown

for multi-file sends.

\- Dark theme by default, sub-1-second first paint, minimal dependencies on the critical path.

\- PWA: installable, app shell cached via service worker so the UI loads instantly even on

flaky connections (only the signaling/TURN connection itself needs live connectivity).

\- Mobile-first responsive layout; large touch targets for QR scan / code entry flows.

DELIVERABLES:

1\. Full Next.js 14 project structure (App Router, TypeScript, Tailwind).

2\. Standalone signaling server (Node.js + ws) ready to deploy to [Fly.io](http://Fly.io), including

per-session TURN credential issuance logic.

3\. coturn configuration reference for self-hosted TURN deployment.

4\. Complete WebRTC transfer engine (chunking, backpressure, multi-channel, checksum/resume

logic) as a well-isolated, reusable module — this is the most critical piece, build and

test it in isolation before wiring up the UI.

5\. PWA manifest + service worker setup.

6\. Clean, documented README covering local dev setup, signaling server deployment, and

coturn setup.

Build incrementally: (1) get basic 1-to-1 same-network P2P transfer of a small file working

end-to-end first, (2) layer in chunking/backpressure/large-file support, (3) add room

code + QR + cross-network joining, (4) add TURN fallback, (5) add encryption layer and

checksum/resume logic, (6) polish UI/UX and PWA features last.