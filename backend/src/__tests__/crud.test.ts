import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, TestCompany } from './helpers';

describe('CRUD modules (clients, suppliers, services)', () => {
  let ctx: TestCompany;

  beforeAll(async () => {
    ctx = await registerCompany({ prefix: 'crud' });
  });

  describe('clients', () => {
    it('creates, reads, updates and lists', async () => {
      const created = await request(app)
        .post('/api/v1/clients')
        .set(auth(ctx.token))
        .send({ name: 'João CRUD', email: 'joao@crud.com', phone: '(11) 99999-0000' })
        .expect(201);
      expect(created.body.data.name).toBe('João CRUD');

      const listed = await request(app)
        .get('/api/v1/clients')
        .set(auth(ctx.token))
        .expect(200);
      expect(listed.body.pagination.total).toBe(1);

      const updated = await request(app)
        .put(`/api/v1/clients/${created.body.data.id}`)
        .set(auth(ctx.token))
        .send({ name: 'João Editado' })
        .expect(200);
      expect(updated.body.data.name).toBe('João Editado');
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/v1/clients')
          .set(auth(ctx.token)).send({ name: `Paginado ${i}` }).expect(201);
      }
      const res = await request(app)
        .get('/api/v1/clients?page=1&limit=2')
        .set(auth(ctx.token))
        .expect(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.totalPages).toBeGreaterThan(1);
    });

    it('soft-deletes (deactivates) instead of removing', async () => {
      const created = await request(app)
        .post('/api/v1/clients').set(auth(ctx.token))
        .send({ name: 'Para deletar' }).expect(201);

      await request(app)
        .delete(`/api/v1/clients/${created.body.data.id}`)
        .set(auth(ctx.token)).expect(200);

      const shown = await request(app)
        .get(`/api/v1/clients/${created.body.data.id}`)
        .set(auth(ctx.token)).expect(200);
      expect(shown.body.data.active).toBe(false);
    });

    it('rejects empty name with validation error', async () => {
      const res = await request(app)
        .post('/api/v1/clients').set(auth(ctx.token))
        .send({ name: '' }).expect(400);
      expect(res.body.message).toMatch(/Dados inválidos/i);
    });

    it('accepts empty-string email (UI sends "" for untouched optional fields)', async () => {
      // Regression: forms submit email:'' which z.string().email() used to reject
      const res = await request(app)
        .post('/api/v1/clients').set(auth(ctx.token))
        .send({ name: 'Sem Email', email: '', phone: '' })
        .expect(201);
      expect(res.body.data.name).toBe('Sem Email');
      expect(res.body.data.email).toBeNull();
    });

    it('still rejects a malformed email', async () => {
      await request(app)
        .post('/api/v1/clients').set(auth(ctx.token))
        .send({ name: 'Email Ruim', email: 'nao-e-email' })
        .expect(400);
    });

    it('returns 404 for unknown id', async () => {
      await request(app)
        .get('/api/v1/clients/non-existent-id')
        .set(auth(ctx.token)).expect(404);
    });
  });

  describe('suppliers', () => {
    it('creates and lists', async () => {
      await request(app)
        .post('/api/v1/suppliers').set(auth(ctx.token))
        .send({ name: 'Fornecedor CRUD', document: '11.222.333/0001-44' })
        .expect(201);

      const res = await request(app)
        .get('/api/v1/suppliers').set(auth(ctx.token)).expect(200);
      expect(res.body.pagination.total).toBe(1);
    });
  });

  describe('services', () => {
    it('creates with positive value and rejects negative', async () => {
      await request(app)
        .post('/api/v1/services').set(auth(ctx.token))
        .send({ name: 'Serviço CRUD', value: 150 }).expect(201);

      const res = await request(app)
        .post('/api/v1/services').set(auth(ctx.token))
        .send({ name: 'Inválido', value: -10 }).expect(400);
      expect(res.body.message).toMatch(/Dados inválidos/i);
    });
  });
});
