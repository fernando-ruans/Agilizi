import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, createClient, createProduct, TestCompany } from './helpers';

/**
 * Multi-tenancy is the core invariant of this app:
 * a user from company A must never read or write company B's data.
 */
describe('Multi-tenancy isolation', () => {
  let tenantA: TestCompany;
  let tenantB: TestCompany;
  let clientIdA: string;
  let productIdA: string;

  beforeAll(async () => {
    tenantA = await registerCompany({ prefix: 'alpha' });
    tenantB = await registerCompany({ prefix: 'beta' });
    clientIdA = await createClient(tenantA.token, 'Cliente do Alpha');
    productIdA = (await createProduct(tenantA.token, { name: 'Produto do Alpha', price: 100 })).id;
  });

  describe('list endpoints are scoped', () => {
    const cases: { label: string; url: string }[] = [
      { label: 'clients', url: '/api/v1/clients' },
      { label: 'products', url: '/api/v1/products' },
      { label: 'sales', url: '/api/v1/sales' },
      { label: 'orders', url: '/api/v1/orders' },
      { label: 'budgets', url: '/api/v1/budgets' },
      { label: 'cash', url: '/api/v1/cash' },
      { label: 'expenses', url: '/api/v1/expenses' },
    ];

    it('tenant B sees none of tenant A records', async () => {
      // Tenant A now has at least a client and a product
      const aClients = await request(app).get('/api/v1/clients').set(auth(tenantA.token)).expect(200);
      expect(aClients.body.pagination.total).toBeGreaterThan(0);

      for (const c of cases) {
        const res = await request(app).get(c.url).set(auth(tenantB.token)).expect(200);
        const total = res.body.pagination?.total ?? res.body.data?.length ?? 0;
        expect(total, `${c.url} leaked across tenants`).toBe(0);
      }
    });

    it('tenant user list contains only its own admins', async () => {
      const res = await request(app).get('/api/v1/users').set(auth(tenantB.token)).expect(200);
      const emails: string[] = res.body.data.map((u: any) => u.email);
      expect(emails).toHaveLength(1);
      expect(emails[0]).toBe(tenantB.email);
      expect(emails).not.toContain(tenantA.email);
    });
  });

  describe('cross-tenant reads return 404, not data', () => {
    const resources: { label: string; url: string; id: () => string }[] = [
      { label: 'client', url: '/api/v1/clients', id: () => clientIdA },
      { label: 'product', url: '/api/v1/products', id: () => productIdA },
    ];

    it.each(resources)('$label cannot be read by another tenant', async ({ url, id }) => {
      const res = await request(app)
        .get(`${url}/${id()}`)
        .set(auth(tenantB.token))
        .expect(404);
      expect(res.body.message).toMatch(/não encontrado/i);
    });
  });

  describe('cross-tenant writes are rejected', () => {
    it('tenant B cannot update tenant A client', async () => {
      await request(app)
        .put(`/api/v1/clients/${clientIdA}`)
        .set(auth(tenantB.token))
        .send({ name: 'HACKED' })
        .expect(404);

      // Tenant A still sees original name
      const res = await request(app)
        .get(`/api/v1/clients/${clientIdA}`)
        .set(auth(tenantA.token))
        .expect(200);
      expect(res.body.data.name).toBe('Cliente do Alpha');
    });

    it('tenant B cannot delete tenant A client', async () => {
      await request(app)
        .delete(`/api/v1/clients/${clientIdA}`)
        .set(auth(tenantB.token))
        .expect(404);
    });

    it('tenant B cannot update tenant A product', async () => {
      await request(app)
        .put(`/api/v1/products/${productIdA}`)
        .set(auth(tenantB.token))
        .send({ price: 1 })
        .expect(404);
    });
  });

  describe('numbering is per-company', () => {
    it('both companies start their budget numbering at 1', async () => {
      const clientIdOfB = await createClient(tenantB.token, 'Cliente Beta');

      const [svcRes, bRes] = await Promise.all([
        request(app).post('/api/v1/services').set(auth(tenantA.token))
          .send({ name: `Svc A ${Date.now()}`, value: 100 }).expect(201),
        request(app).post('/api/v1/services').set(auth(tenantB.token))
          .send({ name: `Svc B ${Date.now()}`, value: 200 }).expect(201),
      ]);

      const [budgetA, budgetB] = await Promise.all([
        request(app).post('/api/v1/budgets').set(auth(tenantA.token))
          .send({ clientId: clientIdA, items: [{ serviceId: svcRes.body.data.id, quantity: 1, unitValue: 100 }] })
          .expect(201),
        request(app).post('/api/v1/budgets').set(auth(tenantB.token))
          .send({ clientId: clientIdOfB, items: [{ serviceId: bRes.body.data.id, quantity: 1, unitValue: 200 }] })
          .expect(201),
      ]);

      expect(budgetA.body.data.number).toBe(1);
      expect(budgetB.body.data.number).toBe(1);
    });
  });

  describe('dashboard is scoped', () => {
    it('a fresh tenant sees zero counts despite other tenants having data', async () => {
      // Fresh tenant so earlier tests' data can't leak in via shared state
      const fresh = await registerCompany({ prefix: 'gamma' });

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set(auth(fresh.token))
        .expect(200);

      expect(res.body.data.counts.clients).toBe(0);
      expect(res.body.data.counts.products).toBe(0);
      expect(res.body.data.cash.yearly.entradas).toBe(0);
      expect(res.body.data.orders.recent).toHaveLength(0);
      expect(res.body.data.sales.recent).toHaveLength(0);
    });
  });
});
