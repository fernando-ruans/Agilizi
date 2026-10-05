import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, TestCompany } from './helpers';

/**
 * Company profile validation: the settings form must only accept valid,
 * bounded data (no unbounded strings, no malformed CNPJ/phone/email/CEP).
 */
describe('Validação dos dados da empresa', () => {
  let tenant: TestCompany;

  beforeAll(async () => {
    tenant = await registerCompany({ prefix: 'company' });
  });

  const put = (body: Record<string, unknown>) =>
    request(app).put('/api/v1/companies/mine').set(auth(tenant.token)).send(body);

  const validBase = {
    name: 'Agilzi Demo Ltda',
    tradeName: 'Agilzi Demo',
    document: '12.345.678/0001-90',
    phone: '(11) 98888-7777',
    email: 'contato@agilzi.com',
    address: 'Avenida Paulista, 1000',
    city: 'São Paulo',
    state: 'sp',
    zipCode: '01310-100',
  };

  it('accepts a fully valid profile and normalizes the state to uppercase', async () => {
    const res = await put(validBase).expect(200);
    expect(res.body.data.name).toBe('Agilzi Demo Ltda');
    expect(res.body.data.state).toBe('SP');
    expect(res.body.data.zipCode).toBe('01310-100');
  });

  it('rejects an oversized name (no character overflow)', async () => {
    const res = await put({ ...validBase, name: 'x'.repeat(121) }).expect(400);
    expect(res.body.message).toMatch(/120 caracteres/);
  });

  it('rejects oversized optional fields', async () => {
    await put({ ...validBase, tradeName: 'x'.repeat(121) }).expect(400);
    await put({ ...validBase, address: 'x'.repeat(201) }).expect(400);
    await put({ ...validBase, city: 'x'.repeat(101) }).expect(400);
    await put({ ...validBase, phone: '9'.repeat(21) }).expect(400);
    await put({ ...validBase, email: `${'a'.repeat(146)}@x.com` }).expect(400);
  });

  it('rejects an invalid email', async () => {
    const res = await put({ ...validBase, email: 'nao-e-email' }).expect(400);
    expect(res.body.message).toMatch(/Email inválido/);
  });

  it('rejects a CNPJ without 14 digits', async () => {
    // 13 digits only
    const res = await put({ ...validBase, document: '123.456.789/0001' }).expect(400);
    expect(res.body.message).toMatch(/CNPJ deve ter 14 dígitos/);
  });

  it('rejects a phone with too few digits', async () => {
    await put({ ...validBase, phone: '1234' }).expect(400);
  });

  it('rejects an invalid state (must be a 2-letter UF)', async () => {
    const res = await put({ ...validBase, state: 'São Paulo' }).expect(400);
    expect(res.body.message).toMatch(/UF \(2 letras\)/);
  });

  it('rejects an invalid CEP', async () => {
    await put({ ...validBase, zipCode: '1234' }).expect(400);
  });

  it('accepts empty optional fields (clears them to null)', async () => {
    const res = await put({ ...validBase, document: '', phone: '', email: '', zipCode: '' }).expect(200);
    expect(res.body.data.document).toBeNull();
    expect(res.body.data.phone).toBeNull();
    expect(res.body.data.email).toBeNull();
    expect(res.body.data.zipCode).toBeNull();
  });

  it('persists the activity type (was silently ignored before)', async () => {
    const res = await put({ ...validBase, type: 'prestador' }).expect(200);
    expect(res.body.data.type).toBe('prestador');

    await put({ ...validBase, type: 'inexistente' }).expect(400);
  });

  it('requires a name', async () => {
    await put({ ...validBase, name: '' }).expect(400);
  });
});
