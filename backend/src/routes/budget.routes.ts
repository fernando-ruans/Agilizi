import { Router } from 'express';
import { budgetController } from '../controllers/budgetController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();

const budgetItemSchema = z.object({
  serviceId: z.string().min(1, 'Serviço é obrigatório'),
  description: z.string().optional().nullable(),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  unitValue: z.number().positive('Valor unitário deve ser positivo'),
});

const createSchema = z.object({
  clientId: z.string().min(1, 'Cliente é obrigatório'),
  items: z.array(budgetItemSchema).min(1, 'Pelo menos um item é obrigatório'),
  notes: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  discount: z.number().min(0).optional(),
});

const updateSchema = z.object({
  clientId: z.string().optional(),
  items: z.array(budgetItemSchema).optional(),
  notes: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  discount: z.number().min(0).optional(),
  status: z.enum(['rascunho', 'enviado', 'aprovado', 'rejeitado']).optional(),
});

router.use(authenticate);

router.get('/', budgetController.index);
router.get('/:id', budgetController.show);
router.post('/', authorize('admin', 'gerente', 'operacional'), validate(createSchema), budgetController.store);
router.put('/:id', authorize('admin', 'gerente', 'operacional'), validate(updateSchema), budgetController.update);
router.post('/:id/convert-to-order', authorize('admin', 'gerente'), budgetController.convertToOrder);
router.delete('/:id', authorize('admin'), budgetController.delete);

export default router;
