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
// Brand mark matches NavBar.tsx: Lucide's "Infinity" glyph (stroke-based,
// simplified to a filled path here since PNG rasterization doesn't need
// the live icon component) in primary green (#286749) on the app's cream
// background (#faf8f4) — see tailwind.config.ts for both values.

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

const PRIMARY = '#286749';
const BACKGROUND = '#faf8f4';

// Lucide's actual "Infinity" icon path (MIT licensed, lucide.dev) — the
// exact glyph NavBar.tsx already renders via <Infinity /> from lucide-react.
// Native viewBox is 24x24, stroke-based (open path, round caps/joins).
const LUCIDE_INFINITY_PATH =
  'M18.178 8c5.096 0 5.096 8 0 8-5.095 0-6.687-8-12.535-8-4.984 0-4.984 8 0 8 5.848 0 7.44-8 12.535-8z';

function svgIcon({ size, glyphScale, background }) {
  // Lucide icons are drawn at strokeWidth 2 in a 24-unit box by default;
  // keep that same visual proportion when scaled up to the icon canvas.
  const scale = (size / 24) * glyphScale;
  const strokeWidth = 3.4 / scale; // constant on-canvas stroke thickness after the group's scale() is applied — bolder than the 24px navbar mark, which reads better at app-icon sizes
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${background}"/>
  <g transform="translate(${size / 2}, ${size / 2}) scale(${scale}) translate(-12, -12)">
    <path d="${LUCIDE_INFINITY_PATH}" fill="none" stroke="${PRIMARY}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function render(name, size, glyphScale) {
  const svg = svgIcon({ size, glyphScale, background: BACKGROUND });
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, name));
  console.log(`wrote ${name}`);
}

// purpose:any — glyph can use full canvas
await render('icon-192.png', 192, 1.15);
await render('icon-512.png', 512, 1.15);

// purpose:maskable — OS may clip to a circle/squircle; keep glyph within the
// ~80% safe-zone by scaling it down within the same full-bleed background.
await render('icon-192-maskable.png', 192, 0.72);
await render('icon-512-maskable.png', 512, 0.72);

console.log('done');
