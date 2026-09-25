'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client-side errors for debugging. In production, swap console.error
    // for a lightweight POST to an error-reporting endpoint (e.g. /api/log-error).
    console.error('[zapit:error]', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7 text-error" />
        </div>
        <h1 className="font-display font-bold text-xl text-on-surface">Something went wrong</h1>
        <p className="text-sm text-on-surface-variant">
          An unexpected error occurred. Your files were not transferred and no data was sent.
        </p>
        {error.digest && (
          <p className="text-xs text-on-surface-variant/50 font-mono">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-2 px-6 py-2.5 bg-primary text-white rounded-btn font-body font-semibold
                     text-sm hover:bg-primary-dim transition-colors shadow-primary-glow"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
