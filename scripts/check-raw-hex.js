const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['frontend/web/src', 'frontend/admin/src', 'mobile'];
const HEX = /#[0-9A-Fa-f]{6}\b/g;
const ALLOW = ['design-system'];

let failures = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ALLOW.some((a) => full.includes(a))) continue;
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const matches = text.match(HEX);
    if (matches && matches.length) {
      console.error(`${path.relative(ROOT, full)}: ${matches.join(', ')}`);
      failures += matches.length;
    }
  }
}

for (const t of TARGETS) walk(path.join(ROOT, t));

if (failures) {
  console.error(`\nFound ${failures} raw hex value(s). Use design-system tokens.`);
  process.exit(1);
}
console.log('No raw hex violations found.');
