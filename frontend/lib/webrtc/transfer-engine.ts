'use client';

import CRC32 from 'crc-32';
import { encrypt, decrypt } from './crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

// 128 KB keeps each encrypted frame well under RTCDataChannel's ~256 KB maxMessageSize.
const CHUNK_SIZE           = 128 * 1024;
export const NUM_CHANNELS  = 3;                 // parallel RTCDataChannels
const BUFFERED_AMOUNT_HIGH = 4  * 1024 * 1024;  // pause above 4 MB per channel
const BUFFERED_AMOUNT_LOW  = 512 * 1024;         // resume when drained to 512 KB
const EARLY_FRAMES_MAX     = 512;               // cap before manifest arrives
const ACCEPT_TIMEOUT_MS    = 10_000;            // A3: 10 s accept timeout

// ─── Wire format (all inside AES-GCM — TURN relay sees only the 12-byte IV) ──
//
//   [4 bytes] transferIndex  uint32-BE  (0xffffffff = manifest, 0xfffffffe = ctrl)
//   [4 bytes] chunkIndex     uint32-BE
//   [4 bytes] crc32          int32-BE   CRC32 of plaintext chunk
//   [4 bytes] totalChunks    uint32-BE
//   [1 byte]  flags          bit0=last, bit1=manifest, bit2=accept, bit3=error
//   [rest]    plaintext payload
//
// Wire: [12-byte IV][AES-GCM(above)]

const HDR = 17;

const FLAG_LAST     = 0b00000001;
const FLAG_MANIFEST = 0b00000010;
const FLAG_ACCEPT   = 0b00000100;
const FLAG_ERROR    = 0b00001000;

function encodeHeader(
  transferIndex: number,
  chunkIndex: number,
  crc32: number,
  totalChunks: number,
  flags: number,
): Uint8Array {
  const dv = new DataView(new ArrayBuffer(HDR));
  dv.setUint32(0, transferIndex, false);
  dv.setUint32(4, chunkIndex, false);
  dv.setInt32(8, crc32, false);
  dv.setUint32(12, totalChunks, false);
  dv.setUint8(16, flags);
  return new Uint8Array(dv.buffer);
}

interface ParsedFrame {
  transferIndex: number;
  chunkIndex:    number;
  crc32:         number;
  totalChunks:   number;
  flags:         number;
  payload:       Uint8Array;
}

function decodeFrame(plaintext: Uint8Array): ParsedFrame {
  const dv = new DataView(plaintext.buffer, plaintext.byteOffset, HDR);
  return {
    transferIndex: dv.getUint32(0, false),
    chunkIndex:    dv.getUint32(4, false),
    crc32:         dv.getInt32(8, false),
    totalChunks:   dv.getUint32(12, false),
    flags:         dv.getUint8(16),
    payload:       plaintext.slice(HDR),
  };
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.byteLength; }
  return out;
}

function toSendable(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FileManifestEntry {
  name: string;
  size: number;
  type: string;
}

export interface TransferProgress {
  transferIndex:  number;
  fileName:       string;
  chunksTotal:    number;
  chunksDone:     number;
  bytesTotal:     number;
  bytesDone:      number;
  throughputBps:  number;
  etaSeconds:     number;
  done:           boolean;
  direction:      'send' | 'receive';
  error?:         string;
}

type ProgressCb = (p: TransferProgress) => void;
type ReceiveCb  = (file: File) => void;
type ErrorCb    = (msg: string) => void;

// ─── Sender ──────────────────────────────────────────────────────────────────

export class FileSender {
  private acceptPromise: Promise<void> | null = null;
  private resolveAccept: (() => void) | null = null;

  constructor(
    private readonly channels: RTCDataChannel[],
    private readonly sessionKey: CryptoKey,
    private readonly onProgress: ProgressCb,
  ) {}

  async sendFiles(files: File[]): Promise<void> {
    // A4: Reset accept handshake so each sendFiles() call starts fresh.
    this.acceptPromise = null;
    this.resolveAccept = null;

    const manifest: FileManifestEntry[] = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
    }));
    await this.sendControlFrame(
      0xffffffff, 0, FLAG_MANIFEST,
      new TextEncoder().encode(JSON.stringify(manifest)),
      this.channels[0],
    );

    // A3: Wait for receiver's transfer-accept (times out after 10 s).
    await this.waitForAccept();

    // Send files in parallel; each file distributes its chunks across all channels.
    await Promise.all(files.map((file, i) => this.sendOneFile(file, i)));
  }

  signalAccept(): void {
    this.resolveAccept?.();
  }

  // A3: accept timeout — rejects if the receiver doesn't acknowledge within 10 s.
  private waitForAccept(): Promise<void> {
    if (this.acceptPromise) return this.acceptPromise;

    this.acceptPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Transfer accept timeout — receiver did not respond within 10 s')),
        ACCEPT_TIMEOUT_MS,
      );
      this.resolveAccept = () => { clearTimeout(timer); resolve(); };
    });

    return this.acceptPromise;
  }

  private async sendOneFile(file: File, transferIndex: number): Promise<void> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
    const startTime   = Date.now();

    // Encrypt all chunks in parallel — AES-GCM is hardware-accelerated; parallelising
    // here ensures the send loop is never stalled waiting for crypto.
    const encFrames = await Promise.all(
      Array.from({ length: totalChunks }, async (_, ci) => {
        const plain  = new Uint8Array(await file.slice(ci * CHUNK_SIZE, (ci + 1) * CHUNK_SIZE).arrayBuffer());
        const crc    = CRC32.buf(plain as unknown as number[]) >>> 0; // A9: crc-32 type compat
        const isLast = ci === totalChunks - 1;
        const hdr    = encodeHeader(transferIndex, ci, crc, totalChunks, isLast ? FLAG_LAST : 0);
        return { data: toSendable(await encrypt(this.sessionKey, concat(hdr, plain))), size: plain.byteLength, isLast };
      }),
    );

    // Send round-robin across channels with per-channel backpressure.
    let bytesDone = 0;
    for (let ci = 0; ci < totalChunks; ci++) {
      const ch = this.channels[ci % NUM_CHANNELS];
      await this.sendWithBackpressure(ch, encFrames[ci].data);
      bytesDone += encFrames[ci].size;
      const elapsed = (Date.now() - startTime) / 1000;
      const bps     = bytesDone / Math.max(elapsed, 0.001);
      this.onProgress({
        transferIndex,
        fileName:      file.name,
        chunksTotal:   totalChunks,
        chunksDone:    ci + 1,
        bytesTotal:    file.size,
        bytesDone,
        throughputBps: bps,
        etaSeconds:    (file.size - bytesDone) / Math.max(bps, 1),
        done:          encFrames[ci].isLast,
        direction:     'send',
      });
    }
  }

  private async sendControlFrame(
    transferIndex: number, chunkIndex: number, flags: number,
    payload: Uint8Array, ch: RTCDataChannel,
  ): Promise<void> {
    await this.waitForChannelOpen(ch);
    const hdr = encodeHeader(transferIndex, chunkIndex, 0, 1, flags);
    ch.send(toSendable(await encrypt(this.sessionKey, concat(hdr, payload))));
  }

  private async sendWithBackpressure(ch: RTCDataChannel, frame: ArrayBuffer): Promise<void> {
    if (ch.bufferedAmount > BUFFERED_AMOUNT_HIGH) {
      await new Promise<void>((resolve, reject) => {
        ch.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW;
        const onLow   = () => { cleanup(); resolve(); };
        const onClose = () => { cleanup(); reject(new Error(`Channel ${ch.label} closed while waiting for backpressure drain`)); };
        ch.addEventListener('bufferedamountlow', onLow);
        ch.addEventListener('close', onClose);
        function cleanup() {
          ch.removeEventListener('bufferedamountlow', onLow);
          ch.removeEventListener('close', onClose);
        }
      });
    }
    ch.send(frame);
  }

  private waitForChannelOpen(ch: RTCDataChannel): Promise<void> {
    if (ch.readyState === 'open') return Promise.resolve();
    if (ch.readyState === 'closed' || ch.readyState === 'closing') {
      return Promise.reject(new Error(`Channel ${ch.label} is already ${ch.readyState}`));
    }
    return new Promise((resolve, reject) => {
      const onOpen  = () => { cleanup(); resolve(); };
      const onClose = () => { cleanup(); reject(new Error(`Channel ${ch.label} closed before open`)); };
      ch.addEventListener('open',  onOpen);
      ch.addEventListener('close', onClose);
      function cleanup() {
        ch.removeEventListener('open',  onOpen);
        ch.removeEventListener('close', onClose);
      }
    });
  }
}

// ─── Receiver ────────────────────────────────────────────────────────────────

interface PendingTransfer {
  manifest:      FileManifestEntry;
  writer:        null; // Reserved; always null — see processChunk.
  memChunks:     Map<number, Uint8Array>;
  totalChunks:   number | null;
  receivedCount: number;
  bytesDone:     number;
  startTime:     number;
}

export class FileReceiver {
  private pending:       Map<number, PendingTransfer> = new Map();
  private manifests:     FileManifestEntry[] = [];
  private earlyFrames:   Array<{ raw: ParsedFrame }> = [];
  private manifestReady  = false;
  private onAcceptCb:    (ch: RTCDataChannel) => void;

  constructor(
    private readonly sessionKey: CryptoKey,
    private readonly onProgress: ProgressCb,
    private readonly onReceive:  ReceiveCb,
    private readonly onError:    ErrorCb,
    onAccept: (ch: RTCDataChannel) => void,
  ) {
    this.onAcceptCb = onAccept;
  }

  // A5: update accept callback without recreating the receiver (preserves in-progress state).
  setOnAccept(cb: (ch: RTCDataChannel) => void): void {
    this.onAcceptCb = cb;
  }

  // All frames decrypt concurrently (AES-GCM is hardware-accelerated and parallelises well).
  // processChunk is synchronous for every non-final chunk, so concurrent calls are safe:
  // JS is single-threaded — pt creation and receivedCount++ are atomic w.r.t. microtasks.
  async handleFrame(rawData: ArrayBuffer, replyChannel: RTCDataChannel): Promise<void> {
    let frame: ParsedFrame;
    try {
      const plaintext = await decrypt(this.sessionKey, new Uint8Array(rawData));
      frame = decodeFrame(plaintext);
    } catch {
      return; // AES-GCM auth failure → tampered/corrupt; discard silently.
    }

    // ── Manifest ──────────────────────────────────────────────────────────────
    if (frame.flags & FLAG_MANIFEST) {
      try {
        this.manifests = JSON.parse(new TextDecoder().decode(frame.payload)) as FileManifestEntry[];
      } catch {
        this.onError('Received a corrupt file manifest');
        return;
      }
      this.manifestReady = true;
      await this.sendAccept(replyChannel);
      this.onAcceptCb(replyChannel);
      for (const { raw } of this.earlyFrames) await this.processChunk(raw, replyChannel);
      this.earlyFrames = [];
      return;
    }

    // ── Control: accept echo ──────────────────────────────────────────────────
    if (frame.flags & FLAG_ACCEPT) {
      this.onAcceptCb(replyChannel);
      return;
    }

    // ── Error from sender ─────────────────────────────────────────────────────
    if (frame.flags & FLAG_ERROR) {
      this.onError(new TextDecoder().decode(frame.payload));
      return;
    }

    // ── Data chunk ────────────────────────────────────────────────────────────
    if (!this.manifestReady) {
      if (this.earlyFrames.length < EARLY_FRAMES_MAX) {
        this.earlyFrames.push({ raw: frame });
      } else {
        this.earlyFrames = [];
        this.onError('Transfer aborted: manifest not received before data chunks');
      }
      return;
    }

    await this.processChunk(frame, replyChannel);
  }

  private async processChunk(frame: ParsedFrame, _ch: RTCDataChannel): Promise<void> {
    const ti = frame.transferIndex;

    const computedCrc = CRC32.buf(frame.payload as unknown as number[]) >>> 0; // A9: crc-32 type compat
    if (computedCrc !== (frame.crc32 >>> 0)) {
      this.pending.delete(ti);
      this.onError(
        `Integrity error: chunk ${frame.chunkIndex} of ` +
        `"${this.manifests[ti]?.name ?? String(ti)}" failed CRC check — transfer aborted.`,
      );
      return;
    }

    let pt = this.pending.get(ti);
    if (!pt) {
      const manifest = this.manifests[ti] ?? { name: `file-${ti}`, size: 0, type: 'application/octet-stream' };
      pt = { manifest, writer: null, memChunks: new Map(), totalChunks: null, receivedCount: 0, bytesDone: 0, startTime: Date.now() };
      this.pending.set(ti, pt);
    }

    if (frame.flags & FLAG_LAST) pt.totalChunks = frame.chunkIndex + 1;

    // Always use the in-memory path — StreamSaver's iframe conflicts with the
    // page's frame-ancestors CSP header and causes writer.write() to hang.
    pt.memChunks.set(frame.chunkIndex, frame.payload);
    pt.receivedCount++;
    pt.bytesDone += frame.payload.byteLength;

    const elapsed = (Date.now() - pt.startTime) / 1000;
    const bps     = pt.bytesDone / Math.max(elapsed, 0.001);
    const eta     = ((pt.manifest.size || 0) - pt.bytesDone) / Math.max(bps, 1);

    this.onProgress({
      transferIndex: ti,
      fileName:      pt.manifest.name,
      chunksTotal:   pt.totalChunks ?? frame.totalChunks,
      chunksDone:    pt.receivedCount,
      bytesTotal:    pt.manifest.size,
      bytesDone:     pt.bytesDone,
      throughputBps: bps,
      etaSeconds:    eta,
      done:          false,
      direction:     'receive',
    });

    if (pt.totalChunks !== null && pt.receivedCount >= pt.totalChunks) {
      await this.finalizeTransfer(ti, pt);
    }
  }

  private async finalizeTransfer(ti: number, pt: PendingTransfer): Promise<void> {
    // Assemble chunks in order and hand the complete File to the UI.
    const sorted   = Array.from(pt.memChunks.entries()).sort(([a], [b]) => a - b);
    const total    = sorted.reduce((s, [, c]) => s + c.byteLength, 0);
    const buf      = new Uint8Array(total);
    let off = 0;
    for (const [, chunk] of sorted) { buf.set(chunk, off); off += chunk.byteLength; }
    const plainBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    this.onReceive(new File([plainBuf], pt.manifest.name, { type: pt.manifest.type }));

    this.onProgress({
      transferIndex: ti,
      fileName:      pt.manifest.name,
      chunksTotal:   pt.totalChunks!,
      chunksDone:    pt.receivedCount,
      bytesTotal:    pt.manifest.size,
      bytesDone:     pt.bytesDone,
      throughputBps: 0,
      etaSeconds:    0,
      done:          true,
      direction:     'receive',
    });

    this.pending.delete(ti);
  }

  private async sendAccept(ch: RTCDataChannel): Promise<void> {
    if (ch.readyState !== 'open') return;
    ch.send(toSendable(await encrypt(this.sessionKey, encodeHeader(0xfffffffe, 0, 0, 1, FLAG_ACCEPT))));
  }
}
