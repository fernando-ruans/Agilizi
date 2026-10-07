import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, createClient, TestCompany } from './helpers';

/**
 * Roles: admin > gerente > operacional
 * - Users management: admin only
 * - Delete operations: admin (some allow gerente)
 * - Create/update: admin + gerente (+ operacional for operational modules)
 */
describe('Role permissions', () => {
  let admin: TestCompany;
  let gerenteToken: string;
  let operacionalToken: string;
  let clientId: string;

  beforeAll(async () => {
    admin = await registerCompany({ prefix: 'perm' });
    clientId = await createClient(admin.token, 'Cliente Permissões');

    const g = await request(app).post('/api/v1/users').set(auth(admin.token))
      .send({ name: 'Gerente', email: `g-${Date.now()}@ex.com`, password: 'senha123', role: 'gerente' })
      .expect(201);
    gerenteToken = g.body.data.token || (await loginAs(g.body.data.email));

    const o = await request(app).post('/api/v1/users').set(auth(admin.token))
      .send({ name: 'Operacional', email: `o-${Date.now()}@ex.com`, password: 'senha123', role: 'operacional' })
      .expect(201);
    operacionalToken = o.body.data.token || (await loginAs(o.body.data.email));
  });

  async function loginAs(email: string): Promise<string> {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email, password: 'senha123' }).expect(200);
    return res.body.data.token;
  }

  describe('user management is admin-only', () => {
    it('admin can list users', async () => {
      await request(app).get('/api/v1/users').set(auth(admin.token)).expect(200);
    });

    it('gerente can list users (read-only, e.g. technician picker)', async () => {
      await request(app).get('/api/v1/users').set(auth(gerenteToken)).expect(200);
    });

    it('operacional cannot list users', async () => {
      await request(app).get('/api/v1/users').set(auth(operacionalToken)).expect(401);
    });
  });

  describe('client writes', () => {
    it('gerente can create clients', async () => {
      await request(app).post('/api/v1/clients').set(auth(gerenteToken))
        .send({ name: 'Criado pelo Gerente' }).expect(201);
    });

    it('operacional cannot create clients', async () => {
      await request(app).post('/api/v1/clients').set(auth(operacionalToken))
        .send({ name: 'Bloqueado' }).expect(401);
    });

    it('operacional can read clients', async () => {
      await request(app).get('/api/v1/clients').set(auth(operacionalToken)).expect(200);
    });
  });

  describe('deletes are admin-only', () => {
    it('gerente cannot delete a client', async () => {
      const created = await request(app).post('/api/v1/clients').set(auth(admin.token))
        .send({ name: 'Protegido' }).expect(201);

      await request(app).delete(`/api/v1/clients/${created.body.data.id}`)
        .set(auth(gerenteToken)).expect(401);
    });

    it('admin can delete a client', async () => {
      const created = await request(app).post('/api/v1/clients').set(auth(admin.token))
        .send({ name: 'Removível' }).expect(201);

      await request(app).delete(`/api/v1/clients/${created.body.data.id}`)
        .set(auth(admin.token)).expect(200);
    });
  });

  describe('operational modules allow operacional role', () => {
    it('operacional can create cash entries', async () => {
      await request(app).post('/api/v1/cash').set(auth(operacionalToken))
        .send({ type: 'entrada', category: 'servico', description: 'Recebido', value: 100 })
        .expect(201);
    });

    it('operacional can update order status', async () => {
      const service = await request(app).post('/api/v1/services').set(auth(admin.token))
        .send({ name: 'Srv Permissão', value: 100 }).expect(201);

      const order = await request(app).post('/api/v1/orders').set(auth(admin.token))
        .send({
          clientId,
          items: [{ serviceId: service.body.data.id, quantity: 1, unitValue: 100 }],
        }).expect(201);

      await request(app).post(`/api/v1/orders/${order.body.data.id}/status`)
        .set(auth(operacionalToken))
        .send({ status: 'em_andamento' })
        .expect(200);
    });
  });

  describe('unauthenticated requests are rejected everywhere', () => {
    const protectedUrls = [
      '/api/v1/clients',
      '/api/v1/products',
      '/api/v1/orders',
      '/api/v1/cash',
      '/api/v1/expenses',
      '/api/v1/dashboard',
      '/api/v1/users',
      '/api/v1/companies/mine',
    ];

    it.each(protectedUrls)('%s returns 401 without token', async (url) => {
      await request(app).get(url).expect(401);
    });
  });
});
