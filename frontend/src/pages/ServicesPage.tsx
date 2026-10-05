import { useState, useEffect } from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Service } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Field, FieldGrid } from '../components/DetailFields';
import { formatCurrency } from '../utils/formatters';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Service | null>(null);
  const [selected, setSelected] = useState<Service | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', value: 0, category: '' });

  useEffect(() => { load(); }, [page, search]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/services', { params: { page, limit: 10, search } });
      setServices(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erro ao carregar serviços'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selected) {
        await api.put(`/services/${selected.id}`, formData);
        toast.success('Serviço atualizado!');
      } else {
        await api.post('/services', formData);
        toast.success('Serviço criado!');
      }
      setModalOpen(false); reset(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao salvar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover serviço?')) return;
    try { await api.delete(`/services/${id}`); toast.success('Removido!'); load(); }
    catch { toast.error('Erro ao remover'); }
  };

  const reset = () => { setSelected(null); setFormData({ name: '', description: '', value: 0, category: '' }); };

  const columns = [
    { key: 'name', label: 'Nome', render: (i: Service) => <span className="font-medium">{i.name}</span> },
    { key: 'description', label: 'Descrição' },
    { key: 'category', label: 'Categoria' },
    { key: 'value', label: 'Valor', render: (i: Service) => formatCurrency(i.value) },
    { key: 'actions', label: 'Ações', render: (i: Service) => (
      <div className="flex gap-2">
        <button onClick={() => setViewTarget(i)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" title="Ver detalhes"><Eye size={16} /></button>
        <button onClick={() => { setSelected(i); setFormData({ name: i.name, description: i.description || '', value: i.value, category: i.category || '' }); setModalOpen(true); }} className="text-yellow-600 hover:text-yellow-800"><Pencil size={16} /></button>
        <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Serviços" subtitle="Gerencie seus serviços" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Novo Serviço" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Buscar serviço..." /></div>
      <DataTable columns={columns} data={services} pagination={pagination} onPageChange={setPage} loading={loading} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Editar Serviço' : 'Novo Serviço'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="service-name" className="label">Nome *</label><input id="service-name" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required /></div>
          <div><label htmlFor="service-description" className="label">Descrição</label><textarea id="service-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" rows={3} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="service-value" className="label">Valor (R$) *</label><input id="service-value" type="number" step="0.01" value={formData.value} onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })} className="input" required /></div>
            <div><label htmlFor="service-category" className="label">Categoria</label><input id="service-category" type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{selected ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} title="Detalhes do serviço">
        {viewTarget && (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="Nome" value={viewTarget.name} />
              <Field label="Categoria" value={viewTarget.category || '—'} />
              <Field label="Valor" value={formatCurrency(viewTarget.value)} />
              <Field label="Status" value={viewTarget.active ? 'Ativo' : 'Inativo'} />
            </FieldGrid>
            {viewTarget.description && (
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5 dark:text-slate-500">Descrição</p>
                <p className="text-[13px] text-gray-700 dark:text-slate-300">{viewTarget.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
