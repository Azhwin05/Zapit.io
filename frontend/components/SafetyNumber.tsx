'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

interface SafetyNumberProps {
  safetyNumber: string;
  verified: boolean;
  onVerify: () => void;
}

/**
 * Advisory-only MITM check (see SECURITY.md's acknowledged threat-model gap).
 * Transfers are never blocked on this — it just makes the gap visible and
 * gives users a way to close it themselves, matching Zapit's "known and
 * intentional trade-off... ease of use" framing.
 */
export function SafetyNumber({ safetyNumber, verified, onVerify }: SafetyNumberProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full bg-surface-white shadow-l1 rounded-xl border border-outline-variant/20 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {verified ? (
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />
        ) : (
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={1.5} />
        )}
        <span className="flex-grow text-sm font-medium text-on-surface">
          {verified ? 'Connection verified' : 'Verify this connection is secure'}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-on-surface-variant" />
        ) : (
          <ChevronDown className="w-4 h-4 text-on-surface-variant" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-outline-variant/10 pt-3">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Read this number aloud or compare it with the other device (e.g. over a call or in
            person). If they don&apos;t match, someone may be intercepting your connection —
            disconnect and try again.
          </p>
          <p className="font-mono text-lg tracking-widest text-center bg-surface-low rounded-lg py-3 text-on-surface select-all">
            {safetyNumber}
          </p>
          {!verified && (
            <button
              onClick={onVerify}
              className="self-center px-5 py-2 bg-primary text-white rounded-btn font-body font-medium
                         text-sm hover:bg-primary-dim transition-colors active:scale-95"
            >
              Numbers match — confirm
            </button>
          )}
        </div>
      )}
    </div>
  );
}
