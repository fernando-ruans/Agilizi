import { Request, Response } from 'express';
import prisma from '../config/database';
import { pageParams } from '../utils/pagination';
import { AppError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { dateWhere } from '../utils/dateRange';

export class SaleController {
  // GET /api/v1/sales
  async index(req: Request, res: Response) {
    const { page = '1', limit = '10', search = '', status = '', startDate = '', endDate = '' } = req.query;
    const { page: pageNum, limit: limitNum, skip } = pageParams({ page, limit });

    const where: any = { companyId: req.user!.companyId };
    if (status) where.status = status as string;
    Object.assign(where, dateWhere({ startDate, endDate }, 'createdAt'));
    if (search) {
      where.OR = [
        { client: { name: { contains: search as string } } },
        { number: { equals: parseInt(search as string, 10) || 0 } },
      ];
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: sales,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  }

  // GET /api/v1/sales/summary
  async summary(req: Request, res: Response) {
    const where = { companyId: req.user!.companyId, status: 'concluida' };
    const [agg, count] = await Promise.all([
      prisma.sale.aggregate({ where, _sum: { totalValue: true } }),
      prisma.sale.count({ where }),
    ]);
    const total = agg._sum.totalValue || 0;
    res.json({
      status: 'success',
      data: { total, count, ticket: count > 0 ? total / count : 0 },
    });
  }

  // GET /api/v1/sales/:id
  async show(req: Request, res: Response) {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: {
        client: true,
        user: { select: { id: true, name: true } },
        items: { include: { product: true } },
      },
    });
    if (!sale) throw new NotFoundError('Venda');
    res.json({ status: 'success', data: sale });
  }

  // POST /api/v1/sales — creates sale AND deducts stock atomically
  async store(req: Request, res: Response) {
    const { clientId, items, discount, paymentMethod, notes } = req.body;

    if (!items || items.length === 0) {
      throw new AppError('A venda deve ter pelo menos um item', 400);
    }

    const companyId = req.user!.companyId;

    try {
      const sale = await prisma.$transaction(async (tx) => {
        // Increment counter INSIDE the transaction so it rolls back on failure
        const setting = await tx.companySetting.findUnique({
          where: { companyId_key: { companyId, key: 'next_sale_number' } },
        });
        const saleNumber = setting ? parseInt(setting.value, 10) : 1;
        // upsert: legacy companies may lack the counter row
        await tx.companySetting.upsert({
          where: { companyId_key: { companyId, key: 'next_sale_number' } },
          create: { companyId, key: 'next_sale_number', value: String(saleNumber + 1) },
          update: { value: String(saleNumber + 1) },
        });

        let totalValue = 0;

        // Validate stock and calculate totals first
        for (const item of items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, companyId },
          });
          if (!product) throw new NotFoundError('Produto');
          if (product.stock < item.quantity) {
            throw new AppError(
              `Estoque insuficiente para "${product.name}" (disponível: ${product.stock})`,
              400
            );
          }
          totalValue += item.quantity * item.unitValue;
        }
        const saleDiscount = discount || 0;
        if (saleDiscount > totalValue) {
          throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
        }
        totalValue -= saleDiscount;

        // Create sale
        const sale = await tx.sale.create({
          data: {
            companyId,
            number: saleNumber,
            clientId: clientId || null,
            userId: req.user!.userId,
            totalValue,
            discount: saleDiscount,
            paymentMethod: paymentMethod || null,
            notes: notes || null,
          },
        });

        // Create items + deduct stock
        for (const item of items) {
          const soldProduct = await tx.product.findFirst({
            where: { id: item.productId, companyId },
            select: { costPrice: true },
          });
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              quantity: item.quantity,
              unitValue: item.unitValue,
              totalValue: item.quantity * item.unitValue,
              // Snapshot: later costPrice changes must not rewrite history
              costPrice: soldProduct?.costPrice ?? null,
            },
          });

          const product = await tx.product.findUnique({ where: { id: item.productId } });
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: product!.stock - item.quantity },
          });
        }

        // Create cash-in transaction
        await tx.cashTransaction.create({
          data: {
            companyId,
            type: 'entrada',
            category: 'venda',
            description: `Venda #${String(saleNumber).padStart(4, '0')}`,
            value: totalValue,
            paymentMethod: paymentMethod || null,
            reference: `sale:${sale.id}`,
            userId: req.user!.userId,
          },
        });

        return sale;
      });

      const full = await prisma.sale.findUnique({
        where: { id: sale.id },
        include: {
          client: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      });

      logger.info(`Sale #${sale.number} created by user ${req.user!.userId}`);
      res.status(201).json({ status: 'success', data: full });
    } catch (err: any) {
      if (err instanceof AppError || err instanceof NotFoundError) throw err;
      throw new AppError('Erro ao criar venda', 500);
    }
  }

  // POST /api/v1/sales/:id/cancel — cancel sale and restore stock
  async cancel(req: Request, res: Response) {
    const companyId = req.user!.companyId;
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, companyId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundError('Venda');
    if (sale.status === 'cancelada') throw new AppError('Venda já cancelada', 400);

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'cancelada' },
      });

      // Restore stock
      for (const item of sale.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: product.stock + item.quantity },
          });
        }
      }

      // Remove the cash-in transaction
      await tx.cashTransaction.deleteMany({
        where: { companyId, reference: `sale:${sale.id}` },
      });
    });

    logger.info(`Sale ${sale.id} cancelled`);
    res.json({ status: 'success', message: 'Venda cancelada e estoque restaurado' });
  }
}

export const saleController = new SaleController();
