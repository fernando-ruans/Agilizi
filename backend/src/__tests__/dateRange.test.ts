import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, createClient, createProduct, TestCompany } from './helpers';

/**
 * Date-range filters: every list/report endpoint must honor
 * startDate/endDate (endDate inclusive) so long-lived installs can
 * slice history accurately.
 */
describe('Filtros de período (startDate/endDate)', () => {
  let tenant: TestCompany;

  beforeAll(async () => {
    tenant = await registerCompany({ prefix: 'range' });
  });

  const authHeader = () => auth(tenant.token);

  it('rejects an invalid date with 400', async () => {
    const res = await request(app)
      .get('/api/v1/cash')
      .query({ startDate: 'not-a-date' })
      .set(authHeader());
    expect(res.status).toBe(400);
  });

  it('cash list filters by period', async () => {
    await request(app)
      .post('/api/v1/cash')
      .set(authHeader())
      .send({ type: 'entrada', category: 'venda', description: 'Hoje', value: 100, paymentMethod: 'pix' })
      .expect(201);

    // A period ending before today must not include it
    const past = await request(app)
      .get('/api/v1/cash')
      .query({ startDate: '2020-01-01', endDate: '2020-12-31' })
      .set(authHeader())
      .expect(200);
    expect(past.body.data).toHaveLength(0);

    // Including today
    const today = new Date().toISOString().slice(0, 10);
    const now = await request(app)
      .get('/api/v1/cash')
      .query({ startDate: today, endDate: today })
      .set(authHeader())
      .expect(200);
    expect(now.body.data.length).toBeGreaterThan(0);
  });

  it('cash summary honors the period', async () => {
    const past = await request(app)
      .get('/api/v1/cash/summary')
      .query({ startDate: '2020-01-01', endDate: '2020-12-31' })
      .set(authHeader())
      .expect(200);
    expect(past.body.data.totalEntradas).toBe(0);

    const today = new Date().toISOString().slice(0, 10);
    const now = await request(app)
      .get('/api/v1/cash/summary')
      .query({ startDate: today, endDate: today })
      .set(authHeader())
      .expect(200);
    expect(now.body.data.totalEntradas).toBeGreaterThan(0);
  });

  it('sales filter by createdAt period', async () => {
    const clientId = await createClient(tenant.token, 'Cliente Range');
    const { id: productId } = await createProduct(tenant.token, { name: 'Produto Range', price: 10, stock: 50 });

    await request(app)
      .post('/api/v1/sales')
      .set(authHeader())
      .send({
        clientId, paymentMethod: 'pix',
        items: [{ productId, quantity: 1, unitValue: 10 }],
      })
      .expect(201);

    const past = await request(app)
      .get('/api/v1/sales')
      .query({ startDate: '2020-01-01', endDate: '2020-12-31' })
      .set(authHeader())
      .expect(200);
    expect(past.body.data).toHaveLength(0);

    const today = new Date().toISOString().slice(0, 10);
    const now = await request(app)
      .get('/api/v1/sales')
      .query({ startDate: today, endDate: today })
      .set(authHeader())
      .expect(200);
    expect(now.body.data.length).toBeGreaterThan(0);
  });

  it('orders filter by createdAt period', async () => {
    const clientId = await createClient(tenant.token, 'Cliente OS Range');
    const services = await request(app).get('/api/v1/services').set(authHeader()).expect(200);
    const serviceId = services.body.data[0]?.id;

    if (serviceId) {
      await request(app)
        .post('/api/v1/orders')
        .set(authHeader())
        .send({ clientId, items: [{ serviceId, quantity: 1, unitValue: 50 }] })
        .expect(201);
    }

    const past = await request(app)
      .get('/api/v1/orders')
      .query({ startDate: '2020-01-01', endDate: '2020-12-31' })
      .set(authHeader())
      .expect(200);
    expect(past.body.data).toHaveLength(0);

    const today = new Date().toISOString().slice(0, 10);
    const now = await request(app)
      .get('/api/v1/orders')
      .query({ startDate: today, endDate: today })
      .set(authHeader())
      .expect(200);
    if (serviceId) expect(now.body.data.length).toBeGreaterThan(0);
  });

  it('expenses filter by period', async () => {
    await request(app)
      .post('/api/v1/expenses')
      .set(authHeader())
      .send({ description: 'Aluguel range', value: 1000, category: 'aluguel', date: new Date().toISOString() })
      .expect(201);

    const past = await request(app)
      .get('/api/v1/expenses')
      .query({ startDate: '2020-01-01', endDate: '2020-12-31' })
      .set(authHeader())
      .expect(200);
    expect(past.body.data).toHaveLength(0);

    const today = new Date().toISOString().slice(0, 10);
    const now = await request(app)
      .get('/api/v1/expenses')
      .query({ startDate: today, endDate: today })
      .set(authHeader())
      .expect(200);
    expect(now.body.data.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/dashboard/series', () => {
  let tenant: TestCompany;

  beforeAll(async () => {
    tenant = await registerCompany({ prefix: 'series' });
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/dashboard/series').expect(401);
  });

  it('returns monthly buckets for the default (12 months) range', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/series')
      .set(auth(tenant.token))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1); // at least current month
    expect(res.body.data.length).toBeLessThanOrEqual(12);
    expect(res.body.data[0]).toHaveProperty('month');
    expect(res.body.data[0]).toHaveProperty('entradas');
    expect(res.body.data[0]).toHaveProperty('saidas');
  });

  it('accepts a custom period', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/series')
      .query({ startDate: '2024-01-01', endDate: '2024-03-31' })
      .set(auth(tenant.token))
      .expect(200);

    // Jan, Feb, Mar 2024
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.every((b: any) => b.entradas === 0 && b.saidas === 0)).toBe(true);
  });

  it('rejects an invalid period (start after end)', async () => {
    await request(app)
      .get('/api/v1/dashboard/series')
      .query({ startDate: '2024-06-01', endDate: '2024-01-01' })
      .set(auth(tenant.token))
      .expect(400);
  });

  it('rejects a malformed date', async () => {
    await request(app)
      .get('/api/v1/dashboard/series')
      .query({ startDate: 'xx/xx/xxxx' })
      .set(auth(tenant.token))
      .expect(400);
  });

  it('caps the series at 36 months', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/series')
      .query({ startDate: '2000-01-01', endDate: new Date().toISOString().slice(0, 10) })
      .set(auth(tenant.token))
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(36);
  });

  it('tenant isolation: series only includes own transactions', async () => {
    const other = await registerCompany({ prefix: 'series-b' });
    await request(app)
      .post('/api/v1/cash')
      .set(auth(other.token))
      .send({ type: 'entrada', category: 'venda', description: 'Outro tenant', value: 99999, paymentMethod: 'pix' })
      .expect(201);

    const res = await request(app)
      .get('/api/v1/dashboard/series')
      .set(auth(tenant.token))
      .expect(200);

    const total = res.body.data.reduce((s: number, b: any) => s + b.entradas, 0);
    expect(total).toBe(0);
  });
});
