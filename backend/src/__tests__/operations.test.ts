import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, createClient, TestCompany } from './helpers';

async function createService(token: string, value = 100): Promise<string> {
  const res = await request(app)
    .post('/api/v1/services').set(auth(token))
    .send({ name: `Serviço ${Date.now()}${Math.random()}`, value })
    .expect(201);
  return res.body.data.id;
}

describe('Operations (budgets, orders, cash, expenses, dashboard)', () => {
  let ctx: TestCompany;
  let clientId: string;

  beforeAll(async () => {
    ctx = await registerCompany({ prefix: 'ops', type: 'prestador' });
    clientId = await createClient(ctx.token, 'Cliente Ops');
  });

  describe('budgets', () => {
    it('creates with sequential numbering', async () => {
      const serviceId = await createService(ctx.token, 200);

      const b1 = await request(app).post('/api/v1/budgets').set(auth(ctx.token))
        .send({ clientId, items: [{ serviceId, quantity: 2, unitValue: 200 }] }).expect(201);
      const b2 = await request(app).post('/api/v1/budgets').set(auth(ctx.token))
        .send({ clientId, items: [{ serviceId, quantity: 1, unitValue: 100 }] }).expect(201);

      expect(b1.body.data.number).toBe(1);
      expect(b2.body.data.number).toBe(2);
      expect(b1.body.data.totalValue).toBe(400);
    });

    it('rejects budget without items', async () => {
      await request(app).post('/api/v1/budgets').set(auth(ctx.token))
        .send({ clientId, items: [] }).expect(400);
    });

    it('converts approved budget to an order', async () => {
      const serviceId = await createService(ctx.token, 300);

      const budget = await request(app).post('/api/v1/budgets').set(auth(ctx.token))
        .send({ clientId, items: [{ serviceId, quantity: 1, unitValue: 300 }] }).expect(201);

      // Approve it first
      await request(app).put(`/api/v1/budgets/${budget.body.data.id}`)
        .set(auth(ctx.token)).send({ status: 'aprovado' }).expect(200);

      const order = await request(app)
        .post(`/api/v1/budgets/${budget.body.data.id}/convert-to-order`)
        .set(auth(ctx.token)).expect(201);

      expect(order.body.data.number).toBeGreaterThanOrEqual(1);
      expect(order.body.data.totalValue).toBe(300);

      // Budget now marked converted
      const after = await request(app)
        .get(`/api/v1/budgets/${budget.body.data.id}`).set(auth(ctx.token)).expect(200);
      expect(after.body.data.status).toBe('convertido');
    });

    it('cannot convert a budget that is not approved', async () => {
      const serviceId = await createService(ctx.token, 50);
      const budget = await request(app).post('/api/v1/budgets').set(auth(ctx.token))
        .send({ clientId, items: [{ serviceId, quantity: 1, unitValue: 50 }] }).expect(201);

      const res = await request(app)
        .post(`/api/v1/budgets/${budget.body.data.id}/convert-to-order`)
        .set(auth(ctx.token)).expect(400);
      expect(res.body.message).toMatch(/aprovado/i);
    });
  });

  describe('orders', () => {
    it('creates with items and status history', async () => {
      const serviceId = await createService(ctx.token, 150);

      const res = await request(app).post('/api/v1/orders').set(auth(ctx.token))
        .send({
          clientId,
          description: 'Instalação de ar',
          items: [{ serviceId, quantity: 2, unitValue: 150 }],
        })
        .expect(201);

      expect(res.body.data.status).toBe('aberta');
      expect(res.body.data.totalValue).toBe(300);
      expect(res.body.data.statusHistory?.length).toBeGreaterThan(0);
    });

    it('follows the status workflow', async () => {
      const serviceId = await createService(ctx.token, 100);
      const order = await request(app).post('/api/v1/orders').set(auth(ctx.token))
        .send({ clientId, items: [{ serviceId, quantity: 1, unitValue: 100 }] }).expect(201);

      // aberta → em_andamento
      await request(app).post(`/api/v1/orders/${order.body.data.id}/status`)
        .set(auth(ctx.token)).send({ status: 'em_andamento' }).expect(200);

      // em_andamento → concluida
      const done = await request(app).post(`/api/v1/orders/${order.body.data.id}/status`)
        .set(auth(ctx.token)).send({ status: 'concluida' }).expect(200);
      expect(done.body.data.status).toBe('concluida');
      expect(done.body.data.endDate).toBeTruthy();
    });

    it('rejects invalid status transition', async () => {
      const serviceId = await createService(ctx.token, 100);
      const order = await request(app).post('/api/v1/orders').set(auth(ctx.token))
        .send({ clientId, items: [{ serviceId, quantity: 1, unitValue: 100 }] }).expect(201);

      // aberta → concluida is not allowed directly
      const res = await request(app).post(`/api/v1/orders/${order.body.data.id}/status`)
        .set(auth(ctx.token)).send({ status: 'concluida' }).expect(400);
      expect(res.body.message).toMatch(/Transição de status inválida/i);
    });
  });

  describe('cash', () => {
    it('records entries and exits with running summary', async () => {
      await request(app).post('/api/v1/cash').set(auth(ctx.token))
        .send({ type: 'entrada', category: 'servico', description: 'Recebimento', value: 500 })
        .expect(201);
      await request(app).post('/api/v1/cash').set(auth(ctx.token))
        .send({ type: 'saida', category: 'aluguel', description: 'Aluguel', value: 200 })
        .expect(201);

      const res = await request(app).get('/api/v1/cash/summary').set(auth(ctx.token)).expect(200);
      expect(res.body.data.totalEntradas).toBeGreaterThanOrEqual(500);
      expect(res.body.data.totalSaidas).toBeGreaterThanOrEqual(200);
      expect(res.body.data.saldo).toBe(res.body.data.totalEntradas - res.body.data.totalSaidas);
    });

    it('validates the transaction type', async () => {
      await request(app).post('/api/v1/cash').set(auth(ctx.token))
        .send({ type: 'qualquer', category: 'x', description: 'y', value: 10 })
        .expect(400);
    });
  });

  describe('expenses', () => {
    it('creates a pending expense and marks it paid', async () => {
      const created = await request(app).post('/api/v1/expenses').set(auth(ctx.token))
        .send({ description: 'Conta de luz', value: 150, category: 'energia' })
        .expect(201);
      expect(created.body.data.status).toBe('pendente');

      const paid = await request(app).put(`/api/v1/expenses/${created.body.data.id}`)
        .set(auth(ctx.token))
        .send({ status: 'pago', paidDate: new Date().toISOString() })
        .expect(200);
      expect(paid.body.data.status).toBe('pago');
    });

    it('summarises totals by status', async () => {
      const res = await request(app).get('/api/v1/expenses/summary').set(auth(ctx.token)).expect(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('pendente');
      expect(res.body.data).toHaveProperty('pago');
    });
  });

  describe('dashboard', () => {
    it('returns the full expected shape', async () => {
      const res = await request(app).get('/api/v1/dashboard').set(auth(ctx.token)).expect(200);
      const d = res.body.data;

      expect(d.counts).toHaveProperty('clients');
      expect(d.counts).toHaveProperty('products');
      expect(d).toHaveProperty('products.lowStock');
      expect(d).toHaveProperty('sales.monthCount');
      expect(d).toHaveProperty('sales.ticket');
      expect(d).toHaveProperty('cash.series');
      expect(d.cash.series).toHaveLength(12);
      expect(d).toHaveProperty('expenses.pending');
      expect(d).toHaveProperty('orders.byStatus');
    });
  });
});
