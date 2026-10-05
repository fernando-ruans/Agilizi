import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { UserRound, KeyRound, Building2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Loading';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  operacional: 'Operacional',
};

const typeLabels: Record<string, string> = {
  loja: 'Loja',
  prestador: 'Prestador de Serviço',
  ambos: 'Loja + Serviços',
};

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'senha' ? 'senha' : 'dados';
  const { user, company, updateUser } = useAuth();

  // Profile form
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '' });

  // Password form
  const [savingPassword, setSavingPassword] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email });
  }, [user]);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const r = await api.put('/auth/me', { name: profile.name, email: profile.email });
      updateUser(r.data.data);
      toast.success('Perfil atualizado');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar perfil');
    } finally { setSavingProfile(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      toast.success('Senha alterada com sucesso');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao alterar senha');
    } finally { setSavingPassword(false); }
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div className="max-w-3xl">
      <PageHeader title="Meu perfil" subtitle="Gerencie seus dados pessoais e senha" showAdd={false} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 dark:border-slate-800">
        <button
          onClick={() => setSearchParams({})}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'dados' ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-2"><UserRound size={14} /> Dados</span>
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'senha' })}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'senha' ? 'border-slate-800 text-slate-800 dark:border-slate-200 dark:text-slate-200' : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-2"><KeyRound size={14} /> Senha</span>
        </button>
      </div>

      {activeTab === 'dados' ? (
        <div className="space-y-6">
          {/* Avatar + basic info */}
          <div className="card p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center text-[18px] font-semibold dark:bg-slate-200 dark:text-slate-900">
              {initials}
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-800 dark:text-slate-100">{user?.name}</p>
              <p className="text-[13px] text-gray-400 dark:text-slate-500">{user?.email}</p>
              <span className="badge badge-info mt-1">{roleLabels[user?.role || '']}</span>
            </div>
          </div>

          {/* Editable form */}
          <form onSubmit={handleProfile} className="card p-5 space-y-4">
            <h3 className="text-[13px] font-semibold text-gray-700 dark:text-slate-200">Dados pessoais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-name" className="label">Nome</label>
                <input id="profile-name" type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="input" required minLength={2} />
              </div>
              <div>
                <label htmlFor="profile-email" className="label">Email</label>
                <input id="profile-email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="input" required />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                {savingProfile && <Spinner size={13} className="text-current" />} Salvar alterações
              </button>
            </div>
          </form>

          {/* Company info (read-only here) */}
          {company && (
            <div className="card p-5">
              <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2 mb-4 dark:text-slate-200">
                <Building2 size={14} /> Empresa
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">Nome</p><p className="text-[13px] text-gray-700 dark:text-slate-300">{company.name}</p></div>
                {company.tradeName && <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">Nome fantasia</p><p className="text-[13px] text-gray-700 dark:text-slate-300">{company.tradeName}</p></div>}
                <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">CNPJ</p><p className="text-[13px] text-gray-700 font-mono dark:text-slate-300">{company.document || '—'}</p></div>
                <div><p className="text-[11px] text-gray-400 uppercase tracking-wider dark:text-slate-500">Tipo</p><p className="text-[13px] text-gray-700 dark:text-slate-300">{typeLabels[company.type] || company.type}</p></div>
              </div>
              <p className="text-[12px] text-gray-400 mt-4 flex items-center gap-1.5 dark:text-slate-500">
                Para alterar dados da empresa, acesse <Link to="/configuracoes">Configurações</Link>.
              </p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handlePassword} className="card p-5 space-y-4 max-w-md">
          <h3 className="text-[13px] font-semibold text-gray-700 dark:text-slate-200">Alterar senha</h3>
          <div>
            <label htmlFor="pw-current" className="label">Senha atual</label>
            <input id="pw-current" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="input" required autoComplete="current-password" />
          </div>
          <div>
            <label htmlFor="pw-new" className="label">Nova senha</label>
            <input id="pw-new" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="input" required minLength={6} autoComplete="new-password" />
            <p className="helper-text">Mínimo de 6 caracteres</p>
          </div>
          <div>
            <label htmlFor="pw-confirm" className="label">Confirmar nova senha</label>
            <input id="pw-confirm" type="password" value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} className="input" required minLength={6} autoComplete="new-password" />
            {pw.confirmPassword && pw.newPassword !== pw.confirmPassword && (
              <p className="error-text">As senhas não coincidem</p>
            )}
          </div>
          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-slate-800">
            <button type="submit" disabled={savingPassword} className="btn-primary">
              {savingPassword && <Spinner size={13} className="text-current" />}
              <Check size={14} /> Alterar senha
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
