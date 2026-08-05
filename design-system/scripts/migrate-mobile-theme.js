/**
 * Converts mobile screens from static StyleSheet colors to useThemeColors().
 * Idempotent-ish: skips files that already import useThemeColors.
 */
const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, '../../mobile/customer/src'),
  path.join(__dirname, '../../mobile/driver/src'),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(p);
  }
  return out;
}

function transform(src) {
  if (!src.includes('@movr/design-system/theme')) return null;
  if (src.includes('useThemeColors')) return null;
  if (!/colors\.(jetBlack|pureWhite|surface|textPrimary|textSecondary|border|surfaceElevated)/.test(src)) {
    return null;
  }

  let next = src;

  // Ensure ThemeProvider import
  if (!next.includes("from '@movr/design-system/ThemeProvider'")) {
    next = next.replace(
      /import\s*\{([^}]+)\}\s*from\s*'@movr\/design-system\/theme';/,
      (m, inner) => {
        const parts = inner.split(',').map((s) => s.trim()).filter(Boolean);
        const kept = parts.filter((p) => p !== 'colors' && !p.startsWith('colors '));
        const themeImport =
          kept.length > 0
            ? `import { ${kept.join(', ')} } from '@movr/design-system/theme';\n`
            : '';
        return `${themeImport}import { useThemeColors } from '@movr/design-system/ThemeProvider';`;
      }
    );
  }

  // Find default export function and inject hook + dynamic styles
  // Pattern: export default function Name(...) { ... const styles = StyleSheet.create
  // Move StyleSheet.create inside component is hard; instead wrap return root.

  // Simpler: replace `const styles = StyleSheet.create({` with a factory called inside component.
  if (!/const styles = StyleSheet\.create\(/.test(next)) return next === src ? null : next;

  // Inject hook after opening of default function body
  next = next.replace(
    /(export default function \w+\s*\([^)]*\)\s*\{)/,
    `$1\n  const colors = useThemeColors();\n  const styles = makeStyles(colors);\n`
  );

  // Rename StyleSheet.create to makeStyles factory
  next = next.replace(
    /const styles = StyleSheet\.create\(/,
    'function makeStyles(colors: any) {\n  return StyleSheet.create('
  );

  // Close factory: find last `});` of StyleSheet - typically end of file before nothing
  // The StyleSheet ends with `});` - change last occurrence of StyleSheet close
  const idx = next.lastIndexOf('});');
  if (idx !== -1) {
    // Check we're closing StyleSheet not something else - look back for StyleSheet.create / makeStyles
    const before = next.slice(0, idx);
    if (before.includes('function makeStyles')) {
      next = next.slice(0, idx) + '});\n}' + next.slice(idx + 3);
    }
  }

  // Remove duplicate `const styles = makeStyles` if StyleSheet was at module level and we injected
  // We may now have "const styles = makeStyles" twice if we also renamed - fix double inject
  const hookMatches = next.match(/const colors = useThemeColors\(\);/g);
  if (hookMatches && hookMatches.length > 1) return null;

  // If we injected makeStyles call but also have `function makeStyles` after the component,
  // remove the erroneous `const styles = makeStyles(colors);` that sits next to old StyleSheet rename...

  // Fix: when StyleSheet was module-level, we replaced `const styles = StyleSheet.create` with
  // `function makeStyles...` so the inject `const styles = makeStyles(colors)` is correct.

  // TypeScript: colors: any in makeStyles - ok for RN screens

  // Remove unused colors from theme import if empty import left
  next = next.replace(/import\s*\{\s*\}\s*from\s*'@movr\/design-system\/theme';\n?/g, '');

  return next;
}

let changed = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8');
    const out = transform(src);
    if (!out || out === src) continue;
    fs.writeFileSync(file, out);
    changed++;
    console.log('updated', path.relative(path.join(__dirname, '..'), file));
  }
}
console.log('done, changed=', changed);
