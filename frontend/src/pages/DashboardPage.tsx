import { useState, useEffect } from 'react';
import {
  Users, Truck, Wrench, ClipboardList, TrendingUp, TrendingDown,
  AlertTriangle, ArrowUpRight, Package, ShoppingCart, Percent,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Link } from 'react-router-dom';
import api from '../services/api';
import type { DashboardData } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SkeletonCard } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
import { DateRangePicker, DEFAULT_RANGE, applyPreset, rangeParams, type DateRangeValue } from '../components/DateRangePicker';

const CHART_COLORS = ['#64748b', '#f59e0b', '#10b981', '#ef4444'];
const statusLabels: Record<string, string> = {
  aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState<DateRangeValue>(() => applyPreset('365d', DEFAULT_RANGE));
  const [chartSeries, setChartSeries] = useState<any[] | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Chart series follows its own period filter (independent from KPIs above)
  useEffect(() => {
    const controller = new AbortController();
    setSeriesLoading(true);
    api
      .get('/dashboard/series', { params: rangeParams(chartRange), signal: controller.signal })
      .then((r) => setChartSeries(r.data.data))
      .catch((err) => { if (err?.code !== 'ERR_CANCELED') console.error(err); })
      .finally(() => { if (!controller.signal.aborted) setSeriesLoading(false); });
    return () => controller.abort();
  }, [chartRange]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const orderStatusData = Object.entries(data.orders.byStatus).map(([name, value]) => ({
    name: name.replace('_', ' '), value,
  }));

  // Prefer the filtered series; fall back to the dashboard payload while loading
  const series = chartSeries ?? data.cash.series;
  const hasData = Array.isArray(series) && series.some((s) => s.entradas > 0 || s.saidas > 0);
  // Once the user filters a period, keep the card visible (with an empty state)
  // so the filter control never disappears under their cursor.
  const hasSeries = hasData || chartSeries !== null;

  return (
    <div className="min-w-0">
      <PageHeader title="Dashboard" subtitle="Visão geral da sua operação" showAdd={false} />

      <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CountCard icon={Users} label="Clientes" value={data.counts.clients} />
        <CountCard icon={Truck} label="Fornecedores" value={data.counts.suppliers} />
        <CountCard icon={Wrench} label="Serviços" value={data.counts.services} />
        <CountCard
          icon={ClipboardList}
          label="OS este mês"
          value={data.orders.currentMonth.count}
          accent={formatCurrency(data.orders.currentMonth.totalValue)}
        />
      </div>

      {/* Products & sales KPIs (only meaningful when company has them) */}
      {((data.counts.products > 0 || data.sales.monthCount > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <CountCard icon={Package} label="Produtos ativos" value={data.counts.products} />
          <CountCard
            icon={ShoppingCart}
            label="Vendas no mês"
            value={data.sales.monthCount}
            accent={formatCurrency(data.sales.monthValue)}
          />
          <CountCard
            icon={Percent}
            label="Ticket médio"
            value={0}
            hideValue
            accent={formatCurrency(data.sales.ticket)}
          />
          <CountCard
            icon={TrendingUp}
            label="Lucro no mês"
            value={0}
            hideValue
            valueText={formatCurrency(data.sales.profit ?? 0)}
            accent={data.sales.marginPct != null
              ? `${data.sales.marginPct.toFixed(0)}% de margem`
              : (data.sales.monthCount > 0 ? 'custos sem cadastro' : '—')}
          />
        </div>
      )}

      {/* Low stock alert */}
      {data.products.lowStock > 0 && (
        <Link
          to="/produtos"
          className="flex items-center gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors dark:bg-amber-950/40 dark:border-amber-900 dark:hover:bg-amber-900/40"
        >
          <AlertTriangle size={17} className="text-amber-600 shrink-0 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
              {data.products.lowStock} produto{data.products.lowStock > 1 ? 's' : ''} com estoque baixo
            </p>
            <p className="text-[12px] text-amber-600 truncate dark:text-amber-400/80">
              {data.products.lowStockList.map((p) => p.name).join(', ')}
            </p>
          </div>
          <span className="text-[12px] font-medium text-amber-700 shrink-0 dark:text-amber-400">Ver estoque →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FinancialCard label="Entradas no ano" value={data.cash.yearly.entradas} icon={<TrendingUp size={15} />} variant="green" />
        <FinancialCard label="Saídas no ano" value={data.cash.yearly.saidas} icon={<TrendingDown size={15} />} variant="red" />
        <FinancialCard label="Saldo no ano" value={data.cash.yearly.saldo} icon={<ArrowUpRight size={15} />} variant={data.cash.yearly.saldo >= 0 ? 'green' : 'red'} />
      </div>

      {hasSeries && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-[13px] font-semibold text-gray-700 dark:text-slate-200">Entradas × Saídas</h3>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Entradas
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Saídas
              </span>
            </div>
          </div>
          <div className="mb-4">
            <DateRangePicker value={chartRange} onChange={setChartRange} idPrefix="chart-range" compact />
          </div>
          {seriesLoading && (
            <div className="skeleton h-[220px] rounded mb-4" aria-label="Carregando gráfico" />
          )}
          {!seriesLoading && !hasData && (
            <div className="flex items-center justify-center h-[220px] text-[13px] text-gray-400 dark:text-slate-500">
              Sem movimento no período selecionado
            </div>
          )}
          <div className={`min-w-0 w-full overflow-hidden ${seriesLoading || !hasData ? 'hidden' : ''}`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip
                formatter={(value: any, name: string) => [formatCurrency(Number(value)), name === 'entradas' ? 'Entradas' : 'Saídas']}
                contentStyle={{ fontSize: 12, border: '1px solid #334155', borderRadius: 6, boxShadow: 'none', background: '#0f172a', color: '#e2e8f0' }}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
              <Bar dataKey="entradas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="saidas" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="card lg:col-span-3 p-5">
          <h3 className="text-[13px] font-semibold text-gray-700 mb-4 dark:text-slate-200">Ordens por status</h3>
          {orderStatusData.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 w-full sm:w-[60%]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {orderStatusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #334155', borderRadius: 6, boxShadow: 'none', background: '#0f172a', color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 min-w-0">
                {orderStatusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-[12px] text-gray-500 w-24 dark:text-slate-400">{statusLabels[item.name] || item.name}</span>
                    <span className="text-[12px] font-semibold text-gray-700 tabular-nums dark:text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-[13px] text-gray-400 dark:text-slate-500">Sem dados de OS para exibir</div>
          )}
        </div>

        <div className="card lg:col-span-2 p-5">
          <h3 className="text-[13px] font-semibold text-gray-700 mb-4 dark:text-slate-200">Despesas pendentes</h3>
          {data.expenses.pending.count > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-amber-50 border border-amber-100 dark:bg-amber-950/40 dark:border-amber-900">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 dark:text-amber-400" />
                <div>
                  <p className="text-[12px] text-amber-700 font-medium dark:text-amber-300">{data.expenses.pending.count} pendente{data.expenses.pending.count > 1 ? 's' : ''}</p>
                  <p className="text-[14px] font-semibold text-amber-800 tabular-nums dark:text-amber-200">{formatCurrency(data.expenses.pending.total)}</p>
                </div>
              </div>
              {data.expenses.recent.slice(0, 4).map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="text-[13px] text-gray-700 truncate dark:text-slate-300">{e.description}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">{e.category}</p>
                  </div>
                  <span className="text-[13px] font-medium text-gray-800 tabular-nums ml-3 shrink-0 dark:text-slate-100">{formatCurrency(e.value)}</span>
                </div>
              ))}
              <Link to="/despesas" className="text-[12px] text-brand-600 hover:text-brand-700 font-medium mt-1 inline-block">Ver todas →</Link>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[140px] text-[13px] text-gray-400 dark:text-slate-500">Nenhuma despesa pendente</div>
          )}
        </div>
      </div>

      {data.orders.recent.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3 p-5 pb-0">
            <h3 className="text-[13px] font-semibold text-gray-700 dark:text-slate-200">Ordens recentes</h3>
            <Link to="/ordens-servico" className="text-[12px] text-brand-600 hover:text-brand-700 font-medium">Ver todas →</Link>
          </div>
          <div className="overflow-x-auto p-5 pt-3">
            <table className="table">
              <thead><tr><th>Nº</th><th>Cliente</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
              <tbody>
                {data.orders.recent.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium font-mono text-[12px]">#{String(order.number).padStart(4, '0')}</td>
                    <td>{order.client?.name}</td>
                    <td><span className={`badge ${order.status === 'concluida' ? 'badge-success' : order.status === 'cancelada' ? 'badge-danger' : order.status === 'em_andamento' ? 'badge-warning' : 'badge-info'}`}>{statusLabels[order.status] || order.status}</span></td>
                    <td className="font-medium tabular-nums">{formatCurrency(order.totalValue)}</td>
                    <td className="text-gray-400 dark:text-slate-500">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function CountCard({ icon: Icon, label, value, accent, hideValue, valueText }: {
  icon: React.ElementType; label: string; value: number; accent?: string; hideValue?: boolean; valueText?: string;
}) {
  return (
    <div className="card min-w-0 overflow-hidden p-4">
      <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center shrink-0 dark:bg-slate-800">
          <Icon size={15} className="text-gray-500 dark:text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium dark:text-slate-500">{label}</p>
          {!hideValue && (
            <p className="text-[18px] font-semibold text-gray-800 tabular-nums leading-tight dark:text-slate-100">{value}</p>
          )}
          {valueText && (
            <p className={`text-[18px] font-semibold tabular-nums leading-tight ${valueText.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-slate-100'}`}>{valueText}</p>
          )}
          {accent && <p className={`${hideValue && !valueText ? 'text-[16px] font-semibold text-gray-800 dark:text-slate-100' : 'text-[11px] text-gray-400 dark:text-slate-500'} tabular-nums mt-0.5`}>{accent}</p>}
        </div>
      </div>
    </div>
  );
}

function FinancialCard({ label, value, icon, variant }: { label: string; value: number; icon: React.ReactNode; variant: 'green' | 'red' }) {
  const colors = { green: 'text-emerald-700', red: 'text-red-600' };
  const bgColors = { green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400', red: 'bg-red-50 text-red-500 dark:bg-red-950/60 dark:text-red-400' };
  return (
    <div className="card min-w-0 overflow-hidden p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium dark:text-slate-500">{label}</p>
          <p className={`text-[16px] font-semibold tabular-nums mt-0.5 break-words ${colors[variant]}`}>{formatCurrency(value)}</p>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${bgColors[variant]}`}>{icon}</div>
      </div>
    </div>
  );
}
