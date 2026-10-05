import { Request, Response } from 'express';
import prisma from '../config/database';
import { dateWhere } from '../utils/dateRange';

interface MarginRow {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  missingCost: boolean;
}

export class ReportController {
  // GET /api/v1/reports/margin?startDate=&endDate=
  // Profitability of concluded sales in a period (products/loja only —
  // services have no costPrice, so their margin would be meaningless).
  async margin(req: Request, res: Response) {
    const companyId = req.user!.companyId;
    const { startDate = '', endDate = '' } = req.query;

    const saleWhere: any = { companyId, status: 'concluida' };
    Object.assign(saleWhere, dateWhere({ startDate, endDate }, 'createdAt'));

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      select: { id: true },
    });

    const items = await prisma.saleItem.findMany({
      where: { saleId: { in: sales.map((s) => s.id) } },
      select: {
        saleId: true,
        quantity: true,
        unitValue: true,
        costPrice: true,
        product: { select: { id: true, name: true, costPrice: true } },
      },
    });

    let revenue = 0;
    let cost = 0;
    let missingCostCount = 0;
    const byProduct = new Map<string, MarginRow>();

    for (const item of items) {
      const itemRevenue = item.quantity * item.unitValue;
      // Snapshot first; older sales (before the snapshot existed) fall back
      // to the product's current cost.
      const unitCost = item.costPrice ?? item.product.costPrice;
      const missing = unitCost == null;
      const itemCost = missing ? 0 : item.quantity * unitCost;

      revenue += itemRevenue;
      cost += itemCost;
      if (missing) missingCostCount += item.quantity;

      const row = byProduct.get(item.product.id) || {
        productId: item.product.id,
        name: item.product.name,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPct: null,
        missingCost: false,
      };
      row.quantity += item.quantity;
      row.revenue += itemRevenue;
      row.cost += itemCost;
      row.profit += itemRevenue - itemCost;
      row.missingCost = row.missingCost || missing;
      byProduct.set(item.product.id, row);
    }

    const profit = revenue - cost;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;

    const products = Array.from(byProduct.values())
      .map((row) => ({
        ...row,
        marginPct: row.revenue > 0 && !row.missingCost ? (row.profit / row.revenue) * 100 : null,
      }))
      .sort((a, b) => b.profit - a.profit);

    res.json({
      status: 'success',
      data: {
        revenue,
        cost,
        profit,
        marginPct,
        salesCount: new Set(items.map((i) => i.saleId)).size,
        products,
        missingCostCount,
      },
    });
  }
}

export const reportController = new ReportController();
