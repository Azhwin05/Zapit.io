'use client';

import { useEffect, useState } from 'react';
import { Settings, X, Wifi, Cloud, AlertCircle } from 'lucide-react';
import {
  getSignalingUrlOverride,
  setSignalingUrlOverride,
  isValidSignalingUrl,
  resolveSignalingUrl,
} from '@/lib/signaling-url';

/**
 * LAN-mode settings panel — lets a user point this browser at their own
 * signaling server (e.g. one running on their own laptop/network) instead
 * of the app's default. See lib/signaling-url.ts for how the override is
 * stored and why it needs a matching CSP change in middleware.ts.
 *
 * Applying a change reloads the page — simplest and safest way to fully
 * reset the WebSocket/WebRTC/room state rather than trying to hot-swap the
 * signaling connection mid-session.
 */
export function SignalingSettings() {
  const [open, setOpen]     = useState(false);
  const [input, setInput]   = useState('');
  const [error, setError]   = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(getSignalingUrlOverride());
    setInput(getSignalingUrlOverride() ?? '');
  }, [open]);

  const defaultUrl = resolveSignalingUrl();

  const handleUseCustom = () => {
    const url = input.trim();
    if (!url) { setError('Enter a signaling server URL first'); return; }
    if (!isValidSignalingUrl(url)) {
      setError('Must be a ws:// or wss:// URL, e.g. ws://192.168.1.42:8787');
      return;
    }
    setSignalingUrlOverride(url);
    window.location.reload();
  };

  const handleUseDefault = () => {
    setSignalingUrlOverride(null);
    window.location.reload();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Signaling server settings"
        className="text-on-surface-variant hover:text-on-surface transition-colors p-1.5 rounded-btn hover:bg-surface-low"
      >
        <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface-white rounded-modal shadow-l1 p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg text-on-surface">
                Signaling Server
              </h2>
              <button onClick={() => setOpen(false)} className="p-1 text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed">
              Zapit needs a small server to help two devices find each other (it never
              sees file contents). By default it uses the hosted server this site ships
              with — you can point it at your own instead, e.g. one running on your own
              laptop or local network for a fully self-hosted, zero-cloud setup.
            </p>

            <div className="flex items-center gap-2 px-3 py-2 rounded-btn bg-surface-low text-xs text-on-surface-variant">
              {current ? <Wifi className="w-3.5 h-3.5 shrink-0" /> : <Cloud className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">
                Currently using: <span className="font-mono text-on-surface">{defaultUrl}</span>
                {current ? ' (custom)' : ' (default)'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Custom server URL
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(null); }}
                placeholder="ws://192.168.1.42:8787"
                className="px-3 py-2.5 rounded-btn border border-outline-variant/40 bg-surface-white
                           text-sm font-mono text-on-surface placeholder:text-on-surface-variant/50
                           focus:outline-none focus:border-primary/60"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-error">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 justify-end pt-1">
              {current && (
                <button
                  onClick={handleUseDefault}
                  className="px-4 py-2 rounded-btn text-sm font-medium text-on-surface-variant
                             hover:bg-surface-low transition-colors"
                >
                  Use default
                </button>
              )}
              <button
                onClick={handleUseCustom}
                className="px-4 py-2 bg-primary text-white rounded-btn font-medium text-sm
                           hover:bg-primary-dim transition-colors"
              >
                Connect to this server
              </button>
            </div>

            <p className="text-xs text-on-surface-variant/70 leading-relaxed border-t border-outline-variant/20 pt-3">
              To run your own: <code className="font-mono">cd signaling-server && npm install && npm run dev</code>{' '}
              — see the project README for details. Applying a change reloads the page.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
