import { Router } from 'express';
import { expenseController } from '../controllers/expenseController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();

const createSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  value: z.number().positive('Valor deve ser positivo'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  date: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  paidDate: z.string().optional().nullable(),
  status: z.enum(['pendente', 'pago', 'atrasado']).optional(),
  // Selects send "" for the placeholder option — normalize to null
  paymentMethod: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'transferencia', 'boleto']).optional().nullable()
  ),
  supplierId: z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional()),
  notes: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

router.use(authenticate);

router.get('/summary', expenseController.summary);
router.get('/', expenseController.index);
router.get('/:id', expenseController.show);
router.post('/', authorize('admin', 'gerente'), validate(createSchema), expenseController.store);
router.put('/:id', authorize('admin', 'gerente'), validate(updateSchema), expenseController.update);
router.delete('/:id', authorize('admin'), expenseController.delete);

export default router;
