# PRIVACY POLICY

**Last updated: \[DATE\]**

## 1. Overview

\[App Name\] is a peer-to-peer file and text sharing tool. It is built around a simple principle: **we should know as little about you and your data as possible.** There is no account system, no sign-up, and no email collection. This policy explains exactly what limited data is processed to make the service work, and what we deliberately do not collect.

## 2. What We Do NOT Collect

- No account registration, no email address, no password
- No name, phone number, or other personal identifiers
- No persistent cookies or tracking identifiers used to follow you across visits
- No advertising trackers or third-party ad networks
- **No file contents.** Files and text you share are transferred directly between your device and the recipient's device, or relayed (still encrypted) only when a direct connection isn't possible. We do not read, scan, store, or have the ability to access the contents of what you transfer in the normal operation of the service.

## 3. What Is Processed, and Why

To make a peer-to-peer connection work at all, a small amount of technical data passes through our signaling server:

- **Room codes**: short-lived, randomly generated codes used to connect two devices. These are not linked to any personal identity.
- **Connection metadata (SDP/ICE data)**: technical networking information (such as your device's network-facing address) required to negotiate a direct connection between two browsers. This is standard for any WebRTC-based service and is necessary for the core function of the app.
- **Public encryption keys**: your browser generates a temporary public/private key pair for each session. Only the _public_ key is ever transmitted (via the signaling server) to negotiate an encryption key directly with your peer's device — your private key never leaves your device, and the resulting shared encryption key is never transmitted in any form.
- **IP address (hashed/temporary use)**: used briefly to (a) automatically detect when two devices are on the same local network, so you don't have to manually enter a code, and (b) apply rate-limiting to prevent abuse. IP addresses are not retained beyond the active session and associated short-term diagnostic logs (see Section 5).

## 4. How Encryption Works (and Its Real Limits)

Files and text are encrypted on your device before being sent, using a key that is derived independently on each device through a key-agreement process (ECDH) — the encryption key itself is never transmitted over our servers in any form, including in encrypted form.

**Honest limitation:** this design defeats passive interception — meaning that even if someone captured all traffic passing through our signaling server, they could not recover your encryption key or read your data. It does not, by itself, provide cryptographic proof against a theoretical active attacker who fully controls our signaling infrastructure at the moment of connection. We do not currently offer a manual key-verification step (a "safety number" you could compare on both devices), which is the strongest available defense against that specific scenario; we may add this in the future. We believe this provides strong, real-world privacy protection appropriate to the service's purpose, and we describe it accurately rather than overstating it as an absolute guarantee.

## 5. Logs and Diagnostics

We keep limited technical logs (connection events, errors, rate-limit triggers) to operate and secure the service and to diagnose problems. These logs may include IP addresses and timestamps but do not include file contents, file names, or message text. Logs are retained for \[X days — recommend 30\] and then automatically deleted, except where retention is necessary to investigate active abuse or a security incident.

## 6. Relay/TURN Servers

When a direct connection between two devices isn't possible (due to certain network/firewall configurations), encrypted data may be relayed through a TURN server we operate. This server only ever sees encrypted bytes — it cannot decrypt or read the content being relayed.

## 7. Data Retention

- Room codes and associated session data are automatically deleted after \[10 minutes of inactivity / when both peers disconnect\].
- We do not store transferred files or messages on any server under normal operation.
- Diagnostic logs are retained for a limited period as described in Section 5.

## 8. Children's Privacy

This service is not directed at children, and we do not knowingly collect personal information from children under 13 (or the relevant age threshold in your jurisdiction). Since the service requires no account or personal information to use, age-specific data collection does not occur.

## 9. International Users

Our servers are located in \[jurisdiction(s)\]. By using the service, you understand that technical connection data described above may be processed in that location. Because the service does not collect personal data tied to your identity, the practical privacy impact of this is limited — but we note it for transparency.

## 10. Your Rights

Because we do not maintain accounts or persistent personal data, there is generally nothing tied to you individually to access, correct, or delete beyond the short-lived logs described above. If you believe data about you has been processed inappropriately, contact us at \[support email\] and we will investigate.

## 11. Changes to This Policy

We may update this policy as the service evolves. Material changes will be noted with an updated "Last updated" date at the top of this page.

## 12. Contact

Questions about this policy: \[support email\]

---

# TERMS OF SERVICE

**Last updated: \[DATE\]**

## 1. Acceptance of Terms

By using \[App Name\] ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.

## 2. Description of the Service

\[App Name\] is a free, browser-based tool for transferring files and text directly between devices, primarily using peer-to-peer connections, with an encrypted relay fallback used only when a direct connection is not possible. The Service does not require an account.

## 3. No Warranty — Use At Your Own Risk

The Service is provided **"as is" and "as available," without warranties of any kind**, express or implied. Specifically, and without limitation:

- We do not guarantee that every transfer will complete successfully. Peer-to-peer connections depend on network conditions outside our control (NAT/firewall configuration, network stability, device performance).
- **Large file transfers may fail or cause your browser to become unresponsive** due to current memory-handling limitations on the receiving device. We recommend keeping individual file transfers under \[500MB\] until streaming-to-disk support is available, and the app will display a warning above this threshold.
- If a connection drops mid-transfer, the transfer cannot currently be resumed and must be restarted from the beginning.
- We do not guarantee compatibility with every browser or device; some features may not work correctly on all platforms (in particular, certain older or non-standard browser configurations).
- We are not liable for any data loss, corruption, or failed transfer, to the maximum extent permitted by law.

## 4. Acceptable Use

You agree not to use the Service to:

- Transmit any content that is illegal in your jurisdiction or the recipient's, including but not limited to child sexual abuse material, content that infringes the intellectual property rights of others, malware, or content intended to harass, threaten, or harm others.
- Attempt to gain unauthorized access to other users' active sessions, including by guessing or brute-forcing room codes.
- Attempt to disrupt, overload, or abuse the Service's infrastructure (including denial-of-service attempts, excessive automated requests, or circumventing rate limits).
- Use the Service for any purpose that violates applicable law.

We reserve the right to block or rate-limit access (by IP address or other technical means) for any activity we reasonably believe violates these Terms, without prior notice.

## 5. Your Content

You retain all rights to any files or text you transfer using the Service. We do not claim ownership of your content, and — by design — we do not have access to its contents during normal operation (see Privacy Policy, Section 4). You are solely responsible for ensuring you have the right to share any content you transmit, and for complying with applicable law regarding that content.

## 6. Intellectual Property — Service Software

\[If open source:\] The software powering this Service is open source, released under the \[MIT License\], available at \[repository URL\]. You may self-host, fork, or modify it under the terms of that license. This Terms of Service applies specifically to use of the hosted public instance at \[domain\], not to your own self-hosted deployments, which are governed by the open source license alone.

## 7. Copyright Complaints

If you believe content transferred through the Service infringes your copyright, note that we generally have no visibility into transferred content and no ability to remove content already delivered peer-to-peer, since it is not stored on our servers. If you have a complaint regarding misuse of the Service itself, contact \[support email\] and we will review and respond appropriately, including blocking abusive accounts/sessions where applicable.

## 8. Service Availability and Changes

The Service is provided free of charge and may be modified, suspended, or discontinued at any time without notice or liability. We do not guarantee uptime or availability.

## 9. Limitation of Liability

To the maximum extent permitted by applicable law, \[App Name/Company\] shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, arising from your use of or inability to use the Service, even if advised of the possibility of such damages.

## 10. Indemnification

You agree to indemnify and hold harmless \[App Name/Company\] from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.

## 11. Termination

We may suspend or terminate your access to the Service at any time, for any reason, including violation of these Terms, without prior notice.

## 12. Governing Law

These Terms are governed by the laws of \[jurisdiction\], without regard to conflict-of-law principles. \[Have a lawyer confirm the right jurisdiction given where you're incorporated/operating and your target user base.\]

## 13. Changes to These Terms

We may revise these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.

## 14. Severability

If any provision of these Terms is found unenforceable, the remaining provisions will remain in full effect.

## 15. Contact

Questions about these Terms: \[support email\]

---

## Notes for you before publishing

1. **Fill in the bracketed placeholders** — jurisdiction, support email, retention periods, file size thresholds — with your actual decisions.
2. **The "no warranty" and large-file sections in the Terms directly mirror the real, audited limitations** (memory ceiling, no resume) — don't soften this language even though it feels like admitting weakness; it's the language that actually protects you if something goes wrong, and it matches what users will genuinely experience.
3. **The encryption section in the Privacy Policy deliberately includes the honest MITM caveat** we discussed in the audit — resist the temptation to market it as unconditionally "unbreakable" anywhere on the site, since that specific word could become a legal liability if a sophisticated attack scenario were ever demonstrated.
4. If you later add the optional async/offline-relay storage mode (Cloudflare R2 with auto-expiry) discussed earlier, **both documents need a new section** describing that files in that mode are briefly stored, for how long, and that this is the one mode where the "we cannot access your data" claim doesn't fully apply (it should be encrypted in that mode too, but storage itself is a different risk profile worth disclosing separately).
5. Consider a lightweight **cookie/consent banner only if you ever add analytics** — currently, since there's no tracking, you likely don't need one, which is itself a nice selling point worth highlighting in your marketing.
