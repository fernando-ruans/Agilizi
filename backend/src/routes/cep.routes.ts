import { Router } from 'express';
import { lookupCep } from '../services/cepService';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/cep/:cep
router.get('/:cep', async (req, res) => {
  const address = await lookupCep(req.params.cep);
  res.json({ status: 'success', data: address });
});

export default router;
