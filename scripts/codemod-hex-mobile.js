/**
 * Replace raw hex in React Native screens with colors.* from @movr/design-system/theme.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['mobile/customer/src', 'mobile/driver/src'];

const HEX_TO_COLORS = {
  '#000000': 'colors.jetBlack',
  '#FFFFFF': 'colors.pureWhite',
  '#6A00FF': 'colors.electricViolet',
  '#0055FF': 'colors.motionBlue',
  '#3F7048': 'colors.movrGreen',
  '#0A0A0A': 'colors.surface',
  '#1A1A1A': 'colors.surfaceElevated',
  '#2A2A2A': 'colors.border',
  '#A0A0A0': 'colors.textSecondary',
  '#00D97A': 'colors.success',
  '#FF3B5C': 'colors.error',
  '#FFB800': 'colors.warning',
  '#FF5A7A': 'colors.error',
  '#3FCF7A': 'colors.success',
  '#7CFC9A': 'colors.success',
  '#9BE0A8': 'colors.success',
  '#74D38F': 'colors.success',
  '#8FCF9A': 'colors.success',
  '#4A72FF': 'colors.motionBlue',
  '#007AFF': 'colors.motionBlue',
  '#0A84FF': 'colors.motionBlue',
  '#8FB3FF': 'colors.motionBlue',
  '#5E9EFF': 'colors.motionBlue',
  '#8E8E93': 'colors.textSecondary',
  '#C8C8C8': 'colors.textSecondary',
  '#E0E0E0': 'colors.textPrimary',
  '#E8E8E8': 'colors.textPrimary',
  '#E9EDEF': 'colors.textPrimary',
  '#8696A0': 'colors.textSecondary',
  '#0D0D0D': 'colors.surface',
  '#0d0d0d': 'colors.surface',
  '#3A3A3A': 'colors.border',
  '#141414': 'colors.surfaceElevated',
  '#121212': 'colors.surfaceElevated',
  '#111111': 'colors.surfaceElevated',
  '#1C1C1E': 'colors.surfaceElevated',
  '#2C2C2E': 'colors.border',
  '#1A3A2A': 'colors.movrGreen',
  '#2A6B45': 'colors.movrGreen',
  '#25D366': 'colors.success',
  '#005C4B': 'colors.movrGreen',
  '#8B6914': 'colors.warning',
  '#6B2D2D': 'colors.error',
  '#D4AF37': 'colors.warning',
  '#E57373': 'colors.error',
  '#FF8FA0': 'colors.error',
  '#FF6B6B': 'colors.error',
  '#3A2424': 'colors.error',
  '#1a1040': 'colors.surface',
  '#1A1040': 'colors.surface',
  '#0A1224': 'colors.surface',
  '#0B141A': 'colors.surface',
  '#1F2C34': 'colors.surfaceElevated',
  '#2A3942': 'colors.border',
  '#7A9A8F': 'colors.textSecondary',
  '#4A7A4A': 'colors.movrGreen',
  '#1A2F1A': 'colors.movrGreen',
  '#7CFF7C': 'colors.success',
  '#2F4F2F': 'colors.movrGreen',
  '#0F1F0F': 'colors.surface',
  '#4B8BFF': 'colors.motionBlue',
  '#D4C4FF': 'colors.electricViolet',
  '#E9968B': 'colors.error',
  '#C9B458': 'colors.warning',
  '#120024': 'colors.surface',
  '#F37474': 'colors.error',
  '#749CF3': 'colors.motionBlue',
  '#fff': 'colors.pureWhite',
  '#FFF': 'colors.pureWhite',
  '#000': 'colors.jetBlack',
  '#111': 'colors.surfaceElevated',
  '#222': 'colors.border',
  '#333': 'colors.border',
  '#444': 'colors.border',
  '#555': 'colors.border',
  '#666': 'colors.textSecondary',
  '#888': 'colors.textSecondary',
  '#999': 'colors.textSecondary',
  '#ccc': 'colors.border',
  '#CCC': 'colors.border',
  '#ddd': 'colors.border',
  '#DDD': 'colors.border',
};

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, files);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) files.push(f);
  }
  return files;
}

function resolveToken(match) {
  const upper = match.toUpperCase();
  const lower = match.toLowerCase();
  return (
    HEX_TO_COLORS[match] ||
    HEX_TO_COLORS[upper] ||
    HEX_TO_COLORS[lower] ||
    null
  );
}

function ensureColorsImport(text) {
  if (/from ['"]@movr\/design-system\/theme['"]/.test(text)) {
    return text.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]@movr\/design-system\/theme['"]/,
      (m, inner) => {
        if (/\bcolors\b/.test(inner)) return m;
        return `import { colors, ${inner.trim()} } from '@movr/design-system/theme'`;
      }
    );
  }
  // Insert after react / react-native imports
  const importLine = "import { colors } from '@movr/design-system/theme';\n";
  const rnImport = text.match(/^import .+ from ['"]react-native['"];?\r?\n/m);
  if (rnImport) {
    const idx = rnImport.index + rnImport[0].length;
    return text.slice(0, idx) + importLine + text.slice(idx);
  }
  return importLine + text;
}

let changed = 0;
let replacements = 0;

for (const t of TARGETS) {
  for (const file of walk(path.join(ROOT, t))) {
    let text = fs.readFileSync(file, 'utf8');
    const orig = text;
    let fileHits = 0;

    // JSX attr="#hex" → attr={colors.token}
    text = text.replace(
      /(\w+)=['"]#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b['"]/gi,
      (full, attr, hex) => {
        const token = resolveToken(`#${hex}`);
        if (!token) return full;
        fileHits++;
        return `${attr}={${token}}`;
      }
    );

    // Quoted hex in objects / StyleSheet → colors.token
    text = text.replace(/['"]#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b['"]/gi, (full, hex) => {
      const match = `#${hex}`;
      const token = resolveToken(match);
      if (!token) return full;
      fileHits++;
      return token;
    });

    // Repair broken JSX from older runs: prop=colors.x → prop={colors.x}
    text = text.replace(/(\w+)=(colors\.[a-zA-Z]+)\b/g, (_, attr, token) => {
      fileHits++;
      return `${attr}={${token}}`;
    });

    if (fileHits) {
      text = ensureColorsImport(text);
      replacements += fileHits;
    }

    if (text !== orig) {
      fs.writeFileSync(file, text);
      changed++;
      console.log('updated', path.relative(ROOT, file), `(${fileHits})`);
    }
  }
}

console.log('files_changed', changed, 'replacements', replacements);
