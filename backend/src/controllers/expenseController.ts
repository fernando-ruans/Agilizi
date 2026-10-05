import { Request, Response } from 'express';
import prisma from '../config/database';
import { pageParams } from '../utils/pagination';
import { NotFoundError } from '../utils/errors';
import { dateWhere } from '../utils/dateRange';
import { syncExpenseToCash, removeExpenseFromCash } from '../services/cashSync';

export class ExpenseController {
  // GET /api/v1/expenses
  async index(req: Request, res: Response) {
    const { page = '1', limit = '10', search = '', category = '', status = '', startDate = '', endDate = '' } = req.query;
    const { page: pageNum, limit: limitNum, skip } = pageParams({ page, limit });

    const where: any = { companyId: req.user!.companyId };
    if (search) {
      where.OR = [
        { description: { contains: search as string } },
        { supplier: { name: { contains: search as string } } },
      ];
    }
    if (category) where.category = category as string;
    if (status) where.status = status as string;
    Object.assign(where, dateWhere({ startDate, endDate }, 'date'));

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        skip,
        take: limitNum,
        orderBy: { date: 'desc' },
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: expenses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  // GET /api/v1/expenses/summary
  async summary(req: Request, res: Response) {
    const { startDate = '', endDate = '' } = req.query;

    const where: any = { companyId: req.user!.companyId };
    Object.assign(where, dateWhere({ startDate, endDate }, 'date'));

    const [totalExpenses, paidExpenses, pendingExpenses, overdueExpenses] = await Promise.all([
      prisma.expense.aggregate({
        where,
        _sum: { value: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { ...where, status: 'pago' },
        _sum: { value: true },
      }),
      prisma.expense.aggregate({
        where: { ...where, status: 'pendente' },
        _sum: { value: true },
      }),
      prisma.expense.aggregate({
        where: { ...where, status: 'atrasado' },
        _sum: { value: true },
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        total: totalExpenses._sum.value || 0,
        count: totalExpenses._count,
        pago: paidExpenses._sum.value || 0,
        pendente: pendingExpenses._sum.value || 0,
        atrasado: overdueExpenses._sum.value || 0,
      },
    });
  }

  // GET /api/v1/expenses/:id
  async show(req: Request, res: Response) {
    const expense = await prisma.expense.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
      include: {
        supplier: true,
        user: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      throw new NotFoundError('Despesa');
    }

    res.json({ status: 'success', data: expense });
  }

  // POST /api/v1/expenses
  async store(req: Request, res: Response) {
    const { description, value, category, date, dueDate, paidDate, status, paymentMethod, supplierId, notes } = req.body;

    const expense = await prisma.expense.create({
      data: {
        companyId: req.user!.companyId,
        description,
        value,
        category,
        date: date ? new Date(date) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        paidDate: paidDate ? new Date(paidDate) : null,
        status: status || 'pendente',
        paymentMethod: paymentMethod || null,
        supplierId: supplierId || null,
        userId: req.user?.userId,
        notes,
      },
      include: {
        supplier: true,
        user: { select: { id: true, name: true } },
      },
    });

    // Paid on creation → money already left the register
    await syncExpenseToCash(expense);

    res.status(201).json({ status: 'success', data: expense });
  }

  // PUT /api/v1/expenses/:id
  async update(req: Request, res: Response) {
    const id = String(req.params.id);
    const { description, value, category, date, dueDate, paidDate, status, paymentMethod, supplierId, notes } = req.body;

    const expense = await prisma.expense.findFirst({
      where: { id, companyId: req.user!.companyId },
    });
    if (!expense) {
      throw new NotFoundError('Despesa');
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        description,
        value,
        category,
        date: date ? new Date(date) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        paidDate: paidDate ? new Date(paidDate) : undefined,
        status,
        // The form sends "" for "no supplier"/"not informed" — an empty
        // string would violate the FK / enum and crash with a 500
        supplierId: supplierId || null,
        paymentMethod: paymentMethod === undefined ? undefined : paymentMethod || null,
        notes,
      },
      include: {
        supplier: true,
        user: { select: { id: true, name: true } },
      },
    });

    // Create/update/remove the cash entry as the payment status changes
    await syncExpenseToCash(updated);

    res.json({ status: 'success', data: updated });
  }

  // DELETE /api/v1/expenses/:id
  async delete(req: Request, res: Response) {
    const expense = await prisma.expense.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId },
    });
    if (!expense) {
      throw new NotFoundError('Despesa');
    }

    await prisma.expense.delete({ where: { id: String(req.params.id) } });

    // The auto-generated cash entry must not survive its source
    await removeExpenseFromCash(String(req.params.id), req.user!.companyId);

    res.json({ status: 'success', message: 'Despesa removida com sucesso' });
  }
}

export const expenseController = new ExpenseController();
