import { Request, Response } from 'express';
import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { startOfDay, endOfDay, parseDate } from '../utils/dateRange';

export class DashboardController {
  // GET /api/v1/dashboard
  async index(req: Request, res: Response) {
    const companyId = req.user!.companyId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      totalClients,
      totalSuppliers,
      totalServices,
      totalProducts,
      allProducts,
      totalSalesMonth,
      salesMonthValue,
      ordersByStatus,
      recentOrders,
      recentSales,
      monthlyCashSummary,
      yearlyCashSummary,
      recentExpenses,
      pendingExpenses,
      currentMonthOrders,
      monthlySeries,
      monthSaleItems,
    ] = await Promise.all([
      // Counts (company-scoped)
      prisma.client.count({ where: { companyId, active: true } }),
      prisma.supplier.count({ where: { companyId, active: true } }),
      prisma.service.count({ where: { companyId, active: true } }),
      prisma.product.count({ where: { companyId, active: true } }),
      prisma.product.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, stock: true, minStock: true },
      }),

      // Sales this month (company-scoped)
      prisma.sale.count({
        where: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } },
      }),
      prisma.sale.aggregate({
        where: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } },
        _sum: { totalValue: true },
      }),

      // Orders by status (company-scoped)
      prisma.order.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
      }),

      // Recent orders (company-scoped)
      prisma.order.findMany({
        where: { companyId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),

      // Recent sales (company-scoped)
      prisma.sale.findMany({
        where: { companyId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      }),

      // Monthly cash summary (company-scoped)
      prisma.cashTransaction.aggregate({
        where: { companyId, date: { gte: startOfMonth } },
        _sum: { value: true },
        _count: true,
      }),

      // Yearly cash summary (company-scoped)
      Promise.all([
        prisma.cashTransaction.aggregate({
          where: { companyId, date: { gte: startOfYear }, type: 'entrada' },
          _sum: { value: true },
        }),
        prisma.cashTransaction.aggregate({
          where: { companyId, date: { gte: startOfYear }, type: 'saida' },
          _sum: { value: true },
        }),
      ]),

      // Recent expenses (company-scoped)
      prisma.expense.findMany({
        where: { companyId },
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
        },
      }),

      // Pending expenses count (company-scoped)
      prisma.expense.aggregate({
        where: { companyId, status: { in: ['pendente', 'atrasado'] } },
        _sum: { value: true },
        _count: true,
      }),

      // Current month orders (company-scoped)
      prisma.order.aggregate({
        where: { companyId, createdAt: { gte: startOfMonth } },
        _sum: { totalValue: true },
        _count: true,
      }),

      // 12-month entradas/saídas series (company-scoped)
      prisma.cashTransaction.findMany({
        where: { companyId, date: { gte: twelveMonthsAgo } },
        select: { type: true, value: true, date: true },
      }),

      // Sale items this month → profit (uses the per-sale cost snapshot)
      prisma.saleItem.findMany({
        where: {
          sale: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } },
        },
        select: {
          quantity: true,
          unitValue: true,
          costPrice: true,
          product: { select: { costPrice: true } },
        },
      }),
    ]);

    // Month profit: snapshot cost first, fallback to current costPrice
    let monthRevenue = 0;
    let monthCost = 0;
    monthSaleItems.forEach((item) => {
      const unitCost = item.costPrice ?? item.product.costPrice;
      monthRevenue += item.quantity * item.unitValue;
      if (unitCost != null) monthCost += item.quantity * unitCost;
    });
    const monthProfit = monthRevenue - monthCost;
    const monthMarginPct = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : null;

    // Low stock: computed in-memory (Prisma can't compare two columns)
    const lowStockList = allProducts.filter((p) => p.stock <= p.minStock);

    // Build 12-month series
    const seriesMap = new Map<string, { month: string; entradas: number; saidas: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      seriesMap.set(key, { month: label, entradas: 0, saidas: 0 });
    }
    monthlySeries.forEach((t) => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = seriesMap.get(key);
      if (bucket) {
        if (t.type === 'entrada') bucket.entradas += t.value;
        else bucket.saidas += t.value;
      }
    });

    // Format orders by status
    const ordersStatusMap: Record<string, number> = {};
    ordersByStatus.forEach((item) => {
      ordersStatusMap[item.status] = item._count;
    });

    // Format cash summary
    const [yearlyEntradas, yearlySaidas] = yearlyCashSummary;

    res.json({
      status: 'success',
      data: {
        counts: {
          clients: totalClients,
          suppliers: totalSuppliers,
          services: totalServices,
          products: totalProducts,
        },
        products: {
          lowStock: lowStockList.length,
          lowStockList: lowStockList.slice(0, 5),
        },
        sales: {
          monthCount: totalSalesMonth,
          monthValue: salesMonthValue._sum.totalValue || 0,
          ticket: totalSalesMonth > 0 ? (salesMonthValue._sum.totalValue || 0) / totalSalesMonth : 0,
          // Profit = revenue − cost (per-sale snapshot; items without a
          // known cost contribute 0 cost, so this is a floor, not a guess)
          profit: monthProfit,
          marginPct: monthMarginPct,
          recent: recentSales,
        },
        orders: {
          byStatus: ordersStatusMap,
          recent: recentOrders,
          currentMonth: {
            count: currentMonthOrders._count,
            totalValue: currentMonthOrders._sum.totalValue || 0,
          },
        },
        cash: {
          monthly: {
            total: monthlyCashSummary._sum.value || 0,
            count: monthlyCashSummary._count,
          },
          yearly: {
            entradas: yearlyEntradas._sum.value || 0,
            saidas: yearlySaidas._sum.value || 0,
            saldo: (yearlyEntradas._sum.value || 0) - (yearlySaidas._sum.value || 0),
          },
          series: Array.from(seriesMap.values()),
        },
        expenses: {
          recent: recentExpenses,
          pending: {
            count: pendingExpenses._count,
            total: pendingExpenses._sum.value || 0,
          },
        },
      },
    });
  }

  // GET /api/v1/dashboard/series?startDate=&endDate=
  // Monthly entradas/saídas for a custom range (defaults to last 12 months).
  async series(req: Request, res: Response) {
    const companyId = req.user!.companyId;
    const now = new Date();
    const { startDate = '', endDate = '' } = req.query;

    const start = startDate
      ? startOfDay(parseDate(startDate as string))
      : new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = endDate ? endOfDay(parseDate(endDate as string)) : now;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new AppError('Período inválido', 400);
    }

    // Cap at 36 months back from the end date so a stray request can't
    // build an unbounded chart (start is clamped, end is respected)
    const minFrom = new Date(end.getFullYear(), end.getMonth() - 35, 1);
    const from = start < minFrom ? minFrom : start;

    const transactions = await prisma.cashTransaction.findMany({
      where: { companyId, date: { gte: from, lte: end } },
      select: { type: true, value: true, date: true },
    });

    // One bucket per month, from `from` through `end` (inclusive)
    const buckets = new Map<string, { month: string; entradas: number; saidas: number }>();
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, {
        month: cursor.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        entradas: 0,
        saidas: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    transactions.forEach((t) => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (bucket) {
        if (t.type === 'entrada') bucket.entradas += t.value;
        else bucket.saidas += t.value;
      }
    });

    res.json({ status: 'success', data: Array.from(buckets.values()) });
  }
}

export const dashboardController = new DashboardController();
