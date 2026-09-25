import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
// bypassCSP lets React hydrate without nonce restrictions in headless mode
const ctx  = await browser.newContext({ bypassCSP: true });
const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

page.on('pageerror', err => console.error('[page error]', err.message.split('\n')[0]));

// ── 1. Landing screen ─────────────────────────────────────────────────────
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/01-landing.png', fullPage: true });
console.log('✓ 01-landing.png');

// ── 2. Discovery screen ───────────────────────────────────────────────────
// ?join= param sets hasStarted = true in useEffect → shows Discovery
await page.goto('http://localhost:3000?join=SAGE59A', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Debug: log what h1 text we see
const h1Text = await page.evaluate(() => document.querySelector('h1')?.textContent ?? 'no h1');
console.log('  h1 text:', h1Text);

await page.screenshot({ path: 'screenshots/02-discovery.png', fullPage: true });
console.log('✓ 02-discovery.png');

// ── 3. QR Code expanded ───────────────────────────────────────────────────
try {
  const qrBtn = page.locator('button', { hasText: /QR/i }).first();
  await qrBtn.waitFor({ state: 'visible', timeout: 5000 });
  await qrBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/03-discovery-qr.png', fullPage: true });
  console.log('✓ 03-discovery-qr.png');
} catch (e) {
  console.log('  QR step skipped:', e.message.split('\n')[0]);
}

await browser.close();
console.log('Done.');
