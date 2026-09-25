'use client';

import type { TurnCredentials } from './webrtc/peer-connection';

export type SignalingEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'joined'; roomCode: string; clientId: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'room-full' }
  | { type: 'offer';  from: string; payload: { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string } }
  | { type: 'answer'; from: string; payload: { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string } }
  | { type: 'ice-candidate'; from: string; payload: RTCIceCandidateInit }
  | { type: 'turn-credentials'; payload: TurnCredentials }
  | { type: 'nearby-devices'; payload: Array<{ id: string; roomCode: string | null }> }
  | { type: 'error'; payload: string };

type Listener = (event: SignalingEvent) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const PENDING_MESSAGES_MAX = 50; // prevent unbounded growth during long disconnect

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners: Listener[] = [];
  private reconnectDelay = RECONNECT_BASE_MS;
  private destroyed = false;
  private pendingMessages: string[] = [];
  private clientId: string | null = null;

  constructor(private readonly url: string) {}

  connect(): void {
    if (this.destroyed) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = RECONNECT_BASE_MS;
      this.emit({ type: 'connected' });
      for (const msg of this.pendingMessages) this.ws!.send(msg);
      this.pendingMessages = [];
    };

    this.ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(ev.data as string) as Record<string, unknown>; }
      catch { return; }

      const type = msg.type as string;

      if (type === 'joined') {
        this.clientId = msg.from as string;
        this.emit({ type: 'joined', roomCode: msg.roomCode as string, clientId: this.clientId });
        return;
      }
      if (type === 'peer-joined') { this.emit({ type: 'peer-joined', peerId: msg.from as string }); return; }
      if (type === 'peer-left') { this.emit({ type: 'peer-left', peerId: msg.from as string }); return; }
      if (type === 'room-full') { this.emit({ type: 'room-full' }); return; }
      if (type === 'turn-credentials') { this.emit({ type: 'turn-credentials', payload: msg.payload as TurnCredentials }); return; }
      if (type === 'nearby-devices') { this.emit({ type: 'nearby-devices', payload: msg.payload as Array<{ id: string; roomCode: string | null }> }); return; }
      if (type === 'offer')  { this.emit({ type: 'offer',  from: msg.from as string, payload: msg.payload as { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string } }); return; }
      if (type === 'answer') { this.emit({ type: 'answer', from: msg.from as string, payload: msg.payload as { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string } }); return; }
      if (type === 'ice-candidate') { this.emit({ type: 'ice-candidate', from: msg.from as string, payload: msg.payload as RTCIceCandidateInit }); return; }
      if (type === 'error') { this.emit({ type: 'error', payload: msg.payload as string }); return; }
    };

    this.ws.onclose = () => {
      this.emit({ type: 'disconnected' });
      if (!this.destroyed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose fires after onerror; let it handle reconnect.
    };
  }

  send(msg: Record<string, unknown>): void {
    const str = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(str);
    } else if (this.pendingMessages.length < PENDING_MESSAGES_MAX) {
      this.pendingMessages.push(str);
    }
    // If queue is full, drop the message — prevents unbounded memory growth during
    // extended disconnects. Signaling messages are best-effort by design.
  }

  joinRoom(code: string): void {
    this.send({ type: 'join', roomCode: code });
  }

  leaveRoom(): void {
    this.send({ type: 'leave' });
  }

  sendOffer(to: string, offer: RTCSessionDescriptionInit): void {
    this.send({ type: 'offer', to, payload: offer });
  }

  sendAnswer(to: string, answer: RTCSessionDescriptionInit, ecdhPublicKey: string): void {
    this.send({ type: 'answer', to, payload: { sdp: answer, ecdhPublicKey } });
  }

  sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    this.send({ type: 'ice-candidate', to, payload: candidate });
  }

  on(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  getClientId(): string | null { return this.clientId; }

  destroy(): void {
    this.destroyed = true;
    this.ws?.close();
    this.ws = null;
  }

  private emit(event: SignalingEvent): void {
    for (const l of this.listeners) l(event);
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    setTimeout(() => this.connect(), delay);
  }
}
