import { Router } from 'express';
import { cashController } from '../controllers/cashController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();

const createSchema = z.object({
  type: z.enum(['entrada', 'saida']),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  value: z.number().positive('Valor deve ser positivo'),
  date: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

router.use(authenticate);

router.get('/summary', cashController.summary);
router.get('/', cashController.index);
router.get('/:id', cashController.show);
router.post('/', authorize('admin', 'gerente', 'operacional'), validate(createSchema), cashController.store);
router.put('/:id', authorize('admin', 'gerente'), validate(updateSchema), cashController.update);
router.delete('/:id', authorize('admin'), cashController.delete);

export default router;
