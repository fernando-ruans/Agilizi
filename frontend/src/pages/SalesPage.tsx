import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, XCircle, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Sale, Product, Client } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { DateRangePicker, DEFAULT_RANGE, rangeParams, type DateRangeValue } from '../components/DateRangePicker';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Spinner } from '../components/Loading';

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito',
  pix: 'PIX', boleto: 'Boleto',
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clientId, setClientId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [range, setRange] = useState<DateRangeValue>({ ...DEFAULT_RANGE, preset: 'all', startDate: '', endDate: '' });

  useEffect(() => { load(); }, [page, search, range]);
  useEffect(() => { loadCatalog(); }, []);

  // Deep link (?view=<id>) — e.g. from the Caixa "see source" button
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('view');
    if (!id) return;
    api.get(`/sales/${id}`)
      .then((r) => { setSelected(r.data.data); setViewOpen(true); })
      .catch(() => toast.error('Venda não encontrada'))
      .finally(() => setSearchParams({}, { replace: true }));
  }, [searchParams, setSearchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/sales', { params: { page, limit: 10, search, ...rangeParams(range) } });
      setSales(r.data.data);
      setPagination(r.data.pagination);
    } catch { toast.error('Erro ao carregar vendas'); }
    finally { setLoading(false); }
  };

  const loadCatalog = async () => {
    try {
      const [p, c] = await Promise.all([
        api.get('/products', { params: { limit: 100 } }),
        api.get('/clients', { params: { limit: 100 } }),
      ]);
      setProducts(p.data.data.filter((x: Product) => x.active && x.stock > 0));
      setClients(c.data.data);
    } catch {}
  };

  const addItem = () => setItems([...items, { productId: '', quantity: 1, unitValue: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    if (field === 'productId') {
      const p = products.find((x) => x.id === value);
      if (p) next[i].unitValue = p.price;
    }
    setItems(next);
  };

  const totalValue = items.reduce((s, i) => s + i.quantity * i.unitValue, 0) - discount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Adicione ao menos um item'); return; }
    for (const item of items) {
      if (!item.productId) { toast.error('Selecione todos os produtos'); return; }
      const p = products.find((x) => x.id === item.productId);
      if (p && item.quantity > p.stock) { toast.error(`Estoque insuficiente para ${p.name} (disponível: ${p.stock})`); return; }
    }
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitValue, 0);
    if (discount > subtotal) { toast.error('Desconto não pode ser maior que o valor dos itens'); return; }
    setSubmitting(true);
    try {
      await api.post('/sales', { clientId: clientId || null, items, discount, paymentMethod, notes });
      toast.success('Venda registrada!');
      setModalOpen(false); reset(); load(); loadCatalog();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao registrar venda');
    } finally { setSubmitting(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.post(`/sales/${cancelTarget.id}/cancel`);
      toast.success('Venda cancelada e estoque restaurado');
      setCancelTarget(null); load(); loadCatalog();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cancelar');
    }
  };

  const reset = () => {
    setSelected(null); setClientId(''); setPaymentMethod('pix'); setDiscount(0); setNotes(''); setItems([]);
  };

  const columns = [
    { key: 'number', label: 'Nº', render: (i: Sale) => <span className="font-mono text-[12px] font-medium">#{String(i.number).padStart(4, '0')}</span> },
    { key: 'client', label: 'Cliente', render: (i: Sale) => i.client?.name || <span className="text-gray-400 dark:text-slate-500">Balcão</span> },
    {
      key: 'status', label: 'Status',
      render: (i: Sale) => <span className={i.status === 'concluida' ? 'badge-success' : 'badge-danger'}>{i.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span>,
    },
    { key: 'payment', label: 'Pagamento', render: (i: Sale) => <span className="text-gray-500 dark:text-slate-400">{paymentLabels[i.paymentMethod || ''] || '—'}</span> },
    { key: 'totalValue', label: 'Total', render: (i: Sale) => <span className="tabular-nums font-medium">{formatCurrency(i.totalValue)}</span> },
    { key: 'createdAt', label: 'Data', render: (i: Sale) => <span className="text-gray-500 dark:text-slate-400">{formatDate(i.createdAt)}</span> },
    {
      key: 'actions', label: '', className: 'w-24',
      render: (i: Sale) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setSelected(i); setViewOpen(true); }} className="btn-ghost btn-sm p-1.5 rounded" title="Ver detalhes"><Eye size={14} className="text-gray-400 dark:text-slate-500" /></button>
          {i.status === 'concluida' && (
            <button onClick={() => setCancelTarget(i)} className="btn-ghost btn-sm p-1.5 rounded" title="Cancelar venda"><XCircle size={14} className="text-gray-400 hover:text-red-500 dark:text-slate-500" /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Vendas" subtitle="Registro de vendas da loja" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Nova Venda" />
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="min-w-[240px] flex-1 max-w-sm"><SearchBar value={search} onChange={setSearch} placeholder="Buscar venda, cliente..." /></div>
        <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} idPrefix="sales-range" />
      </div>

      <DataTable
        columns={columns} data={sales} pagination={pagination} onPageChange={setPage}
        loading={loading} emptyMessage="Nenhuma venda registrada"
        emptyIcon={<ShoppingCart size={20} className="text-gray-300" />}
      />

      {/* Create modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova venda" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sale-client" className="label">Cliente (opcional)</label>
              <select id="sale-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
                <option value="">Venda balcão</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sale-payment" className="label">Pagamento</label>
              <select id="sale-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
                <option value="pix">PIX</option><option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão Crédito</option><option value="cartao_debito">Cartão Débito</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label mb-0">Itens</p>
              <button type="button" onClick={addItem} className="text-sm text-slate-800 font-medium hover:underline flex items-center gap-1"><Plus size={13} /> Adicionar</button>
            </div>
            {items.length === 0 && <p className="text-[13px] text-gray-400 py-3 dark:text-slate-500">Nenhum item adicionado.</p>}
            {items.map((item, index) => {
              const p = products.find((x) => x.id === item.productId);
              return (
                <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <div className="col-span-5">
                    <select aria-label={`Produto do item ${index + 1}`} value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)} className="input" required>
                      <option value="">Produto</option>
                      {products.map((x) => <option key={x.id} value={x.id} disabled={x.stock === 0}>{x.name} ({x.stock} disp.)</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input aria-label={`Quantidade do item ${index + 1}`} type="number" min="1" max={p?.stock ?? 999} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} className="input" />
                  </div>
                  <div className="col-span-2">
                    <input aria-label={`Valor unitário do item ${index + 1}`} type="number" step="0.01" value={item.unitValue} onChange={(e) => updateItem(index, 'unitValue', parseFloat(e.target.value) || 0)} className="input" />
                  </div>
                  <div className="col-span-2 text-[13px] font-medium tabular-nums">{formatCurrency(item.quantity * item.unitValue)}</div>
                  <div className="col-span-1">
                    <button type="button" onClick={() => removeItem(index)} aria-label={`Remover item ${index + 1}`} className="text-gray-400 hover:text-red-500 p-1 dark:text-slate-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="sale-discount" className="label">Desconto (R$)</label><input id="sale-discount" type="number" step="0.01" min="0" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="input" /></div>
            <div className="flex items-end"><span className="text-[15px] font-semibold">Total: {formatCurrency(totalValue)}</span></div>
          </div>

          <div><label htmlFor="sale-notes" className="label">Observações</label><textarea id="sale-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} /></div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting && <Spinner size={13} className="text-current" />} Registrar venda
            </button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title={`Venda #${selected ? String(selected.number).padStart(4, '0') : ''}`}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">Cliente</p><p className="text-[13px] text-gray-700 dark:text-slate-300">{selected.client?.name || 'Balcão'}</p></div>
              <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">Pagamento</p><p className="text-[13px] text-gray-700 dark:text-slate-300">{paymentLabels[selected.paymentMethod || ''] || '—'}</p></div>
              <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">Data</p><p className="text-[13px] text-gray-700 dark:text-slate-300">{formatDate(selected.createdAt)}</p></div>
              <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">Total</p><p className="text-[15px] font-semibold">{formatCurrency(selected.totalValue)}</p></div>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 dark:text-slate-500">Itens</p>
              <table className="table">
                <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead>
                <tbody>
                  {selected.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.product?.name || it.productName}</td>
                      <td className="tabular-nums">{it.quantity}</td>
                      <td className="tabular-nums">{formatCurrency(it.unitValue)}</td>
                      <td className="tabular-nums font-medium">{formatCurrency(it.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected.notes && <div><p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1 dark:text-slate-500">Observações</p><p className="text-[13px] text-gray-700 dark:text-slate-300">{selected.notes}</p></div>}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={handleCancel}
        title="Cancelar venda" message={`Cancelar a venda #${cancelTarget ? String(cancelTarget.number).padStart(4, '0') : ''}? O estoque será restaurado e o lançamento no caixa removido.`}
        confirmLabel="Cancelar venda" variant="danger"
      />
    </div>
  );
}
