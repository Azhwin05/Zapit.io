'use client';

import { useEffect, useRef } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCodeDisplay({ value, size = 200 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      if (cancelled || !canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: { dark: '#286749', light: '#ffffff' },
      });
    });
    return () => { cancelled = true; };
  }, [value, size]);

  return (
    <div className="rounded-modal overflow-hidden border border-outline-variant/30 bg-surface-white shadow-l1 p-3">
      <canvas ref={canvasRef} width={size} height={size} />
    </div>
  );
}
