import { useState, useEffect } from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Supplier } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { ImageUploader } from '../components/ImageUploader';
import { ImageGallery } from '../components/ImageGallery';
import { AddressFields } from '../components/AddressFields';
import { maskDocumentInput, maskPhoneInput } from '../utils/formatters';
import { Field, FieldGrid, DetailSection } from '../components/DetailFields';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [viewTarget, setViewTarget] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '', companyName: '', document: '', email: '', phone: '',
    address: '', city: '', state: '', zipCode: '', notes: '',
  });

  useEffect(() => { load(); }, [page, search]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers', { params: { page, limit: 10, search } });
      setSuppliers(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erro ao carregar fornecedores'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selected) {
        await api.put(`/suppliers/${selected.id}`, formData);
        toast.success('Fornecedor atualizado!');
      } else {
        await api.post('/suppliers', formData);
        toast.success('Fornecedor criado!');
      }
      setModalOpen(false); reset(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao salvar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar fornecedor?')) return;
    try { await api.delete(`/suppliers/${id}`); toast.success('Desativado!'); load(); }
    catch { toast.error('Erro ao desativar'); }
  };

  const reset = () => { setSelected(null); setFormData({ name: '', companyName: '', document: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', notes: '' }); };

  const columns = [
    {
      key: 'name', label: 'Nome',
      render: (i: Supplier) => (
        <span className="flex items-center gap-2.5">
          {i.images && i.images.length > 0 ? (
            <img src={i.images[0].url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200 bg-gray-50 flex-shrink-0 dark:border-slate-700 dark:bg-slate-800" loading="lazy" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex-shrink-0 flex items-center justify-center text-[11px] font-semibold dark:bg-slate-800 dark:text-slate-400">
              {i.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="font-medium">{i.name}</span>
        </span>
      ),
    },
    { key: 'companyName', label: 'Razão Social' },
    { key: 'document', label: 'CNPJ' },
    { key: 'phone', label: 'Telefone' },
    { key: 'email', label: 'Email' },
    { key: 'actions', label: 'Ações', render: (i: Supplier) => (
      <div className="flex gap-2">
        <button onClick={() => setViewTarget(i)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" title="Ver detalhes"><Eye size={16} /></button>
        <button onClick={() => { setSelected(i); setFormData({ name: i.name, companyName: i.companyName || '', document: i.document || '', email: i.email || '', phone: i.phone || '', address: i.address || '', city: i.city || '', state: i.state || '', zipCode: i.zipCode || '', notes: i.notes || '' }); setModalOpen(true); }} className="text-yellow-600 hover:text-yellow-800"><Pencil size={16} /></button>
        <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Fornecedores" subtitle="Gerencie seus fornecedores" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Novo Fornecedor" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Buscar fornecedor..." /></div>
      <DataTable columns={columns} data={suppliers} pagination={pagination} onPageChange={setPage} loading={loading} />
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); load(); }} title={selected ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label htmlFor="supplier-name" className="label">Nome *</label><input id="supplier-name" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required /></div>
            <div><label htmlFor="supplier-company" className="label">Razão Social</label><input id="supplier-company" type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="input" /></div>
            <div><label htmlFor="supplier-document" className="label">CNPJ</label><input id="supplier-document" type="text" inputMode="numeric" value={formData.document} onChange={(e) => setFormData({ ...formData, document: maskDocumentInput(e.target.value, 'cnpj') })} className="input" placeholder="00.000.000/0000-00" maxLength={18} /></div>
            <div><label htmlFor="supplier-email" className="label">Email</label><input id="supplier-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" /></div>
            <div className="md:col-span-2"><label htmlFor="supplier-phone" className="label">Telefone</label><input id="supplier-phone" type="text" inputMode="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: maskPhoneInput(e.target.value) })} className="input" placeholder="(00) 00000-0000" maxLength={15} /></div>
            <div className="md:col-span-2">
              <AddressFields
                idPrefix="supplier"
                value={{ zipCode: formData.zipCode, address: formData.address, city: formData.city, state: formData.state }}
                onChange={(a) => setFormData({ ...formData, zipCode: a.zipCode, address: a.address, city: a.city, state: a.state })}
              />
            </div>
            <div className="md:col-span-2"><label htmlFor="supplier-notes" className="label">Observações</label><textarea id="supplier-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input" rows={3} /></div>
          </div>
          <div>
            <span className="label">Fotos</span>
            <ImageUploader
              entityType="supplier"
              entityId={selected?.id}
              images={selected?.images}
              multiple
              disabled={!selected}
              onChange={(images) => selected && setSelected({ ...selected, images })}
            />
            {!selected && <p className="helper-text">Salve o fornecedor para adicionar imagens.</p>}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setModalOpen(false); load(); }} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{selected ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} title="Detalhes do fornecedor" size="lg">
        {viewTarget && (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="Nome" value={viewTarget.name} />
              <Field label="Razão social" value={viewTarget.companyName || '—'} />
              <Field label="CNPJ" value={viewTarget.document || '—'} mono />
              <Field label="Telefone" value={viewTarget.phone || '—'} />
              <Field label="Email" value={viewTarget.email || '—'} />
              <Field label="Cidade" value={viewTarget.city ? `${viewTarget.city} - ${viewTarget.state}` : '—'} />
            </FieldGrid>
            {viewTarget.address && (
              <Field label="Endereço" value={`${viewTarget.address}${viewTarget.zipCode ? ` — CEP ${viewTarget.zipCode}` : ''}`} />
            )}
            {viewTarget.notes && <DetailSection title="Observações"><p className="text-[13px] text-gray-700 dark:text-slate-300">{viewTarget.notes}</p></DetailSection>}
            <DetailSection title="Fotos">
              {viewTarget.images && viewTarget.images.length > 0 ? (
                <ImageGallery images={viewTarget.images} />
              ) : (
                <p className="text-[13px] text-gray-400 dark:text-slate-500">Nenhuma imagem anexada.</p>
              )}
            </DetailSection>
          </div>
        )}
      </Modal>
    </div>
  );
}
