import { Request, Response } from 'express';
import prisma from '../config/database';
import { AppError, NotFoundError, ForbiddenError } from '../utils/errors';
import { processImage, removeImageFile } from '../utils/imageProcessor';

const OWNER_TYPES = ['product', 'client', 'supplier', 'company', 'user'] as const;
type OwnerType = (typeof OWNER_TYPES)[number];

/**
 * Ensures the target entity exists AND belongs to the caller's company.
 * This is the multi-tenancy gate for uploads: without it, any logged-in
 * user could attach files to another company's records.
 */
async function assertOwnerExists(ownerType: OwnerType, ownerId: string, companyId: string) {
  if (ownerType === 'company') {
    if (ownerId !== companyId) throw new NotFoundError('Empresa');
    return;
  }

  if (ownerType === 'user') {
    // Users live under the company, but only admins may touch another
    // user's photo — everyone else is limited to their own.
    const owner = await prisma.user.findFirst({ where: { id: ownerId, companyId } });
    if (!owner) throw new NotFoundError('Registro');
    return;
  }

  let entity: { id: string } | null;
  switch (ownerType) {
    case 'product':
      entity = await prisma.product.findFirst({ where: { id: ownerId, companyId } });
      break;
    case 'client':
      entity = await prisma.client.findFirst({ where: { id: ownerId, companyId } });
      break;
    default:
      entity = await prisma.supplier.findFirst({ where: { id: ownerId, companyId } });
  }
  if (!entity) throw new NotFoundError('Registro');
}

/** Keeps user.avatar pointing at the first image (or null when none left). */
async function syncUserAvatar(userId: string, companyId: string) {
  const first = await prisma.image.findFirst({
    where: { companyId, ownerType: 'user', ownerId: userId },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  await prisma.user.update({
    where: { id: userId },
    data: { avatar: first?.url ?? null },
  });
}

/** Non-admins may only upload/remove their own photo. */
function assertAvatarPermission(ownerType: OwnerType, ownerId: string, req: Request) {
  if (ownerType !== 'user') return;
  if (req.user!.role !== 'admin' && ownerId !== req.user!.userId) {
    throw new ForbiddenError('Você só pode alterar a sua própria foto');
  }
}

/** Keeps company.logo pointing at the first image (or null when none left). */
async function syncCompanyLogo(companyId: string) {
  const first = await prisma.image.findFirst({
    where: { companyId, ownerType: 'company' },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  await prisma.company.update({
    where: { id: companyId },
    data: { logo: first?.url ?? null },
  });
}

export class UploadController {
  // GET /api/v1/uploads?entityType=&entityId=
  async index(req: Request, res: Response) {
    const ownerType = req.query.entityType as OwnerType;
    const ownerId = req.query.entityId as string;

    if (!OWNER_TYPES.includes(ownerType) || !ownerId) {
      throw new AppError('Parâmetros entityType e entityId são obrigatórios', 400);
    }
    await assertOwnerExists(ownerType, ownerId, req.user!.companyId);

    const images = await prisma.image.findMany({
      where: { companyId: req.user!.companyId, ownerType, ownerId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    res.json({ status: 'success', data: images });
  }

  // POST /api/v1/uploads  (multipart: file + entityType + entityId)
  async store(req: Request, res: Response) {
    if (!req.file) throw new AppError('Nenhuma imagem enviada', 400);

    const ownerType = (req.body.entityType || '') as OwnerType;
    const ownerId = req.body.entityId as string;

    if (!OWNER_TYPES.includes(ownerType)) {
      throw new AppError('entityType inválido (use product, client, supplier, company ou user)', 400);
    }
    if (!ownerId) throw new AppError('entityId é obrigatório', 400);
    assertAvatarPermission(ownerType, ownerId, req);

    const companyId = req.user!.companyId;
    await assertOwnerExists(ownerType, ownerId, companyId);

    const processed = await processImage(req.file.buffer, companyId, req.file.mimetype);

    const image = await prisma.image.create({
      data: {
        companyId,
        ownerType,
        ownerId,
        url: processed.url,
        fileName: req.file.originalname || null,
        mimeType: 'image/webp',
        size: processed.size,
      },
    });

    if (ownerType === 'company') await syncCompanyLogo(companyId);
    if (ownerType === 'user') await syncUserAvatar(ownerId, companyId);

    res.status(201).json({ status: 'success', data: image });
  }

  // DELETE /api/v1/uploads/:id
  async delete(req: Request, res: Response) {
    const image = await prisma.image.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!image) throw new NotFoundError('Imagem');
    assertAvatarPermission(image.ownerType as OwnerType, image.ownerId, req);

    await removeImageFile(image.url);
    await prisma.image.delete({ where: { id: image.id } });

    if (image.ownerType === 'company') await syncCompanyLogo(req.user!.companyId);
    if (image.ownerType === 'user') await syncUserAvatar(image.ownerId, req.user!.companyId);

    res.json({ status: 'success', message: 'Imagem removida com sucesso' });
  }
}

export const uploadController = new UploadController();
