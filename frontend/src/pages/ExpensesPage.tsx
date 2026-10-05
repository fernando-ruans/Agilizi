import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Trash2, CheckCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Expense, Supplier } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Field, FieldGrid } from '../components/DetailFields';
import { DateRangePicker, DEFAULT_RANGE, rangeParams, type DateRangeValue } from '../components/DateRangePicker';
import { formatCurrency, formatDate } from '../utils/formatters';

const categoryLabels: Record<string, string> = {
  aluguel: 'Aluguel', energia: 'Energia', agua: 'Água', internet: 'Internet',
  telefone: 'Telefone', material: 'Material', frete: 'Frete', impostos: 'Impostos', outros: 'Outros',
};

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
  pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto',
};

const statusLabels: Record<string, { label: string; class: string }> = {
  pendente: { label: 'Pendente', class: 'badge-warning' },
  pago: { label: 'Pago', class: 'badge-success' },
  atrasado: { label: 'Atrasado', class: 'badge-danger' },
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ ...DEFAULT_RANGE, preset: 'all' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Expense | null>(null);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    description: '', value: 0, category: 'aluguel', supplierId: '', dueDate: '', status: 'pendente', paymentMethod: '', notes: '',
  });

  useEffect(() => { load(); loadSuppliers(); }, [page, search, filterStatus, range]);

  // Deep link (?view=<id>) — e.g. from the Caixa "see source" button
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('view');
    if (!id) return;
    api.get(`/expenses/${id}`)
      .then((r) => { setViewTarget(r.data.data); })
      .catch(() => toast.error('Despesa não encontrada'))
      .finally(() => setSearchParams({}, { replace: true }));
  }, [searchParams, setSearchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses', { params: { page, limit: 10, search, status: filterStatus, ...rangeParams(range) } });
      setExpenses(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erro ao carregar despesas'); }
    finally { setLoading(false); }
  };

  const loadSuppliers = async () => { try { const res = await api.get('/suppliers', { params: { limit: 100 } }); setSuppliers(res.data.data); } catch {} };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Empty selects mean "none" — send null instead of "" (FK/enum safe)
      const payload = {
        ...formData,
        supplierId: formData.supplierId || null,
        paymentMethod: formData.paymentMethod || null,
      };
      if (selected) {
        await api.put(`/expenses/${selected.id}`, payload);
        toast.success('Despesa atualizada!');
      } else {
        await api.post('/expenses', payload);
        toast.success('Despesa criada!');
      }
      setModalOpen(false); reset(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao salvar'); }
  };

  const handlePay = async (id: string) => {
    if (!confirm('Marcar como pago?')) return;
    try {
      await api.put(`/expenses/${id}`, { status: 'pago', paidDate: new Date().toISOString() });
      toast.success('Marcada como paga!');
      load();
    } catch { toast.error('Erro ao atualizar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover despesa?')) return;
    try { await api.delete(`/expenses/${id}`); toast.success('Removida!'); load(); }
    catch { toast.error('Erro ao remover'); }
  };

  const reset = () => { setSelected(null); setFormData({ description: '', value: 0, category: 'aluguel', supplierId: '', dueDate: '', status: 'pendente', paymentMethod: '', notes: '' }); };

  const columns = [
    { key: 'description', label: 'Descrição', render: (i: Expense) => <span className="font-medium">{i.description}</span> },
    { key: 'category', label: 'Categoria' },
    { key: 'supplier', label: 'Fornecedor', render: (i: Expense) => i.supplier?.name || '-' },
    { key: 'value', label: 'Valor', render: (i: Expense) => formatCurrency(i.value) },
    { key: 'status', label: 'Status', render: (i: Expense) => <span className={statusLabels[i.status]?.class}>{statusLabels[i.status]?.label}</span> },
    { key: 'dueDate', label: 'Vencimento', render: (i: Expense) => i.dueDate ? formatDate(i.dueDate) : '-' },
    { key: 'actions', label: 'Ações', render: (i: Expense) => (
      <div className="flex gap-2">
        <button onClick={() => setViewTarget(i)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" title="Ver detalhes"><Eye size={16} /></button>
        {i.status !== 'pago' && <button onClick={() => handlePay(i.id)} className="text-green-600 hover:text-green-800" title="Marcar como pago"><CheckCircle size={16} /></button>}
        <button onClick={() => { setSelected(i); setFormData({ description: i.description, value: i.value, category: i.category, supplierId: i.supplierId || '', dueDate: i.dueDate ? i.dueDate.split('T')[0] : '', status: i.status, paymentMethod: i.paymentMethod || '', notes: i.notes || '' }); setModalOpen(true); }} className="text-yellow-600 hover:text-yellow-800"><Pencil size={16} /></button>
        <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Despesas" subtitle="Controle de despesas operacionais" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Nova Despesa" />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Buscar despesa..." /></div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input w-48" aria-label="Filtrar por status">
          <option value="">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} idPrefix="expense-range" />
      </div>

      <DataTable columns={columns} data={expenses} pagination={pagination} onPageChange={setPage} loading={loading} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Editar Despesa' : 'Nova Despesa'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="expense-description" className="label">Descrição *</label><input id="expense-description" type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="expense-value" className="label">Valor (R$) *</label><input id="expense-value" type="number" step="0.01" value={formData.value} onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })} className="input" required /></div>
            <div>
              <label htmlFor="expense-category" className="label">Categoria *</label>
              <select id="expense-category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
                <option value="aluguel">Aluguel</option><option value="energia">Energia</option><option value="agua">Água</option>
                <option value="internet">Internet</option><option value="telefone">Telefone</option><option value="material">Material</option>
                <option value="frete">Frete</option><option value="impostos">Impostos</option><option value="outros">Outros</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="expense-supplier" className="label">Fornecedor</label>
              <select id="expense-supplier" value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })} className="input">
                <option value="">Nenhum</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label htmlFor="expense-due-date" className="label">Data de Vencimento</label><input id="expense-due-date" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="input" /></div>
          </div>
          {selected && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="expense-status" className="label">Status</label>
                <select id="expense-status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input">
                  <option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option>
                </select>
              </div>
              <div>
                <label htmlFor="expense-payment" className="label">Forma de pagamento</label>
                <select id="expense-payment" value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="input">
                  <option value="">Não informado</option>
                  {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          )}
          {!selected && (
            <div>
              <label htmlFor="expense-payment" className="label">Forma de pagamento</label>
              <select id="expense-payment" value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="input">
                <option value="">Não informado</option>
                {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          )}
          <div><label htmlFor="expense-notes" className="label">Observações</label><textarea id="expense-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input" rows={2} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{selected ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} title="Detalhes da despesa">
        {viewTarget && (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="Valor" value={formatCurrency(viewTarget.value)} />
              <Field label="Status" value={statusLabels[viewTarget.status]?.label || viewTarget.status} />
              <Field label="Categoria" value={categoryLabels[viewTarget.category] || viewTarget.category} />
              <Field label="Pagamento" value={viewTarget.paymentMethod ? paymentLabels[viewTarget.paymentMethod] || viewTarget.paymentMethod : '—'} />
              <Field label="Fornecedor" value={viewTarget.supplier?.name || '—'} />
              <Field label="Vencimento" value={viewTarget.dueDate ? formatDate(viewTarget.dueDate) : '—'} />
              <Field label="Pago em" value={viewTarget.paidDate ? formatDate(viewTarget.paidDate) : '—'} />
            </FieldGrid>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5 dark:text-slate-500">Descrição</p>
              <p className="text-[13px] text-gray-700 dark:text-slate-300">{viewTarget.description}</p>
            </div>
            {viewTarget.notes && (
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5 dark:text-slate-500">Observações</p>
                <p className="text-[13px] text-gray-700 dark:text-slate-300">{viewTarget.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
