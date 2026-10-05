import { describe, it, expect } from 'vitest';
import {
  formatCurrency, formatDate, formatDocument, formatPhone, parseCurrency,
  maskDocumentInput, maskPhoneInput, UF_LIST,
} from '../utils/formatters';

describe('formatters', () => {
  it('formats currency as BRL', () => {
    expect(formatCurrency(1500.5)).toMatch(/R\$\s*1\.500,50/);
    expect(formatCurrency(0)).toMatch(/R\$\s*0,00/);
    // pt-BR places the minus sign before the symbol: -R$ 100,00
    expect(formatCurrency(-100)).toMatch(/-R\$\s*100,00/);
  });

  it('formats dates as pt-BR', () => {
    const out = formatDate('2026-09-26T12:00:00.000Z');
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('formats CPF', () => {
    expect(formatDocument('12345678900', 'cpf')).toBe('123.456.789-00');
  });

  it('formats CNPJ', () => {
    expect(formatDocument('12345678000190', 'cnpj')).toBe('12.345.678/0001-90');
  });

  it('auto-detects document type by length', () => {
    expect(formatDocument('12345678000190')).toBe('12.345.678/0001-90');
    expect(formatDocument('12345678900')).toBe('123.456.789-00');
  });

  it('formats phone numbers', () => {
    expect(formatPhone('11999991234')).toBe('(11) 99999-1234');
    expect(formatPhone('1133334567')).toBe('(11) 3333-4567');
  });

  it('parses currency strings back to numbers', () => {
    expect(parseCurrency('R$ 1.500,50')).toBe(1500.5);
    expect(parseCurrency('')).toBe(0);
  });

  it('masks document input live (CPF/CNPJ with overflow cut)', () => {
    expect(maskDocumentInput('12345678900', 'cpf')).toBe('123.456.789-00');
    expect(maskDocumentInput('12345678000190', 'cnpj')).toBe('12.345.678/0001-90');
    expect(maskDocumentInput('12345678900123123123', 'cpf')).toBe('123.456.789-00');
    expect(maskDocumentInput('12345678901')).toBe('123.456.789-01');
    expect(maskDocumentInput('12345678901234')).toBe('12.345.678/9012-34');
  });

  it('masks phone input live (10/11 digits)', () => {
    expect(maskPhoneInput('11999991234')).toBe('(11) 99999-1234');
    expect(maskPhoneInput('1133334567')).toBe('(11) 3333-4567');
    expect(maskPhoneInput('(11) 99999-123456789')).toBe('(11) 99999-1234');
  });

  it('lists all 27 UFs', () => {
    expect(UF_LIST).toHaveLength(27);
    expect(UF_LIST).toContain('BA');
  });
});
