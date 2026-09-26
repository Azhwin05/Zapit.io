import { test, expect } from 'playwright/test';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// End-to-end: two real browser contexts (simulating two separate devices),
// a real signaling server, a real WebRTC connection, real ECDH + AES-GCM
// encryption, and a real file on disk sent from one to the other. This is
// the automated version of the manual two-tab testing used throughout
// development — if this test passes, the actual product works, not just
// its unit-testable pieces.

test('two devices connect, exchange a message, and transfer a file intact', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    // ── A creates a room ────────────────────────────────────────────────
    await pageA.goto('/');
    await pageA.getByRole('button', { name: 'Create Room' }).click();

    // Room code is shown in the top-right pill as "ROOM • XXXXXX".
    const roomPill = pageA.getByText(/ROOM\s*•\s*[A-Z0-9]{6}/);
    await expect(roomPill).toBeVisible();
    const pillText = await roomPill.textContent();
    const roomCode = pillText?.match(/([A-Z0-9]{6})/)?.[1];
    expect(roomCode).toBeTruthy();

    // ── B joins via a shareable link (the same mechanism the app's own
    //    "Share Link" button produces — ?join=<code>) ─────────────────────
    await pageB.goto(`/?join=${roomCode!.toLowerCase()}`);

    // ── Both sides should reach the connected state ─────────────────────
    await expect(pageA.getByText('Connected and Ready')).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText('Connected and Ready')).toBeVisible({ timeout: 15_000 });

    // ── Real ECDH handshake happened — both sides show a safety number ──
    await pageA.getByText('Verify this connection is secure').click();
    await pageB.getByText('Verify this connection is secure').click();
    const safetyNumberA = await pageA.locator('p.font-mono.select-all').textContent();
    const safetyNumberB = await pageB.locator('p.font-mono.select-all').textContent();
    expect(safetyNumberA?.trim()).toBe(safetyNumberB?.trim());
    expect(safetyNumberA?.trim()).toMatch(/^\d{4}( \d{4}){5}$/);

    // ── Text message: A -> B ─────────────────────────────────────────────
    const messageText = `e2e test message ${Date.now()}`;
    const textInput = pageA.getByPlaceholder('Send a quick text message instead…');
    await textInput.fill(messageText);
    await textInput.press('Enter');
    await expect(pageB.getByText(messageText)).toBeVisible({ timeout: 10_000 });

    // ── File transfer: A -> B, byte-for-byte integrity check ────────────
    const dir = mkdtempSync(join(tmpdir(), 'zapit-e2e-'));
    const filePath = join(dir, 'e2e-test-file.bin');
    const fileBytes = Buffer.from(Array.from({ length: 250_000 }, (_, i) => (i * 7) & 0xff));
    writeFileSync(filePath, fileBytes);

    await pageA.locator('input[type="file"]').setInputFiles(filePath);
    await pageA.getByRole('button', { name: /Send File/ }).click();

    const downloadPromise = pageB.waitForEvent('download', { timeout: 20_000 });
    await pageB.getByText('Download').click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    const downloadedBytes = readFileSync(downloadedPath!);

    expect(downloadedBytes.length).toBe(fileBytes.length);
    expect(downloadedBytes.equals(fileBytes)).toBe(true);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('multi-peer mesh: a third device joins and receives a broadcast message', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [pageA, pageB, pageC] = await Promise.all(contexts.map((c) => c.newPage()));

  try {
    await pageA.goto('/');
    await pageA.getByRole('button', { name: 'Create Room' }).click();
    const pillText = await pageA.getByText(/ROOM\s*•\s*[A-Z0-9]{6}/).textContent();
    const roomCode = pillText?.match(/([A-Z0-9]{6})/)?.[1]!.toLowerCase();

    await pageB.goto(`/?join=${roomCode}`);
    await pageC.goto(`/?join=${roomCode}`);

    await expect(pageA.getByText('Connected and Ready')).toBeVisible({ timeout: 15_000 });
    await expect(pageA.getByText('Connected to 2 devices')).toBeVisible({ timeout: 15_000 });

    const messageText = `broadcast ${Date.now()}`;
    const textInput = pageA.getByPlaceholder('Send a quick text message instead…');
    await textInput.fill(messageText);
    await textInput.press('Enter');

    await expect(pageB.getByText(messageText)).toBeVisible({ timeout: 10_000 });
    await expect(pageC.getByText(messageText)).toBeVisible({ timeout: 10_000 });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
