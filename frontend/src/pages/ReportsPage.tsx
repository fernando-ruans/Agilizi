import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, Users, ShoppingCart, Receipt, Percent,
  FileDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Loading';
import { formatCurrency } from '../utils/formatters';
import {
  DateRangePicker, DEFAULT_RANGE, formatRange, rangeParams,
  type DateRangeValue,
} from '../components/DateRangePicker';

// pdfmake ships ~2MB of fonts — load it only when a PDF is actually generated
type PdfModule = typeof import('../utils/pdfReports');
let pdfModule: PdfModule | null = null;
async function getPdf(): Promise<PdfModule> {
  if (!pdfModule) pdfModule = await import('../utils/pdfReports');
  return pdfModule;
}

const PAGE_SIZE = 200;
const MAX_PAGES = 50; // safety cap: 10k records per report

/**
 * Fetches ALL records in a period (paginating), so reports never silently
 * truncate as the company accumulates data over the years.
 */
async function fetchAll(
  url: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<any[]> {
  const items: any[] = [];
  let page = 1;
  for (;;) {
    const { data } = await api.get(url, { params: { ...params, page, limit: PAGE_SIZE }, signal });
    items.push(...data.data);
    if (data.data.length < PAGE_SIZE || page >= MAX_PAGES) break;
    page += 1;
  }
  return items;
}

interface ReportCard {
  key: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  count: number | null;
  countLabel?: string;
  /** Extra highlight shown under the description (e.g. profit of the period) */
  extra?: string;
  onClick: () => void | Promise<void>;
  show: boolean;
}

export default function ReportsPage() {
  const { company } = useAuth();
  const [range, setRange] = useState<DateRangeValue>(DEFAULT_RANGE);
  const [generating, setGenerating] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const companyType = company?.type || 'ambos';
  const abortRef = useRef<AbortController>();

  const loadPreview = useCallback(async (value: DateRangeValue, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = rangeParams(value);
      const [cash, expenses, orders, sales, margin] = await Promise.all([
        fetchAll('/cash', params, signal),
        fetchAll('/expenses', params, signal),
        fetchAll('/orders', params, signal),
        fetchAll('/sales', params, signal),
        api.get('/reports/margin', { params, signal }).then((r) => r.data.data),
      ]);
      if (signal?.aborted) return;
      setPreview({ cash, expenses, orders, sales, margin });
    } catch {
      if (!signal?.aborted) toast.error('Erro ao carregar dados');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadPreview(range, controller.signal);
    return () => controller.abort();
  }, [range, loadPreview]);

  const meta = (title: string) => ({
    title,
    companyName: company?.name || 'Empresa',
    period: formatRange(range),
    // Contact block printed in every PDF header
    company: company ? {
      tradeName: company.tradeName,
      document: company.document,
      phone: company.phone,
      email: company.email,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
    } : undefined,
  });

  const run = async (key: string, fn: () => void | Promise<void>) => {
    setGenerating(key);
    try {
      // Small delay lets the UI show the spinner
      await new Promise((r) => setTimeout(r, 150));
      await fn();
      toast.success('PDF gerado!');
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally { setGenerating(null); }
  };

  const buildFinancial = async () => {
    const { financialPdf } = await getPdf();
    const entradas = preview.cash.filter((t: any) => t.type === 'entrada').reduce((s: number, t: any) => s + t.value, 0);
    const saidas = preview.cash.filter((t: any) => t.type === 'saida').reduce((s: number, t: any) => s + t.value, 0);
    financialPdf(meta('Relatório Financeiro'), {
      entradas, saidas, saldo: entradas - saidas,
      transactions: preview.cash.map((t: any) => ({
        date: t.date, description: t.description, category: t.category, type: t.type, value: t.value,
      })),
    });
  };

  const buildSales = async () => {
    const { salesPdf } = await getPdf();
    const items = preview.sales.filter((s: any) => s.status === 'concluida');
    const total = items.reduce((s: number, x: any) => s + x.totalValue, 0);
    salesPdf(
      meta('Relatório de Vendas'),
      preview.sales.map((s: any) => ({
        number: s.number, client: s.client?.name, status: s.status,
        paymentMethod: s.paymentMethod,
        totalValue: s.totalValue, date: s.createdAt,
      })),
      { total, count: items.length, ticket: items.length ? total / items.length : 0 }
    );
  };

  const buildExpenses = async () => {
    const { expensesPdf } = await getPdf();
    const total = preview.expenses.reduce((s: number, e: any) => s + e.value, 0);
    const pending = preview.expenses.filter((e: any) => e.status !== 'pago').reduce((s: number, e: any) => s + e.value, 0);
    expensesPdf(
      meta('Relatório de Despesas'),
      preview.expenses.map((e: any) => ({
        description: e.description, category: e.category,
        supplier: e.supplier?.name, paymentMethod: e.paymentMethod,
        status: e.status, value: e.value, date: e.date,
      })),
      { total, count: preview.expenses.length, pending }
    );
  };

  const buildClients = async () => {
    const { clientsPdf } = await getPdf();
    const items = await fetchAll('/clients', {});
    clientsPdf(meta('Relatório de Clientes'), items.map((c: any) => ({
      name: c.name, document: c.document, phone: c.phone, email: c.email, city: c.city,
    })));
  };

  const reportCards: ReportCard[] = [
    {
      key: 'financial', title: 'Financeiro', desc: 'Entradas, saídas e saldo por período',
      icon: BarChart3, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      count: preview?.cash?.length ?? 0, onClick: async () => buildFinancial(),
      show: true,
    },
    {
      key: 'clients', title: 'Clientes', desc: 'Lista completa da base de clientes',
      icon: Users, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
      count: null, onClick: buildClients,
      show: true,
    },
    {
      key: 'sales', title: 'Vendas', desc: 'Vendas, faturamento e ticket médio',
      icon: ShoppingCart, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
      count: preview?.sales?.length ?? 0, onClick: async () => buildSales(),
      show: companyType !== 'prestador',
    },
    {
      key: 'expenses', title: 'Despesas', desc: 'Despesas por categoria e status',
      icon: Receipt, color: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
      count: preview?.expenses?.length ?? 0, onClick: async () => buildExpenses(),
      show: true,
    },
    {
      key: 'margins', title: 'Rentabilidade', desc: 'Lucro e margem por produto no período',
      icon: Percent, color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300',
      count: preview?.margin?.products?.length ?? 0,
      countLabel: 'produto',
      extra: preview?.margin
        ? `Lucro ${formatCurrency(preview.margin.profit)} · margem ${preview.margin.marginPct != null ? `${preview.margin.marginPct.toFixed(0)}%` : '—'}`
        : undefined,
      onClick: async () => {
        const { marginsPdf } = await getPdf();
        marginsPdf(meta('Relatório de Rentabilidade'), preview.margin, preview.margin.products);
      },
      show: companyType !== 'prestador',
    },
  ].filter((c) => c.show);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Relatórios" subtitle="Gere relatórios em PDF da sua operação" showAdd={false} />

      {/* Period selector: presets + custom start/end dates */}
      <div className="card min-w-0 p-4 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-gray-600 dark:text-slate-300">Período:</span>
          <DateRangePicker value={range} onChange={setRange} idPrefix="reports" />
        </div>
        <p className="text-[12px] text-gray-400 dark:text-slate-500" aria-live="polite">
          {formatRange(range)}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5"><div className="skeleton h-16 rounded" /></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.key} className="card p-5 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${card.color}`}>
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold text-gray-800 dark:text-slate-100">{card.title}</h3>
                    <p className="text-[12px] text-gray-400 mt-0.5 dark:text-slate-500">{card.desc}</p>
                    {card.extra && (
                      <p className="text-[12px] font-medium text-teal-700 mt-1 dark:text-teal-300">{card.extra}</p>
                    )}
                  </div>
                  {card.count !== null && (
                    <span className="badge badge-gray shrink-0">{card.count} {card.countLabel || 'registro'}{!card.countLabel && card.count !== 1 ? 's' : ''}{card.countLabel && card.count !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="mt-auto pt-3 border-t border-gray-50">
                  <button
                    disabled={generating !== null}
                    onClick={() => run(card.key, () => card.onClick())}
                    className="btn-secondary w-full"
                  >
                    {generating === card.key ? <Spinner size={13} /> : <FileDown size={13} />}
                    Gerar PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && preview && (
        <div className="card p-5 mt-6">
          <h3 className="text-[13px] font-semibold text-gray-700 mb-4 dark:text-slate-200">Prévia do período</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PreviewStat label="Transações" value={String(preview.cash.length)} />
            <PreviewStat label="Despesas" value={String(preview.expenses.length)} />
            <PreviewStat label="Ordens" value={String(preview.orders.length)} />
            <PreviewStat label="Vendas" value={String(preview.sales.length)} />
          </div>
          {preview.margin && preview.margin.salesCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
              <PreviewStat label="Faturamento" value={formatCurrency(preview.margin.revenue)} />
              <PreviewStat label="Custo" value={formatCurrency(preview.margin.cost)} />
              <PreviewStat label="Lucro" value={formatCurrency(preview.margin.profit)} />
              <PreviewStat label="Margem" value={preview.margin.marginPct != null ? `${preview.margin.marginPct.toFixed(1)}%` : '—'} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-md bg-gray-50 dark:bg-slate-800">
      <p className="text-[18px] font-semibold text-gray-800 tabular-nums dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5 dark:text-slate-500">{label}</p>
    </div>
  );
}
