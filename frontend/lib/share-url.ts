'use client';

// Building the share link / QR code that gets another device into your room.
//
// On a normal hosted deployment this is trivial — `${origin}?join=<code>` —
// because every device resolves the signaling server the same way (the
// build-time NEXT_PUBLIC_SIGNALING_URL). LAN self-hosting breaks that
// assumption: the host runs its OWN signaling server, reachable only at the
// host's LAN address. A guest who scans a bare `?join=` link would fall back
// to their build-time default (localhost), which on the guest's own phone
// means the phone itself — so the WebSocket never reaches the host and the
// connection silently never forms.
//
// The fix: when a custom signaling server is active (i.e. we're in LAN mode),
// fold it into the share link as `?signaling=`, which the receiving device
// reads on load (see app/page.tsx) and adopts as its own override. We also
// rewrite a localhost signaling URL to the host's LAN address, since the
// host's own window talks to `wss://localhost:8787` but a guest must be told
// the host's real IP.

/**
 * Rewrite a `localhost`/`127.0.0.1` signaling URL to the host's LAN address so
 * it's reachable from other devices. Any other host (a real LAN IP already, or
 * a public hostname) is returned unchanged. Invalid input is passed through
 * untouched — a failed connect is the real validation.
 */
export function remapSignalingHost(signalingUrl: string, lanHost: string): string {
  try {
    const u = new URL(signalingUrl);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      u.hostname = lanHost;
    }
    // URL serialization appends a trailing slash for an empty path (e.g.
    // `wss://host:8787/`); drop it so the link matches what users expect.
    return u.toString().replace(/\/$/, '');
  } catch {
    return signalingUrl;
  }
}

/**
 * Build the join link for a room. When `signalingUrl` is provided (LAN mode),
 * it's appended so the receiving device adopts the same signaling server;
 * otherwise a plain `?join=` link is returned (hosted deployments, where every
 * device already shares a build-time default).
 */
export function buildShareUrl(origin: string, roomCode: string, signalingUrl?: string | null): string {
  const base = `${origin}?join=${roomCode}`;
  if (!signalingUrl) return base;
  return `${base}&signaling=${encodeURIComponent(signalingUrl)}`;
}
