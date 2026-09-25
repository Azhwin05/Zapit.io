// H4: Separate rate limits for join attempts vs. general signaling messages.
// Tight limit on join (brute-force surface); generous limit on signaling (ICE candidates etc.).

interface Window {
  count: number;
  resetAt: number;
}

function createLimiter(windowMs: number, max: number) {
  const store = new Map<string, Window>();

  function check(ip: string): boolean {
    const now = Date.now();
    let w = store.get(ip);
    if (!w || now > w.resetAt) {
      w = { count: 0, resetAt: now + windowMs };
      store.set(ip, w);
    }
    w.count++;
    return w.count > max;
  }

  // Prune expired windows periodically.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, w] of store) if (now > w.resetAt) store.delete(ip);
  }, windowMs * 2);

  return check;
}

// 5 join attempts per minute per IP — tight to resist room-code brute-force.
export const isJoinRateLimited = createLimiter(60_000, 5);

// 500 signaling messages per minute per IP — generous for normal ICE/SDP flow.
export const isSignalingRateLimited = createLimiter(60_000, 500);
