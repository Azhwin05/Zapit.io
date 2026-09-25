'use client';

interface NearbyDevice {
  id: string;
  roomCode: string | null;
}

interface NearbyDevicesProps {
  devices: NearbyDevice[];
  onConnect: (device: NearbyDevice) => void;
}

export function NearbyDevices({ devices, onConnect }: NearbyDevicesProps) {
  if (devices.length === 0) return null;

  return (
    <div className="animate-slide-up rounded-2xl border border-brand-700/40 bg-brand-700/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
        </span>
        <p className="text-sm font-semibold text-brand-400">Nearby devices detected</p>
      </div>
      <div className="flex flex-col gap-2">
        {devices.map((d) => (
          <button
            key={d.id}
            onClick={() => onConnect(d)}
            className="flex items-center justify-between w-full bg-brand-700/20 hover:bg-brand-700/40 border border-brand-700/30 rounded-xl px-4 py-3 transition-all duration-150 active:scale-95 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-700/50 flex items-center justify-center text-sm text-brand-400">
                {d.id.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Device on your network</p>
                <p className="text-xs text-zinc-500 font-mono">{d.id.slice(0, 8)}</p>
              </div>
            </div>
            <span className="text-brand-400 text-sm group-hover:translate-x-0.5 transition-transform">
              Connect →
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-600 mt-3 text-center">Same Wi-Fi / LAN — no code needed</p>
    </div>
  );
}
