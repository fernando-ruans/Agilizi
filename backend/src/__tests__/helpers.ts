import request from 'supertest';
import app from '../app';

export interface TestCompany {
  token: string;
  companyId: string;
  userId: string;
  email: string;
}

let counter = 0;

/**
 * Registers a brand-new company + admin user and returns an auth token.
 * Every call creates an isolated tenant — used for multi-tenancy tests.
 */
export async function registerCompany(opts?: {
  type?: 'loja' | 'prestador' | 'ambos';
  prefix?: string;
}): Promise<TestCompany> {
  counter += 1;
  const prefix = opts?.prefix || 'test';
  const email = `${prefix}${counter}-${Date.now()}@example.com`;
  const companyName = `${prefix}-company-${counter}-${Date.now()}`;

  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Test Admin',
      email,
      password: 'secret123',
      companyName,
      companyType: opts?.type || 'ambos',
    })
    .expect(201);

  return {
    token: res.body.data.token,
    companyId: res.body.data.company.id,
    userId: res.body.data.user.id,
    email,
  };
}

/** Logs in an existing company's admin. */
export async function login(email: string, password = 'secret123'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.data.token;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Creates a client and returns its id. */
export async function createClient(token: string, name = 'Cliente Teste'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/clients')
    .set(auth(token))
    .send({
      name,
      // Keep ASCII: accented names (e.g. "Permissões") would produce an invalid email
      email: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ex.com`,
    })
    .expect(201);
  return res.body.data.id;
}

/** Creates a product and returns { id, stock }. */
export async function createProduct(
  token: string,
  overrides: Partial<{ name: string; price: number; costPrice: number; stock: number; minStock: number }> = {}
): Promise<{ id: string; stock: number }> {
  const res = await request(app)
    .post('/api/v1/products')
    .set(auth(token))
    .send({
      name: overrides.name || `Produto ${Date.now()}${Math.random()}`,
      price: overrides.price ?? 50,
      stock: overrides.stock ?? 10,
      minStock: overrides.minStock ?? 2,
      ...overrides,
    })
    .expect(201);
  return { id: res.body.data.id, stock: res.body.data.stock };
}

export function clearDb() {
  // Kept for symmetry with globalSetup; the file DB is recreated per run
}
