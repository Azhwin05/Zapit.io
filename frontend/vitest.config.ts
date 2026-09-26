import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' environment gives real WebCrypto (crypto.subtle) via Node's
    // global crypto — no jsdom/browser mocking needed for the pure-logic
    // modules under test (crypto.ts, room-code.ts, wire format, etc.).
    // Anything needing real DOM/RTCPeerConnection is covered by the
    // Playwright e2e test instead, not unit tests.
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e/**'],
  },
});
