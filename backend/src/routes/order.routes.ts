import { Router } from 'express';
import { orderController } from '../controllers/orderController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();

const orderItemSchema = z.object({
  serviceId: z.string().min(1, 'Serviço é obrigatório'),
  description: z.string().optional().nullable(),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  unitValue: z.number().positive('Valor unitário deve ser positivo'),
});

const createSchema = z.object({
  clientId: z.string().min(1, 'Cliente é obrigatório'),
  userId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'Pelo menos um item é obrigatório'),
  priority: z.enum(['baixa', 'normal', 'alta', 'urgente']).optional(),
  notes: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  discount: z.number().min(0).optional(),
});

const updateSchema = z.object({
  clientId: z.string().optional(),
  userId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  priority: z.enum(['baixa', 'normal', 'alta', 'urgente']).optional(),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).optional(),
  discount: z.number().min(0).optional(),
});

const statusSchema = z.object({
  status: z.enum(['aberta', 'em_andamento', 'concluida', 'cancelada']),
  notes: z.string().optional(),
});

router.use(authenticate);

router.get('/', orderController.index);
router.get('/:id', orderController.show);
router.post('/', authorize('admin', 'gerente', 'operacional'), validate(createSchema), orderController.store);
router.put('/:id', authorize('admin', 'gerente', 'operacional'), validate(updateSchema), orderController.update);
router.post('/:id/status', authorize('admin', 'gerente', 'operacional'), validate(statusSchema), orderController.updateStatus);
router.delete('/:id', authorize('admin'), orderController.delete);

export default router;
