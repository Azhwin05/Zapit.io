import type { Client, Room } from './types';

const ROOM_TTL_MS        = 10 * 60 * 1000; // idle room purge
// Mesh topology — every peer connects directly to every other peer, so cost
// grows O(N^2) in both RTCPeerConnections per client and signaling fan-out
// (join/leave and offer/answer/ICE routing already loop over room.clients,
// see index.ts). 6 peers = 15 pairwise links, comfortably under the
// per-IP signaling rate limit (500 msgs/min) for a normal connect sequence.
const MAX_PEERS_PER_ROOM = 6;

// H3 / A15: Global cap aligned just below Fly.io's soft_limit (400) so the app
// can reject gracefully before Fly drops connections at the hard_limit (500).
const MAX_CONNS_PER_IP = 10;
const MAX_CONNS_GLOBAL = 380;

// A14: Discovery window — sliding per-device, not anchored to the first device's join.
const DISCOVERY_WINDOW_MS = 30_000;

const rooms   = new Map<string, Room>();
const clients = new Map<string, Client>();
const ipIndex = new Map<string, Set<string>>();

export function canAddClient(publicIp: string): { ok: true } | { ok: false; reason: string } {
  if (clients.size >= MAX_CONNS_GLOBAL) return { ok: false, reason: 'Server at capacity' };
  const ipSet = ipIndex.get(publicIp);
  if (ipSet && ipSet.size >= MAX_CONNS_PER_IP) {
    return { ok: false, reason: 'Too many connections from your IP' };
  }
  return { ok: true };
}

export function addClient(client: Client): void {
  clients.set(client.id, client);
  let ipSet = ipIndex.get(client.publicIp);
  if (!ipSet) { ipSet = new Set(); ipIndex.set(client.publicIp, ipSet); }
  ipSet.add(client.id);
}

export function removeClient(clientId: string): void {
  const client = clients.get(clientId);
  if (!client) return;

  if (client.roomCode) leaveRoom(clientId, client.roomCode);

  const ipSet = ipIndex.get(client.publicIp);
  if (ipSet) {
    ipSet.delete(clientId);
    if (ipSet.size === 0) ipIndex.delete(client.publicIp);
  }
  clients.delete(clientId);
}

export function getClient(clientId: string): Client | undefined {
  return clients.get(clientId);
}

/**
 * A14: Per-device sliding discovery window.
 * A device is "nearby" if it joined within DISCOVERY_WINDOW_MS of the querying
 * device's joinedAt timestamp.  This fixes the previous anchor-to-first-device
 * bug where C joining at t=35 s couldn't see B who joined at t=29 s.
 */
export function getNearbyClients(clientId: string): Client[] {
  const self = clients.get(clientId);
  if (!self) return [];

  const ipSet = ipIndex.get(self.publicIp);
  if (!ipSet) return [];

  return [...ipSet]
    .filter((id) => id !== clientId)
    .map((id) => clients.get(id)!)
    .filter((peer): peer is Client => {
      if (!peer) return false;
      // Both devices must have joined within the same DISCOVERY_WINDOW_MS.
      return Math.abs(peer.joinedAt - self.joinedAt) <= DISCOVERY_WINDOW_MS;
    });
}

export function joinRoom(
  client: Client,
  code: string,
): { ok: true; room: Room } | { ok: false; reason: 'full' } {
  let room = rooms.get(code);
  if (!room) {
    room = { code, clients: new Map(), createdAt: Date.now(), lastActivity: Date.now() };
    rooms.set(code, room);
  }
  if (room.clients.size >= MAX_PEERS_PER_ROOM) return { ok: false, reason: 'full' };
  room.clients.set(client.id, client);
  room.lastActivity = Date.now();
  client.roomCode = code;
  return { ok: true, room };
}

export function leaveRoom(clientId: string, code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  room.clients.delete(clientId);
  if (room.clients.size === 0) rooms.delete(code);
}

export function getRoom(code: string): Room | undefined { return rooms.get(code); }

export function getStats(): { connections: number; rooms: number } {
  return { connections: clients.size, rooms: rooms.size };
}

export function touchRoom(code: string): void {
  const room = rooms.get(code);
  if (room) room.lastActivity = Date.now();
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS && room.clients.size === 0) {
      rooms.delete(code);
    }
  }
}, 60_000);
