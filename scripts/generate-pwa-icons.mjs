import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const source = join(publicDir, 'soulforms-logo-dark.png');

const targets = [
  { out: 'pwa-icon-192.png', size: 192, background: '#ffffff', padding: 0.10 },
  { out: 'pwa-icon-512.png', size: 512, background: '#ffffff', padding: 0.10 },
  // Maskable: safe-zone del 15% para que el crop circular/redondeado de
  // Android no corte el logo.
  { out: 'pwa-icon-512-maskable.png', size: 512, background: '#00c2a8', padding: 0.20 },
  { out: 'apple-touch-icon.png', size: 180, background: '#ffffff', padding: 0.10 },
];

for (const t of targets) {
  const inner = Math.round(t.size * (1 - 2 * t.padding));
  const pad = Math.round((t.size - inner) / 2);
  await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: t.background })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: t.background })
    .png()
    .toFile(join(publicDir, t.out));
  console.log(`generated ${t.out} (${t.size}x${t.size}, padding=${(t.padding * 100).toFixed(0)}%)`);
}
