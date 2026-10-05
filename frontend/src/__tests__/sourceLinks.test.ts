import { describe, it, expect } from 'vitest';
import { parseCashReference } from '../utils/sourceLinks';

describe('parseCashReference', () => {
  it('links sales to the sales page', () => {
    expect(parseCashReference('sale:abc123')).toEqual({
      path: '/vendas?view=abc123',
      label: 'Ver a venda original',
    });
  });

  it('links expenses to the expenses page', () => {
    expect(parseCashReference('expense:xyz')).toEqual({
      path: '/despesas?view=xyz',
      label: 'Ver a despesa original',
    });
  });

  it('links orders to the orders page', () => {
    expect(parseCashReference('order:42')).toEqual({
      path: '/ordens-servico?view=42',
      label: 'Ver a ordem de serviço original',
    });
  });

  it('returns null for manual/free-text references', () => {
    expect(parseCashReference('OS #0001')).toBeNull();
    expect(parseCashReference('qualquer coisa')).toBeNull();
  });

  it('returns null for empty/missing references', () => {
    expect(parseCashReference(null)).toBeNull();
    expect(parseCashReference(undefined)).toBeNull();
    expect(parseCashReference('')).toBeNull();
  });

  it('ignores unknown kinds (future-proof)', () => {
    expect(parseCashReference('budget:123')).toBeNull();
  });

  it('encodes the id to keep the URL safe', () => {
    expect(parseCashReference('sale:a b/c')?.path).toBe('/vendas?view=a%20b%2Fc');
  });
});
