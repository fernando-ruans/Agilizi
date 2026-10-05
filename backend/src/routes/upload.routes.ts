import { Router } from 'express';
import { uploadController } from '../controllers/uploadController';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadSingle } from '../middlewares/upload';

const router = Router();

router.use(authenticate);

router.get('/', uploadController.index);
router.post(
  '/',
  authorize('admin', 'gerente', 'operacional'),
  uploadSingle('file'),
  uploadController.store,
);
router.delete('/:id', authorize('admin', 'gerente', 'operacional'), uploadController.delete);

export default router;
