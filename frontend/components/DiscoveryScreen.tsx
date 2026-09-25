'use client';

import { useState, useCallback } from 'react';
import { Share2, Copy, QrCode, CheckCircle2, Laptop, Smartphone, Tablet, Check } from 'lucide-react';
import { QRCodeDisplay } from './QRCode';
import { normalizeCode } from '@/lib/room-code';
import { CodeInput } from './CodeInput';

interface NearbyDevice {
  id: string;
  roomCode: string | null;
}

interface DiscoveryScreenProps {
  roomCode: string;
  shareUrl: string;
  status: 'waiting' | 'connecting' | 'disconnected' | string;
  statusMsg: string;
  nearbyDevices: NearbyDevice[];
  onNearbyConnect: (device: NearbyDevice) => void;
  onJoinCode: (code: string) => void;
}

function DeviceIcon({ id }: { id: string }) {
  const hash = id.charCodeAt(0) + id.charCodeAt(1);
  if (hash % 3 === 0) return <Laptop className="w-9 h-9 text-primary" strokeWidth={1.5} />;
  if (hash % 3 === 1) return <Smartphone className="w-9 h-9 text-primary" strokeWidth={1.5} />;
  return <Tablet className="w-9 h-9 text-primary" strokeWidth={1.5} />;
}

export function DiscoveryScreen({
  roomCode, shareUrl, status, statusMsg, nearbyDevices, onNearbyConnect, onJoinCode,
}: DiscoveryScreenProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinChars, setJoinChars] = useState<string[]>(Array(6).fill(''));

  const copyCode = useCallback(async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomCode]);

  const shareLink = useCallback(async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join my Zapit room', url: shareUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const submitJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeCode(joinChars.join(''));
    if (code.length < 6) return;
    onJoinCode(code);
    setJoinOpen(false);
    setJoinChars(Array(6).fill(''));
  };

  const displayCode = roomCode.toUpperCase().split('').join(' ');

  return (
    <main className="flex-grow flex flex-col items-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-12">

        {/* Room Code Card */}
        <div className="text-center flex flex-col items-center gap-6">
          <p className="text-on-surface-variant font-body text-lg">Your Room Code</p>

          <button
            onClick={copyCode}
            className="group relative cursor-pointer active:scale-95 transition-transform duration-200"
            title="Click to copy"
          >
            <div className="bg-surface-white rounded-modal px-12 py-8 shadow-l1 border border-outline-variant/20
                            flex items-center justify-center gap-4
                            group-hover:shadow-l2 transition-shadow duration-300">
              <span className="text-outline font-mono font-medium text-xl tracking-[0.2em]">ROOM&nbsp;•</span>
              <span className="font-mono font-bold text-3xl sm:text-4xl text-primary tracking-[0.25em]">
                {displayCode}
              </span>
            </div>
            <div className="absolute -inset-2 bg-primary/5 rounded-[calc(1.5rem+8px)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </button>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={shareLink}
              className="flex items-center gap-2 bg-primary text-white rounded-modal px-6 py-3.5 font-body font-medium text-sm
                         hover:bg-primary-dim transition-colors shadow-l1 active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Share Link
            </button>
            <button
              onClick={copyCode}
              className="flex items-center gap-2 bg-transparent text-primary border border-primary/20 rounded-modal px-6 py-3.5 font-body font-medium text-sm
                         hover:bg-primary/5 transition-colors active:scale-95"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 bg-transparent text-primary border border-primary/20 rounded-modal px-6 py-3.5 font-body font-medium text-sm
                         hover:bg-primary/5 transition-colors active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              {showQR ? 'Hide QR' : 'Show QR Code'}
            </button>
          </div>

          {/* QR Code */}
          {showQR && (
            <div className="animate-fade-in">
              <QRCodeDisplay value={shareUrl || roomCode} size={200} />
            </div>
          )}
        </div>

        {/* Status indicator */}
        {status === 'disconnected' && statusMsg && (
          <div className="px-4 py-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm font-medium text-center">
            {statusMsg}
          </div>
        )}

        {/* Nearby Devices */}
        {nearbyDevices.length > 0 ? (
          <div className="w-full flex flex-col gap-4 animate-slide-up">
            <div className="flex items-center gap-2 text-on-surface-variant text-sm">
              <div className="relative w-3 h-3">
                <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-pulse-ring" />
                <div className="absolute inset-[3px] bg-primary rounded-full" />
              </div>
              Devices on your network
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {nearbyDevices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => onNearbyConnect(device)}
                  className="bg-surface-white rounded-card p-8 flex items-center gap-5 shadow-l1 hover:shadow-l2
                             border border-outline-variant/20 hover:border-primary/20
                             transition-all duration-300 cursor-pointer group active:scale-[0.98] text-left"
                >
                  <div className="w-16 h-16 rounded-2xl bg-surface-low flex-shrink-0 flex items-center justify-center
                                  group-hover:bg-primary/5 transition-colors">
                    <DeviceIcon id={device.id} />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-lg text-on-surface">
                      Device on your network
                    </p>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-primary mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Available Now
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <div className="relative w-3 h-3">
              <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-pulse-ring" />
              <div className="absolute inset-[3px] bg-primary rounded-full" />
            </div>
            {status === 'connecting' ? 'Establishing P2P connection…' : 'Searching for devices nearby…'}
          </div>
        )}

        {/* Join someone else's room */}
        {!joinOpen ? (
          <button
            onClick={() => setJoinOpen(true)}
            className="text-sm text-on-surface-variant hover:text-primary transition-colors underline underline-offset-4"
          >
            Enter someone else's room code instead
          </button>
        ) : (
          <div className="w-full max-w-sm animate-slide-up">
            <form onSubmit={submitJoin} className="flex flex-col gap-4">
              <p className="text-sm font-medium text-on-surface text-center">Enter the 6-character code</p>
              <CodeInput value={joinChars} onChange={setJoinChars} autoFocus />
              <button
                type="submit"
                disabled={joinChars.join('').length < 6}
                className="w-full py-3 rounded-xl bg-primary text-white font-body font-medium
                           hover:bg-primary-dim disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all active:scale-95"
              >
                Connect
              </button>
              <button
                type="button"
                onClick={() => { setJoinOpen(false); setJoinChars(Array(6).fill('')); }}
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors text-center"
              >
                Cancel
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
