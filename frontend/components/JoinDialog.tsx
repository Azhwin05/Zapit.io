'use client';

import { useState, useEffect } from 'react';
import { normalizeCode } from '@/lib/room-code';
import { CodeInput } from './CodeInput';

interface JoinDialogProps {
  onJoin: (code: string) => void;
}

export function JoinDialog({ onJoin }: JoinDialogProps) {
  const [open, setOpen] = useState(false);
  const [chars, setChars] = useState<string[]>(Array(6).fill(''));

  useEffect(() => {
    if (!open) setChars(Array(6).fill(''));
  }, [open]);

  const code = chars.join('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    onJoin(normalizeCode(code));
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 px-6 rounded-2xl border border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-medium transition-all duration-150 active:scale-95"
      >
        Enter a room code
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-1">Join a room</h2>
            <p className="text-sm text-zinc-500 mb-5">Enter the 6-character code from the other device</p>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <CodeInput value={chars} onChange={setChars} autoFocus={open} />
              <button
                type="submit"
                disabled={code.length < 6}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all duration-150 active:scale-95"
              >
                Connect
              </button>
            </form>
            <button
              onClick={() => setOpen(false)}
              className="mt-3 w-full py-2 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
