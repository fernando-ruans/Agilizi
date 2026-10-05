import { useState, useEffect } from 'react';
import { Pencil, Trash2, Eye, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Client } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { ImageUploader } from '../components/ImageUploader';
import { ImageGallery } from '../components/ImageGallery';
import { AddressFields } from '../components/AddressFields';
import { formatDocument, formatPhone, maskDocumentInput, maskPhoneInput } from '../utils/formatters';
import { Spinner } from '../components/Loading';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', document: '', documentType: 'cpf',
    address: '', city: '', state: '', zipCode: '', notes: '',
  });

  useEffect(() => { load(); }, [page, search]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/clients', { params: { page, limit: 10, search } });
      setClients(r.data.data);
      setPagination(r.data.pagination);
    } catch { toast.error('Erro ao carregar clientes'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (selected) {
        await api.put(`/clients/${selected.id}`, form);
        toast.success('Cliente atualizado');
      } else {
        await api.post('/clients', form);
        toast.success('Cliente criado');
      }
      setModalOpen(false);
      reset();
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/clients/${deleteTarget.id}`);
      toast.success('Cliente desativado');
      setDeleteTarget(null);
      load();
    } catch { toast.error('Erro ao desativar'); }
  };

  const openEdit = (c: Client) => {
    setSelected(c);
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '',
      document: c.document || '', documentType: c.documentType || 'cpf',
      address: c.address || '', city: c.city || '', state: c.state || '',
      zipCode: c.zipCode || '', notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const reset = () => {
    setSelected(null);
    setForm({ name: '', email: '', phone: '', document: '', documentType: 'cpf', address: '', city: '', state: '', zipCode: '', notes: '' });
  };

  const columns = [
    {
      key: 'name', label: 'Nome',
      render: (i: Client) => (
        <span className="flex items-center gap-2.5">
          {i.images && i.images.length > 0 ? (
            <img src={i.images[0].url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200 bg-gray-50 flex-shrink-0 dark:border-slate-700 dark:bg-slate-800" loading="lazy" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex-shrink-0 flex items-center justify-center text-[11px] font-semibold dark:bg-slate-800 dark:text-slate-400">
              {i.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="font-medium text-gray-800 dark:text-slate-100">{i.name}</span>
        </span>
      ),
    },
    { key: 'document', label: 'Documento', render: (i: Client) => <span className="font-mono text-[12px] text-gray-500 dark:text-slate-400">{i.document ? formatDocument(i.document, i.documentType) : '—'}</span> },
    { key: 'phone', label: 'Telefone', render: (i: Client) => i.phone ? formatPhone(i.phone) : '—' },
    { key: 'email', label: 'Email', render: (i: Client) => <span className="text-gray-500 dark:text-slate-400">{i.email || '—'}</span> },
    { key: 'city', label: 'Cidade', render: (i: Client) => <span className="text-gray-500 dark:text-slate-400">{i.city || '—'}</span> },
    {
      key: 'actions', label: '', className: 'w-24',
      render: (i: Client) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setSelected(i); setViewOpen(true); }} className="btn-ghost btn-sm p-1.5 rounded" title="Ver detalhes">
            <Eye size={14} className="text-gray-400 dark:text-slate-500" />
          </button>
          <button onClick={() => openEdit(i)} className="btn-ghost btn-sm p-1.5 rounded" title="Editar">
            <Pencil size={14} className="text-gray-400 dark:text-slate-500" />
          </button>
          <button onClick={() => setDeleteTarget(i)} className="btn-ghost btn-sm p-1.5 rounded" title="Desativar">
            <Trash2 size={14} className="text-gray-400 hover:text-red-500 dark:text-slate-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Gerencie sua base de clientes" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Novo Cliente" />
      <div className="mb-4 max-w-sm">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nome, email..." />
      </div>
      <DataTable columns={columns} data={clients} pagination={pagination} onPageChange={setPage} loading={loading} emptyMessage="Nenhum cliente cadastrado" emptyIcon={<Users size={20} className="text-gray-300" />} />

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); load(); }} title={selected ? 'Editar cliente' : 'Novo cliente'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="client-name" className="label">Nome *</label><input id="client-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="client-doc-type" className="label">Documento</label>
              <div className="flex gap-2">
                <select id="client-doc-type" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value, document: maskDocumentInput(form.document, e.target.value) })} className="input w-24">
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                </select>
                <input id="client-document" type="text" inputMode="numeric" value={form.document} onChange={(e) => setForm({ ...form, document: maskDocumentInput(e.target.value, form.documentType) })} className="input flex-1" placeholder={form.documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'} maxLength={form.documentType === 'cpf' ? 14 : 18} />
              </div>
            </div>
            <div><label htmlFor="client-phone" className="label">Telefone</label><input id="client-phone" type="text" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhoneInput(e.target.value) })} className="input" placeholder="(00) 00000-0000" maxLength={15} /></div>
          </div>
          <div>
            <label htmlFor="client-email" className="label">Email</label>
            <input id="client-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          </div>
          <AddressFields
            idPrefix="client"
            value={{ zipCode: form.zipCode, address: form.address, city: form.city, state: form.state }}
            onChange={(a) => setForm({ ...form, zipCode: a.zipCode, address: a.address, city: a.city, state: a.state })}
          />
          <div><label htmlFor="client-notes" className="label">Observações</label><textarea id="client-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} /></div>
          <div>
            <span className="label">Fotos</span>
            <ImageUploader
              entityType="client"
              entityId={selected?.id}
              images={selected?.images}
              multiple
              disabled={!selected}
              onChange={(images) => selected && setSelected({ ...selected, images })}
            />
            {!selected && <p className="helper-text">Salve o cliente para adicionar imagens.</p>}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
            <button type="button" onClick={() => { setModalOpen(false); load(); }} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting && <Spinner size={13} className="text-current" />}
              {selected ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Detalhes do cliente">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome" value={selected.name} />
              <Field label="Email" value={selected.email || '—'} />
              <Field label="Telefone" value={selected.phone ? formatPhone(selected.phone) : '—'} />
              <Field label="Documento" value={selected.document ? formatDocument(selected.document, selected.documentType) : '—'} mono />
              <Field label="Cidade" value={selected.city ? `${selected.city} - ${selected.state}` : '—'} />
              <Field label="Endereço" value={selected.address || '—'} />
            </div>
            {selected.notes && <Field label="Observações" value={selected.notes} />}
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-1.5 dark:text-slate-500">Fotos</p>
              <ImageGallery images={selected.images || []} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Desativar cliente" message={`Deseja desativar "${deleteTarget?.name}"? O cliente não aparecerá mais nas listagens.`} confirmLabel="Desativar" variant="danger" />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5 dark:text-slate-500">{label}</p>
      <p className={`text-[13px] text-gray-700 dark:text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
