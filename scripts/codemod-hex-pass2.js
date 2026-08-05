/**
 * Second-pass hex cleanup for leftovers the first codemod missed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['frontend/web/src', 'frontend/admin/src']; // mobile uses codemod-hex-mobile.js

const REPLACEMENTS = [
  [/bg-\[#2A2A2A\]/gi, 'bg-border'],
  [/bg-\[#3A3A3A\]/gi, 'bg-border'],
  [/bg-\[#0d0d0d\]/gi, 'bg-surface'],
  [/bg-\[#0D0D0D\]/gi, 'bg-surface'],
  [/bg-\[#FF5A7A\]/gi, 'bg-error'],
  [/divide-\[#2A2A2A\]/gi, 'divide-border'],
  [/border-\[#FF3B5C\]\/50/gi, 'border-error/50'],
  [/border-\[#FFB800\]\/40/gi, 'border-warning/40'],
  [/border-\[#3FCF7A\]/gi, 'border-success'],
  [/border-\[#007AFF\]/gi, 'border-motion-blue'],
  [/accent-\[#6A00FF\]/gi, 'accent-electric-violet'],
  [/from-\[#1a1040\]/gi, 'from-surface'],
  [/from-\[#0A0A0A\]/gi, 'from-surface'],
  [/to-\[#3F7048\]/gi, 'to-movr-green'],
  [/via-electric-violet\/70/gi, 'via-electric-violet/70'],
  [/shadow-\[0_0_12px_#0055FF\]/gi, 'shadow-active-glow'],
  [/shadow-\[0_10px_40px_rgba\(106,0,255,0\.35\)\]/gi, 'shadow-active-glow'],
  [/shadow-\[0_20px_60px_rgba\(106,0,255,0\.3\)\]/gi, 'shadow-active-glow'],
  [/shadow-\[0_30px_80px_rgba\(0,85,255,0\.25\)\]/gi, 'shadow-active-glow'],
  [/#2A2A2A/g, ''], // handled case-by-case below for styles
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, files);
    else if (/\.(tsx|ts|jsx|js|css)$/.test(e.name)) files.push(f);
  }
  return files;
}

// Inline style / string color map for remaining hex literals
const HEX_TO_TOKEN = {
  '#000000': 'var(--jet-black)',
  '#000': 'var(--jet-black)',
  '#FFFFFF': 'var(--pure-white)',
  '#fff': 'var(--pure-white)',
  '#6A00FF': 'var(--electric-violet)',
  '#0055FF': 'var(--motion-blue)',
  '#3F7048': 'var(--movr-green)',
  '#0A0A0A': 'var(--surface)',
  '#1A1A1A': 'var(--surface-elevated)',
  '#2A2A2A': 'var(--border)',
  '#A0A0A0': 'var(--text-secondary)',
  '#00D97A': 'var(--success)',
  '#FF3B5C': 'var(--error)',
  '#FFB800': 'var(--warning)',
  '#FF5A7A': 'var(--error)',
  '#3FCF7A': 'var(--success)',
  '#7CFC9A': 'var(--success)',
  '#9BE0A8': 'var(--success)',
  '#4A72FF': 'var(--motion-blue)',
  '#007AFF': 'var(--motion-blue)',
  '#8FB3FF': 'var(--motion-blue)',
  '#5E9EFF': 'var(--motion-blue)',
  '#8E8E93': 'var(--text-secondary)',
  '#f0f0f0': 'var(--border)',
  '#f9fafb': 'var(--surface-elevated)',
  '#f5f5f5': 'var(--surface-elevated)',
  '#4caf50': 'var(--success)',
  '#1a1040': 'var(--surface)',
  '#0d0d0d': 'var(--surface)',
  '#3A3A3A': 'var(--border)',
  '#141414': 'var(--surface-elevated)',
  '#121212': 'var(--surface-elevated)',
  '#1C1C1E': 'var(--surface-elevated)',
  '#1A3A2A': 'var(--movr-green)',
  '#2A6B45': 'var(--movr-green)',
  '#25D366': 'var(--success)',
  '#8B6914': 'var(--warning)',
  '#6B2D2D': 'var(--error)',
  '#D4AF37': 'var(--warning)',
  '#E57373': 'var(--error)',
  '#FF8FA0': 'var(--error)',
  '#C8C8C8': 'var(--text-secondary)',
  '#E0E0E0': 'var(--text-primary)',
  '#1E1B4B': 'var(--surface-elevated)',
  '#CFCFCF': 'var(--text-secondary)',
  '#4A86E8': 'var(--motion-blue)',
  '#3A2A2A': 'var(--surface-elevated)',
  '#1F1F1F': 'var(--surface-elevated)',
  '#8b5cf6': 'var(--electric-violet)',
  '#8B5CF6': 'var(--electric-violet)',
  '#808080': 'var(--text-secondary)',
  '#4A90E2': 'var(--motion-blue)',
  '#FFB0B0': 'var(--error)',
  '#0A84FF': 'var(--motion-blue)',
  '#2C2C2E': 'var(--border)',
  '#ff9800': 'var(--warning)',
  '#FF9800': 'var(--warning)',
  '#f44336': 'var(--error)',
  '#F44336': 'var(--error)',
  '#e8f5e9': 'var(--surface-elevated)',
  '#E8F5E9': 'var(--surface-elevated)',
  '#ffebee': 'var(--surface-elevated)',
  '#FFEBEE': 'var(--surface-elevated)',
  '#fff3e0': 'var(--surface-elevated)',
  '#FFF3E0': 'var(--surface-elevated)',
  '#f3e5f5': 'var(--surface-elevated)',
  '#F3E5F5': 'var(--surface-elevated)',
  '#2e7d32': 'var(--success)',
  '#2E7D32': 'var(--success)',
  '#e65100': 'var(--warning)',
  '#E65100': 'var(--warning)',
  '#4caf50': 'var(--success)',
  '#4CAF50': 'var(--success)',
  '#c62828': 'var(--error)',
  '#C62828': 'var(--error)',
  '#1565c0': 'var(--motion-blue)',
  '#1565C0': 'var(--motion-blue)',
  '#6a1b9a': 'var(--electric-violet)',
  '#6A1B9A': 'var(--electric-violet)',
  '#424242': 'var(--text-secondary)',
  '#212121': 'var(--jet-black)',
  '#fafafa': 'var(--surface-elevated)',
  '#FAFAFA': 'var(--surface-elevated)',
  '#eeeeee': 'var(--border)',
  '#EEEEEE': 'var(--border)',
  '#f9f9f9': 'var(--surface-elevated)',
  '#F9F9F9': 'var(--surface-elevated)',
  '#fff': 'var(--pure-white)',
  '#FFF': 'var(--pure-white)',
  '#000': 'var(--jet-black)',
  '#111': 'var(--surface-elevated)',
  '#222': 'var(--border)',
  '#333': 'var(--border)',
  '#444': 'var(--border)',
  '#555': 'var(--border)',
  '#666': 'var(--text-secondary)',
  '#888': 'var(--text-secondary)',
  '#999': 'var(--text-secondary)',
  '#ccc': 'var(--border)',
  '#CCC': 'var(--border)',
  '#ddd': 'var(--border)',
  '#DDD': 'var(--border)',
};

let changed = 0;
for (const t of TARGETS) {
  for (const file of walk(path.join(ROOT, t))) {
    if (/MovrLogoMark\.tsx$|MovrWordmark\.tsx$/.test(file)) continue;
    let text = fs.readFileSync(file, 'utf8');
    const orig = text;

    for (const [re, rep] of REPLACEMENTS) {
      if (rep === '') continue;
      text = text.replace(re, rep);
    }

    // Replace remaining #hex in style objects / strings with CSS vars
    text = text.replace(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g, (match) => {
      const key = match.length === 4
        ? `#${match[1]}${match[1]}${match[2]}${match[2]}${match[3]}${match[3]}`.toLowerCase()
        : match;
      const upper = match.toUpperCase();
      const lower = match.toLowerCase();
      return (
        HEX_TO_TOKEN[match] ||
        HEX_TO_TOKEN[upper] ||
        HEX_TO_TOKEN[lower] ||
        HEX_TO_TOKEN[key] ||
        match
      );
    });

    if (text !== orig) {
      fs.writeFileSync(file, text);
      changed++;
      console.log('updated', path.relative(ROOT, file));
    }
  }
}
console.log('files_changed', changed);
