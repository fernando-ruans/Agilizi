import { useState, useEffect } from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { User } from '../types';
import { PageHeader, SearchBar } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Field, FieldGrid } from '../components/DetailFields';
import { formatDate } from '../utils/formatters';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  operacional: 'Operacional',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [viewTarget, setViewTarget] = useState<User | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'operacional' });

  useEffect(() => { load(); }, [page, search]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { page, limit: 10, search } });
      setUsers(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Erro ao carregar usuários'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selected) {
        const data: any = { name: formData.name, email: formData.email, role: formData.role };
        if (formData.password) data.password = formData.password;
        await api.put(`/users/${selected.id}`, data);
        toast.success('Usuário atualizado!');
      } else {
        await api.post('/users', formData);
        toast.success('Usuário criado!');
      }
      setModalOpen(false); reset(); load();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Erro ao salvar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar usuário?')) return;
    try { await api.delete(`/users/${id}`); toast.success('Desativado!'); load(); }
    catch { toast.error('Erro ao desativar'); }
  };

  const reset = () => { setSelected(null); setFormData({ name: '', email: '', password: '', role: 'operacional' }); };

  const columns = [
    { key: 'name', label: 'Nome', render: (i: User) => (
      <span className="flex items-center gap-2.5">
        {i.avatar ? (
          <img src={i.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-semibold shrink-0 dark:bg-slate-800 dark:text-slate-300">
            {i.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
          </span>
        )}
        <span className="font-medium">{i.name}</span>
      </span>
    ) },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Perfil', render: (i: User) => <span className="badge badge-info">{roleLabels[i.role]}</span> },
    { key: 'active', label: 'Status', render: (i: User) => <span className={i.active ? 'badge-success' : 'badge-danger'}>{i.active ? 'Ativo' : 'Inativo'}</span> },
    { key: 'createdAt', label: 'Criado em', render: (i: User) => formatDate(i.createdAt) },
    { key: 'actions', label: 'Ações', render: (i: User) => (
      <div className="flex gap-2">
        <button onClick={() => setViewTarget(i)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" title="Ver detalhes"><Eye size={16} /></button>
        <button onClick={() => { setSelected(i); setFormData({ name: i.name, email: i.email, password: '', role: i.role }); setModalOpen(true); }} className="text-yellow-600 hover:text-yellow-800"><Pencil size={16} /></button>
        {i.active && <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Usuários" subtitle="Gerencie os usuários do sistema" onAdd={() => { reset(); setModalOpen(true); }} addLabel="Novo Usuário" />
      <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Buscar usuário..." /></div>
      <DataTable columns={columns} data={users} pagination={pagination} onPageChange={setPage} loading={loading} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Editar Usuário' : 'Novo Usuário'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="user-name" className="label">Nome *</label><input id="user-name" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required /></div>
          <div><label htmlFor="user-email" className="label">Email *</label><input id="user-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" required /></div>
          <div><label htmlFor="user-password" className="label">{selected ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label><input id="user-password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="input" required={!selected} minLength={6} /></div>
          <div>
            <label htmlFor="user-role" className="label">Perfil *</label>
            <select id="user-role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="input">
              <option value="operacional">Operacional</option><option value="gerente">Gerente</option><option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{selected ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewTarget} onClose={() => setViewTarget(null)} title="Detalhes do usuário">
        {viewTarget && (
          <div className="space-y-4">
            <FieldGrid>
              <Field label="Nome" value={viewTarget.name} />
              <Field label="Email" value={viewTarget.email} />
              <Field label="Perfil" value={roleLabels[viewTarget.role] || viewTarget.role} />
              <Field label="Status" value={viewTarget.active ? 'Ativo' : 'Inativo'} />
              <Field label="Criado em" value={formatDate(viewTarget.createdAt)} />
            </FieldGrid>
          </div>
        )}
      </Modal>
    </div>
  );
}
