'use client';

import type { TransferProgress } from '@/lib/webrtc/transfer-engine';

interface TransferProgressProps {
  transfers: TransferProgress[];
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function humanEta(sec: number): string {
  if (!isFinite(sec) || sec > 3600) return '> 1h';
  if (sec < 2) return 'almost done';
  if (sec < 60) return `${Math.ceil(sec)}s`;
  return `${Math.ceil(sec / 60)}m`;
}

export function TransferProgressList({ transfers }: TransferProgressProps) {
  if (transfers.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {transfers.map((t) => {
        const pct = t.chunksTotal > 0 ? Math.min((t.chunksDone / t.chunksTotal) * 100, 100) : 0;
        return (
          <div key={t.transferIndex} className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700/50">
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate" title={t.fileName}>
                  {t.fileName}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {humanSize(t.bytesDone)} / {humanSize(t.bytesTotal)}
                </p>
              </div>
              <div className="text-right shrink-0">
                {t.done ? (
                  <span className="text-xs font-semibold text-brand-400 bg-brand-700/20 px-2 py-0.5 rounded-full">
                    Done
                  </span>
                ) : (
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-medium text-zinc-300">
                      {humanSize(t.throughputBps)}/s
                    </span>
                    <span className="text-xs text-zinc-500">
                      {humanEta(t.etaSeconds)} left
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={[
                  'absolute left-0 top-0 h-full rounded-full transition-all duration-300',
                  t.done ? 'bg-brand-500' : 'bg-brand-400',
                ].join(' ')}
                style={{ width: `${pct}%` }}
              />
              {!t.done && (
                <div
                  className="absolute top-0 h-full w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]"
                  style={{ left: `${Math.max(pct - 8, 0)}%` }}
                />
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-1.5 text-right">{pct.toFixed(0)}%</p>
          </div>
        );
      })}
    </div>
  );
}
