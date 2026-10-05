import { Router } from 'express';
import { createCrudController } from '../controllers/crudController';
import prisma from '../config/database';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();
const controller = createCrudController(prisma, { modelName: 'Service' });

const createSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  description: z.string().optional().nullable(),
  value: z.number().positive('Valor deve ser positivo'),
  category: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

router.use(authenticate);

router.get('/', controller.index);
router.get('/:id', controller.show);
router.post('/', authorize('admin', 'gerente'), validate(createSchema), controller.store);
router.put('/:id', authorize('admin', 'gerente'), validate(updateSchema), controller.update);
router.delete('/:id', authorize('admin'), controller.softDelete);

export default router;
