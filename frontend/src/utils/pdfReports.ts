import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';

// pdfmake 0.3 ships vfs_fonts as a flat { 'Roboto-Regular.ttf': ... } object.
// Older versions nested it under `.pdfMake.vfs` / `.vfs` — handle both.
// NOTE: we use Roboto (the only family bundled in vfs_fonts). Standard PDF
// fonts like Helvetica require loading build/standard-fonts/*.js separately,
// otherwise pdfmake throws "Font 'Helvetica' … is not defined".
(pdfMake as any).vfs = (pdfFonts as any).pdfMake
  ? (pdfFonts as any).pdfMake.vfs
  : (pdfFonts as any).vfs || pdfFonts;

const COLORS = {
  primary: '#1e293b',
  accent: '#d97706',
  muted: '#64748b',
  border: '#e2e8f0',
  bg: '#f8fafc',
};

export interface ReportMeta {
  title: string;
  subtitle?: string;
  companyName: string;
  period?: string;
  /** Full company contact block — printed in the header of every PDF */
  company?: {
    tradeName?: string;
    document?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

/** Contact lines of the emitting company (CNPJ, phone, email, address). */
function companyLines(meta: ReportMeta): string[] {
  const c = meta.company;
  if (!c) return [];
  const lines: string[] = [];
  if (c.tradeName && c.tradeName !== meta.companyName) lines.push(c.tradeName);
  if (c.document) lines.push(`CNPJ: ${c.document}`);
  if (c.phone) lines.push(`Telefone: ${c.phone}`);
  if (c.email) lines.push(`Email: ${c.email}`);
  const locality = [
    c.address,
    c.city && c.state ? `${c.city}/${c.state}` : c.city,
    c.zipCode ? `CEP ${c.zipCode}` : '',
  ].filter(Boolean).join(' · ');
  if (locality) lines.push(locality);
  return lines;
}

function header(meta: ReportMeta): Content[] {
  const contact = companyLines(meta);
  return [
    {
      columns: [
        {
          width: '58%',
          stack: [
            { text: meta.companyName, style: 'companyName' },
            contact.length > 0
              ? { text: contact.join('\n'), style: 'companyContact' }
              : { text: 'Agilzi — Sistema de Gestão', style: 'systemName' },
          ],
        },
        {
          width: '42%',
          stack: [
            { text: meta.title, style: 'reportTitle', alignment: 'right' },
            ...(meta.period ? [{ text: `Período: ${meta.period}`, style: 'period', alignment: 'right' as const }] : []),
            { text: `Emitido em ${new Date().toLocaleDateString('pt-BR')}`, style: 'period', alignment: 'right' as const },
          ],
        },
      ],
      margin: [0, 0, 0, 16],
    },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: COLORS.accent }],
      margin: [0, 0, 0, 16],
    },
  ];
}

function footer(pageCount: number): any {
  return {
    columns: [
      { text: `Gerado em ${new Date().toLocaleString('pt-BR')}`, style: 'footer', alignment: 'left' },
      { text: `Página ${pageCount}`, style: 'footer', alignment: 'right' },
    ],
    margin: [40, 20, 40, 0],
  };
}

function kpiRow(items: { label: string; value: string }[]): Content {
  return {
    columns: items.map((kpi) => ({
      stack: [
        { text: kpi.value, style: 'kpiValue' },
        { text: kpi.label, style: 'kpiLabel' },
      ],
      width: '*',
      margin: [0, 0, 0, 14],
    })),
  };
}

function dataTable(headerRow: string[], rows: (string | number)[][], alignments?: ('left' | 'right' | 'center')[]): Content {
  const headerCells: TableCell[] = headerRow.map((h) => ({
    text: h,
    style: 'tableHeader',
    alignment: 'left',
  }));
  const body: TableCell[][] = [
    headerCells,
    ...rows.map((r) => r.map((cell, i) => ({
      text: String(cell),
      style: 'tableCell',
      alignment: alignments?.[i] || 'left',
    }))),
  ];

  return {
    table: {
      headerRows: 1,
      widths: headerRow.map(() => '*'),
      body,
    },
    layout: {
      hLineColor: () => COLORS.border,
      vLineColor: () => COLORS.border,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.primary : rowIndex % 2 === 0 ? COLORS.bg : null),
    },
    margin: [0, 0, 0, 14],
  };
}

const styles: any = {
  companyName: { fontSize: 13, bold: true, color: COLORS.primary },
  companyContact: { fontSize: 8, color: COLORS.muted, margin: [0, 3, 0, 0], lineHeight: 1.35 },
  systemName: { fontSize: 8, color: COLORS.muted, margin: [0, 2, 0, 0] },
  // Single documents (OS / Budget)
  docLabel: { fontSize: 7, color: COLORS.muted, margin: [0, 5, 0, 1] },
  docValue: { fontSize: 9.5, color: '#334155' },
  docValueStrong: { fontSize: 10.5, bold: true, color: COLORS.primary },
  docBody: { fontSize: 9.5, color: '#334155', margin: [0, 0, 0, 8], lineHeight: 1.4 },
  docTotalLine: { fontSize: 10, color: COLORS.muted, alignment: 'right' },
  docTotal: { fontSize: 13, bold: true, color: COLORS.primary, alignment: 'right', margin: [0, 3, 0, 0] },
  reportTitle: { fontSize: 15, bold: true, color: COLORS.primary },
  period: { fontSize: 9, color: COLORS.muted, margin: [0, 3, 0, 0] },
  kpiValue: { fontSize: 16, bold: true, color: COLORS.primary, alignment: 'center' },
  kpiLabel: { fontSize: 8, color: COLORS.muted, alignment: 'center', margin: [0, 2, 0, 0] },
  tableHeader: { fontSize: 8, bold: true, color: '#ffffff' },
  tableCell: { fontSize: 9, color: '#334155' },
  footer: { fontSize: 7, color: COLORS.muted },
  sectionTitle: { fontSize: 11, bold: true, color: COLORS.primary, margin: [0, 8, 0, 6] },
  note: { fontSize: 8, color: COLORS.muted, italics: true, margin: [0, 4, 0, 0] },
};

function build(meta: ReportMeta, body: Content[], headerOverride?: Content[]): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    content: [...(headerOverride ?? header(meta)), ...body],
    styles,
    // Roboto is the family bundled in vfs_fonts — Helvetica would need the
    // separate standard-fonts loader (see note at the top of this file)
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    footer: (currentPage: number, pageCount: number) => (currentPage === 1 ? undefined : footer(pageCount)),
  };
}

function download(doc: TDocumentDefinitions, filename: string) {
  pdfMake.createPdf(doc).download(filename);
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
}

// ── Financial report ──
export function financialPdf(meta: ReportMeta, data: {
  entradas: number; saidas: number; saldo: number;
  transactions: { date: string; description: string; category: string; type: string; value: number }[];
}): void {
  const body: Content[] = [
    { text: 'Resumo financeiro', style: 'sectionTitle' },
    kpiRow([
      { label: 'ENTRADAS', value: brl(data.entradas) },
      { label: 'SAÍDAS', value: brl(data.saidas) },
      { label: 'SALDO', value: brl(data.saldo) },
    ]),
    { text: 'Transações', style: 'sectionTitle' },
    dataTable(
      ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'],
      data.transactions.map((t) => [
        new Date(t.date).toLocaleDateString('pt-BR'),
        t.description,
        t.category,
        t.type === 'entrada' ? 'Entrada' : 'Saída',
        brl(t.value),
      ]),
      ['left', 'left', 'left', 'center', 'right']
    ),
  ];
  download(build(meta, body), `relatorio-financeiro-${slug(meta.companyName)}.pdf`);
}

// ── Clients report ──
export function clientsPdf(meta: ReportMeta, clients: {
  name: string; document?: string; phone?: string; email?: string; city?: string;
}[]): void {
  const body: Content[] = [
    kpiRow([{ label: 'TOTAL DE CLIENTES', value: String(clients.length) }]),
    dataTable(
      ['Nome', 'Documento', 'Telefone', 'Email', 'Cidade'],
      clients.map((c) => [c.name, c.document || '—', c.phone || '—', c.email || '—', c.city || '—'])
    ),
  ];
  download(build(meta, body), `relatorio-clientes-${slug(meta.companyName)}.pdf`);
}

// ── Shared layout for single documents (OS / Budget) sent to clients ──
export interface Issuer {
  companyName: string;
  company?: ReportMeta['company'];
}

function docHeader(issuer: Issuer, docTitle: string, docNumber: string): Content[] {
  const contact = companyLines({ companyName: issuer.companyName, company: issuer.company } as ReportMeta);
  return [
    {
      columns: [
        {
          width: '58%',
          stack: [
            { text: issuer.companyName, style: 'companyName' },
            contact.length > 0
              ? { text: contact.join('\n'), style: 'companyContact' }
              : { text: 'Agilzi — Sistema de Gestão', style: 'systemName' },
          ],
        },
        {
          width: '42%',
          stack: [
            { text: docTitle, style: 'reportTitle', alignment: 'right' },
            { text: docNumber, style: 'period', alignment: 'right' },
            { text: `Emitido em ${new Date().toLocaleDateString('pt-BR')}`, style: 'period', alignment: 'right' },
          ],
        },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: COLORS.accent }],
      margin: [0, 0, 0, 14],
    },
  ];
}

/** Rows of label/value pairs, borderless — every row padded to the widest. */
type InfoCell = { label: string; value: string; strong?: boolean };

function infoGrid(rows: InfoCell[][]): Content {
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (row: InfoCell[]): InfoCell[] => [
    ...row,
    ...Array.from({ length: cols - row.length }, (): InfoCell => ({ label: '', value: '' })),
  ];

  const body: any[] = [];
  rows.forEach((raw) => {
    const row = pad(raw);
    body.push(row.map((c) => ({ text: c.label, style: 'docLabel' })));
    body.push(row.map((c) => ({ text: c.value, style: c.strong ? 'docValueStrong' : 'docValue' })));
  });
  return {
    table: { widths: Array.from({ length: cols }, () => '*'), body },
    layout: 'noBorders',
    margin: [0, 0, 0, 12],
  } as Content;
}

function totalsBlock(subtotal: number, discount: number, total: number): Content {
  const lines: Content[] = [];
  if (discount > 0) {
    lines.push({ text: `Subtotal: ${brl(subtotal)}`, style: 'docTotalLine' });
    lines.push({ text: `Desconto: −${brl(discount)}`, style: 'docTotalLine' });
  }
  lines.push({ text: `TOTAL: ${brl(total)}`, style: 'docTotal' });
  return { columns: [{ canvas: [] }, { width: 230, stack: lines, alignment: 'right' }], margin: [0, 6, 0, 8] };
}

function signatureSection(label: string): Content {
  return {
    columns: [
      {
        width: 230,
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: COLORS.muted }], margin: [0, 44, 0, 4] },
          { text: label, style: 'period' },
        ],
      },
    ],
    margin: [0, 24, 0, 0],
  };
}

interface DocItem {
  service?: string;
  description?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

function itemsTableDoc(items: DocItem[]): Content {
  if (items.length === 0) return { text: 'Nenhum serviço lançado.', style: 'note' };
  return dataTable(
    ['Serviço', 'Qtd', 'Valor unit.', 'Total'],
    items.map((i) => [i.service || i.description || '—', String(i.quantity), brl(i.unitValue), brl(i.totalValue)]),
    ['left', 'right', 'right', 'right']
  );
}

// ── Order (OS) — single document to send to the client ──
export function orderDocPdf(issuer: Issuer, order: {
  number: number;
  status: string;
  priority?: string;
  description?: string;
  notes?: string;
  createdAt: string;
  endDate?: string;
  client?: { name: string; document?: string; phone?: string; email?: string };
  technician?: string;
  discount?: number;
  totalValue: number;
  items: DocItem[];
}): void {
  const statusLabels: Record<string, string> = {
    aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada',
  };
  const priorityLabels: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };
  const subtotal = order.items.reduce((s, i) => s + i.totalValue, 0);
  const client = order.client;

  const body: Content[] = [
    infoGrid([
      [
        { label: 'CLIENTE', value: client?.name || 'Consumidor final' },
        { label: 'TÉCNICO', value: order.technician || '—' },
        { label: 'STATUS', value: statusLabels[order.status] || order.status, strong: true },
        { label: 'PRIORIDADE', value: priorityLabels[order.priority || ''] || '—' },
      ],
      [
        { label: 'ABERTURA', value: new Date(order.createdAt).toLocaleDateString('pt-BR') },
        { label: 'CONCLUSÃO', value: order.endDate ? new Date(order.endDate).toLocaleDateString('pt-BR') : '—' },
        { label: 'CONTATO', value: [client?.phone, client?.email].filter(Boolean).join(' · ') || '—' },
        { label: 'DOCUMENTO', value: client?.document || '—' },
      ],
    ]),
    ...(order.description
      ? [{ text: 'Descrição do serviço', style: 'sectionTitle' }, { text: order.description, style: 'docBody' } as Content]
      : []),
    { text: 'Serviços', style: 'sectionTitle' },
    itemsTableDoc(order.items),
    totalsBlock(subtotal, order.discount || 0, order.totalValue),
    ...(order.notes
      ? [{ text: 'Observações', style: 'sectionTitle' }, { text: order.notes, style: 'docBody' } as Content]
      : []),
    // Internal status history is intentionally NOT part of the client-facing
    // document (it stays visible in the app's view modal)
    signatureSection('Assinatura do cliente'),
  ];

  download(
    build(
      { companyName: issuer.companyName, company: issuer.company, title: 'Ordem de Serviço' },
      body,
      docHeader(issuer, 'ORDEM DE SERVIÇO', `Nº ${String(order.number).padStart(4, '0')}`),
    ),
    `os-${String(order.number).padStart(4, '0')}-${slug(issuer.companyName)}.pdf`
  );
}

// ── Budget (Orçamento) — single proposal to send to the client ──
export function budgetDocPdf(issuer: Issuer, budget: {
  number: number;
  status: string;
  createdAt: string;
  validUntil?: string;
  notes?: string;
  client?: { name: string; document?: string; phone?: string; email?: string };
  discount?: number;
  totalValue: number;
  items: DocItem[];
}): void {
  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
    rejeitado: 'Rejeitado', convertido: 'Convertido',
  };
  const subtotal = budget.items.reduce((s, i) => s + i.totalValue, 0);
  const client = budget.client;

  const body: Content[] = [
    infoGrid([
      [
        { label: 'CLIENTE', value: client?.name || 'Consumidor final' },
        { label: 'STATUS', value: statusLabels[budget.status] || budget.status, strong: true },
        { label: 'EMISSÃO', value: new Date(budget.createdAt).toLocaleDateString('pt-BR') },
        { label: 'VÁLIDO ATÉ', value: budget.validUntil ? new Date(budget.validUntil).toLocaleDateString('pt-BR') : '—', strong: true },
      ],
      [
        { label: 'CONTATO', value: [client?.phone, client?.email].filter(Boolean).join(' · ') || '—' },
        { label: 'DOCUMENTO', value: client?.document || '—' },
      ],
    ]),
    { text: 'Serviços', style: 'sectionTitle' },
    itemsTableDoc(budget.items),
    totalsBlock(subtotal, budget.discount || 0, budget.totalValue),
    ...(budget.notes
      ? [{ text: 'Condições e observações', style: 'sectionTitle' }, { text: budget.notes, style: 'docBody' } as Content]
      : []),
    ...(budget.validUntil
      ? [{ text: `Proposta válida até ${new Date(budget.validUntil).toLocaleDateString('pt-BR')}.`, style: 'note' } as Content]
      : []),
    signatureSection('Aceite do cliente'),
  ];

  download(
    build(
      { companyName: issuer.companyName, company: issuer.company, title: 'Orçamento' },
      body,
      docHeader(issuer, 'ORÇAMENTO', `Nº ${String(budget.number).padStart(4, '0')}`),
    ),
    `orcamento-${String(budget.number).padStart(4, '0')}-${slug(issuer.companyName)}.pdf`
  );
}

// ── Profitability report (products / loja) ──
export function marginsPdf(meta: ReportMeta, summary: {
  revenue: number; cost: number; profit: number; marginPct: number | null; missingCostCount: number;
}, products: {
  name: string; quantity: number; revenue: number; cost: number; profit: number; marginPct: number | null;
}[]): void {
  const body: Content[] = [
    { text: 'Resumo de rentabilidade', style: 'sectionTitle' },
    kpiRow([
      { label: 'FATURAMENTO', value: brl(summary.revenue) },
      { label: 'CUSTO', value: brl(summary.cost) },
      { label: 'LUCRO', value: brl(summary.profit) },
      { label: 'MARGEM', value: summary.marginPct != null ? `${summary.marginPct.toFixed(1)}%` : '—' },
    ]),
    ...(products.length > 0
      ? [
          { text: 'Por produto', style: 'sectionTitle' } as Content,
          dataTable(
            ['Produto', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem'],
            products.map((p) => [
              p.name,
              String(p.quantity),
              brl(p.revenue),
              p.marginPct == null && p.cost === 0 ? 's/ custo' : brl(p.cost),
              brl(p.profit),
              p.marginPct != null ? `${p.marginPct.toFixed(0)}%` : '—',
            ]),
            ['left', 'right', 'right', 'right', 'right', 'right']
          ),
        ]
      : [{ text: 'Nenhuma venda concluída no período selecionado.', style: 'note' } as Content]),
    ...(summary.missingCostCount > 0
      ? [{ text: `⚠ ${summary.missingCostCount} item(ns) vendidos sem preço de custo cadastrado — o lucro exibido é um piso. Cadastre o custo para um número exato.`, style: 'note' } as Content]
      : []),
  ];
  download(build(meta, body), `relatorio-rentabilidade-${slug(meta.companyName)}.pdf`);
}

// ── Sales report ──
export function salesPdf(meta: ReportMeta, sales: {
  number: number; client?: string; status: string; paymentMethod?: string; totalValue: number; date: string; items?: number;
}[], summary: { total: number; count: number; ticket: number }): void {
  const paymentLabels: Record<string, string> = {
    dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
    pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto',
  };
  const cancelled = sales.filter((s) => s.status === 'cancelada');
  const body: Content[] = [
    { text: 'Resumo de vendas', style: 'sectionTitle' },
    kpiRow([
      { label: 'VENDAS', value: String(summary.count) },
      { label: 'FATURAMENTO', value: brl(summary.total) },
      { label: 'TICKET MÉDIO', value: brl(summary.ticket) },
      { label: 'CANCELADAS', value: String(cancelled.length) },
    ]),
    { text: 'Vendas no período', style: 'sectionTitle' },
    dataTable(
      ['Nº', 'Cliente', 'Status', 'Pagamento', 'Data', 'Total'],
      sales.map((s) => [
        `#${String(s.number).padStart(4, '0')}`,
        s.client || 'Balcão',
        s.status === 'concluida' ? 'Concluída' : 'Cancelada',
        paymentLabels[s.paymentMethod || ''] || '—',
        new Date(s.date).toLocaleDateString('pt-BR'),
        brl(s.totalValue),
      ]),
      ['left', 'left', 'left', 'left', 'left', 'right']
    ),
  ];
  download(build(meta, body), `relatorio-vendas-${slug(meta.companyName)}.pdf`);
}

// ── Expenses report ──
export function expensesPdf(meta: ReportMeta, expenses: {
  description: string; category: string; supplier?: string; status: string; paymentMethod?: string; value: number; date: string;
}[], summary: { total: number; count: number; pending: number }): void {
  const statusLabels: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', atrasado: 'Atrasado' };
  const paymentLabels: Record<string, string> = {
    dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
    pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto',
  };

  const body: Content[] = [
    { text: 'Resumo de despesas', style: 'sectionTitle' },
    kpiRow([
      { label: 'DESPESAS', value: String(summary.count) },
      { label: 'TOTAL', value: brl(summary.total) },
      { label: 'PENDENTE', value: brl(summary.pending) },
      { label: 'PAGO', value: brl(summary.total - summary.pending) },
    ]),
    { text: 'Despesas no período', style: 'sectionTitle' },
    dataTable(
      ['Descrição', 'Categoria', 'Fornecedor', 'Pagamento', 'Data', 'Status', 'Valor'],
      expenses.map((e) => [
        e.description,
        e.category,
        e.supplier || '—',
        paymentLabels[e.paymentMethod || ''] || '—',
        new Date(e.date).toLocaleDateString('pt-BR'),
        statusLabels[e.status] || e.status,
        brl(e.value),
      ]),
      ['left', 'left', 'left', 'left', 'left', 'left', 'right']
    ),
  ];
  download(build(meta, body), `relatorio-despesas-${slug(meta.companyName)}.pdf`);
}

export function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
