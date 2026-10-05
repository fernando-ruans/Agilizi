import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Play, CheckCircle, XCircle, Trash2, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getPdf, issuerFromCompany } from '../utils/lazyPdf';
import type { Order, Client, Service, User } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { DateRangePicker, DEFAULT_RANGE, rangeParams, type DateRangeValue } from '../components/DateRangePicker';
import { formatCurrency, formatDate } from '../utils/formatters';

const statusLabels: Record<string, { label: string; class: string }> = {
  aberta: { label: 'Aberta', class: 'badge-info' },
  em_andamento: { label: 'Em Andamento', class: 'badge-warning' },
  concluida: { label: 'Concluída', class: 'badge-success' },
  cancelada: { label: 'Cancelada', class: 'badge-danger' },
};

const priorityLabels: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ ...DEFAULT_RANGE, preset: 'all', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const { company } = useAuth();
  const [clientId, setClientId] = useState('');
  const [userId, setUserId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => { load(); loadClients(); loadServices(); }, [page, search, filterStatus, range]);

  // Deep link (?view=<id>) — e.g. from the Caixa "see source" button
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('view');
    if (!id) return;
    api.get(`/orders/${id}`)
      .then((r) => { setSelected(r.data.data); setViewOpen(true); })
      .catch(() => toast.error('Ordem de serviço não encontrada'))
      .finally(() => setSearchParams({}, { replace: true }));
  }, [searchParams, setSearchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders', { params: { page, limit: 10, search, status: filterStatus, ...rangeParams(range) } });
      setOrders(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erro ao carregar ordens'); }
    finally { setLoading(false); }
  };

  const loadClients = async () => { try { const res = await api.get('/clients', { params: { limit: 100 } }); setClients(res.data.data); } catch {} };
  const loadServices = async () => { try { const res = await api.get('/services', { params: { limit: 100 } }); setServices(res.data.data); } catch {} };

  const addItem = () => setItems([...items, { serviceId: '', quantity: 1, unitValue: 0 }]);
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

  // Technicians list (admin/gerente only — hidden for other roles)
  const [technicians, setTechnicians] = useState<User[]>([]);
  useEffect(() => {
    api.get('/users', { params: { limit: 100 } })
      .then((r) => setTechnicians(r.data.data))
      .catch(() => setTechnicians([])); // 403 for operacional → field hidden
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitValue), 0);
    if (discount > subtotal) { toast.error('Desconto não pode ser maior que o valor dos itens'); return; }
    try {
      await api.post('/orders', { clientId, userId: userId || null, description, priority, items, notes, discount: discount || 0 });
      toast.success('OS criada!');
      setModalOpen(false); reset(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao criar'); }
  };

  const handleStatus = async (orderId: string, status: string) => {
    const labels: Record<string, string> = { em_andamento: 'iniciar', concluida: 'concluir', cancelada: 'cancelar' };
    if (!confirm(`Deseja ${labels[status] || 'alterar'} esta OS?`)) return;
    try {
      await api.post(`/orders/${orderId}/status`, { status });
      toast.success('Status atualizado!');
      load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao atualizar'); }
  };

  // Exports the OS as a client-ready document (fetches the full record)
  const downloadOrderPdf = async () => {
    if (!selected) return;
    setPdfBusy(true);
    try {
      const { data } = await api.get(`/orders/${selected.id}`);
      const o = data.data;
      const { orderDocPdf } = await getPdf();
      orderDocPdf(issuerFromCompany(company), {
        number: o.number,
        status: o.status,
        priority: o.priority,
        description: o.description,
        notes: o.notes,
        createdAt: o.createdAt,
        endDate: o.endDate,
        client: o.client ? { name: o.client.name, document: o.client.document, phone: o.client.phone, email: o.client.email } : undefined,
        technician: o.user?.name,
        discount: o.discount,
        totalValue: o.totalValue,
        items: (o.items || []).map((i: any) => ({
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

  const reset = () => { setSelected(null); setClientId(''); setUserId(''); setDiscount(0); setDescription(''); setPriority('normal'); setItems([]); setNotes(''); };

  const columns = [
    { key: 'number', label: 'Nº', render: (i: Order) => <span className="font-medium">#{String(i.number).padStart(4, '0')}</span> },
    { key: 'client', label: 'Cliente', render: (i: Order) => i.client?.name || '-' },
    { key: 'status', label: 'Status', render: (i: Order) => <span className={statusLabels[i.status]?.class}>{statusLabels[i.status]?.label}</span> },
    { key: 'priority', label: 'Prioridade', render: (i: Order) => priorityLabels[i.priority] || i.priority },
    { key: 'totalValue', label: 'Valor', render: (i: Order) => formatCurrency(i.totalValue) },
    { key: 'createdAt', label: 'Data', render: (i: Order) => formatDate(i.createdAt) },
    { key: 'actions', label: 'Ações', render: (i: Order) => (
      <div className="flex gap-2">
        <button onClick={() => { setSelected(i); setViewOpen(true); }} className="text-blue-600 hover:text-blue-800" title="Ver detalhes"><Eye size={16} /></button>
        {i.status === 'aberta' && <button onClick={() => handleStatus(i.id, 'em_andamento')} className="text-yellow-600 hover:text-yellow-800" title="Iniciar"><Play size={16} /></button>}
        {i.status === 'em_andamento' && <button onClick={() => handleStatus(i.id, 'concluida')} className="text-green-600 hover:text-green-800" title="Concluir"><CheckCircle size={16} /></button>}
        {['aberta', 'em_andamento'].includes(i.status) && <button onClick={() => handleStatus(i.id, 'cancelada')} className="text-red-600 hover:text-red-800" title="Cancelar"><XCircle size={16} /></button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Ordens de Serviço" subtitle="Gerencie suas ordens de serviço" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Nova OS" />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Buscar OS..." /></div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input w-48" aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} idPrefix="orders-range" />
      </div>

      <DataTable columns={columns} data={orders} pagination={pagination} onPageChange={setPage} loading={loading} />

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nova Ordem de Serviço" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="order-client" className="label">Cliente *</label>
              <select id="order-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input" required>
                <option value="">Selecione um cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="order-priority" className="label">Prioridade</label>
              <select id="order-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {technicians.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="order-technician" className="label">Técnico responsável</label>
                <select id="order-technician" value={userId} onChange={(e) => setUserId(e.target.value)} className="input">
                  <option value="">Não atribuído</option>
                  {technicians.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="order-discount" className="label">Desconto (R$)</label>
                <input id="order-discount" type="number" step="0.01" min="0" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="input" placeholder="0,00" />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="order-description" className="label">Descrição</label>
            <textarea id="order-description" value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label mb-0">Itens</p>
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700">+ Adicionar item</button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                <div className="col-span-5">
                  <select aria-label={`Serviço do item ${index + 1}`} value={item.serviceId} onChange={(e) => updateItem(index, 'serviceId', e.target.value)} className="input" required>
                    <option value="">Serviço</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><input aria-label={`Quantidade do item ${index + 1}`} type="number" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)} className="input" placeholder="Qtd" /></div>
                <div className="col-span-3"><input aria-label={`Valor unitário do item ${index + 1}`} type="number" step="0.01" value={item.unitValue} onChange={(e) => updateItem(index, 'unitValue', parseFloat(e.target.value) || 0)} className="input" placeholder="Valor" /></div>
                <div className="col-span-1"><span className="text-sm font-medium">{formatCurrency(item.quantity * item.unitValue)}</span></div>
                <div className="col-span-1"><button type="button" onClick={() => removeItem(index)} className="text-red-600" aria-label={`Remover item ${index + 1}`}><Trash2 size={16} /></button></div>
              </div>
            ))}
            <p className="text-right font-bold mt-2">Total: {formatCurrency(totalValue)}</p>
          </div>

          <div>
            <label htmlFor="order-notes" className="label">Observações</label>
            <textarea id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">Criar OS</button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title={`OS #${selected ? String(selected.number).padStart(4, '0') : ''}`} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Cliente</p><p className="font-medium">{selected.client?.name}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Técnico</p><p className="font-medium">{selected.user?.name || '-'}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Status</p><span className={statusLabels[selected.status]?.class}>{statusLabels[selected.status]?.label}</span></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Prioridade</p><p className="font-medium">{priorityLabels[selected.priority]}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Data de Abertura</p><p className="font-medium">{formatDate(selected.createdAt)}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-slate-400">Valor Total</p><p className="font-bold text-lg">{formatCurrency(selected.totalValue)}</p></div>
            </div>
            {selected.description && <div><p className="text-sm text-gray-500 dark:text-slate-400">Descrição</p><p>{selected.description}</p></div>}
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
            {selected.statusHistory && selected.statusHistory.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Histórico de Status</h4>
                <div className="space-y-2">
                  {selected.statusHistory.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded dark:bg-slate-800">
                      <span className={statusLabels[h.status]?.class}>{statusLabels[h.status]?.label || h.status}</span>
                      <span className="text-sm text-gray-500 dark:text-slate-400">{formatDate(h.createdAt)}</span>
                      {h.notes && <span className="text-sm text-gray-600 dark:text-slate-400">- {h.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-slate-800">
              <button type="button" onClick={downloadOrderPdf} disabled={pdfBusy} className="btn-primary">
                {pdfBusy ? 'Gerando…' : <><FileDown size={14} /> Baixar PDF da OS</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
