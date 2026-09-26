import { describe, it, expect, vi, afterEach } from 'vitest';
import { isJoinRateLimited, isSignalingRateLimited } from './rate-limiter';

// rate-limiter.ts's two limiters are module-level singletons keyed by IP —
// using a fresh fake IP per test avoids cross-test pollution without needing
// a reset export (unlike room-manager.ts, whose state isn't IP-partitioned
// the same way).
let ipCounter = 0;
function freshIp(): string {
  return `10.99.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('isJoinRateLimited — 5 per minute per IP', () => {
  it('allows the first 5 attempts', () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) expect(isJoinRateLimited(ip)).toBe(false);
  });

  it('blocks the 6th attempt within the same window', () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) isJoinRateLimited(ip);
    expect(isJoinRateLimited(ip)).toBe(true);
  });

  it('a different IP is unaffected by another IP being limited', () => {
    const ipA = freshIp();
    const ipB = freshIp();
    for (let i = 0; i < 5; i++) isJoinRateLimited(ipA);
    expect(isJoinRateLimited(ipA)).toBe(true);
    expect(isJoinRateLimited(ipB)).toBe(false);
  });

  it('resets after the 60s window elapses', () => {
    vi.useFakeTimers();
    const ip = freshIp();
    for (let i = 0; i < 5; i++) isJoinRateLimited(ip);
    expect(isJoinRateLimited(ip)).toBe(true);

    vi.advanceTimersByTime(60_001);

    expect(isJoinRateLimited(ip)).toBe(false);
  });
});

describe('isSignalingRateLimited — 500 per minute per IP', () => {
  it('allows well under the limit', () => {
    const ip = freshIp();
    for (let i = 0; i < 100; i++) expect(isSignalingRateLimited(ip)).toBe(false);
  });

  it('blocks once the limit (500) is exceeded', () => {
    const ip = freshIp();
    for (let i = 0; i < 500; i++) isSignalingRateLimited(ip);
    expect(isSignalingRateLimited(ip)).toBe(true);
  });

  it('join and signaling limits are tracked independently per IP', () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) isJoinRateLimited(ip);
    // The join limiter is now maxed out for this IP, but signaling should
    // still be wide open — they're separate limiter instances/stores.
    expect(isSignalingRateLimited(ip)).toBe(false);
  });
});
