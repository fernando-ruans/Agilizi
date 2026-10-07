import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { UserRound, KeyRound, Building2, Check, Camera, Trash2 } from 'lucide-react';
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

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const refreshMe = async () => {
    const r = await api.get('/auth/me');
    updateUser(r.data.data);
  };

  const handleAvatar = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 5MB).');
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'user');
      formData.append('entityId', user!.id);
      await api.post('/uploads', formData);
      await refreshMe();
      toast.success('Foto atualizada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar foto');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const r = await api.get('/uploads', { params: { entityType: 'user', entityId: user!.id } });
      await Promise.all(r.data.data.map((img: { id: string }) => api.delete('/uploads/' + img.id)));
      await refreshMe();
      toast.success('Foto removida');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao remover foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

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
            <div className="relative shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt={"Foto de " + (user?.name || 'usuário')} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center text-[18px] font-semibold dark:bg-slate-200 dark:text-slate-900">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Alterar foto"
                aria-label="Alterar foto"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
              >
                <Camera size={12} />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-gray-800 truncate dark:text-slate-100">{user?.name}</p>
              <p className="text-[13px] text-gray-400 truncate dark:text-slate-500">{user?.email}</p>
              <span className="badge badge-info mt-1">{roleLabels[user?.role || '']}</span>
            </div>
            {user?.avatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                title="Remover foto"
                aria-label="Remover foto"
                className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-950/50"
              >
                <Trash2 size={15} />
              </button>
            )}
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
