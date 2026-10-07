import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, Trash2, Eye, Search, X, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { CashTransaction, CashSummary } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Field, FieldGrid } from '../components/DetailFields';
import { DateRangePicker, DEFAULT_RANGE, applyPreset, rangeParams, type DateRangeValue } from '../components/DateRangePicker';
import { parseCashReference } from '../utils/sourceLinks';
import { formatCurrency, formatDate } from '../utils/formatters';

const categoryLabels: Record<string, string> = {
  venda: 'Venda', servico: 'Serviço', pagamento: 'Pagamento', aluguel: 'Aluguel',
  fornecedor: 'Fornecedor', salario: 'Salário', despesa: 'Despesa', outros: 'Outros',
};

const categoryOptions = ['venda', 'servico', 'despesa', 'pagamento', 'aluguel', 'fornecedor', 'salario', 'outros'];

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
  pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto',
};

export default function CashPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRangeValue>(() => applyPreset('month', DEFAULT_RANGE));
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<CashTransaction | null>(null);
  const [formData, setFormData] = useState({ type: 'entrada', category: 'venda', description: '', value: 0, paymentMethod: 'pix', reference: '' });

  useEffect(() => { load(); loadSummary(); }, [page, filterType, filterCategory, filterPayment, search, range]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cash', {
        params: {
          page, limit: 10, type: filterType, category: filterCategory,
          paymentMethod: filterPayment, search, ...rangeParams(range),
        },
      });
      setTransactions(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erro ao carregar transações'); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    try { const res = await api.get('/cash/summary', { params: rangeParams(range) }); setSummary(res.data.data); } catch {}
  };

  const hasFilters = !!(filterType || filterCategory || filterPayment || search);
  const clearFilters = () => {
    setFilterType(''); setFilterCategory(''); setFilterPayment(''); setSearch(''); setPage(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/cash', formData);
      toast.success('Transação registrada!');
      setModalOpen(false); setFormData({ type: 'entrada', category: 'venda', description: '', value: 0, paymentMethod: 'pix', reference: '' }); load(); loadSummary();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao registrar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover transação?')) return;
    try { await api.delete(`/cash/${id}`); toast.success('Removida!'); load(); loadSummary(); }
    catch { toast.error('Erro ao remover'); }
  };

  const columns = [
    { key: 'type', label: 'Tipo', render: (i: CashTransaction) => (
      <span className={i.type === 'entrada' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
        {i.type === 'entrada' ? '↑ Entrada' : '↓ Saída'}
      </span>
    )},
    { key: 'description', label: 'Descrição' },
    { key: 'category', label: 'Categoria', render: (i: CashTransaction) => categoryLabels[i.category] || i.category },
    { key: 'value', label: 'Valor', render: (i: CashTransaction) => (
      <span className={i.type === 'entrada' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
        {i.type === 'entrada' ? '+' : '-'} {formatCurrency(i.value)}
      </span>
    )},
    { key: 'paymentMethod', label: 'Pagamento', render: (i: CashTransaction) => paymentLabels[i.paymentMethod || ''] || '-' },
    { key: 'date', label: 'Data', render: (i: CashTransaction) => formatDate(i.date) },
    { key: 'actions', label: 'Ações', render: (i: CashTransaction) => (
      <div className="flex gap-1">
        <button onClick={() => setViewTarget(i)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" title="Ver detalhes"><Eye size={16} /></button>
        <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Caixa" subtitle="Controle de entradas e saídas" onAdd={() => setModalOpen(true)} addLabel="Nova Transação" />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium dark:text-slate-500">Entradas</p>
<p className="text-[22px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1 break-words">{formatCurrency(summary.totalEntradas)}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{summary.countEntradas ?? 0} lançamento{summary.countEntradas === 1 ? '' : 's'} no período</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-950/60 dark:text-emerald-400">
                <TrendingUp size={17} />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium dark:text-slate-500">Saídas</p>
<p className="text-[22px] font-semibold text-red-600 dark:text-red-400 tabular-nums mt-1 break-words">{formatCurrency(summary.totalSaidas)}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{summary.countSaidas ?? 0} lançamento{summary.countSaidas === 1 ? '' : 's'} no período</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 dark:bg-red-950/60 dark:text-red-400">
                <TrendingDown size={17} />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium dark:text-slate-400">Saldo do período</p>
<p className={`text-[22px] font-semibold tabular-nums mt-1 break-words ${summary.saldo >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(summary.saldo)}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Entradas − saídas</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 dark:bg-slate-800 dark:text-slate-300">
                <Wallet size={17} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters toolbar */}
      <div className="card p-3.5 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] max-w-sm">
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar descrição ou referência..." />
          </div>

          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="input w-40" aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            <option value="entrada">↑ Entradas</option>
            <option value="saida">↓ Saídas</option>
          </select>

          <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} className="input w-44" aria-label="Filtrar por categoria">
            <option value="">Todas categorias</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}
          </select>

          <select value={filterPayment} onChange={(e) => { setFilterPayment(e.target.value); setPage(1); }} className="input w-44" aria-label="Filtrar por pagamento">
            <option value="">Todos pagamentos</option>
            {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost btn-sm" title="Limpar filtros">
              <X size={13} /> Limpar
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 font-medium dark:text-slate-400">
            <Search size={13} /> Período:
          </span>
          <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} idPrefix="cash-range" />
        </div>
      </div>

      <DataTable columns={columns} data={transactions} pagination={pagination} onPageChange={setPage} loading={loading} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova Transação">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cash-type" className="label">Tipo *</label>
              <select id="cash-type" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="input">
                <option value="entrada">↑ Entrada</option>
                <option value="saida">↓ Saída</option>
              </select>
            </div>
            <div>
              <label htmlFor="cash-category" className="label">Categoria *</label>
              <select id="cash-category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
                <option value="venda">Venda</option>
                <option value="servico">Serviço</option>
                <option value="pagamento">Pagamento</option>
                <option value="aluguel">Aluguel</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="salario">Salário</option>
                <option value="outros">Outros</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="cash-description" className="label">Descrição *</label>
            <input id="cash-description" type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cash-value" className="label">Valor (R$) *</label>
              <input id="cash-value" type="number" step="0.01" value={formData.value} onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })} className="input" required />
            </div>
            <div>
              <label htmlFor="cash-payment" className="label">Forma de Pagamento</label>
              <select id="cash-payment" value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="input">
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="cartao_debito">Cartão Débito</option>
                <option value="transferencia">Transferência</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="cash-reference" className="label">Referência</label>
            <input id="cash-reference" type="text" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="input" placeholder="Ex: OS #0001" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Registrar</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} title="Detalhes da transação">
        {viewTarget && (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="Tipo" value={viewTarget.type === 'entrada' ? '↑ Entrada' : '↓ Saída'} />
              <Field label="Valor" value={`${viewTarget.type === 'entrada' ? '+' : '-'} ${formatCurrency(viewTarget.value)}`} />
              <Field label="Categoria" value={categoryLabels[viewTarget.category] || viewTarget.category} />
              <Field label="Pagamento" value={paymentLabels[viewTarget.paymentMethod || ''] || '—'} />
              <Field label="Data" value={formatDate(viewTarget.date)} />
              <Field label="Referência" value={viewTarget.reference || '—'} mono />
            </FieldGrid>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5 dark:text-slate-500">Descrição</p>
              <p className="text-[13px] text-gray-700 dark:text-slate-300">{viewTarget.description}</p>
            </div>
            {viewTarget.user && <Field label="Lançado por" value={viewTarget.user.name} />}
            {(() => {
              const source = parseCashReference(viewTarget.reference);
              if (!source) return null;
              return (
                <button
                  type="button"
                  onClick={() => { setViewTarget(null); navigate(source.path); }}
                  className="btn-secondary w-full"
                >
                  <ArrowUpRight size={14} /> {source.label}
                </button>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
