import 'dotenv/config';
import { createServer as createHttpServer, type IncomingMessage } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import {
  canAddClient,
  addClient,
  removeClient,
  getClient,
  getNearbyClients,
  joinRoom,
  leaveRoom,
  getRoom,
  getStats,
  touchRoom,
  getPublicRoomList,
  getAllClients,
} from './room-manager';
import { getTurnCredentials } from './turn-credentials';
import { isJoinRateLimited, isSignalingRateLimited } from './rate-limiter';
import type { Client, SignalingMessage } from './types';
import logger from './logger';

// ── Production startup guard ─────────────────────────────────────────────────
// Fail loudly at boot rather than silently serving a broken or insecure config.
if (process.env.NODE_ENV === 'production') {
  const issues: string[] = [];

  if (!process.env.ALLOWED_ORIGINS) {
    issues.push('ALLOWED_ORIGINS must be set to your frontend URL(s) — without it any website can use this signaling server');
  }

  if (!process.env.METERED_API_KEY) {
    // Non-fatal: TURN credentials will not be issued; users behind symmetric NAT
    // will fall back to STUN-only (P2P may fail on some networks).
    logger.warn('METERED_API_KEY is not set — TURN relay is disabled. Set it to enable fallback for restricted networks.');
  }

  if (issues.length > 0) {
    logger.error('Production startup check failed — refusing to start. Fix the following:');
    for (const issue of issues) logger.error(`  • ${issue}`);
    logger.error('See .env.production.example for all required variables.');
    process.exit(1);
  }

  logger.info('Production startup checks passed.');
}

const PORT = parseInt(process.env.PORT ?? '8787', 10);

// LAN mode: this server is a private rendezvous for one local network, so it
// may expose the live list of active rooms (the "room browser"). A public
// cloud deployment must leave this OFF — otherwise anyone could enumerate
// every room code on the server. The host/ launcher and desktop app set it.
const LAN_MODE = process.env.LAN_MODE === '1';

// L3: Allowed WebSocket origins — only our own frontend may connect.
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

// M1: Trusted reverse-proxy IPs — only these may set x-forwarded-for.
const TRUSTED_PROXIES = new Set(
  (process.env.TRUSTED_PROXIES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

// A6: Warn loudly if origin enforcement is disabled in production.
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.size === 0) {
  logger.warn(
    'ALLOWED_ORIGINS is not set in production — any website can connect to this ' +
    'signaling server. Set ALLOWED_ORIGINS to your frontend URL (e.g. https://zapit.io).',
  );
}

function resolveIp(req: IncomingMessage): string {
  const remoteIp = req.socket.remoteAddress ?? '0.0.0.0';
  if (TRUSTED_PROXIES.has(remoteIp)) {
    const fwd = req.headers['x-forwarded-for'] as string | undefined;
    if (fwd) return fwd.split(',')[0].trim();
  }
  return remoteIp;
}

// ── HTTP server ─────────────────────────────────────────────────────────────

const START_TIME = Date.now();

// TLS: when cert/key paths are provided (LAN self-hosting over HTTPS), serve
// WSS. An HTTPS frontend cannot open an insecure ws:// socket — the browser
// blocks it as mixed content — so secure-context LAN mode requires this.
// Without the paths we stay on plain HTTP/WS (behind a TLS proxy, or local).
const TLS_CERT_FILE = process.env.TLS_CERT_FILE;
const TLS_KEY_FILE = process.env.TLS_KEY_FILE;
const USE_TLS = Boolean(TLS_CERT_FILE && TLS_KEY_FILE);

const requestListener = (req: IncomingMessage, res: import('http').ServerResponse) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'GET') { res.writeHead(405).end(); return; }

  if (req.url === '/health') {
    const { connections, rooms } = getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({ status: 'ok', connections, rooms, uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000) }),
    );
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Zapit signaling server');
};

const httpServer = USE_TLS
  ? createHttpsServer(
      { cert: readFileSync(TLS_CERT_FILE!), key: readFileSync(TLS_KEY_FILE!) },
      requestListener,
    )
  : createHttpServer(requestListener);

// ── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 64 * 1024, // H2: 64 KB max message
  verifyClient: ({ req }: { req: IncomingMessage }) => {
    if (ALLOWED_ORIGINS.size === 0) return true;
    return ALLOWED_ORIGINS.has(req.headers.origin ?? '');
  },
});

function send(ws: WebSocket, msg: SignalingMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(roomCode: string, msg: SignalingMessage, excludeId?: string): void {
  const room = getRoom(roomCode);
  if (!room) return;
  for (const [id, client] of room.clients) {
    if (id !== excludeId) send(client.ws, msg);
  }
}

// Push the live room list to everyone connected. No-op unless LAN_MODE is on,
// so this is safe to call from any room mutation path unconditionally.
function broadcastRoomList(): void {
  if (!LAN_MODE) return;
  const rooms = getPublicRoomList();
  for (const client of getAllClients()) {
    send(client.ws, { type: 'rooms-updated', payload: rooms });
  }
}

wss.on('connection', (ws, req) => {
  const publicIp = resolveIp(req);
  const clientId = randomUUID();

  // A2/L2 (heartbeat): wire pong handler at connection time — merged into one handler.
  const ext = ws as WebSocket & { _zapitAlive?: boolean };
  ext._zapitAlive = true;
  ws.on('pong', () => { ext._zapitAlive = true; });

  // H3: Reject if connection caps are exceeded.
  const capCheck = canAddClient(publicIp);
  if (!capCheck.ok) {
    logger.warn({ clientId, publicIp, reason: capCheck.reason }, 'connection rejected');
    ws.close(1008, capCheck.reason);
    return;
  }

  const client: Client = { ws, roomCode: null, publicIp, id: clientId, joinedAt: Date.now() };
  addClient(client);
  logger.info({ clientId, publicIp }, 'client connected');

  // LAN mode: hand the new client the current room list straight away so the
  // room browser is populated the moment the app opens.
  if (LAN_MODE) send(ws, { type: 'rooms-updated', payload: getPublicRoomList() });

  // Notify nearby devices (within discovery window).
  const nearby = getNearbyClients(clientId);
  if (nearby.length > 0) {
    send(ws, {
      type: 'nearby-devices',
      payload: nearby.map((c) => ({ id: c.id, roomCode: c.roomCode })),
    });
    for (const peer of nearby) {
      send(peer.ws, { type: 'nearby-devices', payload: [{ id: clientId, roomCode: null }] });
    }
  }

  ws.on('message', (rawMsg) => {
    if (typeof rawMsg !== 'string' && !Buffer.isBuffer(rawMsg)) return;

    if (isSignalingRateLimited(publicIp)) {
      send(ws, { type: 'error', payload: 'Rate limited' });
      return;
    }

    let msg: SignalingMessage;
    try {
      msg = JSON.parse(rawMsg.toString()) as SignalingMessage;
    } catch {
      send(ws, { type: 'error', payload: 'Invalid JSON' });
      return;
    }

    switch (msg.type) {
      case 'join': {
        if (isJoinRateLimited(publicIp)) {
          send(ws, { type: 'error', payload: 'Too many join attempts — slow down' });
          return;
        }

        // H8: Validate room code format.
        const roomCode = (msg.roomCode ?? '').trim().toLowerCase();
        if (!roomCode || !/^[a-z0-9]{6}$/.test(roomCode)) {
          send(ws, { type: 'error', payload: 'Invalid room code format' });
          return;
        }

        // Carry optional labels for the LAN room browser.
        if (typeof msg.name === 'string' && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 40);
        }
        const roomName = typeof msg.roomName === 'string' ? msg.roomName : undefined;

        const result = joinRoom(client, roomCode, roomName);
        if (!result.ok) { send(ws, { type: 'room-full' }); return; }
        broadcastRoomList();

        // H5: Issue TURN credentials only after a room is joined.
        // getTurnCredentials() is cached after the first call; subsequent joins
        // are synchronous from cache and do not delay the joined/peer-joined messages.
        getTurnCredentials().then((turnCreds) => {
          if (turnCreds) send(ws, { type: 'turn-credentials', payload: turnCreds });
          send(ws, { type: 'joined', roomCode, from: clientId });

          const peers = [...result.room.clients.values()].filter((c) => c.id !== clientId);
          for (const peer of peers) {
            if (turnCreds) send(peer.ws, { type: 'turn-credentials', payload: turnCreds });
            send(peer.ws, { type: 'peer-joined', from: clientId });
            send(ws,       { type: 'peer-joined', from: peer.id });
          }
          logger.info({ clientId, roomCode }, 'client joined room');
        }).catch((err: unknown) => {
          logger.error({ err }, 'Unexpected error fetching TURN credentials');
          send(ws, { type: 'joined', roomCode, from: clientId });
        });
        break;
      }

      case 'leave': {
        if (!client.roomCode) return;
        broadcast(client.roomCode, { type: 'peer-left', from: clientId }, clientId);
        leaveRoom(clientId, client.roomCode);
        client.roomCode = null;
        broadcastRoomList();
        break;
      }

      case 'list-rooms': {
        // Explicit refresh request. Ignored on public deployments.
        if (LAN_MODE) send(ws, { type: 'rooms-updated', payload: getPublicRoomList() });
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        const target = msg.to ? getClient(msg.to) : null;
        if (!target) return;
        if (client.roomCode && client.roomCode === target.roomCode) {
          touchRoom(client.roomCode);
          send(target.ws, { ...msg, from: clientId });
        }
        break;
      }

      default:
        send(ws, { type: 'error', payload: `Unknown message type: ${String(msg.type)}` });
    }
  });

  ws.on('close', (code) => {
    // A7: capture roomCode before removeClient clears it, then broadcast.
    // removeClient internally calls leaveRoom, removing client from the room map
    // before the broadcast fires — so the departing client never receives its own
    // peer-left message.
    const roomCode = client.roomCode;
    removeClient(clientId);
    if (roomCode) broadcast(roomCode, { type: 'peer-left', from: clientId });
    broadcastRoomList();
    logger.info({ clientId, code }, 'client disconnected');
  });

  ws.on('error', (err) => {
    logger.error({ clientId, err: err.message }, 'websocket error');
  });
});

// Periodic heartbeat — detect and evict zombie connections.
setInterval(() => {
  for (const ws of wss.clients) {
    const ext = ws as WebSocket & { _zapitAlive?: boolean };
    if (ext._zapitAlive === false) { ws.terminate(); return; }
    ext._zapitAlive = false;
    ws.ping();
  }
}, 30_000);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'zapit-signaling listening');
});
