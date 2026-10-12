/**
 * Contexto total da sessão, montado no servidor: o cliente informa só a
 * rota atual e o registro em tela; todos os dados vêm do Prisma já
 * escopados por companyId. Nada aqui confia em input do navegador.
 */
import prisma from '../../config/database';
import { ChatTurn } from './provider';

export interface PageContext {
  route: string;
  recordId?: string;
}

const money = (v: number) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NL = String.fromCharCode(10);

export async function buildCompanySnapshot(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return 'Empresa não encontrada.';
  const [clients, suppliers, products, services, sales, expenses, orders, budgets] =
    await Promise.all([
      prisma.client.count({ where: { companyId, active: true } }),
      prisma.supplier.count({ where: { companyId, active: true } }),
      prisma.product.count({ where: { companyId, active: true } }),
      prisma.service.count({ where: { companyId, active: true } }),
      prisma.sale.count({ where: { companyId } }),
      prisma.expense.count({ where: { companyId } }),
      prisma.order.count({ where: { companyId } }),
      prisma.budget.count({ where: { companyId } }),
    ]);
  const lowStock = await prisma.product.findMany({
    where: { companyId, active: true },
    select: { id: true, name: true, stock: true, minStock: true, price: true },
    orderBy: { stock: 'asc' },
    take: 10,
  });
  const lowStockLines = lowStock
    .filter((p) => p.stock <= p.minStock)
    .map((p) => '- ' + p.name + ' (id ' + p.id + '): estoque ' + p.stock + ', mínimo ' + p.minStock);
  const recentSales = await prisma.sale.findMany({
    where: { companyId },
    select: { id: true, number: true, totalValue: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  const recentExpenses = await prisma.expense.findMany({
    where: { companyId },
    select: { id: true, description: true, value: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  const openOrders = await prisma.order.findMany({
    where: { companyId, status: { in: ['aberta', 'em_andamento'] } },
    select: { id: true, number: true, status: true, totalValue: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  const cashAgg = await prisma.cashTransaction.groupBy({
    by: ['type'],
    where: { companyId },
    _sum: { value: true },
  });
  const inflow = cashAgg.find((g) => g.type === 'entrada')?._sum.value || 0;
  const outflow = cashAgg.find((g) => g.type === 'saida')?._sum.value || 0;
  const lines = [
    'Empresa: ' + company.name + ' (tipo ' + company.type + ', id ' + company.id + ').',
    'Totais: clientes ' + clients + ', fornecedores ' + suppliers + ', produtos ' + products +
      ', servicos ' + services + ', vendas ' + sales + ', despesas ' + expenses +
      ', OS ' + orders + ', orcamentos ' + budgets + '.',
    'Caixa: entradas ' + money(inflow) + ', saidas ' + money(outflow) + ', saldo ' + money(inflow - outflow) + '.',
  ];
  if (lowStockLines.length) lines.push('Estoque baixo:' + NL + lowStockLines.join(NL));
  if (recentSales.length)
    lines.push('Vendas recentes:' + NL + recentSales.map((s) => '- #' + s.number + ' (id ' + s.id + '): ' + money(s.totalValue) + ' [' + s.status + ']').join(NL));
  if (recentExpenses.length)
    lines.push('Despesas recentes:' + NL + recentExpenses.map((e) => '- ' + e.description + ' (id ' + e.id + '): ' + money(e.value) + ' [' + e.status + ']').join(NL));
  if (openOrders.length)
    lines.push('OS em aberto:' + NL + openOrders.map((o) => '- #' + o.number + ' (id ' + o.id + '): ' + money(o.totalValue) + ' [' + o.status + ']').join(NL));
  return lines.join(NL);
}

export async function buildHistory(threadId: string, companyId: string, limit = 20): Promise<ChatTurn[]> {
  const msgs = await prisma.assistantMessage.findMany({
    where: { threadId, thread: { companyId } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return msgs.reverse().map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    text: m.content.slice(0, 2000),
  }));
}

export function describePageContext(page: PageContext): string {
  let s = 'Tela atual do usuario: ' + (page.route || 'desconhecida') + '.';
  if (page.recordId) s += ' Registro em foco: ' + page.recordId + '.';
  return s;
}
