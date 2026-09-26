// One-off generator for the PWA/desktop app icons. `sharp` is deliberately
// NOT a project dependency (native binary, ~40MB, only needed to regenerate
// these assets) — install it ad hoc, run, then let it drop out of
// node_modules on the next clean `npm install`:
//   npm install --no-save sharp
//   node scripts/generate-icons.mjs
// Produces icon-192.png, icon-512.png (purpose: any) and
// icon-192-maskable.png, icon-512-maskable.png (purpose: maskable, with
// safe-zone padding per https://web.dev/articles/maskable-icon).
//
// Brand mark: the "Zapit ring" — a bold ring with a pinched inner waist,
// same path as components/ZapitMark.tsx (keep the two in sync if this ever
// changes). Primary green (#286749) on the app's cream background
// (#faf8f4) — see tailwind.config.ts for both values.

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

const PRIMARY = '#286749';
const BACKGROUND = '#faf8f4';

// Same path as components/ZapitMark.tsx, native viewBox 0 0 100 100.
const ZAPIT_RING_PATH = `M 32 50
  C 32 39, 41 30, 52 30
  C 63 30, 72 39, 72 50
  C 72 61, 63 70, 52 70
  C 44 70, 37 65, 34 58
  M 68 50
  C 68 39, 59 30, 48 30
  C 37 30, 28 39, 28 50
  C 28 61, 37 70, 48 70
  C 56 70, 63 65, 66 58`;

function svgIcon({ size, glyphScale, background }) {
  const scale = (size / 100) * glyphScale;
  const strokeWidth = 9; // in the path's own 100-unit space — constant regardless of canvas size
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${background}"/>
  <g transform="translate(${size / 2}, ${size / 2}) scale(${scale}) translate(-50, -50)">
    <path d="${ZAPIT_RING_PATH}" fill="none" stroke="${PRIMARY}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function render(name, size, glyphScale) {
  const svg = svgIcon({ size, glyphScale, background: BACKGROUND });
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, name));
  console.log(`wrote ${name}`);
}

// purpose:any — glyph can use full canvas (scale 1.0 = the path's natural size)
await render('icon-192.png', 192, 1.0);
await render('icon-512.png', 512, 1.0);

// purpose:maskable — OS may clip to a circle/squircle; keep glyph within the
// ~80% safe-zone by scaling it down within the same full-bleed background.
await render('icon-192-maskable.png', 192, 0.85);
await render('icon-512-maskable.png', 512, 0.85);

console.log('done');
