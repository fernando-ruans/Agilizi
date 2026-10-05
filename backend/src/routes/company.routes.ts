import { Router } from 'express';
import prisma from '../config/database';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const router = Router();

// Company profile: only valid, bounded data may enter — the form must not
// accept "anything" (see limits below; empty string = cleared field).
const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

const digitsOnly = (v: string) => v.replace(/\D/g, '');

const updateSchema = z.object({
  name: z.string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(120, 'Nome pode ter no máximo 120 caracteres'),
  tradeName: z.preprocess(emptyToNull, z.string().trim().max(120, 'Nome fantasia pode ter no máximo 120 caracteres').nullable()),
  document: z.preprocess(
    emptyToNull,
    z.string().trim()
      .max(18, 'CNPJ inválido')
      .refine((v) => digitsOnly(v).length === 14, 'CNPJ deve ter 14 dígitos')
      .nullable()
  ),
  phone: z.preprocess(
    emptyToNull,
    z.string().trim()
      .max(20, 'Telefone pode ter no máximo 20 caracteres')
      .refine((v) => digitsOnly(v).length >= 8 && digitsOnly(v).length <= 11, 'Telefone deve ter entre 8 e 11 dígitos')
      .nullable()
  ),
  email: z.preprocess(
    emptyToNull,
    z.string().trim().email('Email inválido').max(150, 'Email pode ter no máximo 150 caracteres').nullable()
  ),
  address: z.preprocess(emptyToNull, z.string().trim().max(200, 'Endereço pode ter no máximo 200 caracteres').nullable()),
  city: z.preprocess(emptyToNull, z.string().trim().max(100, 'Cidade pode ter no máximo 100 caracteres').nullable()),
  state: z.preprocess(
    emptyToNull,
    z.string().trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z]{2}$/.test(v), 'Estado deve ser a UF (2 letras)')
      .nullable()
  ),
  zipCode: z.preprocess(
    emptyToNull,
    z.string().trim()
      .max(9, 'CEP inválido')
      .refine((v) => digitsOnly(v).length === 8, 'CEP deve ter 8 dígitos')
      .nullable()
  ),
  type: z.enum(['loja', 'prestador', 'ambos']).optional(),
  logo: z.string().max(2000, 'Logo inválida').nullable().optional(),
});

// GET /api/v1/companies/mine - Get current user's company
router.get('/mine', authenticate, async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.user!.companyId },
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      type: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      logo: true,
      active: true,
      createdAt: true,
    },
  });

  if (!company) {
    throw new AppError('Empresa não encontrada', 404);
  }

  res.json({ status: 'success', data: company });
});

// PUT /api/v1/companies/mine - Update current user's company
router.put('/mine', authenticate, validate(updateSchema), async (req, res) => {
  const { name, tradeName, document, phone, email, address, city, state, zipCode, logo, type } = req.body;

  const company = await prisma.company.update({
    where: { id: req.user!.companyId },
    data: {
      ...(name && { name }),
      ...(tradeName !== undefined && { tradeName }),
      ...(document !== undefined && { document }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(zipCode !== undefined && { zipCode }),
      ...(logo !== undefined && { logo }),
      ...(type !== undefined && { type }),
    },
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      type: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      logo: true,
    },
  });

  res.json({ status: 'success', data: company });
});

// GET /api/v1/companies/users - List users in current company
router.get('/users', authenticate, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { companyId: req.user!.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ status: 'success', data: users });
});

export default router;
