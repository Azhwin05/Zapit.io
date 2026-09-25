'use client';

import { useState } from 'react';

interface RoomCodeProps {
  code: string;
}

export function RoomCode({ code }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-zinc-400 tracking-widest uppercase">Your room code</p>
      <button
        onClick={copy}
        className="group flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl px-6 py-4 transition-all duration-150 active:scale-95"
        title="Click to copy"
      >
        <span className="font-mono text-2xl font-bold tracking-wider text-white select-all">
          {code}
        </span>
        <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors text-sm">
          {copied ? '✓ Copied' : 'Copy'}
        </span>
      </button>
      <p className="text-xs text-zinc-600">Share this code with the other device</p>
    </div>
  );
}
