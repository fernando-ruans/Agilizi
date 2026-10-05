import { Request, Response } from 'express';
import prisma from '../config/database';
import { pageParams } from '../utils/pagination';
import { NotFoundError } from '../utils/errors';
import { dateWhere } from '../utils/dateRange';

export class CashController {
  // GET /api/v1/cash
  async index(req: Request, res: Response) {
    const { page = '1', limit = '10', type = '', category = '', startDate = '', endDate = '', search = '', paymentMethod = '' } = req.query;
    const { page: pageNum, limit: limitNum, skip } = pageParams({ page, limit });

    const where: any = { companyId: req.user!.companyId };
    if (type) where.type = type as string;
    if (category) where.category = category as string;
    if (paymentMethod) where.paymentMethod = paymentMethod as string;
    if (search) {
      where.OR = [
        { description: { contains: search as string } },
        { reference: { contains: search as string } },
      ];
    }
    Object.assign(where, dateWhere({ startDate, endDate }, 'date'));

    const [transactions, total] = await Promise.all([
      prisma.cashTransaction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
        },
        skip,
        take: limitNum,
        orderBy: { date: 'desc' },
      }),
      prisma.cashTransaction.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  // GET /api/v1/cash/summary
  async summary(req: Request, res: Response) {
    const { startDate = '', endDate = '' } = req.query;

    const where: any = { companyId: req.user!.companyId };
    Object.assign(where, dateWhere({ startDate, endDate }, 'date'));

    const [entradas, saidas, totalEntradas, totalSaidas] = await Promise.all([
      prisma.cashTransaction.aggregate({
        where: { ...where, type: 'entrada' },
        _sum: { value: true },
      }),
      prisma.cashTransaction.aggregate({
        where: { ...where, type: 'saida' },
        _sum: { value: true },
      }),
      prisma.cashTransaction.count({
        where: { ...where, type: 'entrada' },
      }),
      prisma.cashTransaction.count({
        where: { ...where, type: 'saida' },
      }),
    ]);

    const totalEntradasValue = entradas._sum.value || 0;
    const totalSaidasValue = saidas._sum.value || 0;
    const saldo = totalEntradasValue - totalSaidasValue;

    res.json({
      status: 'success',
      data: {
        totalEntradas: totalEntradasValue,
        totalSaidas: totalSaidasValue,
        saldo,
        countEntradas: totalEntradas,
        countSaidas: totalSaidas,
      },
    });
  }

  // GET /api/v1/cash/:id
  async show(req: Request, res: Response) {
    const transaction = await prisma.cashTransaction.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transação');
    }

    res.json({ status: 'success', data: transaction });
  }

  // POST /api/v1/cash
  async store(req: Request, res: Response) {
    const { type, category, description, value, date, paymentMethod, reference } = req.body;

    const transaction = await prisma.cashTransaction.create({
      data: {
        companyId: req.user!.companyId,
        type,
        category,
        description,
        value,
        date: date ? new Date(date) : new Date(),
        paymentMethod,
        reference,
        userId: req.user?.userId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ status: 'success', data: transaction });
  }

  // PUT /api/v1/cash/:id
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { type, category, description, value, date, paymentMethod, reference } = req.body;

    const transaction = await prisma.cashTransaction.findFirst({
      where: { id, companyId: req.user!.companyId },
    });
    if (!transaction) {
      throw new NotFoundError('Transação');
    }

    const updated = await prisma.cashTransaction.update({
      where: { id },
      data: {
        type,
        category,
        description,
        value,
        date: date ? new Date(date) : undefined,
        paymentMethod,
        reference,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    res.json({ status: 'success', data: updated });
  }

  // DELETE /api/v1/cash/:id
  async delete(req: Request, res: Response) {
    const transaction = await prisma.cashTransaction.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!transaction) {
      throw new NotFoundError('Transação');
    }

    await prisma.cashTransaction.delete({ where: { id: req.params.id } });

    res.json({ status: 'success', message: 'Transação removida com sucesso' });
  }
}

export const cashController = new CashController();
