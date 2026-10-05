import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import { backfillCashSync } from '../services/cashSync';
import { registerCompany, auth, createClient, createProduct, TestCompany } from './helpers';

/**
 * Profitability + cash-flow centralization:
 * - SaleItem snapshots the cost at sale time (history never rewrites)
 * - GET /reports/margin computes revenue/cost/profit/margin
 * - Dashboard exposes sales.profit/marginPct
 * - Paid expenses and completed orders generate cash entries
 */
describe('Rentabilidade (margem/lucro)', () => {
  let tenant: TestCompany;
  let productId: string;
  let clientId: string;

  beforeAll(async () => {
    tenant = await registerCompany({ prefix: 'margin' });
    clientId = await createClient(tenant.token, 'Cliente Margem');
    // Cost 40, price 100 → unit profit 60, margin 60%
    productId = (await createProduct(tenant.token, { name: 'Produto Margem', price: 100, costPrice: 40, stock: 100 })).id;
  });

  const sell = (quantity = 2, unitValue = 100) =>
    request(app)
      .post('/api/v1/sales')
      .set(auth(tenant.token))
      .send({
        clientId,
        paymentMethod: 'pix',
        items: [{ productId, quantity, unitValue }],
      });

  it('snapshots the cost price on each sale item', async () => {
    await sell(2).expect(201);

    const items = await prisma.saleItem.findMany({ where: { productId } });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].costPrice).toBe(40);
  });

  it('later costPrice changes do NOT rewrite sale history', async () => {
    await sell(1).expect(201);

    // Product cost doubles after the sales above
    await request(app)
      .put(`/api/v1/products/${productId}`)
      .set(auth(tenant.token))
      .send({ costPrice: 80 })
      .expect(200);

    const res = await request(app)
      .get('/api/v1/reports/margin')
      .set(auth(tenant.token))
      .expect(200);

    // Old items still cost 40; the report must not use the new 80
    const snapshotItems = await prisma.saleItem.findMany({ where: { productId } });
    const expectedCost = snapshotItems.reduce((s, i) => s + i.quantity * (i.costPrice ?? 0), 0);
    expect(res.body.data.cost).toBeCloseTo(expectedCost, 5);
    expect(res.body.data.cost).toBeCloseTo(3 * 40, 5); // 2 + 1 units at R$40
  });

  it('computes revenue, profit and margin %', async () => {
    const res = await request(app)
      .get('/api/v1/reports/margin')
      .set(auth(tenant.token))
      .expect(200);

    const { revenue, cost, profit, marginPct, products } = res.body.data;
    expect(revenue).toBeCloseTo(3 * 100, 5);
    expect(cost).toBeCloseTo(3 * 40, 5);
    expect(profit).toBeCloseTo(3 * 60, 5);
    expect(marginPct).toBeCloseTo(60, 1);

    // Per-product breakdown, sorted by profit
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Produto Margem');
    expect(products[0].quantity).toBe(3);
    expect(products[0].marginPct).toBeCloseTo(60, 1);
  });

  it('respects the period filter (empty when outside range)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/margin')
      .query({ startDate: '2020-01-01', endDate: '2020-12-31' })
      .set(auth(tenant.token))
      .expect(200);

    expect(res.body.data.revenue).toBe(0);
    expect(res.body.data.profit).toBe(0);
    expect(res.body.data.products).toHaveLength(0);
    expect(res.body.data.marginPct).toBeNull();
  });

  it('counts items sold without a registered cost', async () => {
    const plain = await createProduct(tenant.token, { name: 'Sem Custo', price: 50, stock: 10 });
    await request(app)
      .post('/api/v1/sales')
      .set(auth(tenant.token))
      .send({ paymentMethod: 'pix', items: [{ productId: plain.id, quantity: 1, unitValue: 50 }] })
      .expect(201);

    const res = await request(app)
      .get('/api/v1/reports/margin')
      .set(auth(tenant.token))
      .expect(200);

    expect(res.body.data.missingCostCount).toBeGreaterThan(0);
    // The product row is flagged so the UI/PDF can warn the user
    const plainRow = res.body.data.products.find((p: any) => p.name === 'Sem Custo');
    expect(plainRow.missingCost).toBe(true);
    expect(plainRow.marginPct).toBeNull();
  });

  it('dashboard exposes month profit and margin', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set(auth(tenant.token))
      .expect(200);

    expect(res.body.data.sales).toHaveProperty('profit');
    expect(res.body.data.sales).toHaveProperty('marginPct');
    expect(res.body.data.sales.profit).toBeGreaterThan(0);
    expect(res.body.data.sales.marginPct).toBeGreaterThan(0);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/reports/margin').expect(401);
  });
});

describe('Centralização no Caixa', () => {
  let tenant: TestCompany;

  beforeAll(async () => {
    tenant = await registerCompany({ prefix: 'cashsync' });
  });

  const authHeader = () => auth(tenant.token);

  const findCashEntry = (reference: string) =>
    prisma.cashTransaction.findFirst({ where: { companyId: tenant.companyId, reference } });

  it('paid expense creates a "saida" in the caixa', async () => {
    const created = await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({
        description: 'Aluguel do galpão',
        value: 1200,
        category: 'aluguel',
        date: new Date().toISOString(),
        status: 'pago',
        paidDate: new Date().toISOString(),
      })
      .expect(201);

    const entry = await findCashEntry(`expense:${created.body.data.id}`);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe('saida');
    expect(entry!.category).toBe('despesa');
    expect(entry!.value).toBe(1200);
    expect(entry!.description).toBe('Aluguel do galpão');
  });

  it('pending expense does NOT touch the caixa', async () => {
    const created = await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({ description: 'A pagar depois', value: 99, category: 'outros', date: new Date().toISOString(), status: 'pendente' })
      .expect(201);

    expect(await findCashEntry(`expense:${created.body.data.id}`)).toBeNull();
  });

  it('paying an expense later creates the entry; value edit keeps it in sync', async () => {
    const created = await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({ description: 'Conta de luz', value: 200, category: 'energia', date: new Date().toISOString(), status: 'pendente' })
      .expect(201);
    const id = created.body.data.id;
    expect(await findCashEntry(`expense:${id}`)).toBeNull();

    // Mark as paid → entry appears
    await request(app)
      .put(`/api/v1/expenses/${id}`)
      .set(authHeader())
      .send({ status: 'pago', paidDate: new Date().toISOString() })
      .expect(200);
    expect((await findCashEntry(`expense:${id}`))!.value).toBe(200);

    // Correct the value → entry follows
    await request(app)
      .put(`/api/v1/expenses/${id}`)
      .set(authHeader())
      .send({ status: 'pago', value: 250 })
      .expect(200);
    expect((await findCashEntry(`expense:${id}`))!.value).toBe(250);

    // Revert to pending → entry disappears (money never left)
    await request(app)
      .put(`/api/v1/expenses/${id}`)
      .set(authHeader())
      .send({ status: 'pendente' })
      .expect(200);
    expect(await findCashEntry(`expense:${id}`)).toBeNull();
  });

  it('deleting a paid expense removes its cash entry', async () => {
    const created = await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({ description: 'Deletável', value: 50, category: 'outros', date: new Date().toISOString(), status: 'pago' })
      .expect(201);
    const id = created.body.data.id;
    expect(await findCashEntry(`expense:${id}`)).not.toBeNull();

    await request(app).delete(`/api/v1/expenses/${id}`).set(authHeader()).expect(200);
    expect(await findCashEntry(`expense:${id}`)).toBeNull();
  });

  it('completing an order (OS) creates an "entrada" in the caixa', async () => {
    const clientId = await createClient(tenant.token, 'Cliente OS Caixa');
    // Fresh companies have no seed services — create one
    const service = await request(app)
      .post('/api/v1/services')
      .set(authHeader())
      .send({ name: 'Instalação', value: 350 })
      .expect(201);
    const serviceId = service.body.data.id;

    const order = await request(app)
      .post('/api/v1/orders')
      .set(authHeader())
      .send({ clientId, items: [{ serviceId, quantity: 1, unitValue: 350 }] })
      .expect(201);

    expect(await findCashEntry(`order:${order.body.data.id}`)).toBeNull();

    // Valid transition chain: aberta → em_andamento → concluida
    await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/status`)
      .set(authHeader())
      .send({ status: 'em_andamento' })
      .expect(200);
    expect(await findCashEntry(`order:${order.body.data.id}`)).toBeNull(); // not yet

    await request(app)
      .post(`/api/v1/orders/${order.body.data.id}/status`)
      .set(authHeader())
      .send({ status: 'concluida' })
      .expect(200);

    const entry = await findCashEntry(`order:${order.body.data.id}`);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe('entrada');
    expect(entry!.value).toBe(350);
    expect(entry!.description).toMatch(/^OS #\d{4}$/);

    // Idempotent: repeated completion must not double-register
    const entries = await prisma.cashTransaction.count({
      where: { companyId: tenant.companyId, reference: `order:${order.body.data.id}` },
    });
    expect(entries).toBe(1);
  });

  it('expense payment method flows into the cash entry', async () => {
    const created = await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({
        description: 'Curso de treinamento',
        value: 300,
        category: 'outros',
        date: new Date().toISOString(),
        status: 'pago',
        paymentMethod: 'boleto',
      })
      .expect(201);

    const entry = await findCashEntry(`expense:${created.body.data.id}`);
    expect(entry).not.toBeNull();
    expect(entry!.paymentMethod).toBe('boleto');
  });

  it('backfill repairs paid expenses created BEFORE the sync existed', async () => {
    // Simulate legacy data: paid expense written directly to the DB,
    // exactly what the user reported (paid rent missing from the Caixa)
    const legacy = await prisma.expense.create({
      data: {
        companyId: tenant.companyId,
        description: 'Aluguel legado (pré-sync)',
        value: 100,
        category: 'aluguel',
        status: 'pago',
        date: new Date(),
        paymentMethod: 'dinheiro',
      },
    });

    expect(await findCashEntry(`expense:${legacy.id}`)).toBeNull();

    await backfillCashSync();

    const entry = await findCashEntry(`expense:${legacy.id}`);
    expect(entry, 'backfill deve criar a saída faltante').not.toBeNull();
    expect(entry!.value).toBe(100);
    expect(entry!.type).toBe('saida');
    expect(entry!.paymentMethod).toBe('dinheiro');
  });

  it('backfill is idempotent (no duplicate entries on second run)', async () => {
    await backfillCashSync();

    const dupes = await prisma.cashTransaction.groupBy({
      by: ['reference'],
      where: { companyId: tenant.companyId, reference: { startsWith: 'expense:' } },
      _count: true,
    });
    dupes.forEach((d) => expect(d._count, `reference ${d.reference}`).toBe(1));
  });

  it('editing with empty selects does NOT crash (regression: FK 500)', async () => {
    const created = await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({ description: 'Edição com selects vazios', value: 10, category: 'outros', date: new Date().toISOString() })
      .expect(201);

    // The form sends "" for "Nenhum fornecedor" / "Não informado"
    const res = await request(app)
      .put(`/api/v1/expenses/${created.body.data.id}`)
      .set(authHeader())
      .send({
        description: 'Edição com selects vazios',
        value: 12,
        category: 'outros',
        supplierId: '',
        paymentMethod: '',
        status: 'pendente',
        notes: '',
      });

    expect(res.status, res.body.message).toBe(200);
    expect(res.body.data.supplierId).toBeNull();
    expect(res.body.data.paymentMethod).toBeNull();
  });

  it('saving a payment method updates the linked cash entry', async () => {
    const created = await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({ description: 'Ajuste de meio de pagamento', value: 55, category: 'outros', date: new Date().toISOString(), status: 'pago' })
      .expect(201);
    const id = created.body.data.id;

    await request(app)
      .put(`/api/v1/expenses/${id}`)
      .set(authHeader())
      .send({ status: 'pago', paymentMethod: 'pix' })
      .expect(200);

    const entry = await prisma.cashTransaction.findFirst({
      where: { companyId: tenant.companyId, reference: `expense:${id}` },
    });
    expect(entry).not.toBeNull();
    expect(entry!.paymentMethod).toBe('pix');
  });

  it('caixa list supports search and paymentMethod filters', async () => {
    await request(app)
      .post('/api/v1/cash')
      .set(authHeader())
      .send({ type: 'entrada', category: 'venda', description: 'Pix de teste XYZ', value: 10, paymentMethod: 'pix' })
      .expect(201);

    const bySearch = await request(app)
      .get('/api/v1/cash')
      .query({ search: 'XYZ' })
      .set(authHeader())
      .expect(200);
    expect(bySearch.body.data.some((t: any) => t.description.includes('XYZ'))).toBe(true);

    const byPayment = await request(app)
      .get('/api/v1/cash')
      .query({ paymentMethod: 'boleto' })
      .set(authHeader())
      .expect(200);
    expect(byPayment.body.data.every((t: any) => t.paymentMethod === 'boleto')).toBe(true);
  });
});
