import { useState, useEffect } from 'react';
import { Building2, Users, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { ImageUploader } from '../components/ImageUploader';
import { AddressFields } from '../components/AddressFields';
import { maskDocumentInput, maskPhoneInput } from '../utils/formatters';
import { Spinner } from '../components/Loading';
import UsersPage from './UsersPage';
import type { Image } from '../types';

const typeOptions = [
  { value: 'loja', label: 'Loja' },
  { value: 'prestador', label: 'Prestador de Serviço' },
  { value: 'ambos', label: 'Ambos' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<'empresa' | 'usuarios' | 'sobre'>('empresa');
  const { company, isAdmin, updateCompany } = useAuth();
  const [saving, setSaving] = useState(false);
  const [logoImages, setLogoImages] = useState<Image[]>([]);
  const [form, setForm] = useState({
    name: '', tradeName: '', document: '', phone: '', email: '',
    address: '', city: '', state: '', zipCode: '', type: 'ambos',
  });

  useEffect(() => {
    if (!company?.id) return;
    api.get('/uploads', { params: { entityType: 'company', entityId: company.id } })
      .then((r) => setLogoImages(r.data.data))
      .catch(() => { /* logo is optional — silent */ });
  }, [company?.id]);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '', tradeName: company.tradeName || '',
        document: company.document || '', phone: company.phone || '',
        email: company.email || '', address: company.address || '',
        city: company.city || '', state: company.state || '',
        zipCode: company.zipCode || '', type: company.type || 'ambos',
      });
    }
  }, [company]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.put('/companies/mine', form);
      updateCompany(r.data.data);
      toast.success('Empresa atualizada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const tabs = [
    { key: 'empresa', label: 'Empresa', icon: Building2 },
    ...(isAdmin ? [{ key: 'usuarios', label: 'Usuários', icon: Users }] : []),
    { key: 'sobre', label: 'Sobre', icon: Info },
  ] as const;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Configurações" subtitle="Dados da empresa e preferências do sistema" showAdd={false} />

      <div className="flex gap-1 border-b border-gray-200 mb-6 dark:border-slate-800">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                tab === t.key ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'empresa' && (
        <form onSubmit={handleSave} className="card p-5 space-y-4">
          <h3 className="text-[13px] font-semibold text-gray-700 dark:text-slate-200">Dados da empresa</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="company-name" className="label">Nome da empresa *</label>
              <input id="company-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required minLength={2} maxLength={120} />
            </div>
            <div><label htmlFor="company-trade" className="label">Nome fantasia</label><input id="company-trade" type="text" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} className="input" maxLength={120} /></div>
            <div><label htmlFor="company-doc" className="label">CNPJ / CPF</label><input id="company-doc" type="text" value={form.document} onChange={(e) => setForm({ ...form, document: maskDocumentInput(e.target.value) })} className="input" placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric" /></div>
            <div><label htmlFor="company-phone" className="label">Telefone</label><input id="company-phone" type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhoneInput(e.target.value) })} className="input" placeholder="(00) 00000-0000" maxLength={15} inputMode="tel" /></div>
            <div><label htmlFor="company-email" className="label">Email</label><input id="company-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" maxLength={150} /></div>
            <div className="col-span-2">
              <AddressFields
                idPrefix="company"
                value={{ zipCode: form.zipCode, address: form.address, city: form.city, state: form.state }}
                onChange={(a) => setForm({ ...form, zipCode: a.zipCode, address: a.address, city: a.city, state: a.state })}
              />
            </div>
            <div>
              <label htmlFor="company-type" className="label">Tipo de atividade</label>
              <select id="company-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input" disabled={!isAdmin}>
                {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {!isAdmin && <p className="helper-text">Apenas administradores podem alterar</p>}
            </div>
          </div>
          <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-slate-800">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Spinner size={13} className="text-current" />} Salvar alterações
            </button>
          </div>
        </form>
      )}

      {tab === 'empresa' && (
        <div className="card p-5 mt-4">
          <h3 className="text-[13px] font-semibold text-gray-700 mb-3 dark:text-slate-200">Logo da empresa</h3>
          <div className="max-w-md">
            <ImageUploader
              entityType="company"
              entityId={company?.id}
              images={logoImages}
              onChange={setLogoImages}
              disabled={!company?.id}
            />
          </div>
        </div>
      )}

      {tab === 'usuarios' && <UsersPage />}

      {tab === 'sobre' && (
        <div className="card p-5 space-y-4 max-w-lg">
          <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2 dark:text-slate-200">
            <Info size={14} /> Sobre o Agilzi
          </h3>
          <div className="space-y-3 text-[13px] text-gray-600 dark:text-slate-400">
            <div className="flex justify-between border-b border-gray-50 pb-2 dark:border-slate-800"><span className="text-gray-400 dark:text-slate-500">Versão</span><span className="font-medium">1.0.0</span></div>
            <div className="flex justify-between border-b border-gray-50 pb-2 dark:border-slate-800"><span className="text-gray-400 dark:text-slate-500">Empresa</span><span className="font-medium">{company?.name || '—'}</span></div>
            <div className="flex justify-between border-b border-gray-50 pb-2 dark:border-slate-800"><span className="text-gray-400 dark:text-slate-500">Tipo</span><span className="font-medium">{typeOptions.find((t) => t.value === company?.type)?.label || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400 dark:text-slate-500">Armazenamento</span><span className="font-medium">Local (SQLite)</span></div>
          </div>
          <p className="text-[12px] text-gray-400 pt-2 border-t border-gray-100 dark:text-slate-500 dark:border-slate-800">
            Sistema de gestão para lojas e prestadores de serviço. Seus dados ficam no seu servidor.
          </p>
        </div>
      )}
    </div>
  );
}
