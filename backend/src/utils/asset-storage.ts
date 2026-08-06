import path from 'path';
import fs from 'fs';
import multer from 'multer';

/** Canonical on-disk root for all user-uploaded images/videos/documents. */
export const ASSETS_ROOT = path.resolve(__dirname, '../../assets');

/** Legacy folder — still served read-only for older `/uploads/...` URLs. */
export const LEGACY_UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

export type AssetKind = 'images' | 'videos' | 'documents';

export function kindFromMime(mime: string | undefined): AssetKind {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('video/')) return 'videos';
  if (m.startsWith('image/')) return 'images';
  return 'documents';
}

export function ensureAssetDirs() {
  for (const sub of ['images', 'videos', 'documents', 'videos/trip-recordings']) {
    const dir = path.join(ASSETS_ROOT, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

ensureAssetDirs();

export function safeFilename(originalName: string, fallbackExt = '.bin') {
  const ext = path.extname(originalName || '').toLowerCase() || fallbackExt;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
}

/** Public URL path for a file under ASSETS_ROOT (posix-style). */
export function publicAssetUrl(relativeWithinAssets: string) {
  const rel = relativeWithinAssets.replace(/\\/g, '/').replace(/^\/+/, '');
  return `/assets/${rel}`;
}

export function assetUrlFromMulterFile(file: Express.Multer.File) {
  const rel = path.relative(ASSETS_ROOT, file.path).split(path.sep).join('/');
  return publicAssetUrl(rel);
}

/** Absolute path + public URL after writing a buffer into assets. */
export function saveAssetBuffer(
  buffer: Buffer,
  opts: { mime?: string; filename?: string; subdir?: string }
) {
  const kind = kindFromMime(opts.mime);
  const sub = opts.subdir ? path.join(kind, opts.subdir) : kind;
  const dir = path.join(ASSETS_ROOT, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename =
    opts.filename ||
    safeFilename('upload.bin', kind === 'videos' ? '.mp4' : kind === 'images' ? '.jpg' : '.bin');
  const full = path.join(dir, filename);
  fs.writeFileSync(full, buffer);
  const rel = path.relative(ASSETS_ROOT, full).split(path.sep).join('/');
  return { fullPath: full, relativePath: rel, url: publicAssetUrl(rel), filename };
}

/** Multer disk storage that always lands under backend/assets/{images|videos|documents}. */
export function multerAssetStorage(opts?: { filenamePrefix?: string; fixedSubdir?: string }) {
  return multer.diskStorage({
    destination: (_req, file, cb) => {
      try {
        const kind = kindFromMime(file.mimetype);
        const dir = opts?.fixedSubdir
          ? path.join(ASSETS_ROOT, opts.fixedSubdir)
          : path.join(ASSETS_ROOT, kind);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (err: any) {
        cb(err, ASSETS_ROOT);
      }
    },
    filename: (_req, file, cb) => {
      const prefix = opts?.filenamePrefix || '';
      const base = safeFilename(file.originalname, kindFromMime(file.mimetype) === 'videos' ? '.mp4' : '.jpg');
      cb(null, `${prefix}${base}`);
    },
  });
}

/** S3 / cloud key always under assets/… */
export function cloudAssetKey(...parts: string[]) {
  const cleaned = parts
    .join('/')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .filter((p) => p !== '..');
  if (cleaned[0] === 'assets') return cleaned.join('/');
  return ['assets', ...cleaned].join('/');
}

/** @deprecated Prefer ASSETS_ROOT — kept so older imports keep compiling. */
export const UPLOAD_ROOT = ASSETS_ROOT;
