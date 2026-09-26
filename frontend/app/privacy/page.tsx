import Link from 'next/link';
import { ZapitMark } from '@/components/ZapitMark';

export const metadata = {
  title: 'Privacy Policy — Zapit',
  description: 'How Zapit handles (and deliberately avoids handling) your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal nav */}
      <header className="w-full px-6 py-4 flex items-center max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <ZapitMark className="text-primary w-6 h-6" />
          <span className="font-display font-bold text-xl text-primary tracking-tight">Zapit</span>
        </Link>
      </header>

      <main className="flex-grow max-w-3xl mx-auto w-full px-6 py-12">
        <article className="prose prose-sm max-w-none text-on-surface">

          <h1 className="font-display font-bold text-3xl text-on-surface mb-2">Privacy Policy</h1>
          <p className="text-sm text-on-surface-variant mb-10">Last updated: June 21, 2026</p>

          <Section title="1. Overview">
            <p>
              Zapit is a peer-to-peer file and text sharing tool. It is built around a simple
              principle: <strong>we should know as little about you and your data as possible.</strong>{' '}
              There is no account system, no sign-up, and no email collection. This policy explains
              exactly what limited data is processed to make the service work, and what we
              deliberately do not collect.
            </p>
          </Section>

          <Section title="2. What We Do NOT Collect">
            <ul>
              <li>No account registration, no email address, no password</li>
              <li>No name, phone number, or other personal identifiers</li>
              <li>No persistent cookies or tracking identifiers used to follow you across visits</li>
              <li>No advertising trackers or third-party ad networks</li>
              <li>
                <strong>No file contents.</strong> Files and text you share are transferred directly
                between your device and the recipient&#39;s device, or relayed (still encrypted) only
                when a direct connection isn&#39;t possible. We do not read, scan, store, or have the
                ability to access the contents of what you transfer in the normal operation of the
                service.
              </li>
            </ul>
          </Section>

          <Section title="3. What Is Processed, and Why">
            <p>
              To make a peer-to-peer connection work at all, a small amount of technical data passes
              through our signaling server:
            </p>
            <ul>
              <li>
                <strong>Room codes:</strong> short-lived, randomly generated codes used to connect
                two devices. These are not linked to any personal identity.
              </li>
              <li>
                <strong>Connection metadata (SDP/ICE data):</strong> technical networking information
                (such as your device&#39;s network-facing address) required to negotiate a direct
                connection between two browsers. This is standard for any WebRTC-based service and is
                necessary for the core function of the app.
              </li>
              <li>
                <strong>Public encryption keys:</strong> your browser generates a temporary
                public/private key pair for each session. Only the <em>public</em> key is ever
                transmitted (via the signaling server) to negotiate an encryption key directly with
                your peer&#39;s device — your private key never leaves your device, and the resulting
                shared encryption key is never transmitted in any form.
              </li>
              <li>
                <strong>IP address (temporary use):</strong> used briefly to apply rate-limiting to
                prevent abuse. IP addresses are not retained beyond the active session and associated
                short-term diagnostic logs (see Section 5).
              </li>
            </ul>
          </Section>

          <Section title="4. How Encryption Works (and Its Real Limits)">
            <p>
              Files and text are encrypted on your device before being sent, using a key that is
              derived independently on each device through a key-agreement process (ECDH) — the
              encryption key itself is never transmitted over our servers in any form, including in
              encrypted form.
            </p>
            <p>
              <strong>Honest limitation:</strong> this design defeats passive interception — meaning
              that even if someone captured all traffic passing through our signaling server, they
              could not recover your encryption key or read your data. It does not, by itself, provide
              cryptographic proof against a theoretical active attacker who fully controls our
              signaling infrastructure at the moment of connection. We do not currently offer a manual
              key-verification step (a "safety number" you could compare on both devices), which is
              the strongest available defense against that specific scenario; we may add this in the
              future. We believe this provides strong, real-world privacy protection appropriate to
              the service&#39;s purpose, and we describe it accurately rather than overstating it as an
              absolute guarantee.
            </p>
          </Section>

          <Section title="5. Logs and Diagnostics">
            <p>
              We keep limited technical logs (connection events, errors, rate-limit triggers) to
              operate and secure the service and to diagnose problems. These logs may include IP
              addresses and timestamps but do not include file contents, file names, or message text.
              Logs are retained for 30 days and then automatically deleted, except where retention is
              necessary to investigate active abuse or a security incident.
            </p>
          </Section>

          <Section title="6. Relay / TURN Servers">
            <p>
              When a direct connection between two devices isn&#39;t possible (due to certain
              network/firewall configurations), encrypted data may be relayed through a TURN server
              we operate. This server only ever sees encrypted bytes — it cannot decrypt or read the
              content being relayed.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <ul>
              <li>
                Room codes and associated session data are automatically deleted after 10 minutes of
                inactivity or when both peers disconnect.
              </li>
              <li>
                We do not store transferred files or messages on any server under normal operation.
              </li>
              <li>Diagnostic logs are retained for a limited period as described in Section 5.</li>
            </ul>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              This service is not directed at children, and we do not knowingly collect personal
              information from children under 13 (or the relevant age threshold in your
              jurisdiction). Since the service requires no account or personal information to use,
              age-specific data collection does not occur.
            </p>
          </Section>

          <Section title="9. International Users">
            <p>
              Because the service does not collect personal data tied to your identity, the practical
              privacy impact of cross-border data processing is limited — but we note it for
              transparency.
            </p>
          </Section>

          <Section title="10. Your Rights">
            <p>
              Because we do not maintain accounts or persistent personal data, there is generally
              nothing tied to you individually to access, correct, or delete beyond the short-lived
              logs described above. If you believe data about you has been processed inappropriately,
              contact us at{' '}
              <a href="mailto:ashwinarun05@gmail.com" className="text-primary hover:underline">
                ashwinarun05@gmail.com
              </a>{' '}
              and we will investigate.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this policy as the service evolves. Material changes will be noted with
              an updated &#34;Last updated&#34; date at the top of this page.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Questions about this policy:{' '}
              <a href="mailto:ashwinarun05@gmail.com" className="text-primary hover:underline">
                ashwinarun05@gmail.com
              </a>
            </p>
          </Section>

        </article>
      </main>

      <footer className="w-full py-6 text-center text-xs text-on-surface-variant/50 border-t border-surface-mid">
        <div className="flex items-center justify-center gap-5">
          <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <a
            href="https://www.linkedin.com/in/ashwinkumararun/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Made by Ashwin
          </a>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-semibold text-lg text-on-surface mb-3">{title}</h2>
      <div className="text-sm text-on-surface/80 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
