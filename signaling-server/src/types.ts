import type { WebSocket } from 'ws';

export interface Client {
  ws: WebSocket;
  roomCode: string | null;
  publicIp: string;
  id: string;
  joinedAt: number;
  // Human-friendly device label (e.g. "Ashwin's Laptop"), shown in the LAN
  // room browser. Optional — falls back to a generated label client-side.
  name?: string;
}

export interface Room {
  code: string;
  clients: Map<string, Client>;
  createdAt: number;
  lastActivity: number;
  // Optional human-friendly room label (e.g. "Design Team"), set by whoever
  // created the room. Shown in the LAN room browser alongside the code.
  name?: string;
}

export type MessageType =
  | 'join'
  | 'leave'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'peer-joined'
  | 'peer-left'
  | 'room-full'
  | 'room-not-found'
  | 'joined'
  | 'turn-credentials'
  | 'nearby-devices'
  // LAN room discovery (only active when the server runs with LAN_MODE=1):
  | 'list-rooms'      // client → server: request the current room list
  | 'rooms-updated'   // server → client: the live list of rooms on this network
  | 'error';

// One entry in the LAN room browser.
export interface PublicRoom {
  code: string;
  name?: string;
  peerCount: number;
  deviceNames: string[];
}

export interface SignalingMessage {
  type: MessageType;
  roomCode?: string;
  payload?: unknown;
  from?: string;
  to?: string;
  // Optional labels carried on a `join`: the joining device's name, and
  // (when creating) the room's name.
  name?: string;
  roomName?: string;
}
