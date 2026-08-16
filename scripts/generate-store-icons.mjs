/**
 * Rasterize Movr Play Store / Expo icons from the brand mark (same path as MovrLogoMark).
 * Run: node scripts/generate-store-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(path.join(process.cwd(), 'backend/node_modules/sharp'));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MARK = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3F7048"/>
      <stop offset="50%" stop-color="#6A00FF"/>
      <stop offset="100%" stop-color="#0055FF"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path fill="#FFFFFF" d="M14 44V20h7.2l6.4 14.8L34 20H41v24h-6.2V29.2L28.6 44h-5.2L17.2 29.2V44H14zm30.5 0V20h6.2v24h-6.2z"/>
</svg>`;

const MONO = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 64 64">
  <path fill="#FFFFFF" d="M14 44V20h7.2l6.4 14.8L34 20H41v24h-6.2V29.2L28.6 44h-5.2L17.2 29.2V44H14zm30.5 0V20h6.2v24h-6.2z"/>
</svg>`;

async function markPng(size) {
  return sharp(Buffer.from(MARK)).resize(size, size).png().toBuffer();
}

async function write(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log('wrote', path.relative(root, file), buf.length);
}

async function squareIcon({ dest, background, pad = 0 }) {
  const inner = Math.round(1024 * (1 - pad * 2));
  const mark = await markPng(inner);
  return sharp({
    create: { width: 1024, height: 1024, channels: 4, background },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(dest);
}

async function splash({ dest, background }) {
  const w = 1284;
  const h = 2778;
  const mark = await markPng(420);
  const word = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="140">
  <text x="320" y="100" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
    font-size="92" font-weight="700" fill="#FFFFFF">Movr</text>
</svg>`);
  const wordPng = await sharp(word).png().toBuffer();
  return sharp({
    create: { width: w, height: h, channels: 4, background },
  })
    .composite([
      { input: mark, top: Math.round(h / 2 - 280), left: Math.round((w - 420) / 2) },
      { input: wordPng, top: Math.round(h / 2 + 170), left: Math.round((w - 640) / 2) },
    ])
    .png()
    .toFile(dest);
}

async function featureGraphic(dest, { subtitle }) {
  const w = 1024;
  const h = 500;
  const mark = await markPng(280);
  const title = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="220">
  <text x="0" y="88" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#FFFFFF">Movr</text>
  <text x="0" y="150" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#C4B5FD">${subtitle}</text>
</svg>`);
  const titlePng = await sharp(title).png().toBuffer();
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 10, g: 10, b: 12, alpha: 1 },
    },
  })
    .composite([
      { input: mark, left: 64, top: 110 },
      { input: titlePng, left: 380, top: 150 },
    ])
    .png()
    .toFile(dest);
}

const dark = { r: 10, g: 10, b: 10, alpha: 1 };
const driverDark = { r: 4, g: 47, b: 46, alpha: 1 };

async function main() {
  const customer = path.join(root, 'mobile/customer-app');
  const driver = path.join(root, 'mobile/driver-app');

  await squareIcon({ dest: path.join(customer, 'assets/icon.png'), background: dark, pad: 0 });
  // Adaptive safe zone ≈ 66% — pad so the mark is not cropped on launchers.
  await squareIcon({
    dest: path.join(customer, 'assets/adaptive-icon.png'),
    background: dark,
    pad: 0.18,
  });
  await splash({ dest: path.join(customer, 'assets/splash.png'), background: dark });
  await write(
    path.join(customer, 'assets/notification-icon.png'),
    await sharp(Buffer.from(MONO)).resize(96, 96).png().toBuffer()
  );
  await featureGraphic(path.join(customer, 'store/feature-graphic.png'), {
    subtitle: 'Rides · Shop · Deliver',
  });

  await squareIcon({ dest: path.join(driver, 'assets/icon.png'), background: driverDark, pad: 0 });
  await squareIcon({
    dest: path.join(driver, 'assets/adaptive-icon.png'),
    background: driverDark,
    pad: 0.18,
  });
  await splash({ dest: path.join(driver, 'assets/splash.png'), background: driverDark });
  await write(
    path.join(driver, 'assets/notification-icon.png'),
    await sharp(Buffer.from(MONO)).resize(96, 96).png().toBuffer()
  );
  await featureGraphic(path.join(driver, 'store/feature-graphic.png'), {
    subtitle: 'Drive · Keep 100% of fares',
  });

  const play512 = await sharp(path.join(customer, 'assets/icon.png')).resize(512, 512).png().toBuffer();
  await write(path.join(customer, 'store/icon-512.png'), play512);
  const play512d = await sharp(path.join(driver, 'assets/icon.png')).resize(512, 512).png().toBuffer();
  await write(path.join(driver, 'store/icon-512.png'), play512d);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
