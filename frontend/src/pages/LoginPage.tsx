import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Loading';
import Brand from '../components/Brand';
import AuthBrandPanel from '../components/AuthBrandPanel';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Bem-vindo de volta!');
      navigate('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao fazer login';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8f9fb] dark:bg-slate-950">
      <AuthBrandPanel
        headline="Gerencie sua empresa com clareza."
        description="Orçamentos, ordens de serviço, financeiro e clientes — tudo em um só lugar, sem complicação."
      />

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Brand markSize={30} wordmarkSize={17} />
          </div>

          <div className="mb-8">
            <h1 className="text-[22px] font-semibold text-gray-800 tracking-tight dark:text-slate-100">Entrar</h1>
            <p className="text-[13px] text-gray-400 mt-1 dark:text-slate-500">Acesse o painel de controle</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="label">Email</label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="input" required autoComplete="email" autoFocus />
            </div>
            <div>
              <label htmlFor="login-password" className="label">Senha</label>
              <div className="relative">
                <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input pr-10" required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full h-10">
              {loading ? <Spinner size={15} className="text-current" /> : null}
              {!loading && <span>Entrar</span>}
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          <div className="mt-8 p-3.5 rounded-md bg-gray-50 border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
            <p className="text-[11px] text-gray-400 text-center leading-relaxed dark:text-slate-500">
              Credenciais de teste: <span className="font-medium text-gray-500 dark:text-slate-400">admin@demo.com</span> / <span className="font-medium text-gray-500 dark:text-slate-400">admin123</span>
            </p>
          </div>

          <p className="text-[13px] text-gray-400 text-center mt-6 dark:text-slate-500">
            Não tem conta? <Link to="/register" className="text-slate-800 font-medium hover:underline dark:text-slate-200">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
