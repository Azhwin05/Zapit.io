'use client';

/**
 * Streaming disk writes via the File System Access API.
 *
 * Chunks arrive out of order across the 3 parallel RTCDataChannels, so we
 * can't just append — every write is positional (chunkIndex * CHUNK_SIZE),
 * which FileSystemWritableFileStream supports directly. This avoids ever
 * holding the full file in RAM.
 *
 * StreamSaver.js was tried previously and abandoned: its iframe-based MITM
 * download trick conflicts with this app's `frame-ancestors 'none'` CSP and
 * causes writer.write() to hang indefinitely. The File System Access API
 * needs no iframe/service-worker MITM, so it doesn't hit that problem.
 *
 * Support: Chromium-based browsers only (Chrome, Edge, Opera) as of this
 * writing — no Firefox/Safari. Callers must feature-detect and fall back to
 * the in-memory path (see transfer-engine.ts) when unsupported.
 */

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Prompts the user once for a save folder. The returned handle is reused for
 * every file received in the session — no per-file prompt.
 * Requires a user gesture (must be called from a click handler).
 */
export async function pickSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null; // user cancelled the picker
  }
}

// Sanitize a filename before using it inside a chosen directory — strip path
// separators and other characters that could escape the target directory or
// fail getFileHandle() on some platforms.
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|]/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'unnamed-file';
}

export class DiskWriter {
  private constructor(
    public readonly fileName: string,
    private readonly writable: FileSystemWritableFileStream,
  ) {}

  static async create(dir: FileSystemDirectoryHandle, name: string): Promise<DiskWriter> {
    const safeName = sanitizeFileName(name);
    const handle = await dir.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable({ keepExistingData: false });
    return new DiskWriter(safeName, writable);
  }

  async write(position: number, data: Uint8Array): Promise<void> {
    // Re-wrap so `data`'s buffer is a plain ArrayBuffer (not ArrayBufferLike/
    // SharedArrayBuffer), matching FileSystemWriteChunkType's stricter typing.
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    await this.writable.write({ type: 'write', position, data: new Uint8Array(buf) });
  }

  async close(): Promise<void> {
    await this.writable.close();
  }

  async abort(): Promise<void> {
    try { await this.writable.abort(); } catch { /* already closed */ }
  }
}
