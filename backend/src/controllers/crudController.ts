import { Request, Response } from 'express';
import { CrudService } from '../services/crudService';
import { attachImages, attachImagesToOne } from '../services/imageService';
import { PrismaClient } from '@prisma/client';

type CrudControllerOptions = {
  modelName: string;
};

// Models that own images (see Image.ownerType). Others (Service, etc.) skip the join.
const IMAGE_OWNER: Record<string, 'client' | 'supplier'> = {
  Client: 'client',
  Supplier: 'supplier',
};

export function createCrudController(prisma: PrismaClient, options: CrudControllerOptions) {
  const service = new CrudService((prisma as any)[options.modelName], {
    modelName: options.modelName,
    searchFields: getSearchFields(options.modelName),
    include: getIncludes(options.modelName),
  });

  const ownerType = IMAGE_OWNER[options.modelName];

  return {
    async index(req: Request, res: Response) {
      const result = await service.index({ ...req.query, companyId: req.user!.companyId } as any);
      const data = ownerType
        ? await attachImages(result.data, ownerType, req.user!.companyId)
        : result.data;
      res.json({ status: 'success', ...result, data });
    },

    async show(req: Request, res: Response) {
      const item = await service.show(req.params.id, req.user!.companyId);
      const data = ownerType
        ? await attachImagesToOne(item, ownerType, req.user!.companyId)
        : item;
      res.json({ status: 'success', data });
    },

    async store(req: Request, res: Response) {
      const { companyId: _ignored, ...body } = req.body;
      const item = await service.store({ ...body, companyId: req.user!.companyId });
      const data = ownerType
        ? await attachImagesToOne(item, ownerType, req.user!.companyId)
        : item;
      res.status(201).json({ status: 'success', data });
    },

    async update(req: Request, res: Response) {
      const { companyId: _ignored, ...body } = req.body;
      const item = await service.update(req.params.id, body, req.user!.companyId);
      const data = ownerType
        ? await attachImagesToOne(item, ownerType, req.user!.companyId)
        : item;
      res.json({ status: 'success', data });
    },

    async delete(req: Request, res: Response) {
      await service.delete(req.params.id, req.user!.companyId);
      res.json({ status: 'success', message: 'Registro removido com sucesso' });
    },

    async softDelete(req: Request, res: Response) {
      const item = await service.softDelete(req.params.id, req.user!.companyId);
      res.json({ status: 'success', data: item, message: 'Registro desativado com sucesso' });
    },
  };
}

function getSearchFields(modelName: string): string[] {
  const fields: Record<string, string[]> = {
    Client: ['name', 'email', 'phone', 'document'],
    Supplier: ['name', 'companyName', 'email', 'phone', 'document'],
    Service: ['name', 'description', 'category'],
  };
  return fields[modelName] || ['name'];
}

function getIncludes(modelName: string): Record<string, boolean> | undefined {
  const includes: Record<string, any> = {
    Budget: { client: true, items: { include: { service: true } } },
    Order: { client: true, user: true, items: { include: { service: true } }, statusHistory: true },
  };
  return includes[modelName];
}
