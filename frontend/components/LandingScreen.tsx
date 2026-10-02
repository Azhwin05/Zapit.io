'use client';

import { Lock, UserX, Monitor } from 'lucide-react';
import { LanRoomBrowser } from './LanRoomBrowser';
import type { PublicRoom } from '@/lib/signaling-client';

interface LandingScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  connecting: boolean;
  lanRooms: PublicRoom[];
  onJoinCode: (code: string) => void;
}

export function LandingScreen({ onCreateRoom, onJoinRoom, connecting, lanRooms, onJoinCode }: LandingScreenProps) {
  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-24 animate-fade-in">
      <div className="w-full max-w-3xl mx-auto text-center flex flex-col items-center gap-10">
        {/* Hero */}
        <div className="space-y-4">
          <h1 className="font-display font-bold text-5xl sm:text-7xl text-on-surface tracking-tight leading-none">
            AirDrop for every device.
          </h1>
          <p className="text-lg sm:text-xl text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Move files between devices without apps, accounts, or setup.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
          <button
            onClick={() => onCreateRoom()}
            disabled={connecting}
            className="w-full sm:w-auto px-12 py-4 bg-primary text-white rounded-btn font-body font-medium text-lg
                       hover:bg-primary-dim transition-all shadow-primary-glow hover:shadow-primary-hover
                       hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {connecting ? 'Connecting…' : 'Create Room'}
          </button>
          <button
            onClick={onJoinRoom}
            className="w-full sm:w-auto px-12 py-4 bg-transparent border border-outline-variant text-on-surface rounded-btn font-body font-medium text-lg
                       hover:bg-surface-low hover:border-outline transition-all"
          >
            Join Room
          </button>
        </div>

        {/* Live room browser — only appears in LAN mode when rooms are active */}
        <LanRoomBrowser rooms={lanRooms} onJoin={onJoinCode} />

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8 pt-10 mt-2 border-t border-surface-high w-full max-w-lg">
          <div className="flex items-center gap-2 text-on-surface-variant/80">
            <Lock className="w-4 h-4" />
            <span className="text-sm">End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant/80">
            <UserX className="w-4 h-4" />
            <span className="text-sm">No Account Required</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant/80">
            <Monitor className="w-4 h-4" />
            <span className="text-sm">Works Across Devices</span>
          </div>
        </div>
      </div>
    </main>
  );
}
