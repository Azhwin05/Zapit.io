'use client';

import { useRef, useState, useCallback } from 'react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  connected: boolean;
  disabled?: boolean;
}

export function DropZone({ onFiles, connected, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFiles(Array.from(fileList));
    },
    [onFiles],
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };
  const onClick = () => { if (!disabled) inputRef.current?.click(); };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={[
        'relative flex flex-col items-center justify-center gap-4',
        'min-h-[280px] rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none',
        dragging
          ? 'border-brand-500 bg-brand-700/10 scale-[1.01]'
          : connected
          ? 'border-brand-700/50 hover:border-brand-600/70 bg-zinc-900/50 hover:bg-zinc-800/50'
          : 'border-zinc-700 bg-zinc-900/30 opacity-60 cursor-not-allowed',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || !connected}
      />
      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div className={[
          'w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-200',
          dragging ? 'bg-brand-700/40 scale-110' : 'bg-zinc-800',
        ].join(' ')}>
          {dragging ? '📂' : '📁'}
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-zinc-200">
            {connected
              ? dragging
                ? 'Drop to send'
                : 'Drop files here or click to browse'
              : 'Waiting for peer to connect…'}
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            {connected ? 'Any file type · No size limit · End-to-end encrypted' : 'Share your room code to get started'}
          </p>
        </div>
      </div>
      {dragging && (
        <div className="absolute inset-0 rounded-3xl border-2 border-brand-500 pointer-events-none animate-pulse-slow" />
      )}
    </div>
  );
}
