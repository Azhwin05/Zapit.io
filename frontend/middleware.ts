import { NextResponse, type NextRequest } from 'next/server';

/**
 * A10: Nonce-based Content Security Policy.
 *
 * A fresh cryptographically-random nonce is generated per request and embedded
 * into the CSP header.  Next.js App Router reads the nonce from the x-nonce
 * request header (set below) and applies it to the inline hydration scripts it
 * generates, allowing us to drop 'unsafe-inline' from script-src in production.
 *
 * We keep 'unsafe-inline' in the CSP as a fallback for browsers that do not
 * understand nonces (CSP Level 1 only).  Per spec, 'unsafe-inline' is IGNORED
 * by browsers that support nonces, so this is safe — modern browsers honour the
 * nonce; legacy browsers fall back to 'unsafe-inline' as before.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce  = Buffer.from(crypto.randomUUID()).toString('base64');
  const isProd = process.env.NODE_ENV === 'production';

  // In dev, Next.js injects HMR/Fast Refresh scripts that don't carry the nonce,
  // and 'strict-dynamic' causes nonce-aware browsers to ignore 'unsafe-inline',
  // which blocks React hydration entirely. Use a permissive dev CSP instead.
  const scriptSrc = isProd
    ? `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`;

  // Lock connect-src to the exact WSS host in production so a compromised CDN or
  // injected script cannot phone home to an attacker-controlled signaling server.
  // NEXT_PUBLIC_SIGNALING_URL is available in middleware (Node.js runtime context).
  //
  // Exception — "LAN mode" (see lib/signaling-url.ts): a user can point this
  // browser at their own signaling server (e.g. one running on their own
  // laptop/network) instead of the build's default. That URL isn't known at
  // build time, so the strict single-host policy can't apply to it. The
  // user's own client JS sets a flag-only cookie (no URL, no secret) when
  // they opt into that mode; we widen connect-src to any ws(s) host only for
  // browsers carrying that cookie. A default deployment where no one has
  // ever opened the LAN-mode settings panel is completely unaffected.
  const hasCustomSignaling = request.cookies.get('zapit-custom-signaling')?.value === '1';

  const connectSrc = (() => {
    if (!isProd || hasCustomSignaling) return "connect-src 'self' ws: wss: http: https:";
    // Bug fixed here (caught by e2e/transfer.spec.ts against a real production
    // build): this used to hardcode `wss://${host}` regardless of the actual
    // configured scheme, which silently broke any deployment using a plain
    // ws:// signaling URL — including host/start.mjs (the self-hosted LAN
    // launcher) and any self-hosted deployment that bakes a ws:// URL in.
    // Falls back to the same ws://localhost:8787 default used client-side
    // (see lib/signaling-url.ts's resolveSignalingUrl) when the env var isn't
    // set at all, rather than assuming wss unconditionally.
    const raw = process.env.NEXT_PUBLIC_SIGNALING_URL ?? 'ws://localhost:8787';
    try {
      const { protocol, host } = new URL(raw);
      return `connect-src 'self' ${protocol}//${host}`;
    } catch {
      return "connect-src 'self' wss:"; // raw was unparseable — fall back to a narrow wildcard
    }
  })();

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    connectSrc,
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ].join('; ');

  // Pass nonce to the App Router so Next.js applies it to its inline scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set CSP on the response — takes precedence over next.config.mjs headers.
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    {
      // Run on all page requests; skip Next.js static chunks and image endpoints.
      source: '/((?!_next/static|_next/image|favicon\\.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
