/**
 * TURN credential provider — Metered.ca hosted TURN service.
 *
 * Metered.ca manages the TURN server; we call their REST API to get
 * short-lived credentials per session. The METERED_API_KEY is a server-side
 * secret — it never reaches the browser.
 *
 * Free tier: 50 GB/month relay traffic, no credit card required.
 * Sign up: https://www.metered.ca/tools/openrelay/
 */

const METERED_API_KEY  = process.env.METERED_API_KEY  ?? '';
const METERED_API_HOST = process.env.METERED_API_HOST ?? '';  // e.g. youraccount.metered.ca

export interface TurnCredentials {
  urls:       string[];
  username:   string;
  credential: string;
  ttl:        number;
}

// Cached credentials — Metered issues credentials valid for 12 hours.
// Cache them so we don't make an API call per room join.
let cache: { creds: TurnCredentials; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // refresh every 6h (well within 12h validity)

export async function getTurnCredentials(): Promise<TurnCredentials | null> {
  if (!METERED_API_KEY || !METERED_API_HOST) return null;

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.creds;
  }

  try {
    const url = `https://${METERED_API_HOST}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`Metered API ${res.status}`);

    const iceServers = (await res.json()) as Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }>;

    // Metered returns a full ICE server list; pick the TURNS entries.
    const turns = iceServers.find(
      (s) => [s.urls].flat().some((u) => u.startsWith('turns:')),
    );
    if (!turns || !turns.username || !turns.credential) throw new Error('No TURNS entry in response');

    const creds: TurnCredentials = {
      urls:       [turns.urls].flat(),
      username:   turns.username,
      credential: turns.credential,
      ttl:        43200, // 12h — Metered's default
    };
    cache = { creds, fetchedAt: Date.now() };
    return creds;
  } catch (err) {
    // Non-fatal: fall back to STUN-only. Log so operator knows TURN is degraded.
    console.error('[zapit] Failed to fetch Metered TURN credentials:', err);
    return null;
  }
}
