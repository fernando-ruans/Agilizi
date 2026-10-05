export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function formatCPF(value: string): string {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCNPJ(value: string): string {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 11) {
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

export function formatDocument(value: string, type?: string | null): string {
  const numbers = value.replace(/\D/g, '');
  if (type === 'cnpj' || numbers.length === 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const amount = parseInt(numbers, 10) / 100;
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Live input masks (truncate overflow instead of rejecting keystrokes). */
export function maskPhoneInput(value: string): string {
  return formatPhone(value.replace(/\D/g, '').slice(0, 11));
}

export function maskDocumentInput(value: string, type?: string | null): string {
  const max = type === 'cpf' ? 11 : 14;
  const numbers = value.replace(/\D/g, '').slice(0, max);
  if (type === 'cnpj' || (!type && numbers.length > 11)) return formatCNPJ(numbers);
  return formatCPF(numbers);
}

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export function parseCurrency(value: string): number {
  return Number(value.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
}
