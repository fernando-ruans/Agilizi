import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);
router.get('/', dashboardController.index);
router.get('/series', dashboardController.series);

export default router;
