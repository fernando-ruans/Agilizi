import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { registerCompany, auth, TestCompany } from './helpers';


type FetchCall = string[];
const fetchCalls: FetchCall = [];

const viaCepOk = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
};

const brasilApiOk = {
  cep: 1310100,
  street: 'Avenida Paulista',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

function mockFetch(handlers: Record<string, () => Response | Promise<Response>>) {
  const impl = vi.fn(async (input: any) => {
    const url = String(input);
    fetchCalls.push(url);
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) return handler();
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', impl);
  return impl;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('CEP API', () => {
  let tenant: TestCompany;

  beforeAll(async () => {
    tenant = await registerCompany({ prefix: 'cep' });
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('requires authentication (401)', async () => {
    await request(app).get('/api/v1/cep/01310100').expect(401);
  });

  it('rejects malformed CEPs (400)', async () => {
    for (const bad of ['123', 'abcdefgh', '013101001']) {
      const res = await request(app)
        .get(`/api/v1/cep/${bad}`)
        .set(auth(tenant.token));
      expect(res.status, `cep=${bad}`).toBe(400);
    }
  });

  it('resolves via ViaCEP and normalizes the shape', async () => {
    mockFetch({
      'viacep.com.br': () => jsonResponse(viaCepOk),
    });

    const res = await request(app)
      .get('/api/v1/cep/01310-100')
      .set(auth(tenant.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      cep: '01310-100',
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
    expect(fetchCalls.some((u) => u.includes('viacep'))).toBe(true);
    expect(fetchCalls.some((u) => u.includes('brasilapi'))).toBe(false);
  });

  it('falls back to BrasilAPI when ViaCEP errors', async () => {
    // Distinct CEP so the cache from the previous test doesn't answer here
    mockFetch({
      'viacep.com.br': () => jsonResponse({ erro: true }),
      'brasilapi.com.br': () => jsonResponse(brasilApiOk),
    });

    const res = await request(app)
      .get('/api/v1/cep/01310101')
      .set(auth(tenant.token));

    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe('São Paulo');
    expect(res.body.data.cep).toBe('01310100');
    expect(fetchCalls.some((u) => u.includes('brasilapi'))).toBe(true);
  });

  it('404 when both APIs say the CEP does not exist', async () => {
    mockFetch({
      'viacep.com.br': () => jsonResponse({ erro: true }),
      'brasilapi.com.br': () => jsonResponse({ message: 'CEP not found' }, 404),
    });

    await request(app)
      .get('/api/v1/cep/99999999')
      .set(auth(tenant.token))
      .expect(404);
  });

  it('502 when both upstreams are unreachable', async () => {
    mockFetch({
      'viacep.com.br': () => {
        throw new Error('network down');
      },
      'brasilapi.com.br': () => {
        throw new Error('network down');
      },
    });

    const res = await request(app)
      .get('/api/v1/cep/88888888')
      .set(auth(tenant.token));
    expect(res.status).toBe(502);
  });

  it('serves repeated lookups from cache (single upstream call)', async () => {
    const impl = mockFetch({
      'viacep.com.br': () => jsonResponse(viaCepOk),
    });

    const first = await request(app)
      .get('/api/v1/cep/01310-100')
      .set(auth(tenant.token));
    // Previous tests already resolved this CEP — must not hit the network again
    expect(first.status).toBe(200);
    const callsAfterFirst = fetchCalls.length;

    const second = await request(app)
      .get('/api/v1/cep/01310100')
      .set(auth(tenant.token));
    expect(second.status).toBe(200);
    expect(fetchCalls.length).toBe(callsAfterFirst);
    expect(impl).not.toHaveBeenCalled(); // cache served both requests
  });
});
