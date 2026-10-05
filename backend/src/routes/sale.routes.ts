import { Router } from 'express';
import { saleController } from '../controllers/saleController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();

const itemSchema = z.object({
  productId: z.string().min(1, 'Produto é obrigatório'),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  unitValue: z.number().positive('Valor unitário deve ser positivo'),
});

const createSchema = z.object({
  clientId: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'A venda deve ter pelo menos um item'),
  discount: z.number().min(0).optional(),
  paymentMethod: z.enum(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'boleto']).optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.use(authenticate);

// Summary BEFORE /:id to avoid route conflict
router.get('/summary', saleController.summary);
router.get('/', saleController.index);
router.get('/:id', saleController.show);
router.post('/', authorize('admin', 'gerente', 'operacional'), validate(createSchema), saleController.store);
router.post('/:id/cancel', authorize('admin', 'gerente'), saleController.cancel);

export default router;
