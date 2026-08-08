import multer from 'multer';
import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import {
  ASSETS_ROOT,
  assetUrlFromMulterFile,
  multerAssetStorage,
} from '../utils/asset-storage';
import { processUploadedMedia } from '../utils/media-process';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const upload = multer({
  storage: multerAssetStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(
        new Error('Only JPEG, PNG, WebP, GIF, PDF, MP4, WebM, or QuickTime files are allowed')
      );
    }
    cb(null, true);
  },
});

const db = new DatabaseService();

export const uploadsRouter = Router();

function fileFromRequest(req: AuthRequest) {
  const anyFiles = (req as any).files as Express.Multer.File[] | undefined;
  if (Array.isArray(anyFiles) && anyFiles[0]) return anyFiles[0];
  return (req as any).file as Express.Multer.File | undefined;
}

function purposeFromRequest(req: AuthRequest) {
  return (
    (req.query.purpose as string) ||
    (req.body && (req.body.purpose as string)) ||
    undefined
  );
}

/** POST /api/v1/uploads — authenticated direct file upload → backend/assets/{images|videos|documents}
 *  Images/videos are auto-resized. Optional multipart/query field `purpose`:
 *  banner|hero|card|product|avatar|default
 */
uploadsRouter.post(
  '/',
  authenticateToken,
  requireRole('merchant', 'admin', 'driver', 'customer', 'rider'),
  upload.any(),
  async (req: AuthRequest, res: Response) => {
    try {
      const file = fileFromRequest(req);
      if (!file) {
        return res.status(400).json({ status: 'error', message: 'file is required (multipart)' });
      }
      const processed = await processUploadedMedia(file, ASSETS_ROOT, purposeFromRequest(req));
      res.status(201).json({
        status: 'success',
        data: {
          url: processed.url,
          path: processed.relativePath,
          filename: processed.filename,
          size: processed.size,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
          variants: processed.variants,
          processed: processed.processed,
          note: processed.note,
        },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

/** POST /api/v1/users/avatar — direct avatar upload; stores avatar_url on users */
uploadsRouter.post(
  '/users/avatar',
  authenticateToken,
  upload.any(),
  async (req: AuthRequest, res: Response) => {
    try {
      const file = fileFromRequest(req);
      if (!file) {
        return res.status(400).json({ status: 'error', message: 'avatar file is required' });
      }
      if (!String(file.mimetype).startsWith('image/')) {
        return res.status(400).json({ status: 'error', message: 'Avatar must be an image' });
      }
      const processed = await processUploadedMedia(file, ASSETS_ROOT, 'avatar');
      const url = processed.url || assetUrlFromMulterFile(file);
      await db.query(`UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, [
        url,
        req.user!.id,
      ]);
      res.status(201).json({
        status: 'success',
        data: {
          avatarUrl: url,
          url,
          width: processed.width,
          height: processed.height,
          variants: processed.variants,
          processed: processed.processed,
        },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

export { ASSETS_ROOT, ASSETS_ROOT as UPLOAD_ROOT };
