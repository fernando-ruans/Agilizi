import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, createClient, createProduct, TestCompany } from './helpers';

describe('Products & Sales (stock lifecycle)', () => {
  let ctx: TestCompany;

  beforeAll(async () => {
    ctx = await registerCompany({ prefix: 'stock', type: 'loja' });
  });

  describe('products', () => {
    it('creates with stock and reports summary', async () => {
      await createProduct(ctx.token, { name: 'Resumo Produto', price: 30, stock: 10, minStock: 3 });

      const res = await request(app)
        .get('/api/v1/products/summary')
        .set(auth(ctx.token))
        .expect(200);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalStock).toBeGreaterThanOrEqual(10);
    });

    it('flags low stock in summary', async () => {
      await createProduct(ctx.token, { name: 'Produto Crítico', price: 10, stock: 1, minStock: 5 });

      const res = await request(app)
        .get('/api/v1/products/summary')
        .set(auth(ctx.token))
        .expect(200);
      expect(res.body.data.lowStock).toBeGreaterThanOrEqual(1);
    });

    it('filters by lowStock query', async () => {
      const res = await request(app)
        .get('/api/v1/products?lowStock=true')
        .set(auth(ctx.token))
        .expect(200);

      for (const p of res.body.data) {
        expect(p.stock).toBeLessThanOrEqual(p.minStock);
      }
    });
  });

  describe('sales', () => {
    it('creates a sale, deducts stock and writes a cash entry', async () => {
      const product = await createProduct(ctx.token, { name: 'Vendável', price: 50, stock: 10 });
      const clientId = await createClient(ctx.token, 'Comprador');

      const before = await request(app)
        .get('/api/v1/cash/summary').set(auth(ctx.token)).expect(200);

      const sale = await request(app)
        .post('/api/v1/sales').set(auth(ctx.token))
        .send({
          clientId,
          paymentMethod: 'pix',
          items: [{ productId: product.id, quantity: 3, unitValue: 50 }],
        })
        .expect(201);

      expect(sale.body.data.totalValue).toBe(150);
      expect(sale.body.data.number).toBeGreaterThanOrEqual(1);

      // Stock deducted: 10 → 7
      const after = await request(app)
        .get(`/api/v1/products/${product.id}`).set(auth(ctx.token)).expect(200);
      expect(after.body.data.stock).toBe(7);

      // Cash received
      const cashAfter = await request(app)
        .get('/api/v1/cash/summary').set(auth(ctx.token)).expect(200);
      expect(cashAfter.body.data.totalEntradas).toBeGreaterThan(before.body.data.totalEntradas);
    });

    it('rejects when stock is insufficient', async () => {
      const product = await createProduct(ctx.token, { name: 'Esgotável', price: 20, stock: 2 });

      const res = await request(app)
        .post('/api/v1/sales').set(auth(ctx.token))
        .send({ items: [{ productId: product.id, quantity: 99, unitValue: 20 }] })
        .expect(400);
      expect(res.body.message).toMatch(/Estoque insuficiente/i);

      // Stock untouched
      const after = await request(app)
        .get(`/api/v1/products/${product.id}`).set(auth(ctx.token)).expect(200);
      expect(after.body.data.stock).toBe(2);
    });

    it('rejects a sale with no items', async () => {
      await request(app)
        .post('/api/v1/sales').set(auth(ctx.token))
        .send({ items: [] }).expect(400);
    });

    it('cancelling restores stock and removes the cash entry', async () => {
      const product = await createProduct(ctx.token, { name: 'Cancelável', price: 40, stock: 8 });
      const cashBefore = (await request(app).get('/api/v1/cash/summary').set(auth(ctx.token))).body.data.totalEntradas;

      const sale = await request(app)
        .post('/api/v1/sales').set(auth(ctx.token))
        .send({ items: [{ productId: product.id, quantity: 5, unitValue: 40 }] })
        .expect(201);

      const stockAfterSale = (await request(app).get(`/api/v1/products/${product.id}`).set(auth(ctx.token))).body.data.stock;
      expect(stockAfterSale).toBe(3);

      await request(app)
        .post(`/api/v1/sales/${sale.body.data.id}/cancel`)
        .set(auth(ctx.token)).expect(200);

      // Stock restored
      const stockRestored = (await request(app).get(`/api/v1/products/${product.id}`).set(auth(ctx.token))).body.data.stock;
      expect(stockRestored).toBe(8);

      // Cash entry removed
      const cashAfter = (await request(app).get('/api/v1/cash/summary').set(auth(ctx.token))).body.data.totalEntradas;
      expect(cashAfter).toBe(cashBefore);
    });

    it('cannot cancel the same sale twice', async () => {
      const product = await createProduct(ctx.token, { name: 'Duplo', price: 10, stock: 5 });
      const sale = await request(app)
        .post('/api/v1/sales').set(auth(ctx.token))
        .send({ items: [{ productId: product.id, quantity: 1, unitValue: 10 }] })
        .expect(201);

      await request(app)
        .post(`/api/v1/sales/${sale.body.data.id}/cancel`)
        .set(auth(ctx.token)).expect(200);

      const res = await request(app)
        .post(`/api/v1/sales/${sale.body.data.id}/cancel`)
        .set(auth(ctx.token)).expect(400);
      expect(res.body.message).toMatch(/já cancelada/i);
    });
  });
});
