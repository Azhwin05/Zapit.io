import { defineConfig, devices } from 'playwright/test';

// Real end-to-end coverage of the thing that actually matters for this app:
// two independent browsers doing a genuine WebRTC connection, ECDH key
// exchange, and encrypted transfer against a real (locally-started)
// signaling server. This directly automates the same manual two-tab
// verification used throughout development — the goal is to catch a
// regression here automatically instead of relying on someone noticing.
export default defineConfig({
  testDir: './e2e',
  // Generous: a full test involves real ECDH key generation, real WebRTC
  // negotiation, and (in the file-transfer test) waiting on a real download
  // event — the individual step budgets inside the test already add up to
  // more than 30s, so the previous 30s global timeout was mathematically
  // too tight regardless of app performance.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // WebRTC/room state lives in the signaling server's process memory —
  // running specs in parallel would mean tests racing over shared room
  // codes and connection counts. Keep it serial and simple.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../signaling-server',
      port: 8787,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
    },
    {
      // Deliberately a production build, not `next dev`: React Strict Mode
      // double-invokes effects in dev only, which double-fires this app's
      // connect-and-join-room logic on every page load — that's a dev-mode
      // testing artifact (found by hitting the signaling server's 5/min
      // join rate limit in a multi-page test), not something real users
      // hit, so it shouldn't be something this suite has to work around.
      // A prod build is also more representative of what's actually shipped.
      command: 'npm run build && npm run start -- -p 3100',
      cwd: '.',
      port: 3100,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000, // a full `next build` is the dominant cost here, not the server actually starting
      stdout: 'pipe',
      env: { NEXT_PUBLIC_SIGNALING_URL: 'ws://localhost:8787' },
    },
  ],
});
