import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, GIF, or PDF files are allowed'));
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

/** POST /api/v1/uploads — authenticated direct file upload (field: file | avatar | document) */
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
      const url = `/uploads/${file.filename}`;
      res.status(201).json({
        status: 'success',
        data: {
          url,
          filename: file.filename,
          size: file.size,
          mimeType: file.mimetype,
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
      const url = `/uploads/${file.filename}`;
      await db.query(`UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, [
        url,
        req.user!.id,
      ]);
      res.status(201).json({
        status: 'success',
        data: { avatarUrl: url, url },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

export { UPLOAD_ROOT };
