# Security Policy

## Supported Versions

| Component | Supported |
|---|---|
| Frontend (Next.js) | Latest deployed version |
| Signaling server | Latest deployed version |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately by emailing **ashwinarun05@gmail.com** with:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce it (proof-of-concept code or a minimal repro is appreciated but not required)
- Which component is affected (frontend, signaling server, TURN config, or the transfer protocol)

You can expect an acknowledgement within 72 hours and a status update within 7 days. If the issue is confirmed, we will coordinate disclosure and credit you in the release notes unless you prefer to remain anonymous.

## Threat Model and Known Limitations

Zapit's encryption model is documented in the Privacy Policy. Key properties:

- **ECDH P-256** key agreement: each side generates an ephemeral key pair per connection. Only public keys transit the signaling server; the AES session key is derived locally by both peers. The signaling server never sees the session key.
- **AES-GCM-256** encryption: every chunk is encrypted with a fresh random IV. The TURN relay (if used) sees only ciphertext.
- **Acknowledged limitation**: the design defeats passive interception but does not provide cryptographic proof against an active attacker who controls the signaling server at the moment of connection (a classic MITM during key exchange). We do not currently implement a manual safety-number verification step. This is a known and intentional trade-off for ease of use; we describe it honestly in the Privacy Policy.

## Scope

In-scope for reports:
- Authentication bypass or session hijacking (guessing/brute-forcing room codes beyond the rate-limit)
- CSP bypass or XSS that could exfiltrate in-session data
- Signaling server DoS vectors not covered by existing rate limits
- TURN credential forgery or abuse
- Protocol-level attacks on the WebRTC connection or encrypted transfer

Out-of-scope (but feel free to mention):
- Theoretical attacks requiring physical device access
- Social engineering of users
- Issues in third-party infrastructure (Fly.io, Vercel, coturn) that are not specific to Zapit's configuration
- Missing security headers on pages where they have no practical effect

## CVE Disclosure Notes

For the record: all Next.js CVEs present in `npm audit` as of June 2026 were triaged and found not applicable to this application (no React Server Components, no `next/image` with `remotePatterns`, no route rewrites, no `next/script` with `beforeInteractive`, no i18n config). No upgrade is required for security; the triage reasoning is recorded in `audit.md` at the root of this repository.
