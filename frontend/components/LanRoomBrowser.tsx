'use client';

import { Users, ArrowRight } from 'lucide-react';
import type { PublicRoom } from '@/lib/signaling-client';

interface LanRoomBrowserProps {
  rooms: PublicRoom[];
  onJoin: (code: string) => void;
}

// The live list of rooms active on this local network. Only rendered in LAN
// mode (a LAN-mode signaling server is the only thing that pushes the room
// list). This is the "walk up and see the group already here, click to join"
// experience — no code typing, no QR scan needed once you're on the network.
export function LanRoomBrowser({ rooms, onJoin }: LanRoomBrowserProps) {
  if (rooms.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-3 animate-slide-up">
      <div className="flex items-center justify-center gap-2 text-on-surface-variant text-sm">
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-pulse-ring" />
          <div className="absolute inset-[3px] bg-primary rounded-full" />
        </div>
        {rooms.length === 1 ? '1 room on your network' : `${rooms.length} rooms on your network`}
      </div>

      <div className="flex flex-col gap-3">
        {rooms.map((room) => (
          <button
            key={room.code}
            onClick={() => onJoin(room.code)}
            className="group bg-surface-white rounded-card p-5 flex items-center gap-4 shadow-l1 hover:shadow-l2
                       border border-outline-variant/20 hover:border-primary/30
                       transition-all duration-200 active:scale-[0.98] text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-surface-low flex-shrink-0 flex items-center justify-center
                            group-hover:bg-primary/5 transition-colors">
              <Users className="w-6 h-6 text-primary" strokeWidth={1.5} />
            </div>
            <div className="flex-grow min-w-0">
              <p className="font-display font-semibold text-on-surface truncate">
                {room.name || `Room ${room.code.toUpperCase()}`}
              </p>
              <p className="text-sm text-on-surface-variant truncate">
                {room.peerCount} {room.peerCount === 1 ? 'device' : 'devices'}
                {room.deviceNames.length > 0 && ` · ${room.deviceNames.join(', ')}`}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
