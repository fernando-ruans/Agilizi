import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, login, auth, TestCompany } from './helpers';

describe('Auth', () => {
  let company: TestCompany;

  beforeAll(async () => {
    company = await registerCompany({ prefix: 'auth' });
  });

  describe('POST /api/v1/auth/register', () => {
    it('creates company + admin user and returns tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Maria',
          email: `maria-${Date.now()}@ex.com`,
          password: 'senha123',
          companyName: 'Empresa Nova',
          companyType: 'loja',
        })
        .expect(201);

      expect(res.body.data.user).toMatchObject({ name: 'Maria', role: 'admin' });
      expect(res.body.data.company).toMatchObject({ name: 'Empresa Nova', type: 'loja' });
      expect(res.body.data.token).toBeTruthy();
    });

    it('rejects duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Dup',
          email: company.email,
          password: 'senha123',
          companyName: 'Outra',
        })
        .expect(409);
      expect(res.body.message).toMatch(/já cadastrado/i);
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'X', email: 'not-an-email', password: '123' })
        .expect(400);
      expect(res.body.message).toMatch(/Dados inválidos/i);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials', async () => {
      const token = await login(company.email);
      expect(token).toBeTruthy();
    });

    it('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: company.email, password: 'wrong-password' })
        .expect(401);
      expect(res.body.message).toMatch(/inválidos/i);
    });

    it('rejects unknown email', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'senha123' })
        .expect(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the authenticated user with companyId', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set(auth(company.token))
        .expect(200);
      expect(res.body.data.email).toBe(company.email);
      expect(res.body.data.companyId).toBe(company.companyId);
    });

    it('rejects requests without a token', async () => {
      await request(app).get('/api/v1/auth/me').expect(401);
    });

    it('rejects garbage tokens', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .set(auth('not-a-real-token'))
        .expect(401);
    });
  });

  describe('PUT /api/v1/auth/me', () => {
    it('updates own name', async () => {
      const res = await request(app)
        .put('/api/v1/auth/me')
        .set(auth(company.token))
        .send({ name: 'Nome Atualizado' })
        .expect(200);
      expect(res.body.data.name).toBe('Nome Atualizado');
    });

    it('rejects an email already used by another user in the same company', async () => {
      // Second user in the same company
      const invite = await request(app)
        .post('/api/v1/users')
        .set(auth(company.token))
        .send({ name: 'Segundo', email: `second-${Date.now()}@ex.com`, password: 'senha123' })
        .expect(201);

      const res = await request(app)
        .put('/api/v1/auth/me')
        .set(auth(company.token))
        .send({ email: invite.body.data.email })
        .expect(409);
      expect(res.body.message).toMatch(/em uso/i);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('changes password with correct current password', async () => {
      const c = await registerCompany({ prefix: 'pw' });

      await request(app)
        .post('/api/v1/auth/change-password')
        .set(auth(c.token))
        .send({ currentPassword: 'secret123', newPassword: 'nova-senha-456' })
        .expect(200);

      // Old password no longer works
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: c.email, password: 'secret123' })
        .expect(401);

      // New password works
      await login(c.email, 'nova-senha-456');
    });

    it('rejects wrong current password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set(auth(company.token))
        .send({ currentPassword: 'definitely-wrong', newPassword: 'nova-senha-456' })
        .expect(400);
      expect(res.body.message).toMatch(/incorreta/i);
    });
  });
});
