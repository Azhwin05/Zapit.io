# Zapit Operations Runbook

This document is for whoever is on-call when a user says "Zapit isn't working."

**Deploy targets:** signaling server on **Koyeb**, frontend on **Vercel**,
TURN relay via **Metered.ca** (hosted — no self-managed coturn VPS in the
default setup). If you've chosen to self-host coturn instead, see
[README.md § TURN Server](README.md#turn-server-optional-for-maximum-compatibility)
for the additional maintenance steps that implies.

---

## Quick Orientation

```
User's browser  ←──── WebRTC DataChannel (P2P or TURN relay) ────→  Other browser
     │                                                                      │
     └──────── WebSocket (signaling) ──── Koyeb (zapit-signaling) ─────────┘
                                                    │
                                       TURN relay (Metered.ca, hosted)
```

The signaling server negotiates the WebRTC connection. Once peers are connected, all
file data flows directly between browsers (or via the TURN relay) — the signaling server
is no longer in the data path.

---

## Health Check

**Endpoint:** `GET https://<your-koyeb-app>.koyeb.app/health`

**Healthy response (HTTP 200):**
```json
{
  "status": "ok",
  "connections": 4,
  "rooms": 2,
  "uptimeSeconds": 86400
}
```

**Unhealthy:** any non-200 response, connection refused, or timeout.

**How to check:**
```bash
curl -s https://<your-koyeb-app>.koyeb.app/health | jq .
```

---

## Log Access

### Signaling server (Koyeb)
Koyeb dashboard → your service → **Logs** tab. Filter by text (e.g. `error`,
`rate limited`, `connection rejected`).

Pino log levels: 10=trace, 20=debug, 30=info, **40=warn**, **50=error**, 60=fatal.
Production log level is `info` (30+). To get debug detail during an incident,
set `LOG_LEVEL=debug` in the Koyeb service's environment variables and redeploy;
revert to `info` once done.

### Frontend (Vercel)
Vercel → Project → Deployments → select the current deployment → Functions tab.
The Next.js frontend has no server-side functions except middleware (CSP headers only).
Client-side errors log to browser console. No server-side log stream for client errors
unless you add an error-reporting endpoint.

---

## Healthy vs Unhealthy State

| Symptom | Healthy | Unhealthy |
|---|---|---|
| `/health` response | `status: "ok"`, uptime > 0 | non-200, timeout, or `status: "error"` |
| `connections` | > 0 during active usage, 0 when idle | unexpectedly high (> 200) = potential DoS |
| `rooms` | ≤ connections/2 | rooms > connections = stale room leak |
| Koyeb service metrics | CPU/memory within your instance size's normal range | CPU spike or OOM restart |

---

## Triage by Symptom

### "I can't generate/join a room code"
1. Check `/health` — is the signaling server up?
2. Check browser console for WebSocket errors. Common causes:
   - `wss://` URL wrong or missing in the Vercel `NEXT_PUBLIC_SIGNALING_URL` env var
   - CORS/origin mismatch (check `ALLOWED_ORIGINS` on Koyeb matches the actual Vercel domain)
3. Check Koyeb logs for `connection rejected` or `rate limited` messages.

### "Room code works but they can't connect to each other"
This is a WebRTC ICE failure. Could be:
1. **Direct P2P blocked** by one user's firewall — normal, TURN should kick in.
2. **TURN credentials not being issued** — check `METERED_API_KEY` / `METERED_API_HOST`
   are set on Koyeb and valid. If unset, the server intentionally runs STUN-only
   (see `turn-credentials.ts`) — users behind symmetric NAT (~5-10%) can't connect.
3. **Metered.ca outage or quota exhausted** — check the Metered.ca dashboard for the
   account's usage against the plan's monthly relay-traffic limit.
4. Browser console will show ICE gathering errors and candidate types. If only `host`
   candidates appear (no `srflx`/`relay`), TURN isn't being reached.

### "File transfer starts but gets stuck"
1. Likely a large file (> 500 MB) hitting RAM limits on the receiver. The UI warns about this.
2. Could be a WebRTC data channel backpressure issue — ask the user to try a smaller file.
3. Check if the TURN relay connection dropped mid-transfer (Koyeb logs will show the
   WebSocket close event on the signaling side, though the transfer itself is P2P/TURN
   data-channel traffic the signaling server can't see directly).

### "The signaling server is up but behaves oddly"
1. `connections` much higher than expected → check for zombie connections (clients that
   didn't close cleanly). The heartbeat pings every 30s and terminates zombies.
2. Rate limiter firing too aggressively → check Koyeb logs for `Rate limited` events.
   Adjust `rate-limiter.ts` constants and redeploy.

---

## Redeployment

### Signaling server (Koyeb)
Push to the `main` branch — Koyeb auto-deploys from the Dockerfile
(`signaling-server/Dockerfile`). To deploy manually, trigger a redeploy from the
Koyeb dashboard.

### Frontend (Vercel)
Push to `main` branch — Vercel auto-deploys. Or trigger manually in the Vercel dashboard.

---

## Scaling

The signaling server is stateful (in-memory room/client maps). It does **not** support
horizontal scaling with multiple instances without a shared state layer (Redis, etc.).
For the current traffic level, vertical scaling (a larger Koyeb instance size) is the
right lever. The application-level hard cap is 380 concurrent connections per instance
(`room-manager.ts` — `MAX_CONNS_GLOBAL`); if you regularly approach it, scale up the
instance and raise that constant accordingly.

---

## TURN Relay (Metered.ca)

- Credentials are fetched via `turn-credentials.ts` and cached for 6 hours (Metered
  issues 12h-valid credentials).
- Free tier: 50 GB/month relay traffic, no credit card. If usage grows, check the
  Metered.ca dashboard for plan/quota status before users start seeing connection
  failures behind symmetric NAT.
- No maintenance burden on your side — Metered.ca operates and patches the TURN
  infrastructure. If you later choose to self-host coturn instead, see
  `coturn/turnserver.conf` and the README's self-hosting section — that path adds
  TLS cert renewal, log monitoring, and secrets rotation responsibilities not covered
  here.

---

## Secrets Rotation

- **`METERED_API_KEY`**: rotate from the Metered.ca dashboard, then update the
  `METERED_API_KEY` environment variable on Koyeb and redeploy. The old key stops
  working immediately once rotated on Metered's side — do both steps close together
  to avoid a gap where TURN is unavailable.
- **`ALLOWED_ORIGINS`**: update on Koyeb if the frontend domain changes; redeploy.
