/**
 * Fix screens that got makeStyles() but missed the useThemeColors() hook inject
 * (multi-line function signatures broke the first pass).
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
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

let fixed = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    let src = fs.readFileSync(file, 'utf8');
    if (!src.includes('function makeStyles')) continue;
    if (src.includes('makeStyles(colors)')) continue;

    if (!src.includes("from '@movr/design-system/ThemeProvider'")) {
      src = `import { useThemeColors } from '@movr/design-system/ThemeProvider';\n` + src;
    }

    const exportIdx = src.indexOf('export default function');
    if (exportIdx === -1) continue;

    // Find the opening brace of the component body after the signature
    let i = exportIdx;
    let depth = 0;
    let foundParen = false;
    let bodyStart = -1;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(') {
        foundParen = true;
        depth++;
      } else if (ch === ')') {
        depth--;
      } else if (ch === '{' && foundParen && depth === 0) {
        bodyStart = i;
        break;
      }
    }
    if (bodyStart === -1) continue;

    const inject = `\n  const colors = useThemeColors();\n  const styles = makeStyles(colors);\n`;
    src = src.slice(0, bodyStart + 1) + inject + src.slice(bodyStart + 1);
    fs.writeFileSync(file, src);
    fixed++;
    console.log('fixed', path.relative(path.join(__dirname, '../..'), file));
  }
}
console.log('done, fixed=', fixed);
