'use client';

interface JoiningScreenProps {
  roomCode: string;
  status: 'waiting' | 'connecting' | 'disconnected' | string;
  statusMsg: string;
}

// Shown when this browser arrived via someone ELSE's room code/link/QR and
// is waiting for the WebRTC handshake to complete. Deliberately does NOT
// show this device's own room code or a QR to scan — that's DiscoveryScreen,
// for the person who created the room. Showing that here was the actual
// bug reported live: scanning a join QR on a phone landed on what looked
// like "the same page as the laptop" instead of any sign of progress.
export function JoiningScreen({ roomCode, status, statusMsg }: JoiningScreenProps) {
  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 text-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-pulse-ring" />
          <div className="absolute inset-[6px] bg-primary rounded-full" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display font-bold text-3xl text-on-surface tracking-tight">
            Connecting…
          </h1>
          <p className="text-on-surface-variant">
            Joining room{' '}
            <span className="font-mono font-semibold text-primary tracking-widest">
              {roomCode.toUpperCase()}
            </span>
          </p>
        </div>

        <p className="text-sm text-on-surface-variant/80">
          {status === 'connecting'
            ? 'Establishing a direct, encrypted connection to the other device…'
            : 'Waiting for the other device to be ready…'}
        </p>

        {status === 'disconnected' && statusMsg && (
          <div className="w-full px-4 py-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm font-medium">
            {statusMsg}
          </div>
        )}

        {status !== 'disconnected' && (
          <p className="text-xs text-on-surface-variant/60 max-w-sm">
            Taking a while? Direct connection can fail on some networks (strict
            corporate firewalls, symmetric NAT) — make sure both devices are on
            the same network, or that a TURN relay is configured.
          </p>
        )}
      </div>
    </main>
  );
}
