'use client';

import { generateEcdhPair, exportEcdhPublicKey, deriveAesKey } from './crypto';
import { FileSender, FileReceiver, NUM_CHANNELS, type TransferProgress } from './transfer-engine';
import type { SignalingClient } from '../signaling-client';

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}

const ICE_SERVERS_DEFAULT: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CHANNEL_LABEL_PREFIX = 'zapit-data-';

type PeerRole = 'offerer' | 'answerer';

export interface PeerConnectionCallbacks {
  onProgress:    (p: TransferProgress) => void;
  onFileReceived:(file: File) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
  onError:       (msg: string) => void;
}

export class ZapitPeer {
  private pc: RTCPeerConnection;
  private channels: RTCDataChannel[] = [];
  private sessionKey: CryptoKey | null = null;
  private ecdhPair:   CryptoKeyPair | null = null;
  private sender:   FileSender  | null = null;
  private receiver: FileReceiver | null = null;
  // ICE candidates that arrived before setRemoteDescription was called are queued
  // here and drained immediately after the remote description is set. Dropping them
  // (the previous behaviour) caused intermittent connection failures on fast LANs
  // where candidates outrace the async offer/answer processing.
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescSet = false;

  constructor(
    private readonly sigClient: SignalingClient,
    private readonly peerId: string,
    private readonly role: PeerRole,
    turnCreds: TurnCredentials | null,
    private readonly callbacks: PeerConnectionCallbacks,
  ) {
    const iceServers: RTCIceServer[] = [...ICE_SERVERS_DEFAULT];
    if (turnCreds) {
      iceServers.push({
        urls:       turnCreds.urls,
        username:   turnCreds.username,
        credential: turnCreds.credential,
      });
    }

    this.pc = new RTCPeerConnection({ iceServers });
    this.pc.onconnectionstatechange = () => callbacks.onStateChange(this.pc.connectionState);
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) sigClient.sendIceCandidate(peerId, candidate.toJSON());
    };

    if (role === 'offerer') this.setupOffererChannels();
    else                     this.setupAnswererChannels();
  }

  // ── Channel setup ───────────────────────────────────────────────────────────

  private setupOffererChannels(): void {
    for (let i = 0; i < NUM_CHANNELS; i++) {
      const ch = this.pc.createDataChannel(`${CHANNEL_LABEL_PREFIX}${i}`, { ordered: true });
      ch.binaryType = 'arraybuffer';
      ch.onmessage = ({ data }) => this.handleIncoming(data as ArrayBuffer, ch);
      this.channels.push(ch);
    }
  }

  private setupAnswererChannels(): void {
    this.pc.ondatachannel = ({ channel }) => {
      channel.binaryType = 'arraybuffer';
      channel.onmessage  = ({ data }) => this.handleIncoming(data as ArrayBuffer, channel);
      this.channels.push(channel);
    };
  }

  private handleIncoming(data: ArrayBuffer, ch: RTCDataChannel): void {
    if (!this.sessionKey) return;

    if (!this.receiver) {
      this.receiver = new FileReceiver(
        this.sessionKey,
        this.callbacks.onProgress,
        this.callbacks.onFileReceived,
        this.callbacks.onError,
        () => {}, // onAccept — only relevant on sender side; set via setOnAccept in sendFiles
      );
    }

    this.receiver.handleFrame(data, ch).catch((e: unknown) => {
      console.error('[zapit:rtc] frame error', e);
    });
  }

  // ── Signaling flow ──────────────────────────────────────────────────────────

  async initiate(): Promise<void> {
    this.ecdhPair = await generateEcdhPair();
    const offer   = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sigClient.send({
      type: 'offer', to: this.peerId,
      payload: { sdp: offer, ecdhPublicKey: await exportEcdhPublicKey(this.ecdhPair) },
    });
  }

  async handleOffer(payload: { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string }): Promise<void> {
    this.ecdhPair   = await generateEcdhPair();
    this.sessionKey = await deriveAesKey(this.ecdhPair, payload.ecdhPublicKey);
    await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    this.remoteDescSet = true;
    await this.drainCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.sigClient.sendAnswer(this.peerId, answer, await exportEcdhPublicKey(this.ecdhPair));
  }

  async handleAnswer(payload: { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string }): Promise<void> {
    if (!this.ecdhPair) throw new Error('handleAnswer called before initiate()');
    this.sessionKey = await deriveAesKey(this.ecdhPair, payload.ecdhPublicKey);
    await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    this.remoteDescSet = true;
    await this.drainCandidates();
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteDescSet) { this.pendingCandidates.push(candidate); return; }
    try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale candidate */ }
  }

  private async drainCandidates(): Promise<void> {
    for (const c of this.pendingCandidates) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
    }
    this.pendingCandidates = [];
  }

  // ── Public transfer API ─────────────────────────────────────────────────────

  async sendFiles(files: File[]): Promise<void> {
    if (!this.sessionKey || this.channels.length === 0) {
      throw new Error('Peer not ready — session key or data channels not established');
    }

    this.sender = new FileSender(this.channels, this.sessionKey, this.callbacks.onProgress);

    // A5: update onAccept without recreating the receiver — preserves in-progress
    // receive state if both peers happen to send simultaneously.
    const sender = this.sender;
    if (!this.receiver) {
      this.receiver = new FileReceiver(
        this.sessionKey, this.callbacks.onProgress, this.callbacks.onFileReceived,
        this.callbacks.onError, () => sender.signalAccept(),
      );
    } else {
      this.receiver.setOnAccept(() => sender.signalAccept());
    }

    await this.sender.sendFiles(files);
  }

  close(): void {
    for (const ch of this.channels) ch.close();
    this.pc.close();
  }
}
