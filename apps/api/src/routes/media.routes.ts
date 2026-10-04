import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { MediaController } from '../controllers/media.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { BadRequestError } from '../utils/errors.js';

const tempUploadDir = path.resolve(process.cwd(), 'temp', 'uploads');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB maximum file size
  },
  fileFilter: (_req, file, cb) => {
    // Allowed MIME types
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain',
    ];

    if (
      allowed.includes(file.mimetype) ||
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported media type: ${file.mimetype}`));
    }
  },
});

const router = Router();

// Require authentication for all media operations (token header or query param)
router.use(authenticate);

// Stream Telegram files
router.get('/file/:fileId', asyncHandler(MediaController.getFileStream));

router.post(
  '/upload',
  authorize('owner', 'admin'),
  upload.single('file'),
  asyncHandler(MediaController.upload)
);

export { router as mediaRouter };
