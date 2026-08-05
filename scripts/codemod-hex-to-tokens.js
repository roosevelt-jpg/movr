/**
 * Codemod: replace common raw hex Tailwind / CSS literals with design-system tokens.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['frontend/web/src', 'frontend/admin/src'];

const CLASS_MAP = [
  [/bg-\[#0A0A0A\]/gi, 'bg-surface'],
  [/bg-\[#1A1A1A\]/gi, 'bg-surface-elevated'],
  [/bg-\[#121212\]/gi, 'bg-surface-elevated'],
  [/bg-\[#141414\]/gi, 'bg-surface-elevated'],
  [/bg-\[#1C1C1E\]/gi, 'bg-surface-elevated'],
  [/bg-\[#111\]/gi, 'bg-surface-elevated'],
  [/bg-\[#0A1224\]/gi, 'bg-surface'],
  [/bg-\[#1a1040\]/gi, 'bg-surface-elevated'],
  [/bg-\[#1A3A2A\]/gi, 'bg-movr-green/20'],
  [/bg-\[#2A6B45\]/gi, 'bg-movr-green/40'],
  [/border-\[#6A00FF\]\/50/gi, 'border-electric-violet/50'],
  [/border-\[#0055FF\]\/50/gi, 'border-motion-blue/50'],
  [/border-\[#6A00FF\]/gi, 'border-electric-violet'],
  [/border-\[#0055FF\]/gi, 'border-motion-blue'],
  [/border-\[#2A2A2A\]/gi, 'border-border'],
  [/border-\[#3A3A3A\]/gi, 'border-border'],
  [/border-\[#1A1A1A\]/gi, 'border-border'],
  [/text-\[#A0A0A0\]/gi, 'text-text-secondary'],
  [/text-\[#888\]/g, 'text-text-secondary'],
  [/text-\[#666\]/g, 'text-text-secondary'],
  [/text-\[#8E8E93\]/gi, 'text-text-secondary'],
  [/text-\[#C8C8C8\]/gi, 'text-text-secondary'],
  [/text-\[#E0E0E0\]/gi, 'text-text-primary'],
  [/text-\[#8FB3FF\]/gi, 'text-motion-blue'],
  [/text-\[#5E9EFF\]/gi, 'text-motion-blue'],
  [/text-\[#4A72FF\]/gi, 'text-motion-blue'],
  [/text-\[#007AFF\]/gi, 'text-motion-blue'],
  [/text-\[#0055FF\]/gi, 'text-motion-blue'],
  [/text-\[#6A00FF\]/gi, 'text-electric-violet'],
  [/text-\[#FF3B5C\]/gi, 'text-error'],
  [/text-\[#E57373\]/gi, 'text-error'],
  [/text-\[#FF5A7A\]/gi, 'text-error'],
  [/text-\[#FF8FA0\]/gi, 'text-error'],
  [/text-\[#FFB800\]/gi, 'text-warning'],
  [/text-\[#D4AF37\]/gi, 'text-warning'],
  [/text-\[#00D97A\]/gi, 'text-success'],
  [/text-\[#3F7048\]/gi, 'text-movr-green'],
  [/text-\[#9BE0A8\]/gi, 'text-success'],
  [/text-\[#8FCF9A\]/gi, 'text-success'],
  [/text-\[#7CFC9A\]/gi, 'text-success'],
  [/text-\[#3FCF7A\]/gi, 'text-success'],
  [/placeholder:text-\[#666\]/g, 'placeholder:text-text-secondary'],
  [/from-\[#3F7048\]/gi, 'from-movr-green'],
  [/via-\[#6A00FF\]/gi, 'via-electric-violet'],
  [/to-\[#0055FF\]/gi, 'to-motion-blue'],
  [/from-\[#6A00FF\]/gi, 'from-electric-violet'],
  [/to-\[#6A00FF\]/gi, 'to-electric-violet'],
  [/from-\[#0055FF\]/gi, 'from-motion-blue'],
  [/bg-\[#6A00FF\]/gi, 'bg-electric-violet'],
  [/bg-\[#0055FF\]/gi, 'bg-motion-blue'],
  [/bg-\[#3F7048\]/gi, 'bg-movr-green'],
  [/bg-\[#FF3B5C\]/gi, 'bg-error'],
  [/bg-\[#FFB800\]/gi, 'bg-warning'],
  [/bg-\[#00D97A\]/gi, 'bg-success'],
  [/hover:bg-\[#1A1A1A\]/gi, 'hover:bg-surface-elevated'],
  [/hover:border-\[#6A00FF\]/gi, 'hover:border-electric-violet'],
  [/hover:border-\[#0055FF\]\/50/gi, 'hover:border-motion-blue/50'],
  [/hover:text-\[#FFFFFF\]/gi, 'hover:text-pure-white'],
];

const STYLE_MAP = [];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, files);
    else if (/\.(tsx|ts|jsx|js|css)$/.test(e.name)) files.push(f);
  }
  return files;
}

let changed = 0;
for (const t of TARGETS) {
  for (const file of walk(path.join(ROOT, t))) {
    let text = fs.readFileSync(file, 'utf8');
    const orig = text;
    for (const [re, rep] of CLASS_MAP) text = text.replace(re, rep);

    // Collapse 2-stop brand gradients to movr-gradient utility where exact
    text = text.replace(
      /bg-gradient-to-r from-electric-violet to-motion-blue/g,
      'bg-movr-gradient'
    );
    text = text.replace(
      /bg-gradient-to-br from-electric-violet to-motion-blue/g,
      'bg-movr-gradient'
    );
    text = text.replace(
      /bg-gradient-to-r from-movr-green via-electric-violet to-motion-blue/g,
      'bg-movr-gradient'
    );

    // Semantic black/white in our dark product UI
    text = text.replace(/\bbg-black\b/g, 'bg-jet-black');
    text = text.replace(/\btext-white\b/g, 'text-pure-white');
    text = text.replace(/\bborder-white\b/g, 'border-pure-white');
    text = text.replace(/\bhover:text-white\b/g, 'hover:text-pure-white');
    text = text.replace(/\bhover:bg-white\/5\b/g, 'hover:bg-pure-white/5');
    text = text.replace(/\bborder-white\/70\b/g, 'border-pure-white/70');
    text = text.replace(/\bborder-white\/10\b/g, 'border-pure-white/10');
    text = text.replace(/\btext-white\/90\b/g, 'text-pure-white/90');
    text = text.replace(/\bbg-black\/80\b/g, 'bg-jet-black/80');
    text = text.replace(/\bbg-black\/60\b/g, 'bg-jet-black/60');

    if (text !== orig) {
      fs.writeFileSync(file, text);
      changed++;
      console.log('updated', path.relative(ROOT, file));
    }
  }
}
console.log('files_changed', changed);
