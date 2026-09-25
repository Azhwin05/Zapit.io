# Zapit Operations Runbook

This document is for whoever is on-call when a user says "Zapit isn't working."

---

## Quick Orientation

```
User's browser  ←──── WebRTC DataChannel (P2P or TURN relay) ────→  Other browser
     │                                                                      │
     └──────── WebSocket (signaling) ──── Fly.io (zapit-signaling) ────────┘
                                                    │
                                       TURN relay (coturn VPS, optional path)
```

The signaling server negotiates the WebRTC connection. Once peers are connected, all
file data flows directly between browsers (or via coturn relay) — the signaling server
is no longer in the data path.

---

## Health Check

**Endpoint:** `GET https://zapit-signaling.fly.dev/health`

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
curl -s https://zapit-signaling.fly.dev/health | jq .
```

---

## Log Access

### Signaling server (Fly.io)
```bash
fly logs --app zapit-signaling
# Filter to errors only:
fly logs --app zapit-signaling | grep '"level":50'
```

Pino log levels: 10=trace, 20=debug, 30=info, **40=warn**, **50=error**, 60=fatal.
Production log level is `info` (30+). If you need debug detail during an incident,
temporarily set it via:
```bash
fly secrets set LOG_LEVEL=debug --app zapit-signaling
```
Remember to revert: `fly secrets set LOG_LEVEL=info`.

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
| Fly.io Metrics | CPU < 50%, Memory < 200 MB | CPU spike or OOM kill |

---

## Triage by Symptom

### "I can't generate/join a room code"
1. Check `/health` — is the signaling server up?
2. Check browser console for WebSocket errors. Common causes:
   - `wss://` URL wrong or missing in Vercel env var
   - CORS/origin mismatch (check `ALLOWED_ORIGINS` env var matches the actual Vercel domain)
3. Check server logs (`pm2 logs zapit` on Oracle VM, or Koyeb dashboard logs) for `connection rejected` or `rate limited` messages.

### "Room code works but they can't connect to each other"
This is a WebRTC ICE failure. Could be:
1. **Direct P2P blocked** by one user's firewall — normal, TURN should kick in.
2. **TURN server unreachable** — check `TURN_HOST` resolves and coturn is running.
   ```bash
   # From the VPS:
   systemctl status coturn
   # Check open ports:
   ss -tuln | grep -E '3478|5349'
   ```
3. **TURN credentials wrong** — check `TURN_SECRET` on Fly.io matches `static-auth-secret` in `/etc/turnserver.conf` on the VPS.
4. Browser console will show ICE gathering errors and candidate types. If only `host` candidates appear (no `srflx`/`relay`), the TURN server is unreachable.

### "File transfer starts but gets stuck"
1. Likely a large file (> 500 MB) hitting RAM limits on the receiver. The UI warns about this.
2. Could be a WebRTC data channel backpressure issue — ask the user to try a smaller file.
3. Check if the TURN relay connection dropped mid-transfer (Fly.io logs will show WebSocket close event).

### "The signaling server is up but behaves oddly"
1. `connections` much higher than expected → check for zombie connections (clients that didn't close cleanly). The heartbeat pings every 30s and terminates zombies.
2. Rate limiter firing too aggressively → check Fly.io logs for `Rate limited` events. Adjust `rate-limiter.ts` constants and redeploy.

---

## Redeployment

### Signaling server (Oracle Cloud VM / PM2)
```bash
# On the VM:
cd ~/Zapit.io/signaling-server
git pull
npm ci && npm run build
pm2 restart zapit
```

### Signaling server (Koyeb)
Push to main branch — Koyeb auto-deploys from the Dockerfile.

### Frontend (Vercel)
Push to `main` branch — Vercel auto-deploys. Or trigger manually in the Vercel dashboard.

---

## Scaling

The signaling server is stateful (in-memory room/client maps). It does **not** support
horizontal scaling with multiple instances without a shared state layer (Redis, etc.).
For the current traffic level, vertical scaling (more CPU/RAM on a single Fly.io machine)
is the right lever. The hard cap is 500 connections per instance; if you regularly hit
400+ (the soft limit), upgrade the Fly.io VM size.

---

## TURN Server Maintenance (coturn VPS)

- TLS cert renewal: `certbot renew` (set up auto-renewal cron)
- After cert renewal, restart coturn: `systemctl restart coturn`
- coturn log: `/var/log/coturn/turn.log`
- Test TURN reachability: `turnutils_uclient -T turns://turn.yourdomain.com`

---

## Secrets Rotation

To rotate `TURN_SECRET`:
1. Generate a new secret: `openssl rand -hex 32`
2. Update `/etc/turnserver.conf` on the coturn VPS: set `static-auth-secret=<new>`
3. Restart coturn: `systemctl restart coturn`
4. Update the signaling server: `fly secrets set TURN_SECRET=<new> --app zapit-signaling`
5. Fly.io automatically restarts the app. **Both updates must happen within a few seconds**;
   any TURN credentials issued in the gap will use the old secret and be rejected. The
   impact is brief: affected users will see a connection failure and need to refresh.
