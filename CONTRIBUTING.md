# Contributing to Zapit

Thank you for your interest. Zapit is intentionally simple — please read this before opening a PR.

## Philosophy

Zapit does one thing: transfer files directly between browsers (two, or a small mesh room), privately, without a server in the middle. Every change should make that one thing better. If a PR adds complexity without a clear user benefit, it will probably be declined.

**We will not merge:**
- Third-party analytics, tracking, or telemetry
- Features that require storing files or user data server-side
- Dependencies that increase the bundle size significantly without proportionate benefit
- Anything that weakens the encryption or key exchange

## Getting Started

```bash
# 1. Fork and clone
git clone https://github.com/Azhwin05/Zapit.io.git
cd Zapit.io

# 2. Start the signaling server
cd signaling-server
npm install
cp .env.example .env    # optional: add METERED_API_KEY / METERED_API_HOST for TURN
npm run dev

# 3. Start the frontend (separate terminal)
cd frontend
npm install
echo 'NEXT_PUBLIC_SIGNALING_URL=ws://localhost:8787' > .env.local
npm run dev

# 4. Open http://localhost:3000 in two tabs or two devices
```

## Before Opening a PR

1. **Run typechecks in both packages:**
   ```bash
   cd frontend && npm run typecheck
   cd signaling-server && npm run typecheck
   ```
2. **Test the actual transfer flow** — typecheck alone isn't enough. Open two browser tabs, transfer a file, verify it arrives intact.
3. **No new console.log in production paths** — the transfer engine runs in a hot loop. Log statements are fine during development but must be removed before merging.
4. **Keep PRs focused** — one fix or feature per PR. Mixed concerns take longer to review and are more likely to introduce regressions.

## Project Structure

```
zapit/
├── frontend/               # Next.js 14 app
│   ├── app/                # App Router pages
│   ├── components/         # UI components
│   └── lib/
│       ├── webrtc/         # Transfer engine, crypto, peer connection
│       └── signaling-client.ts
├── signaling-server/       # Node.js WebSocket server
│   └── src/
│       ├── index.ts        # Main server, HTTP health check
│       ├── room-manager.ts # Room/client state
│       ├── turn-credentials.ts  # Metered.ca TURN credential fetching
│       └── rate-limiter.ts
├── coturn/                 # coturn config (for self-hosters)
├── docker-compose.yml      # Self-hosting: signaling + coturn
├── SECURITY.md
└── OPERATIONS.md
```

## Areas That Need Help

Good first issues are labelled [`good first issue`](../../issues?q=label%3A%22good+first+issue%22).

Higher-impact but harder projects:
- **Streaming disk writes** — the receiver currently holds all chunks in RAM. Replacing this with the File System Access API (with a memory fallback) would remove the file-size limitation.
- **Transfer resume** — if a connection drops mid-transfer, the user must restart. Resumable transfers require tracking which chunks arrived and re-sending only the missing ones.
- **Text/clipboard transfer** — a simple text mode alongside files.
- **Mobile PWA improvements** — the share-sheet integration on iOS/Android could be tighter.

## Reporting Security Issues

See [SECURITY.md](SECURITY.md). Please do not open a public issue for security vulnerabilities.

## Code Style

- TypeScript strict mode — no `any` unless unavoidable (and comment why)
- No comments explaining *what* the code does — only *why* (a constraint, a workaround, a non-obvious invariant)
- Prefer explicit over clever

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
