import { Request, Response } from 'express';
import prisma from '../config/database';
import { pageParams } from '../utils/pagination';
import { AppError, NotFoundError } from '../utils/errors';
import { dateWhere } from '../utils/dateRange';
import { syncOrderToCash, removeOrderFromCash } from '../services/cashSync';

export class OrderController {
  // GET /api/v1/orders
  async index(req: Request, res: Response) {
    const { page = '1', limit = '10', search = '', status = '', startDate = '', endDate = '' } = req.query;
    const { page: pageNum, limit: limitNum, skip } = pageParams({ page, limit });

    const where: any = { companyId: req.user!.companyId };
    if (status) {
      where.status = status as string;
    }
    Object.assign(where, dateWhere({ startDate, endDate }, 'createdAt'));
    if (search) {
      where.OR = [
        { client: { name: { contains: search as string } } },
        { number: { equals: parseInt(search as string, 10) || 0 } },
        { description: { contains: search as string } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, document: true } },
          user: { select: { id: true, name: true } },
          items: { include: { service: { select: { id: true, name: true } } } },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  // GET /api/v1/orders/:id
  async show(req: Request, res: Response) {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: {
        client: true,
        user: true,
        items: { include: { service: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new NotFoundError('Ordem de Serviço');
    }

    res.json({ status: 'success', data: order });
  }

  // POST /api/v1/orders
  async store(req: Request, res: Response) {
    const { clientId, userId, description, items, priority, notes, startDate, discount } = req.body;

    // Validate client exists
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId: req.user!.companyId },
    });
    if (!client) {
      throw new NotFoundError('Cliente');
    }

    // Get next order number (per company)
    const config = await prisma.companySetting.findUnique({
      where: { companyId_key: { companyId: req.user!.companyId, key: 'next_order_number' } },
    });
    const nextNumber = config ? parseInt(config.value, 10) : 1;

    // Calculate total
    let totalValue = 0;
    const orderItems = items.map((item: any) => {
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
    const orderDiscount = discount || 0;
    if (orderDiscount > totalValue) {
      throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
    }
    totalValue -= orderDiscount;

    const order = await prisma.order.create({
      data: {
        companyId: req.user!.companyId,
        number: nextNumber,
        clientId,
        userId: userId || null,
        description,
        priority: priority || 'normal',
        totalValue,
        discount: orderDiscount,
        startDate: startDate ? new Date(startDate) : new Date(),
        notes,
        items: {
          create: orderItems,
        },
        statusHistory: {
          create: {
            status: 'aberta',
            notes: 'Ordem de serviço criada',
          },
        },
      },
      include: {
        client: true,
        user: true,
        items: { include: { service: true } },
        statusHistory: true,
      },
    });

    // Update next number
    // upsert: legacy companies may lack the counter row
    await prisma.companySetting.upsert({
      where: { companyId_key: { companyId: req.user!.companyId, key: 'next_order_number' } },
      create: { companyId: req.user!.companyId, key: 'next_order_number', value: String(nextNumber + 1) },
      update: { value: String(nextNumber + 1) },
    });

    res.status(201).json({ status: 'success', data: order });
  }

  // PUT /api/v1/orders/:id
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { clientId, userId, description, priority, notes, items, discount } = req.body;

    const order = await prisma.order.findFirst({
      where: { id, companyId: req.user!.companyId },
    });
    if (!order) {
      throw new NotFoundError('Ordem de Serviço');
    }

    const updateData: any = {};
    if (clientId) updateData.clientId = clientId;
    if (userId !== undefined) updateData.userId = userId;
    if (description !== undefined) updateData.description = description;
    if (priority) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;
    if (discount !== undefined) updateData.discount = discount;

    // If items are being updated, recalculate total
    if (items) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } });

      let totalValue = 0;
      const orderItems = items.map((item: any) => {
        const itemTotal = item.quantity * item.unitValue;
        totalValue += itemTotal;
        return {
          orderId: id,
          serviceId: item.serviceId,
          description: item.description,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: itemTotal,
        };
      });

      // Keep the stored discount when the form doesn't resend it, so
      // total stays consistent with what's saved on the order
      const effDiscount = discount !== undefined ? discount : (order.discount || 0);
      if (effDiscount > totalValue) {
        throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
      }
      totalValue -= effDiscount;
      updateData.totalValue = totalValue;

      await prisma.orderItem.createMany({ data: orderItems });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        user: true,
        items: { include: { service: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    // A concluded order already generated its cash entry — keep the value in sync
    if (updatedOrder.status === 'concluida' && (items || discount !== undefined)) {
      await syncOrderToCash({
        id: updatedOrder.id,
        companyId: updatedOrder.companyId,
        number: updatedOrder.number,
        userId: updatedOrder.userId,
        status: updatedOrder.status,
        totalValue: updatedOrder.totalValue,
      });
    }

    res.json({ status: 'success', data: updatedOrder });
  }

  // POST /api/v1/orders/:id/status
  async updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status, notes } = req.body;

    const order = await prisma.order.findFirst({
      where: { id, companyId: req.user!.companyId },
    });
    if (!order) {
      throw new NotFoundError('Ordem de Serviço');
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      aberta: ['em_andamento', 'cancelada'],
      em_andamento: ['concluida', 'cancelada'],
      concluida: [],
      cancelada: ['aberta'],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new AppError(`Transição de status inválida: ${order.status} → ${status}`);
    }

    const updateData: any = { status };
    if (status === 'concluida') {
      updateData.endDate = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        user: true,
        items: { include: { service: true } },
      },
    });

    // Create status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status,
        notes: notes || `Status alterado para ${status}`,
      },
    });

    // Completed order = revenue → centralize it in the Caixa
    await syncOrderToCash({
      id: updatedOrder.id,
      companyId: updatedOrder.companyId,
      number: updatedOrder.number,
      userId: updatedOrder.userId,
      status: updatedOrder.status,
      totalValue: updatedOrder.totalValue,
    });

    res.json({ status: 'success', data: updatedOrder });
  }

  // DELETE /api/v1/orders/:id
  async delete(req: Request, res: Response) {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!order) {
      throw new NotFoundError('Ordem de Serviço');
    }

    await prisma.orderStatusHistory.deleteMany({ where: { orderId: req.params.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: req.params.id } });
    await prisma.order.delete({ where: { id: req.params.id } });

    // A concluded order generated a cash entry — it must not survive its source
    await removeOrderFromCash(String(req.params.id), req.user!.companyId);

    res.json({ status: 'success', message: 'Ordem de serviço removida com sucesso' });
  }
}

export const orderController = new OrderController();
