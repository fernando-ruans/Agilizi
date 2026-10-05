import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/reports/margin
router.get('/margin', reportController.margin);

export default router;
