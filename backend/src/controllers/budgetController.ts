import { Request, Response } from 'express';
import prisma from '../config/database';
import { pageParams } from '../utils/pagination';
import { AppError, NotFoundError } from '../utils/errors';
import { dateWhere } from '../utils/dateRange';

export class BudgetController {
  // GET /api/v1/budgets
  async index(req: Request, res: Response) {
    const { page = '1', limit = '10', search = '', status = '', startDate = '', endDate = '' } = req.query;
    const { page: pageNum, limit: limitNum, skip } = pageParams({ page, limit });

    const where: any = { companyId: req.user!.companyId };
    if (status) {
      where.status = status as string;
    }
    if (search) {
      where.OR = [
        { client: { name: { contains: search as string } } },
        { number: { equals: parseInt(search as string, 10) || 0 } },
      ];
    }
    Object.assign(where, dateWhere({ startDate, endDate }, 'createdAt'));

    const [budgets, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, document: true } },
          items: { include: { service: { select: { id: true, name: true } } } },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.budget.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: budgets,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  // GET /api/v1/budgets/:id
  async show(req: Request, res: Response) {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: {
        client: true,
        items: { include: { service: true } },
      },
    });

    if (!budget) {
      throw new NotFoundError('Orçamento');
    }

    res.json({ status: 'success', data: budget });
  }

  // POST /api/v1/budgets
  async store(req: Request, res: Response) {
    const { clientId, items, notes, validUntil, discount } = req.body;

    // Validate client exists
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId: req.user!.companyId },
    });
    if (!client) {
      throw new NotFoundError('Cliente');
    }

    // Get next budget number (per company)
    const config = await prisma.companySetting.findUnique({
      where: { companyId_key: { companyId: req.user!.companyId, key: 'next_budget_number' } },
    });
    const nextNumber = config ? parseInt(config.value, 10) : 1;

    // Calculate total
    let totalValue = 0;
    const budgetItems = items.map((item: any) => {
      const itemTotal = item.quantity * item.unitValue;
      totalValue += itemTotal;
      return {
        serviceId: item.serviceId,
        description: item.description,
        quantity: item.quantity,
        unitValue: item.unitValue,
        totalValue: itemTotal,
      };
    });

    const budgetDiscount = discount || 0;
    if (budgetDiscount > totalValue) {
      throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
    }
    totalValue -= budgetDiscount;

    const budget = await prisma.budget.create({
      data: {
        companyId: req.user!.companyId,
        number: nextNumber,
        clientId,
        totalValue,
        discount: budgetDiscount,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        items: {
          create: budgetItems,
        },
      },
      include: {
        client: true,
        items: { include: { service: true } },
      },
    });

    // Update next number
    // upsert: legacy companies may lack the counter row
    await prisma.companySetting.upsert({
      where: { companyId_key: { companyId: req.user!.companyId, key: 'next_budget_number' } },
      create: { companyId: req.user!.companyId, key: 'next_budget_number', value: String(nextNumber + 1) },
      update: { value: String(nextNumber + 1) },
    });

    res.status(201).json({ status: 'success', data: budget });
  }

  // PUT /api/v1/budgets/:id
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { clientId, items, notes, validUntil, discount, status } = req.body;

    const budget = await prisma.budget.findFirst({
      where: { id, companyId: req.user!.companyId },
    });
    if (!budget) {
      throw new NotFoundError('Orçamento');
    }

    // Can't edit approved or converted budgets
    if (['aprovado', 'convertido'].includes(budget.status) && status !== budget.status) {
      throw new AppError('Não é possível alterar um orçamento aprovado ou convertido');
    }

    const updateData: any = {};
    if (clientId) updateData.clientId = clientId;
    if (notes !== undefined) updateData.notes = notes;
    if (validUntil) updateData.validUntil = new Date(validUntil);
    if (discount !== undefined) updateData.discount = discount;
    if (status) updateData.status = status;

    // If items are being updated, recalculate total
    if (items) {
      // Remove old items
      await prisma.budgetItem.deleteMany({ where: { budgetId: id } });

      let totalValue = 0;
      const budgetItems = items.map((item: any) => {
        const itemTotal = item.quantity * item.unitValue;
        totalValue += itemTotal;
        return {
          budgetId: id,
          serviceId: item.serviceId,
          description: item.description,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: itemTotal,
        };
      });

      // Keep the stored discount when the form doesn't resend it, so
      // total stays consistent with what's saved on the budget
      const effDiscount = discount !== undefined ? discount : (budget.discount || 0);
      if (effDiscount > totalValue) {
        throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
      }
      totalValue -= effDiscount;
      updateData.totalValue = totalValue;

      await prisma.budgetItem.createMany({ data: budgetItems });
    }

    const updatedBudget = await prisma.budget.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        items: { include: { service: true } },
      },
    });

    res.json({ status: 'success', data: updatedBudget });
  }

  // POST /api/v1/budgets/:id/convert-to-order
  async convertToOrder(req: Request, res: Response) {
    const { id } = req.params;

    const budget = await prisma.budget.findFirst({
      where: { id, companyId: req.user!.companyId },
      include: { items: true },
    });

    if (!budget) {
      throw new NotFoundError('Orçamento');
    }

    if (budget.status !== 'aprovado') {
      throw new AppError('Apenas orçamentos aprovados podem ser convertidos em OS');
    }

    // Get next order number (per company)
    const config = await prisma.companySetting.findUnique({
      where: { companyId_key: { companyId: req.user!.companyId, key: 'next_order_number' } },
    });
    const nextNumber = config ? parseInt(config.value, 10) : 1;

    // Create order from budget atomically: the conditional status flip
    // makes a double-click / retry convert only once (second attempt
    // sees count 0 and gets a 409 instead of a duplicated OS)
    const order = await prisma.$transaction(async (tx) => {
      const flipped = await tx.budget.updateMany({
        where: { id, companyId: req.user!.companyId, status: 'aprovado' },
        data: { status: 'convertido' },
      });
      if (flipped.count === 0) {
        throw new AppError('Orçamento já convertido ou não aprovado', 409);
      }

      const created = await tx.order.create({
        data: {
          companyId: req.user!.companyId,
          number: nextNumber,
          clientId: budget.clientId,
          description: `Convertido do orçamento #${budget.number}`,
          totalValue: budget.totalValue,
          discount: budget.discount,
          items: {
            create: budget.items.map((item) => ({
              serviceId: item.serviceId,
              description: item.description,
              quantity: item.quantity,
              unitValue: item.unitValue,
              totalValue: item.totalValue,
            })),
          },
          statusHistory: {
            create: {
              status: 'aberta',
              notes: `Orçamento #${budget.number} convertido em OS`,
            },
          },
        },
        include: {
          client: true,
          items: { include: { service: true } },
          statusHistory: true,
        },
      });

      // upsert: legacy companies may lack the counter row
      await tx.companySetting.upsert({
        where: { companyId_key: { companyId: req.user!.companyId, key: 'next_order_number' } },
        create: { companyId: req.user!.companyId, key: 'next_order_number', value: String(nextNumber + 1) },
        update: { value: String(nextNumber + 1) },
      });

      return created;
    });

    res.status(201).json({ status: 'success', data: order });
  }

  // DELETE /api/v1/budgets/:id
  async delete(req: Request, res: Response) {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!budget) {
      throw new NotFoundError('Orçamento');
    }

    await prisma.budgetItem.deleteMany({ where: { budgetId: req.params.id } });
    await prisma.budget.delete({ where: { id: req.params.id } });

    res.json({ status: 'success', message: 'Orçamento removido com sucesso' });
  }
}

export const budgetController = new BudgetController();
