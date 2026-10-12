import { Router } from 'express';
import { assistantController } from '../controllers/assistantController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/status', assistantController.status);
router.get('/threads', assistantController.listThreads);
router.post('/threads', assistantController.createThread);
router.get('/threads/:id', assistantController.getThread);
router.delete('/threads/:id', assistantController.deleteThread);
router.post('/threads/:id/chat', assistantController.chat);
router.post('/actions/:id/confirm', authorize('admin', 'gerente'), assistantController.confirmAction);
router.post('/actions/:id/reject', authorize('admin', 'gerente'), assistantController.rejectAction);

export default router;
