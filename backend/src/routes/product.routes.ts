import { Router } from 'express';
import { productController } from '../controllers/productController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional().nullable(),
  price: z.number().positive('Preço deve ser positivo'),
  costPrice: z.number().min(0).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  barcode: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unit: z.string().optional(),
});

const updateSchema = createSchema.extend({
  active: z.boolean().optional(),
}).partial();

router.use(authenticate);

// Summary BEFORE /:id to avoid route conflict
router.get('/summary', productController.summary);
router.get('/', productController.index);
router.get('/:id', productController.show);
router.post('/', authorize('admin', 'gerente', 'operacional'), validate(createSchema), productController.store);
router.put('/:id', authorize('admin', 'gerente', 'operacional'), validate(updateSchema), productController.update);
router.delete('/:id', authorize('admin', 'gerente'), productController.delete);

export default router;
