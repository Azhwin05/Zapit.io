import type { WebSocket } from 'ws';

export interface Client {
  ws: WebSocket;
  roomCode: string | null;
  publicIp: string;
  id: string;
  joinedAt: number;
}

export interface Room {
  code: string;
  clients: Map<string, Client>;
  createdAt: number;
  lastActivity: number;
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
  | 'error';

export interface SignalingMessage {
  type: MessageType;
  roomCode?: string;
  payload?: unknown;
  from?: string;
  to?: string;
}
