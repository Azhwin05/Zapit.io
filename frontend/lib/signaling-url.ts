'use client';

/**
 * Runtime-configurable signaling server URL ("LAN mode").
 *
 * By default the signaling URL is fixed at build time via
 * NEXT_PUBLIC_SIGNALING_URL (inlined by Next.js — see app/page.tsx). That's
 * right for a standard hosted deployment, but it can't work for someone
 * running the signaling server on their own laptop/LAN, since the right URL
 * depends on their network, not the build.
 *
 * This module lets a user override it at runtime, persisted in
 * localStorage (client-only, never sent to any server). When an override is
 * active we also set a same-site cookie (`zapit-custom-signaling=1`, no
 * value beyond a flag) purely so middleware.ts can widen the CSP
 * `connect-src` for this browser — the cookie carries no URL or secret, just
 * "this user opted into custom mode." Default hosted deployments (no
 * override ever set) are completely unaffected: same strict single-host CSP
 * as before.
 */

const STORAGE_KEY = 'zapit-signaling-url-override';
const CSP_COOKIE = 'zapit-custom-signaling';

export function getSignalingUrlOverride(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null; // private browsing / storage disabled
  }
}

export function setSignalingUrlOverride(url: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (url && url.trim()) {
      window.localStorage.setItem(STORAGE_KEY, url.trim());
      document.cookie = `${CSP_COOKIE}=1; path=/; SameSite=Strict`;
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      document.cookie = `${CSP_COOKIE}=; path=/; Max-Age=0; SameSite=Strict`;
    }
  } catch {
    // Storage disabled — override simply won't persist across reloads.
  }
}

/** Basic sanity check — a real connect attempt is the real validation. */
export function isValidSignalingUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'ws:' || protocol === 'wss:';
  } catch {
    return false;
  }
}

/**
 * Resolves the signaling URL to actually use: localStorage override (LAN
 * mode) first, then the build-time env var, then a localhost dev fallback.
 */
export function resolveSignalingUrl(): string {
  return (
    getSignalingUrlOverride() ??
    process.env.NEXT_PUBLIC_SIGNALING_URL ??
    'ws://localhost:8787'
  );
}
