import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { publicAssetUrl } from './asset-storage';

export type UploadPurpose = 'banner' | 'hero' | 'card' | 'product' | 'avatar' | 'default';

export type ProcessedMedia = {
  fullPath: string;
  relativePath: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  variants?: { sm?: string; md?: string; lg?: string };
  processed: boolean;
  note?: string;
};

const MAX_EDGE: Record<UploadPurpose, number> = {
  banner: 1920,
  hero: 1920,
  default: 1920,
  card: 1280,
  product: 1280,
  avatar: 512,
};

function parsePurpose(raw?: string | null): UploadPurpose {
  const p = String(raw || 'default').toLowerCase();
  if (p === 'banner' || p === 'hero') return p;
  if (p === 'card' || p === 'product' || p === 'avatar') return p;
  return 'default';
}

function relativeFromAssets(fullPath: string, assetsRoot: string) {
  return path.relative(assetsRoot, fullPath).split(path.sep).join('/');
}

/**
 * Auto-resize / optimize an uploaded image or video under backend/assets.
 * Images: sharp (orient, strip, downscale, webp/jpeg + sm/md variants).
 * Videos: optional ffmpeg scale to max 1280p; fail soft if unavailable.
 */
export async function processUploadedMedia(
  file: Express.Multer.File,
  assetsRoot: string,
  purposeRaw?: string | null
): Promise<ProcessedMedia> {
  const purpose = parsePurpose(purposeRaw);
  const mime = String(file.mimetype || '').toLowerCase();
  const rel = relativeFromAssets(file.path, assetsRoot);
  const base: ProcessedMedia = {
    fullPath: file.path,
    relativePath: rel,
    url: publicAssetUrl(rel),
    filename: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    processed: false,
  };

  if (mime.startsWith('image/') && mime !== 'image/gif') {
    return processImage(file, assetsRoot, purpose, base);
  }
  if (mime.startsWith('video/')) {
    return processVideo(file, assetsRoot, base);
  }
  return base;
}

async function processImage(
  file: Express.Multer.File,
  assetsRoot: string,
  purpose: UploadPurpose,
  base: ProcessedMedia
): Promise<ProcessedMedia> {
  const maxEdge = MAX_EDGE[purpose];
  const dir = path.dirname(file.path);
  const parsed = path.parse(file.path);
  const keepPng = file.mimetype === 'image/png';
  const outExt = keepPng ? '.png' : '.webp';
  const outName = `${parsed.name}${outExt}`;
  const outPath = path.join(dir, outName);

  try {
    let pipeline = sharp(file.path).rotate();
    const meta = await pipeline.metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    const longest = Math.max(w, h);

    if (longest > maxEdge) {
      pipeline = sharp(file.path)
        .rotate()
        .resize({
          width: w >= h ? maxEdge : undefined,
          height: h > w ? maxEdge : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        });
    } else {
      pipeline = sharp(file.path).rotate();
    }

    if (keepPng) {
      await pipeline.png({ compressionLevel: 8 }).toFile(outPath + '.tmp');
    } else {
      await pipeline.webp({ quality: 82 }).toFile(outPath + '.tmp');
    }
    // Replace: remove original if different path, rename tmp
    if (fs.existsSync(outPath + '.tmp')) {
      if (path.resolve(file.path) !== path.resolve(outPath) && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      fs.renameSync(outPath + '.tmp', outPath);
    }

    const finalMeta = await sharp(outPath).metadata();
    const variants: { sm?: string; md?: string; lg?: string } = {};
    const lgRel = relativeFromAssets(outPath, assetsRoot);
    variants.lg = publicAssetUrl(lgRel);

    // md / sm siblings for srcset
    const mdMax = Math.min(1280, maxEdge);
    const smMax = 640;
    for (const [key, edge] of [
      ['md', mdMax],
      ['sm', smMax],
    ] as const) {
      if ((finalMeta.width || 0) <= edge && key !== 'sm') continue;
      if ((finalMeta.width || 0) <= edge && key === 'sm' && (finalMeta.width || 0) <= 640) {
        // still write sm if larger than 640 wasn't needed — skip tiny images
        if ((finalMeta.width || 0) <= 640) continue;
      }
      const variantName = `${parsed.name}-${key}.webp`;
      const variantPath = path.join(dir, variantName);
      try {
        await sharp(outPath)
          .resize({
            width: edge,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toFile(variantPath);
        variants[key] = publicAssetUrl(relativeFromAssets(variantPath, assetsRoot));
      } catch {
        // variant optional
      }
    }

    const stat = fs.statSync(outPath);
    return {
      fullPath: outPath,
      relativePath: lgRel,
      url: publicAssetUrl(lgRel),
      filename: path.basename(outPath),
      mimeType: keepPng ? 'image/png' : 'image/webp',
      size: stat.size,
      width: finalMeta.width,
      height: finalMeta.height,
      variants: Object.keys(variants).length ? variants : undefined,
      processed: true,
    };
  } catch (e: any) {
    return { ...base, note: e?.message || 'image process skipped', processed: false };
  }
}

async function processVideo(
  file: Express.Multer.File,
  assetsRoot: string,
  base: ProcessedMedia
): Promise<ProcessedMedia> {
  try {
    // Lazy-require so servers without ffmpeg still boot
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path as string;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegPath);

    const dir = path.dirname(file.path);
    const parsed = path.parse(file.path);
    const outPath = path.join(dir, `${parsed.name}-opt.mp4`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(file.path)
        .outputOptions([
          '-vf',
          "scale='min(1280,iw)':-2",
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '28',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
        ])
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outPath);
    });

    if (fs.existsSync(outPath)) {
      if (fs.existsSync(file.path) && path.resolve(file.path) !== path.resolve(outPath)) {
        fs.unlinkSync(file.path);
      }
      const rel = relativeFromAssets(outPath, assetsRoot);
      const stat = fs.statSync(outPath);
      return {
        fullPath: outPath,
        relativePath: rel,
        url: publicAssetUrl(rel),
        filename: path.basename(outPath),
        mimeType: 'video/mp4',
        size: stat.size,
        processed: true,
      };
    }
    return base;
  } catch (e: any) {
    return {
      ...base,
      processed: false,
      note: e?.message || 'video transcode skipped — original kept',
    };
  }
}
