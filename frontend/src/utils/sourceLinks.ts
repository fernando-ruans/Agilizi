/**
 * Parses the structured CashTransaction.reference ("<kind>:<id>") written
 * by the auto-sync (sales, expenses, orders) into a deep link to the
 * source record. Free-text references (manual entries) return null.
 */
export interface SourceLink {
  path: string;
  label: string;
}

const SOURCES: Record<string, { path: string; label: string }> = {
  sale: { path: '/vendas', label: 'Ver a venda original' },
  expense: { path: '/despesas', label: 'Ver a despesa original' },
  order: { path: '/ordens-servico', label: 'Ver a ordem de serviço original' },
};

export function parseCashReference(reference?: string | null): SourceLink | null {
  if (!reference) return null;
  const match = /^(sale|expense|order):(.+)$/.exec(reference);
  if (!match) return null;

  const source = SOURCES[match[1]];
  if (!source) return null;

  // ?view=<id> makes the destination page fetch the record and open its
  // detail modal automatically (deep link)
  return { path: `${source.path}?view=${encodeURIComponent(match[2])}`, label: source.label };
}
