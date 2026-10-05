import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['admin', 'gerente', 'operacional']).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'gerente', 'operacional']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// List is also visible to gerente (e.g. technician picker on OS) —
// management stays admin-only
router.use(authenticate);

router.get('/', authorize('admin', 'gerente'), userController.index);
router.get('/:id', authorize('admin'), userController.show);
router.post('/', authorize('admin'), validate(createUserSchema), userController.store);
router.put('/:id', authorize('admin'), validate(updateUserSchema), userController.update);
router.delete('/:id', authorize('admin'), userController.delete);

export default router;
