'use client';

// A human-friendly label for this device, shown to others in the LAN room
// browser ("Ashwin's Laptop" instead of a random id). Persisted per-device in
// localStorage; browsers can't read the OS hostname, so we seed a reasonable
// guess from the platform and let the user rename it.

const KEY = 'zapit-device-name';

function guessDefaultName(): string {
  if (typeof navigator === 'undefined') return 'My Device';
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android Phone';
  if (/macintosh|mac os x/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/linux/i.test(ua)) return 'Linux PC';
  return 'My Device';
}

export function getDeviceName(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // localStorage unavailable (private mode, blocked) — fall through.
  }
  return guessDefaultName();
}

export function setDeviceName(name: string): void {
  try {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed) localStorage.setItem(KEY, trimmed);
    else localStorage.removeItem(KEY);
  } catch {
    // Best-effort; a device with no writable storage just uses the guess.
  }
}
