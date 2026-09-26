'use client';

import { Infinity, X } from 'lucide-react';
import { SignalingSettings } from './SignalingSettings';

interface NavBarProps {
  roomCode: string | null;
  onDisconnect?: () => void;
}

export function NavBar({ roomCode, onDisconnect }: NavBarProps) {
  return (
    <header className="w-full px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Infinity className="text-primary w-6 h-6" strokeWidth={2.5} />
          <span className="font-display font-bold text-xl text-primary tracking-tight">
            Zapit
          </span>
        </div>
        <SignalingSettings />
      </div>

      {roomCode ? (
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-btn shadow-l1 border border-outline-variant/30">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
          <span className="font-mono text-sm font-semibold text-on-surface-variant tracking-wider uppercase">
            ROOM • {roomCode.toUpperCase()}
          </span>
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              aria-label="Disconnect"
              className="ml-1 text-on-surface-variant hover:text-error transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div />
      )}
    </header>
  );
}
