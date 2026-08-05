/**
 * Grep for raw hex colors outside design-system.
 * Default: report violations (exit 0) so gradual migration stays unblocked.
 * Strict CI: STRICT_HEX=1 node scripts/check-raw-hex.js  → exit 1 if any found.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['frontend/web/src', 'frontend/admin/src', 'mobile/customer/src', 'mobile/driver/src'];
const HEX = /#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git']);
const ALLOW_FILE =
  /(MovrLogoMark|MovrWordmark)\.tsx$|assets[\\/]logo[\\/]|tokens\.css$|tailwind\.preset\.js$|index\.css$/;
const STRICT = process.env.STRICT_HEX === '1' || process.argv.includes('--strict');

let failures = 0;
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) continue;
    // Allow token CSS import path files that re-export design tokens
    if (full.replace(/\\/g, '/').includes('/design-system/')) continue;
    if (ALLOW_FILE.test(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const matches = text.match(HEX);
    if (matches && matches.length) {
      const rel = path.relative(ROOT, full);
      files.push({ rel, count: matches.length, samples: [...new Set(matches)].slice(0, 8) });
      failures += matches.length;
    }
  }
}

for (const t of TARGETS) walk(path.join(ROOT, t));

if (failures) {
  console.log(`Found ${failures} raw hex value(s) in ${files.length} file(s). Prefer design-system tokens.\n`);
  for (const f of files.slice(0, 40)) {
    console.log(`  ${f.rel} (${f.count}): ${f.samples.join(', ')}`);
  }
  if (files.length > 40) console.log(`  … +${files.length - 40} more files`);
  console.log('\nTip: use bg-jet-black / text-electric-violet / bg-movr-gradient from Tailwind tokens.');
  if (STRICT) {
    console.error('\nSTRICT_HEX=1 — failing.');
    process.exit(1);
  }
  console.log('\nNon-strict mode: reported only. Re-run with STRICT_HEX=1 to fail CI.');
  process.exit(0);
}

console.log('No raw hex violations found outside design-system.');
