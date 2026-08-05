import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Router, Response } from 'express';
import { AuthRequest, authenticateToken, requireRole } from '../middleware/auth.middleware';

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'));
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

/** POST /api/v1/uploads — merchant or admin image upload */
uploadsRouter.post(
  '/',
  authenticateToken,
  requireRole('merchant', 'admin'),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'file is required' });
      }
      const url = `/uploads/${req.file.filename}`;
      res.status(201).json({
        status: 'success',
        data: {
          url,
          filename: req.file.filename,
          size: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

export { UPLOAD_ROOT };
