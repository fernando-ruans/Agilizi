import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors';
import { pageParams } from '../utils/pagination';

type PrismaModel = {
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any>;
  findFirst: (args: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

interface CrudOptions {
  modelName: string;
  searchFields?: string[];
  include?: Record<string, boolean>;
  orderBy?: Record<string, string>;
}

export class CrudService {
  private model: PrismaModel;
  private options: CrudOptions;

  constructor(model: PrismaModel, options: CrudOptions) {
    this.model = model;
    this.options = options;
  }

  async index(query: {
    page?: string;
    limit?: string;
    search?: string;
    [key: string]: any;
  }) {
    const { page, limit, skip } = pageParams(query);
    const { search, page: _p, limit: _l, ...filters } = query;

    const where: any = {};

    // Always filter by companyId if present
    if (filters.companyId) {
      where.companyId = filters.companyId;
      delete filters.companyId;
    }

    // Search
    if (search && this.options.searchFields && this.options.searchFields.length > 0) {
      where.OR = this.options.searchFields.map((field) => ({
        [field]: { contains: search },
      }));
    }

    // Additional filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        where[key] = value;
      }
    });

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.options.orderBy || { createdAt: 'desc' },
        include: this.options.include,
      }),
      this.model.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async show(id: string, companyId?: string) {
    const item = await this.model.findFirst({
      where: { id, ...(companyId && { companyId }) },
      include: this.options.include,
    });

    if (!item) {
      throw new NotFoundError(this.options.modelName);
    }

    return item;
  }

  async store(data: any) {
    return this.model.create({
      data,
      include: this.options.include,
    });
  }

  async update(id: string, data: any, companyId?: string) {
    const existing = await this.model.findFirst({
      where: { id, ...(companyId && { companyId }) },
    });
    if (!existing) {
      throw new NotFoundError(this.options.modelName);
    }

    return this.model.update({
      where: { id },
      data,
      include: this.options.include,
    });
  }

  async delete(id: string, companyId?: string) {
    const existing = await this.model.findFirst({
      where: { id, ...(companyId && { companyId }) },
    });
    if (!existing) {
      throw new NotFoundError(this.options.modelName);
    }

    await this.model.delete({ where: { id } });
  }

  async softDelete(id: string, companyId?: string) {
    const existing = await this.model.findFirst({
      where: { id, ...(companyId && { companyId }) },
    });
    if (!existing) {
      throw new NotFoundError(this.options.modelName);
    }

    return this.model.update({
      where: { id },
      data: { active: false },
    });
  }
}
