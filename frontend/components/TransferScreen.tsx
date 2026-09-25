'use client';

import { FileText, Laptop, Smartphone, HardDriveDownload } from 'lucide-react';
import type { TransferProgress, ReceivedResult } from '@/lib/webrtc/transfer-engine';
import { peerLabel } from '@/lib/peer-label';

interface TransferScreenProps {
  transfers: (TransferProgress & { peerId: string })[];
  receivedFiles: (ReceivedResult & { peerId: string })[];
  roomCode: string;
}

function humanSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function humanEta(sec: number): string {
  if (!isFinite(sec) || sec > 3600) return '> 1h';
  if (sec < 2)  return 'almost done';
  if (sec < 60) return `~${Math.ceil(sec)}s`;
  return `~${Math.ceil(sec / 60)}m`;
}

function fileExt(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

export function TransferScreen({ transfers, receivedFiles }: TransferScreenProps) {
  const activeTransfers = transfers.filter((t) => !t.done);
  const current = activeTransfers[0] ?? transfers[transfers.length - 1];

  if (!current) return null;

  const peerName = peerLabel(current.peerId);

  const pct = current.chunksTotal > 0
    ? Math.min((current.chunksDone / current.chunksTotal) * 100, 100)
    : 0;

  const speed = current.throughputBps > 0
    ? `${humanSize(current.throughputBps)}/s`
    : '—';

  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-10">

        {/* File card */}
        <div className="bg-surface-white shadow-l1 px-8 py-5 rounded-2xl flex items-center gap-5
                        border border-outline-variant/30 w-full max-w-xl">
          <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
            <FileText className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <div className="flex-grow min-w-0">
            <p className="font-display font-semibold text-2xl text-on-surface truncate">
              {current.fileName}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="bg-secondary/10 text-secondary px-2.5 py-0.5 rounded font-mono text-xs font-semibold uppercase tracking-wider">
                {fileExt(current.fileName)}
              </span>
              <span className="text-on-surface-variant text-sm">
                {humanSize(current.bytesTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Transfer visualization */}
        <div className="w-full flex items-center justify-between gap-6 relative">
          {/* Left device — sender when sending, peer when receiving */}
          <div className="flex flex-col items-center gap-3 w-28 flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-surface-white shadow-l1 border border-outline-variant/30
                            flex items-center justify-center">
              <Laptop className="w-10 h-10 text-on-surface-variant" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-mono text-xs text-on-surface-variant uppercase tracking-wider">Sending</p>
              <p className="font-display font-semibold text-base text-on-surface mt-0.5">
                {current.direction === 'receive' ? peerName : 'This Device'}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex-grow flex flex-col gap-3">
            {/* Percentage + ETA row */}
            <div className="flex items-end justify-between px-1">
              <span className="font-display font-bold text-5xl text-primary leading-none">
                {pct.toFixed(0)}%
              </span>
              {!current.done && (
                <span className="text-sm text-on-surface-variant bg-surface-mid px-3 py-1 rounded-btn border border-outline-variant/20">
                  {current.etaSeconds < 2 ? 'almost done' : `${humanEta(current.etaSeconds)} remaining`}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-surface-mid rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full relative transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/25 rounded-r-full" />
              </div>
            </div>

            {/* Speed + progress bytes */}
            <div className="flex justify-between px-1 text-on-surface-variant">
              <span className="font-mono text-sm font-medium">{speed}</span>
              <span className="font-mono text-sm">
                {humanSize(current.bytesDone)} / {humanSize(current.bytesTotal)}
              </span>
            </div>
          </div>

          {/* Right device — peer when sending, this device when receiving */}
          <div className="flex flex-col items-center gap-3 w-28 flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-surface-white shadow-l1 border border-outline-variant/30
                            flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-on-surface-variant" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-mono text-xs text-on-surface-variant uppercase tracking-wider">Receiving</p>
              <p className="font-display font-semibold text-base text-on-surface mt-0.5">
                {current.direction === 'receive' ? 'This Device' : peerName}
              </p>
            </div>
          </div>
        </div>

        {/* Multiple transfers queue */}
        {transfers.length > 1 && (
          <div className="w-full flex flex-col gap-2 animate-slide-up">
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Transfer queue</p>
            {transfers.map((t) => {
              const p = t.chunksTotal > 0 ? Math.min((t.chunksDone / t.chunksTotal) * 100, 100) : 0;
              return (
                <div
                  key={`${t.peerId}:${t.transferIndex}`}
                  className="bg-surface-white shadow-l1 rounded-xl px-4 py-3 border border-outline-variant/20
                             flex items-center gap-4"
                >
                  <span className="flex-grow text-sm text-on-surface truncate font-medium">
                    {t.fileName}
                    <span className="text-on-surface-variant font-normal ml-1.5">
                      · {t.direction === 'receive' ? 'from' : 'to'} {peerLabel(t.peerId)}
                    </span>
                  </span>
                  {t.done ? (
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Done</span>
                  ) : (
                    <span className="text-xs text-on-surface-variant font-mono">{p.toFixed(0)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Received files */}
        {receivedFiles.length > 0 && (
          <div className="w-full flex flex-col gap-2 animate-slide-up">
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Received files</p>
            {receivedFiles.map((r, i) => (
              <div
                key={i}
                className="bg-surface-white shadow-l1 rounded-xl px-4 py-3 border border-outline-variant/20
                           flex items-center justify-between gap-3"
              >
                <span className="text-sm text-on-surface truncate">
                  {r.kind === 'disk' ? r.name : r.file.name}
                  <span className="text-on-surface-variant font-normal ml-1.5">
                    · from {peerLabel(r.peerId)}
                  </span>
                </span>
                {r.kind === 'disk' ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-primary shrink-0">
                    <HardDriveDownload className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Saved to disk
                  </span>
                ) : (
                  <a
                    href={URL.createObjectURL(r.file)}
                    download={r.file.name}
                    className="text-xs font-semibold text-primary hover:text-primary-dim transition-colors shrink-0"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
