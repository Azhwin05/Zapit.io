import Link from 'next/link';
import { Infinity } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service — Zapit',
  description: 'Terms governing your use of the Zapit file-transfer service.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full px-6 py-4 flex items-center max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <Infinity className="text-primary w-6 h-6" strokeWidth={2.5} />
          <span className="font-display font-bold text-xl text-primary tracking-tight">Zapit</span>
        </Link>
      </header>

      <main className="flex-grow max-w-3xl mx-auto w-full px-6 py-12">
        <article className="prose prose-sm max-w-none text-on-surface">

          <h1 className="font-display font-bold text-3xl text-on-surface mb-2">Terms of Service</h1>
          <p className="text-sm text-on-surface-variant mb-10">Last updated: June 21, 2026</p>

          <Section title="1. Acceptance of Terms">
            <p>
              By using Zapit (&#34;the Service&#34;), you agree to these Terms. If you do not agree,
              do not use the Service.
            </p>
          </Section>

          <Section title="2. Description of the Service">
            <p>
              Zapit is a free, browser-based tool for transferring files and text directly between
              devices, primarily using peer-to-peer connections, with an encrypted relay fallback used
              only when a direct connection is not possible. The Service does not require an account.
            </p>
          </Section>

          <Section title="3. No Warranty — Use At Your Own Risk">
            <p>
              The Service is provided <strong>&#34;as is&#34; and &#34;as available,&#34; without
              warranties of any kind</strong>, express or implied. Specifically, and without
              limitation:
            </p>
            <ul>
              <li>
                We do not guarantee that every transfer will complete successfully. Peer-to-peer
                connections depend on network conditions outside our control (NAT/firewall
                configuration, network stability, device performance).
              </li>
              <li>
                <strong>
                  Large file transfers may fail or cause your browser to become unresponsive
                </strong>{' '}
                due to current memory-handling limitations on the receiving device. We recommend
                keeping individual file transfers under 500 MB until streaming-to-disk support is
                available, and the app will display a warning above this threshold.
              </li>
              <li>
                If a connection drops mid-transfer, the transfer cannot currently be resumed and must
                be restarted from the beginning.
              </li>
              <li>
                We do not guarantee compatibility with every browser or device; some features may not
                work correctly on all platforms (in particular, certain older or non-standard browser
                configurations).
              </li>
              <li>
                We are not liable for any data loss, corruption, or failed transfer, to the maximum
                extent permitted by law.
              </li>
            </ul>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>
                Transmit any content that is illegal in your jurisdiction or the recipient&#39;s,
                including but not limited to child sexual abuse material, content that infringes the
                intellectual property rights of others, malware, or content intended to harass,
                threaten, or harm others.
              </li>
              <li>
                Attempt to gain unauthorized access to other users&#39; active sessions, including by
                guessing or brute-forcing room codes.
              </li>
              <li>
                Attempt to disrupt, overload, or abuse the Service&#39;s infrastructure (including
                denial-of-service attempts, excessive automated requests, or circumventing rate
                limits).
              </li>
              <li>Use the Service for any purpose that violates applicable law.</li>
            </ul>
            <p>
              We reserve the right to block or rate-limit access (by IP address or other technical
              means) for any activity we reasonably believe violates these Terms, without prior
              notice.
            </p>
          </Section>

          <Section title="5. Your Content">
            <p>
              You retain all rights to any files or text you transfer using the Service. We do not
              claim ownership of your content, and — by design — we do not have access to its
              contents during normal operation (see{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy, Section 4
              </Link>
              ). You are solely responsible for ensuring you have the right to share any content you
              transmit, and for complying with applicable law regarding that content.
            </p>
          </Section>

          <Section title="6. Intellectual Property — Service Software">
            <p>
              The software powering this Service is open source. You may self-host, fork, or modify
              it under the terms of the applicable open source license. These Terms of Service apply
              specifically to use of the hosted public instance at zapit.io, not to your own
              self-hosted deployments.
            </p>
          </Section>

          <Section title="7. Copyright Complaints">
            <p>
              If you believe content transferred through the Service infringes your copyright, note
              that we generally have no visibility into transferred content and no ability to remove
              content already delivered peer-to-peer, since it is not stored on our servers. If you
              have a complaint regarding misuse of the Service itself, contact{' '}
              <a href="mailto:ashwinarun05@gmail.com" className="text-primary hover:underline">
                ashwinarun05@gmail.com
              </a>{' '}
              and we will review and respond appropriately.
            </p>
          </Section>

          <Section title="8. Service Availability and Changes">
            <p>
              The Service is provided free of charge and may be modified, suspended, or discontinued
              at any time without notice or liability. We do not guarantee uptime or availability.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, Zapit shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of data,
              arising from your use of or inability to use the Service, even if advised of the
              possibility of such damages.
            </p>
          </Section>

          <Section title="10. Indemnification">
            <p>
              You agree to indemnify and hold harmless Zapit from any claims, damages, or expenses
              arising from your use of the Service or violation of these Terms.
            </p>
          </Section>

          <Section title="11. Termination">
            <p>
              We may suspend or terminate your access to the Service at any time, for any reason,
              including violation of these Terms, without prior notice.
            </p>
          </Section>

          <Section title="12. Changes to These Terms">
            <p>
              We may revise these Terms at any time. Continued use of the Service after changes
              constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="13. Severability">
            <p>
              If any provision of these Terms is found unenforceable, the remaining provisions will
              remain in full effect.
            </p>
          </Section>

          <Section title="14. Contact">
            <p>
              Questions about these Terms:{' '}
              <a href="mailto:ashwinarun05@gmail.com" className="text-primary hover:underline">
                ashwinarun05@gmail.com
              </a>
            </p>
          </Section>

        </article>
      </main>

      <footer className="w-full py-6 text-center text-xs text-on-surface-variant/50 border-t border-surface-mid">
        <div className="flex items-center justify-center gap-5">
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
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
