import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';
import { isAllowedImageMime, MAX_IMAGE_SIZE } from '../utils/imageProcessor';

// Files stay in memory: sharp needs the buffer anyway and this avoids
// writing unvalidated client data to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) {
      cb(new AppError('Formato de imagem inválido. Use JPG, PNG, WebP ou GIF.', 400));
      return;
    }
    cb(null, true);
  },
});

/**
 * Wraps multer so its errors (file too big, unexpected field…) surface as
 * 400 AppErrors instead of falling through to the 500 handler.
 */
export function uploadSingle(field: string) {
  const middleware = upload.single(field);
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof AppError) return next(err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('Imagem muito grande. O limite é 5MB.', 400));
        }
        return next(new AppError('Upload inválido. Envie apenas um arquivo por vez.', 400));
      }
      next(err);
    });
  };
}
