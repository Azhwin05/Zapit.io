import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidSignalingUrl, resolveSignalingUrl, getSignalingUrlOverride, setSignalingUrlOverride } from './signaling-url';

// getSignalingUrlOverride/setSignalingUrlOverride's actual localStorage +
// cookie behavior needs a real DOM (jsdom or a real browser) to exercise
// meaningfully — that's covered by manual/e2e verification instead of a
// unit test here (adding jsdom as a dependency for one module felt like
// the wrong tradeoff). What IS unit-tested here: the pure validation logic,
// the env-var/default fallback chain, and — importantly — that these
// functions don't crash when `window` is undefined (the SSR/build-time
// code path, which is a real path these functions run through).

describe('isValidSignalingUrl', () => {
  it('accepts ws:// URLs', () => {
    expect(isValidSignalingUrl('ws://192.168.1.42:8787')).toBe(true);
  });

  it('accepts wss:// URLs', () => {
    expect(isValidSignalingUrl('wss://example.com')).toBe(true);
  });

  it('rejects http(s):// — a common mistake, easy to paste the wrong URL', () => {
    expect(isValidSignalingUrl('https://example.com')).toBe(false);
    expect(isValidSignalingUrl('http://example.com')).toBe(false);
  });

  it('rejects malformed input entirely (not just wrong scheme)', () => {
    expect(isValidSignalingUrl('not a url at all')).toBe(false);
    expect(isValidSignalingUrl('')).toBe(false);
  });
});

describe('resolveSignalingUrl — fallback chain', () => {
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SIGNALING_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SIGNALING_URL = ORIGINAL_ENV;
  });

  it('falls back to the build-time env var when no override exists (no window in this environment)', () => {
    process.env.NEXT_PUBLIC_SIGNALING_URL = 'wss://prod.example.com';
    expect(resolveSignalingUrl()).toBe('wss://prod.example.com');
  });

  it('falls back to ws://localhost:8787 when neither an override nor the env var is set', () => {
    delete process.env.NEXT_PUBLIC_SIGNALING_URL;
    expect(resolveSignalingUrl()).toBe('ws://localhost:8787');
  });
});

describe('getSignalingUrlOverride / setSignalingUrlOverride — no-window safety', () => {
  it('getSignalingUrlOverride returns null instead of throwing when window is undefined (SSR/build-time path)', () => {
    expect(typeof window).toBe('undefined');
    expect(getSignalingUrlOverride()).toBeNull();
  });

  it('setSignalingUrlOverride is a silent no-op instead of throwing when window is undefined', () => {
    expect(() => setSignalingUrlOverride('ws://example.com')).not.toThrow();
  });
});
