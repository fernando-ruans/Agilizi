import { useState, useEffect } from 'react';
import { Trash2, Eye, ArrowRight, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getPdf, issuerFromCompany } from '../utils/lazyPdf';
import type { Budget, Client, Service } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';

const statusLabels: Record<string, { label: string; class: string }> = {
  rascunho: { label: 'Rascunho', class: 'badge-gray' },
  enviado: { label: 'Enviado', class: 'badge-info' },
  aprovado: { label: 'Aprovado', class: 'badge-success' },
  rejeitado: { label: 'Rejeitado', class: 'badge-danger' },
  convertido: { label: 'Convertido', class: 'badge-warning' },
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const { company } = useAuth();
  const [selected, setSelected] = useState<Budget | null>(null);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState('');

  useEffect(() => { load(); loadClients(); loadServices(); }, [page, search]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/budgets', { params: { page, limit: 10, search } });
      setBudgets(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erro ao carregar orçamentos'); }
    finally { setLoading(false); }
  };

  const loadClients = async () => {
    try { const res = await api.get('/clients', { params: { limit: 100 } }); setClients(res.data.data); } catch {}
  };

  const loadServices = async () => {
    try { const res = await api.get('/services', { params: { limit: 100 } }); setServices(res.data.data); } catch {}
  };

  const addItem = () => setItems([...items, { serviceId: '', quantity: 1, unitValue: 0, description: '' }]);

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'serviceId') {
      const service = services.find((s) => s.id === value);
      if (service) newItems[index].unitValue = service.value;
    }
    setItems(newItems);
  };

  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitValue), 0) - discount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitValue), 0);
    if (discount > subtotal) { toast.error('Desconto não pode ser maior que o valor dos itens'); return; }
    try {
      await api.post('/budgets', { clientId, items, notes, discount, validUntil: validUntil || null });
      toast.success('Orçamento criado!');
      setModalOpen(false); reset(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao criar'); }
  };

  const handleConvert = async (id: string) => {
    if (!confirm('Converter orçamento aprovado em Ordem de Serviço?')) return;
    try {
      await api.post(`/budgets/${id}/convert-to-order`);
      toast.success('Convertido em OS!');
      load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao converter'); }
  };

  const handleStatus = async (id: string, status: 'aprovado' | 'rejeitado') => {
    try {
      await api.put(`/budgets/${id}`, { status });
      toast.success(status === 'aprovado' ? 'Orçamento aprovado!' : 'Orçamento rejeitado.');
      setViewOpen(false); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao atualizar status'); }
  };

  // Exports the budget as a client-ready proposal (fetches the full record)
  const downloadBudgetPdf = async () => {
    if (!selected) return;
    setPdfBusy(true);
    try {
      const { data } = await api.get(`/budgets/${selected.id}`);
      const b = data.data;
      const { budgetDocPdf } = await getPdf();
      budgetDocPdf(issuerFromCompany(company), {
        number: b.number,
        status: b.status,
        createdAt: b.createdAt,
        validUntil: b.validUntil,
        notes: b.notes,
        client: b.client ? { name: b.client.name, document: b.client.document, phone: b.client.phone, email: b.client.email } : undefined,
        discount: b.discount,
        totalValue: b.totalValue,
        items: (b.items || []).map((i: any) => ({
          service: i.service?.name, description: i.description,
          quantity: i.quantity, unitValue: i.unitValue, totalValue: i.totalValue,
        })),
      });
      toast.success('PDF gerado!');
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover orçamento?')) return;
    try { await api.delete(`/budgets/${id}`); toast.success('Removido!'); load(); }
    catch { toast.error('Erro ao remover'); }
  };

  const reset = () => { setSelected(null); setClientId(''); setItems([]); setNotes(''); setDiscount(0); setValidUntil(''); };

  const columns = [
    { key: 'number', label: 'Nº', render: (i: Budget) => <span className="font-medium">#{String(i.number).padStart(4, '0')}</span> },
    { key: 'client', label: 'Cliente', render: (i: Budget) => i.client?.name || '-' },
    { key: 'status', label: 'Status', render: (i: Budget) => <span className={statusLabels[i.status]?.class || 'badge-gray'}>{statusLabels[i.status]?.label || i.status}</span> },
    { key: 'totalValue', label: 'Valor Total', render: (i: Budget) => formatCurrency(i.totalValue) },
    { key: 'createdAt', label: 'Data', render: (i: Budget) => formatDate(i.createdAt) },
    { key: 'actions', label: 'Ações', render: (i: Budget) => (
      <div className="flex gap-2">
        <button onClick={() => { setSelected(i); setViewOpen(true); }} className="text-blue-600 hover:text-blue-800" title="Ver detalhes"><Eye size={16} /></button>
        {i.status === 'aprovado' && <button onClick={() => handleConvert(i.id)} className="text-green-600 hover:text-green-800" title="Converter em OS"><ArrowRight size={16} /></button>}
        {i.status !== 'convertido' && <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Orçamentos" subtitle="Gerencie seus orçamentos" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Novo Orçamento" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Buscar orçamento..." /></div>
      <DataTable columns={columns} data={budgets} pagination={pagination} onPageChange={setPage} loading={loading} />

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Orçamento" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="budget-client" className="label">Cliente *</label>
            <select id="budget-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input" required>
              <option value="">Selecione um cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label mb-0">Itens</p>
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700">+ Adicionar item</button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                <div className="col-span-4">
                  <select aria-label={`Serviço do item ${index + 1}`} value={item.serviceId} onChange={(e) => updateItem(index, 'serviceId', e.target.value)} className="input" required>
                    <option value="">Serviço</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input aria-label={`Quantidade do item ${index + 1}`} type="number" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)} className="input" placeholder="Qtd" />
                </div>
                <div className="col-span-3">
                  <input aria-label={`Valor unitário do item ${index + 1}`} type="number" step="0.01" value={item.unitValue} onChange={(e) => updateItem(index, 'unitValue', parseFloat(e.target.value) || 0)} className="input" placeholder="Valor" />
                </div>
                <div className="col-span-2">
                  <span className="text-sm font-medium">{formatCurrency(item.quantity * item.unitValue)}</span>
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeItem(index)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="budget-discount" className="label">Desconto (R$)</label>
              <input id="budget-discount" type="number" step="0.01" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="input" />
            </div>
            <div>
              <label htmlFor="budget-valid-until" className="label">Válido até</label>
              <input id="budget-valid-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input" />
            </div>
            <div className="flex items-end">
              <span className="text-lg font-bold">Total: {formatCurrency(totalValue)}</span>
            </div>
          </div>

          <div>
            <label htmlFor="budget-notes" className="label">Observações</label>
            <textarea id="budget-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Criar Orçamento</button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title={`Orçamento #${selected ? String(selected.number).padStart(4, '0') : ''}`} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Cliente</p><p className="font-medium">{selected.client?.name}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Status</p><span className={statusLabels[selected.status]?.class}>{statusLabels[selected.status]?.label}</span></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Data</p><p className="font-medium">{formatDate(selected.createdAt)}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Valor Total</p><p className="font-bold text-lg">{formatCurrency(selected.totalValue)}</p></div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Itens</h4>
              <table className="table">
                <thead><tr><th>Serviço</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead>
                <tbody>
                  {selected.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{item.service?.name || item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unitValue)}</td>
                      <td>{formatCurrency(item.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected.notes && <div><p className="text-sm text-gray-500 dark:text-slate-400">Observações</p><p>{selected.notes}</p></div>}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
              {(selected.status === 'rascunho' || selected.status === 'enviado') && (
                <>
                  <button type="button" onClick={() => handleStatus(selected.id, 'rejeitado')} className="btn-secondary">Rejeitar</button>
                  <button type="button" onClick={() => handleStatus(selected.id, 'aprovado')} className="btn-primary">Aprovar orçamento</button>
                </>
              )}
              <button type="button" onClick={downloadBudgetPdf} disabled={pdfBusy} className="btn-primary">
                {pdfBusy ? 'Gerando…' : <><FileDown size={14} /> Baixar PDF do orçamento</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
