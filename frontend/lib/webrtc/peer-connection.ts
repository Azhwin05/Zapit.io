'use client';

import { generateEcdhPair, exportEcdhPublicKey, deriveAesKey, computeSafetyNumber } from './crypto';
import { FileSender, FileReceiver, NUM_CHANNELS, type TransferProgress, type ReceivedResult, type PendingTransfer } from './transfer-engine';
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
  onFileReceived:(result: ReceivedResult) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
  onError:       (msg: string) => void;
  // Returns a directory handle if the user picked a save folder — streams
  // received files to disk instead of buffering them in RAM. Optional.
  getSaveDirectory?: () => FileSystemDirectoryHandle | null;
  // Fires once the shared session key is derived — both peers compute the
  // identical safety number, which the user can manually compare to detect
  // an active MITM on the signaling channel (see SECURITY.md).
  onSafetyNumber?: (safetyNumber: string) => void;
  // Returns a Map the caller keeps alive per peerId, so FileReceiver's
  // in-progress state survives a new ZapitPeer/FileReceiver being created for
  // the same peerId (e.g. after an app-level retry) — see FileReceiver's
  // `pending` doc for what this does and does NOT cover (it does not survive
  // a full signaling reconnect, which gets a new peerId). Omit for the
  // original always-fresh behaviour.
  getResumeCache?: () => Map<number, PendingTransfer>;
}

export class ZapitPeer {
  private pc: RTCPeerConnection;
  private channels: RTCDataChannel[] = [];
  private sessionKey: CryptoKey | null = null;
  private ecdhPair:   CryptoKeyPair | null = null;
  private sender:   FileSender  | null = null;
  private receiver: FileReceiver | null = null;
  private myPublicKeyB64: string | null = null;
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
        this.callbacks.getSaveDirectory,
        this.callbacks.getResumeCache?.(),
      );
    }

    this.receiver.handleFrame(data, ch).catch((e: unknown) => {
      console.error('[zapit:rtc] frame error', e);
    });
  }

  // ── Signaling flow ──────────────────────────────────────────────────────────

  async initiate(): Promise<void> {
    this.ecdhPair       = await generateEcdhPair();
    this.myPublicKeyB64 = await exportEcdhPublicKey(this.ecdhPair);
    const offer          = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sigClient.send({
      type: 'offer', to: this.peerId,
      payload: { sdp: offer, ecdhPublicKey: this.myPublicKeyB64 },
    });
  }

  async handleOffer(payload: { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string }): Promise<void> {
    this.ecdhPair        = await generateEcdhPair();
    this.myPublicKeyB64  = await exportEcdhPublicKey(this.ecdhPair);
    this.sessionKey      = await deriveAesKey(this.ecdhPair, payload.ecdhPublicKey);
    await this.emitSafetyNumber(payload.ecdhPublicKey);
    await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    this.remoteDescSet = true;
    await this.drainCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.sigClient.sendAnswer(this.peerId, answer, this.myPublicKeyB64);
  }

  async handleAnswer(payload: { sdp: RTCSessionDescriptionInit; ecdhPublicKey: string }): Promise<void> {
    if (!this.ecdhPair || !this.myPublicKeyB64) throw new Error('handleAnswer called before initiate()');
    this.sessionKey = await deriveAesKey(this.ecdhPair, payload.ecdhPublicKey);
    await this.emitSafetyNumber(payload.ecdhPublicKey);
    await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    this.remoteDescSet = true;
    await this.drainCandidates();
  }

  private async emitSafetyNumber(theirPublicKeyB64: string): Promise<void> {
    if (!this.myPublicKeyB64 || !this.callbacks.onSafetyNumber) return;
    const safetyNumber = await computeSafetyNumber(this.myPublicKeyB64, theirPublicKeyB64);
    this.callbacks.onSafetyNumber(safetyNumber);
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
        this.callbacks.onError, () => sender.signalAccept(), this.callbacks.getSaveDirectory,
        this.callbacks.getResumeCache?.(),
      );
    } else {
      this.receiver.setOnAccept(() => sender.signalAccept());
    }
    this.receiver.setOnResumeInfo((ti, have) => sender.applyResumeInfo(ti, have));

    await this.sender.sendFiles(files);
  }

  close(): void {
    for (const ch of this.channels) ch.close();
    this.pc.close();
  }
}
