import { AppError, NotFoundError } from '../utils/errors';

export interface AddressResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

// In-memory cache, 24h TTL — CEPs basically never change, and this keeps
// repeated lookups (same address typed twice) off the upstream APIs.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: AddressResult; expires: number }>();

const UPSTREAM_TIMEOUT_MS = 5000;

function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Looks up a CEP via ViaCEP with BrasilAPI as fallback.
 * Both are keyless public APIs; only this feature requires internet.
 */
export async function lookupCep(rawCep: string): Promise<AddressResult> {
  const cep = normalizeCep(rawCep);
  if (!/^\d{8}$/.test(cep)) {
    throw new AppError('CEP inválido. Informe 8 dígitos.', 400);
  }

  const cached = cache.get(cep);
  if (cached && cached.expires > Date.now()) return cached.value;

  // --- ViaCEP (primary) ---
  const viaCep = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
  let result: AddressResult | null = null;

  if (viaCep && !viaCep.erro) {
    result = {
      cep: viaCep.cep,
      street: viaCep.logradouro || '',
      neighborhood: viaCep.bairro || '',
      city: viaCep.localidade || '',
      state: viaCep.uf || '',
    };
  }

  // --- BrasilAPI (fallback) ---
  if (!result) {
    const brasilApi = await fetchJson(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    if (brasilApi && brasilApi.street) {
      result = {
        cep: String(brasilApi.cep).padStart(8, '0'),
        street: brasilApi.street,
        neighborhood: brasilApi.neighborhood || '',
        city: brasilApi.city,
        state: brasilApi.state,
      };
    } else if (viaCep && viaCep.erro) {
      // Both APIs answered: this CEP simply doesn't exist
      throw new NotFoundError('CEP');
    } else {
      // At least one upstream unreachable (or both)
      throw new AppError('Não foi possível consultar o CEP. Tente novamente.', 502);
    }
  }

  cache.set(cep, { value: result, expires: Date.now() + CACHE_TTL_MS });
  return result;
}
