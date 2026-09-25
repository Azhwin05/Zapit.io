'use client';

interface AppFooterProps {
  minimal?: boolean;
}

export function AppFooter({ minimal }: AppFooterProps) {
  if (minimal) {
    return (
      <footer className="w-full py-6 text-center text-xs text-on-surface-variant/50">
        © 2026 Zapit · End-to-end encrypted
      </footer>
    );
  }

  return (
    <footer className="w-full py-8 mt-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto px-6 gap-3">
        <span className="text-xs text-on-surface-variant/60">© 2026 Zapit. All rights reserved.</span>

        <div className="flex items-center gap-5">
          <a
            href="/privacy"
            className="text-xs text-on-surface-variant/60 hover:text-primary transition-colors"
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="text-xs text-on-surface-variant/60 hover:text-primary transition-colors"
          >
            Terms
          </a>
          <a
            href="https://www.linkedin.com/in/ashwinkumararun/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-on-surface-variant/60 hover:text-primary transition-colors"
          >
            Made by Ashwin
          </a>
        </div>
      </div>
    </footer>
  );
}
