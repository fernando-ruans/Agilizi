/**
 * Ferramentas do bot: leitura e escrita sempre escopadas por companyId.
 * Escritas espelham a lógica dos controllers (estoque, caixa, contadores)
 * em vez de CRUD cru — o mesmo invariante vale vindo do bot ou da UI.
 * Cada escrita só executa após confirmação explícita (ver conversation.ts).
 */
import { z } from 'zod';
import prisma from '../../config/database';
import { AppError, NotFoundError, ConflictError } from '../../utils/errors';
import { syncExpenseToCash, removeExpenseFromCash, syncOrderToCash } from '../cashSync';
import { buildCompanySnapshot } from './context';

export interface ToolResult {
  summary: string;
  data?: unknown;
}

export interface ToolDef {
  name: string;
  description: string;
  destructive: boolean;
  schema: z.ZodTypeAny;
  execute(companyId: string, userId: string, args: any): Promise<ToolResult>;
}

const idSchema = z.object({ id: z.string().min(1) });
// Modelos gratuitos costumam emitir valores como texto no formato brasileiro
// ("42,50", "R$ 1.500,00"). Normaliza para número antes de validar para a
// proposta não ser descartada em silêncio.
function brNumber(v: unknown): unknown {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  let s = v.trim().replace(/R\$\s?/gi, '').replace(/\s/g, '');
  if (!s) return v;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : v;
}
const moneyField = z.preprocess(brNumber, z.number().nonnegative());
const moneyPositive = z.preprocess(brNumber, z.number().positive());
const intField = z.preprocess(brNumber, z.number().int().min(0));

async function scopedFirst(model: 'client' | 'supplier' | 'product' | 'service' | 'expense' | 'sale' | 'order', id: string, companyId: string, label: string) {
  const item = await (prisma as any)[model].findFirst({ where: { id, companyId } });
  if (!item) throw new NotFoundError(label);
  return item;
}

function fkGuard(err: any, label: string): never {
  if (err?.code === 'P2003') {
    throw new ConflictError(label + ' possui lançamentos vinculados e não pode ser excluído (desative em vez disso)');
  }
  throw err;
}

const ENTITY_SEARCH: Record<string, { fields: string[]; select: Record<string, boolean> }> = {
  client: { fields: ['name', 'email', 'phone', 'document'], select: { id: true, name: true, email: true, phone: true, document: true, active: true } },
  supplier: { fields: ['name', 'companyName', 'document'], select: { id: true, name: true, companyName: true, document: true, active: true } },
  product: { fields: ['name', 'barcode', 'category'], select: { id: true, name: true, price: true, stock: true, minStock: true, active: true } },
  service: { fields: ['name', 'category'], select: { id: true, name: true, value: true, active: true } },
  expense: { fields: ['description', 'category'], select: { id: true, description: true, value: true, status: true, createdAt: true } },
  sale: { fields: ['notes'], select: { id: true, number: true, totalValue: true, status: true, createdAt: true } },
  order: { fields: [], select: { id: true, number: true, status: true, totalValue: true, createdAt: true } },
  budget: { fields: [], select: { id: true, number: true, status: true, totalValue: true, createdAt: true } },
};

// Modelos free às vezes usam `type` em vez de `entity` nos argumentos de
// busca/detalhe. Aceita o apelido para a leitura não ser descartada.
function entityAlias(v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (!o.entity && typeof o.type === 'string') o.entity = o.type;
  }
  return v;
}
const searchSchema = z.preprocess(entityAlias, z.object({
  entity: z.enum(['client', 'supplier', 'product', 'service', 'sale', 'expense', 'order', 'budget']),
  query: z.string().default(''),
  limit: z.number().int().min(1).max(30).default(10),
}));

async function searchEntities(companyId: string, args: z.infer<typeof searchSchema>): Promise<ToolResult> {
  const conf = ENTITY_SEARCH[args.entity];
  const where: any = { companyId };
  if (args.query) {
    const num = parseInt(args.query.replace(/[^0-9]/g, ''), 10);
    if ((args.entity === 'sale' || args.entity === 'order' || args.entity === 'budget') && String(num) === args.query.trim()) {
      where.number = num;
    } else if (conf.fields.length) {
      where.OR = conf.fields.map((f) => ({ [f]: { contains: args.query } }));
    }
  }
  const rows = await (prisma as any)[args.entity].findMany({
    where,
    select: conf.select,
    orderBy: (args.entity === 'sale' || args.entity === 'order' || args.entity === 'budget' || args.entity === 'expense')
      ? { createdAt: 'desc' }
      : { name: 'asc' },
    take: args.limit,
  });
  return { summary: rows.length + ' resultado(s) em ' + args.entity, data: rows };
}

const getSchema = z.preprocess(entityAlias, z.object({
  entity: z.enum(['client', 'supplier', 'product', 'service', 'sale', 'expense', 'order']),
  id: z.string().min(1),
}));

async function getDetails(companyId: string, args: z.infer<typeof getSchema>): Promise<ToolResult> {
  const include: any = {};
  if (args.entity === 'sale') include.items = { include: { product: { select: { id: true, name: true } } } };
  if (args.entity === 'order') include.items = { include: { service: { select: { id: true, name: true } } } };
  const item = await (prisma as any)[args.entity].findFirst({
    where: { id: args.id, companyId },
    include: Object.keys(include).length ? include : undefined,
  });
  if (!item) throw new NotFoundError(args.entity);
  return { summary: args.entity + ' ' + args.id, data: item };
}

const clientFields = {
  name: z.string().min(1).max(120),
  email: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  document: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(2).optional(),
  notes: z.string().max(500).optional(),
};

const supplierFields = {
  name: z.string().min(1).max(120),
  companyName: z.string().max(120).optional(),
  document: z.string().max(20).optional(),
  email: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
};

function clean<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') out[k] = v;
  }
  return out as Partial<T>;
}

export const tools: ToolDef[] = [
  {
    name: 'overview',
    description: 'Resumo da empresa: totais, caixa, estoque baixo, vendas/despesas/OS recentes.',
    destructive: false,
    schema: z.object({}),
    execute: async (companyId) => ({ summary: 'Resumo da empresa', data: await buildCompanySnapshot(companyId) }),
  },
  {
    name: 'search',
    description: 'Busca entidades (client, supplier, product, service, sale, expense, order, budget) por texto ou número.',
    destructive: false,
    schema: searchSchema,
    execute: async (companyId, _userId, args) => searchEntities(companyId, args),
  },
  {
    name: 'get_details',
    description: 'Detalhe de um registro por id (vendas e OS incluem itens).',
    destructive: false,
    schema: getSchema,
    execute: async (companyId, _userId, args) => getDetails(companyId, args),
  },
  {
    name: 'client.create',
    description: 'Cadastra um cliente.',
    destructive: false,
    schema: z.object(clientFields),
    execute: async (companyId, _userId, args) => {
      const c = await prisma.client.create({ data: { companyId, ...clean(args) } as any });
      return { summary: 'Cliente ' + c.name + ' cadastrado', data: c };
    },
  },
  {
    name: 'client.update',
    description: 'Atualiza um cliente pelo id.',
    destructive: false,
    schema: z.object({ id: z.string().min(1), ...clientFields, name: z.string().min(1).max(120).optional() }),
    execute: async (companyId, _userId, args) => {
      const { id, ...data } = args;
      await scopedFirst('client', id, companyId, 'Cliente');
      const c = await prisma.client.update({ where: { id }, data: clean(data) });
      return { summary: 'Cliente ' + c.name + ' atualizado', data: c };
    },
  },
  {
    name: 'client.deactivate',
    description: 'Desativa um cliente (reversível, mantém histórico).',
    destructive: false,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('client', args.id, companyId, 'Cliente');
      await prisma.client.update({ where: { id: args.id }, data: { active: false } });
      return { summary: 'Cliente desativado' };
    },
  },
  {
    name: 'client.delete',
    description: 'Exclui um cliente permanentemente. Falha se houver lançamentos vinculados.',
    destructive: true,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('client', args.id, companyId, 'Cliente');
      try {
        await prisma.client.delete({ where: { id: args.id } });
      } catch (err: any) {
        fkGuard(err, 'Cliente');
      }
      return { summary: 'Cliente excluído permanentemente' };
    },
  },
  {
    name: 'supplier.create',
    description: 'Cadastra um fornecedor.',
    destructive: false,
    schema: z.object(supplierFields),
    execute: async (companyId, _userId, args) => {
      const s = await prisma.supplier.create({ data: { companyId, ...clean(args) } as any });
      return { summary: 'Fornecedor ' + s.name + ' cadastrado', data: s };
    },
  },
  {
    name: 'supplier.update',
    description: 'Atualiza um fornecedor pelo id.',
    destructive: false,
    schema: z.object({ id: z.string().min(1), ...supplierFields, name: z.string().min(1).max(120).optional() }),
    execute: async (companyId, _userId, args) => {
      const { id, ...data } = args;
      await scopedFirst('supplier', id, companyId, 'Fornecedor');
      const s = await prisma.supplier.update({ where: { id }, data: clean(data) });
      return { summary: 'Fornecedor ' + s.name + ' atualizado', data: s };
    },
  },
  {
    name: 'supplier.deactivate',
    description: 'Desativa um fornecedor (reversível).',
    destructive: false,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('supplier', args.id, companyId, 'Fornecedor');
      await prisma.supplier.update({ where: { id: args.id }, data: { active: false } });
      return { summary: 'Fornecedor desativado' };
    },
  },
  {
    name: 'supplier.delete',
    description: 'Exclui um fornecedor permanentemente. Falha se houver lançamentos vinculados.',
    destructive: true,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('supplier', args.id, companyId, 'Fornecedor');
      try {
        await prisma.supplier.delete({ where: { id: args.id } });
      } catch (err: any) {
        fkGuard(err, 'Fornecedor');
      }
      return { summary: 'Fornecedor excluído permanentemente' };
    },
  },
  {
    name: 'product.create',
    description: 'Cadastra um produto (preço, custo, estoque, unidade: un, kg, m, l...). Valores como número com ponto decimal (99.90).',
    destructive: false,
    schema: z.object({
      name: z.string().min(1).max(120),
      price: moneyField,
      costPrice: moneyField.optional(),
      stock: intField.optional(),
      minStock: intField.optional(),
      category: z.string().max(60).optional(),
      barcode: z.string().max(40).optional(),
      unit: z.string().max(5).optional(),
      description: z.string().max(500).optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const p = await prisma.product.create({ data: { companyId, ...clean(args) } as any });
      return { summary: 'Produto ' + p.name + ' cadastrado', data: p };
    },
  },
  {
    name: 'product.update',
    description: 'Atualiza um produto pelo id (preço, estoque, categoria...).',
    destructive: false,
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(120).optional(),
      price: moneyField.optional(),
      costPrice: moneyField.optional(),
      stock: intField.optional(),
      minStock: intField.optional(),
      category: z.string().max(60).optional(),
      barcode: z.string().max(40).optional(),
      unit: z.string().max(5).optional(),
      description: z.string().max(500).optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const { id, ...data } = args;
      await scopedFirst('product', id, companyId, 'Produto');
      const p = await prisma.product.update({ where: { id }, data: clean(data) });
      return { summary: 'Produto ' + p.name + ' atualizado', data: p };
    },
  },
  {
    name: 'product.deactivate',
    description: 'Desativa um produto (reversível, some das vendas).',
    destructive: false,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('product', args.id, companyId, 'Produto');
      await prisma.product.update({ where: { id: args.id }, data: { active: false } });
      return { summary: 'Produto desativado' };
    },
  },
  {
    name: 'product.delete',
    description: 'Exclui um produto permanentemente. Falha se houver vendas vinculadas.',
    destructive: true,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('product', args.id, companyId, 'Produto');
      try {
        await prisma.product.delete({ where: { id: args.id } });
      } catch (err: any) {
        fkGuard(err, 'Produto');
      }
      return { summary: 'Produto excluído permanentemente' };
    },
  },
  {
    name: 'service.create',
    description: 'Cadastra um serviço (nome, valor, categoria). Valor como número com ponto decimal (150.00).',
    destructive: false,
    schema: z.object({
      name: z.string().min(1).max(120),
      value: moneyField,
      category: z.string().max(60).optional(),
      description: z.string().max(500).optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const s = await prisma.service.create({ data: { companyId, ...clean(args) } as any });
      return { summary: 'Serviço ' + s.name + ' cadastrado', data: s };
    },
  },
  {
    name: 'service.update',
    description: 'Atualiza um serviço pelo id.',
    destructive: false,
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(120).optional(),
      value: moneyField.optional(),
      category: z.string().max(60).optional(),
      description: z.string().max(500).optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const { id, ...data } = args;
      await scopedFirst('service', id, companyId, 'Serviço');
      const s = await prisma.service.update({ where: { id }, data: clean(data) });
      return { summary: 'Serviço ' + s.name + ' atualizado', data: s };
    },
  },
  {
    name: 'service.deactivate',
    description: 'Desativa um serviço (reversível).',
    destructive: false,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('service', args.id, companyId, 'Serviço');
      await prisma.service.update({ where: { id: args.id }, data: { active: false } });
      return { summary: 'Serviço desativado' };
    },
  },
  {
    name: 'service.delete',
    description: 'Exclui um serviço permanentemente. Falha se houver OS vinculadas.',
    destructive: true,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('service', args.id, companyId, 'Serviço');
      try {
        await prisma.service.delete({ where: { id: args.id } });
      } catch (err: any) {
        fkGuard(err, 'Serviço');
      }
      return { summary: 'Serviço excluído permanentemente' };
    },
  },
  {
    name: 'expense.create',
    description: 'Lança uma despesa (gera o movimento de caixa quando paga). Valor como número com ponto decimal (42.50).',
    destructive: false,
    schema: z.object({
      description: z.string().min(1).max(200),
      value: moneyPositive,
      category: z.string().max(60).optional(),
      status: z.enum(['pendente', 'pago', 'atrasado']).optional(),
      paymentMethod: z.string().max(30).optional(),
      supplierId: z.string().optional(),
      notes: z.string().max(500).optional(),
    }),
    execute: async (companyId, userId, args) => {
      if (args.supplierId) await scopedFirst('supplier', args.supplierId, companyId, 'Fornecedor');
      const e = await prisma.expense.create({
        data: {
          companyId,
          userId,
          description: args.description,
          value: args.value,
          // category é obrigatória no banco; nunca enviar null (o erro do
          // Prisma nesse caso reclama de `company`, mascarando a causa).
          category: args.category || 'outros',
          status: args.status || 'pendente',
          paymentMethod: args.paymentMethod || null,
          supplierId: args.supplierId || null,
          notes: args.notes || null,
        },
      });
      await syncExpenseToCash(e);
      return { summary: 'Despesa lançada', data: e };
    },
  },
  {
    name: 'expense.update',
    description: 'Atualiza uma despesa pelo id (caixa é sincronizado).',
    destructive: false,
    schema: z.object({
      id: z.string().min(1),
      description: z.string().min(1).max(200).optional(),
      value: moneyPositive.optional(),
      category: z.string().max(60).optional(),
      status: z.enum(['pendente', 'pago', 'atrasado']).optional(),
      paymentMethod: z.string().max(30).optional(),
      supplierId: z.string().optional(),
      notes: z.string().max(500).optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const { id, ...data } = args;
      await scopedFirst('expense', id, companyId, 'Despesa');
      if (data.supplierId) await scopedFirst('supplier', data.supplierId, companyId, 'Fornecedor');
      const e = await prisma.expense.update({ where: { id }, data: clean(data) });
      await syncExpenseToCash(e);
      return { summary: 'Despesa atualizada', data: e };
    },
  },
  {
    name: 'expense.delete',
    description: 'Exclui uma despesa e remove seu movimento de caixa.',
    destructive: true,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      await scopedFirst('expense', args.id, companyId, 'Despesa');
      await prisma.expense.delete({ where: { id: args.id } });
      await removeExpenseFromCash(args.id, companyId);
      return { summary: 'Despesa excluída e caixa ajustado' };
    },
  },
  {
    name: 'sale.create',
    description: 'Registra uma venda: baixa estoque, congela custo e gera o caixa. Itens com productId, quantity e unitValue (números com ponto decimal, ex. 2 e 49.90).',
    destructive: false,
    schema: z.object({
      clientId: z.string().optional(),
      items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.preprocess(brNumber, z.number().positive()),
        unitValue: moneyField,
      })).min(1).max(50),
      discount: moneyField.optional(),
      paymentMethod: z.string().max(30).optional(),
      notes: z.string().max(500).optional(),
    }),
    execute: async (companyId, userId, args) => {
      if (args.clientId) await scopedFirst('client', args.clientId, companyId, 'Cliente');
      const sale = await prisma.$transaction(async (tx) => {
        const setting = await tx.companySetting.findUnique({
          where: { companyId_key: { companyId, key: 'next_sale_number' } },
        });
        const saleNumber = setting ? parseInt(setting.value, 10) : 1;
        await tx.companySetting.upsert({
          where: { companyId_key: { companyId, key: 'next_sale_number' } },
          create: { companyId, key: 'next_sale_number', value: String(saleNumber + 1) },
          update: { value: String(saleNumber + 1) },
        });
        let totalValue = 0;
        for (const item of args.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, companyId } });
          if (!product) throw new NotFoundError('Produto');
          if (product.stock < item.quantity) {
            throw new AppError('Estoque insuficiente para "' + product.name + '" (disponível: ' + product.stock + ')', 400);
          }
          totalValue += item.quantity * item.unitValue;
        }
        const saleDiscount = args.discount || 0;
        if (saleDiscount > totalValue) throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
        totalValue -= saleDiscount;
        const created = await tx.sale.create({
          data: {
            companyId,
            number: saleNumber,
            clientId: args.clientId || null,
            userId,
            totalValue,
            discount: saleDiscount,
            paymentMethod: args.paymentMethod || null,
            notes: args.notes || null,
          },
        });
        for (const item of args.items) {
          const sold = await tx.product.findFirst({
            where: { id: item.productId, companyId },
            select: { costPrice: true, stock: true },
          });
          await tx.saleItem.create({
            data: {
              saleId: created.id,
              productId: item.productId,
              quantity: item.quantity,
              unitValue: item.unitValue,
              totalValue: item.quantity * item.unitValue,
              costPrice: sold?.costPrice ?? null,
            },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: (sold?.stock || 0) - item.quantity },
          });
        }
        await tx.cashTransaction.create({
          data: {
            companyId,
            type: 'entrada',
            category: 'venda',
            description: 'Venda #' + String(saleNumber).padStart(4, '0'),
            value: totalValue,
            paymentMethod: args.paymentMethod || null,
            reference: 'sale:' + created.id,
            userId,
          },
        });
        return created;
      });
      return { summary: 'Venda #' + sale.number + ' registrada', data: sale };
    },
  },
  {
    name: 'sale.cancel',
    description: 'Cancela uma venda: restaura o estoque e remove o caixa.',
    destructive: true,
    schema: idSchema,
    execute: async (companyId, _userId, args) => {
      const sale = await prisma.sale.findFirst({
        where: { id: args.id, companyId },
        include: { items: true },
      });
      if (!sale) throw new NotFoundError('Venda');
      if (sale.status === 'cancelada') throw new AppError('Venda já cancelada', 400);
      await prisma.$transaction(async (tx) => {
        await tx.sale.update({ where: { id: sale.id }, data: { status: 'cancelada' } });
        for (const item of sale.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: product.stock + item.quantity },
            });
          }
        }
        await tx.cashTransaction.deleteMany({
          where: { companyId, reference: 'sale:' + sale.id },
        });
      });
      return { summary: 'Venda #' + sale.number + ' cancelada e estoque restaurado' };
    },
  },
  {
    name: 'budget.create',
    description: 'Cria um orçamento para um cliente com itens de SERVIÇO (serviceId, quantity e unitValue com ponto decimal). Use search para obter clientId e serviceId antes. Orçamentos são de serviços, não de produtos.',
    destructive: false,
    schema: z.object({
      clientId: z.string().min(1),
      items: z.array(z.object({
        serviceId: z.string().min(1),
        description: z.string().max(200).optional(),
        quantity: z.preprocess(brNumber, z.number().positive()),
        unitValue: moneyField,
      })).min(1).max(50),
      discount: moneyField.optional(),
      notes: z.string().max(500).optional(),
      validUntil: z.string().max(30).optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const client = await prisma.client.findFirst({ where: { id: args.clientId, companyId } });
      if (!client) throw new NotFoundError('Cliente');
      const setting = await prisma.companySetting.findUnique({
        where: { companyId_key: { companyId, key: 'next_budget_number' } },
      });
      const budgetNumber = setting ? parseInt(setting.value, 10) : 1;
      let totalValue = 0;
      const items = [];
      for (const item of args.items) {
        const service = await prisma.service.findFirst({ where: { id: item.serviceId, companyId } });
        if (!service) throw new NotFoundError('Serviço');
        const itemTotal = item.quantity * item.unitValue;
        totalValue += itemTotal;
        items.push({
          serviceId: item.serviceId,
          description: item.description || null,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: itemTotal,
        });
      }
      const budgetDiscount = args.discount || 0;
      if (budgetDiscount > totalValue) throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
      totalValue -= budgetDiscount;
      const created = await prisma.budget.create({
        data: {
          companyId,
          number: budgetNumber,
          clientId: args.clientId,
          totalValue,
          discount: budgetDiscount,
          notes: args.notes || null,
          validUntil: args.validUntil ? new Date(args.validUntil) : null,
          items: { create: items },
        },
      });
      await prisma.companySetting.upsert({
        where: { companyId_key: { companyId, key: 'next_budget_number' } },
        create: { companyId, key: 'next_budget_number', value: String(budgetNumber + 1) },
        update: { value: String(budgetNumber + 1) },
      });
      return { summary: 'Orçamento #' + budgetNumber + ' criado', data: created };
    },
  },
  {
    name: 'order.create',
    description: 'Cria uma ordem de serviço para um cliente com itens de SERVIÇO (serviceId, quantity e unitValue com ponto decimal). Use search para obter clientId e serviceId antes.',
    destructive: false,
    schema: z.object({
      clientId: z.string().min(1),
      description: z.string().max(500).optional(),
      items: z.array(z.object({
        serviceId: z.string().min(1),
        description: z.string().max(200).optional(),
        quantity: z.preprocess(brNumber, z.number().positive()),
        unitValue: moneyField,
      })).min(1).max(50),
      priority: z.enum(['baixa', 'normal', 'alta', 'urgente']).optional(),
      notes: z.string().max(500).optional(),
      discount: moneyField.optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const client = await prisma.client.findFirst({ where: { id: args.clientId, companyId } });
      if (!client) throw new NotFoundError('Cliente');
      const setting = await prisma.companySetting.findUnique({
        where: { companyId_key: { companyId, key: 'next_order_number' } },
      });
      const orderNumber = setting ? parseInt(setting.value, 10) : 1;
      let totalValue = 0;
      const items = [];
      for (const item of args.items) {
        const service = await prisma.service.findFirst({ where: { id: item.serviceId, companyId } });
        if (!service) throw new NotFoundError('Serviço');
        const itemTotal = item.quantity * item.unitValue;
        totalValue += itemTotal;
        items.push({
          serviceId: item.serviceId,
          description: item.description || null,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: itemTotal,
        });
      }
      const orderDiscount = args.discount || 0;
      if (orderDiscount > totalValue) throw new AppError('Desconto não pode ser maior que o valor dos itens', 400);
      totalValue -= orderDiscount;
      const created = await prisma.order.create({
        data: {
          companyId,
          number: orderNumber,
          clientId: args.clientId,
          description: args.description || null,
          priority: args.priority || 'normal',
          totalValue,
          discount: orderDiscount,
          notes: args.notes || null,
          startDate: new Date(),
          items: { create: items },
          statusHistory: { create: { status: 'aberta', notes: 'Ordem de serviço criada' } },
        },
      });
      await prisma.companySetting.upsert({
        where: { companyId_key: { companyId, key: 'next_order_number' } },
        create: { companyId, key: 'next_order_number', value: String(orderNumber + 1) },
        update: { value: String(orderNumber + 1) },
      });
      return { summary: 'OS #' + orderNumber + ' criada', data: created };
    },
  },
  {
    name: 'order.set_status',
    description: 'Troca o status de uma OS (aberta, em_andamento, concluida, cancelada). Concluir gera o caixa.',
    destructive: false,
    schema: z.object({
      id: z.string().min(1),
      status: z.enum(['aberta', 'em_andamento', 'concluida', 'cancelada']),
      notes: z.string().max(500).optional(),
    }),
    execute: async (companyId, _userId, args) => {
      const order = await prisma.order.findFirst({ where: { id: args.id, companyId } });
      if (!order) throw new NotFoundError('Ordem de Serviço');
      const valid: Record<string, string[]> = {
        aberta: ['em_andamento', 'cancelada'],
        em_andamento: ['concluida', 'cancelada'],
        concluida: [],
        cancelada: ['aberta'],
      };
      if (!valid[order.status]?.includes(args.status)) {
        throw new AppError('Transição de status inválida: ' + order.status + ' → ' + args.status, 400);
      }
      const updated = await prisma.order.update({
        where: { id: args.id },
        data: { status: args.status, ...(args.status === 'concluida' ? { endDate: new Date() } : {}) },
      });
      await prisma.orderStatusHistory.create({
        data: { orderId: args.id, status: args.status, notes: args.notes || 'Status alterado para ' + args.status },
      });
      await syncOrderToCash({
        id: updated.id,
        companyId: updated.companyId,
        number: updated.number,
        userId: updated.userId,
        status: updated.status,
        totalValue: updated.totalValue,
      });
      return { summary: 'OS #' + updated.number + ' agora está ' + args.status, data: updated };
    },
  },
];

export function getTool(name: string): ToolDef | undefined {
  return tools.find((t) => t.name === name);
}

export function toolsPrompt(): string {
  return tools
    .map((t) => '- ' + t.name + (t.destructive ? ' [DESTRUTIVA]' : '') + ': ' + t.description)
    .join(String.fromCharCode(10));
}
