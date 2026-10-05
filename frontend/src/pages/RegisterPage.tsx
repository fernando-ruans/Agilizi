import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Store, Wrench, Layers, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Loading';
import Brand from '../components/Brand';
import AuthBrandPanel from '../components/AuthBrandPanel';
import { maskDocumentInput } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    companyTradeName: '',
    companyDocument: '',
    companyType: 'ambos' as string,
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!form.name || !form.email || !form.password) {
        toast.error('Preencha todos os campos');
        return;
      }
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const companyTypes = [
    { value: 'loja', label: 'Loja', icon: Store, desc: 'Vendas, produtos, estoque' },
    { value: 'prestador', label: 'Prestador de Serviço', icon: Wrench, desc: 'OS, orçamentos, serviços' },
    { value: 'ambos', label: 'Ambos', icon: Layers, desc: 'Loja + Serviços' },
  ];

  return (
    <div className="min-h-screen flex bg-[#f8f9fb] dark:bg-slate-950">
      {/* Left panel */}
      <AuthBrandPanel
        headline="Comece a gerenciar sua empresa hoje."
        description="Cadastre sua empresa e comece a usar em minutos. Sem complicação, sem mensalidade."
      />

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Brand markSize={34} wordmarkSize={18} />
          </div>

          <div className="mb-8">
            <h1 className="text-[22px] font-semibold text-gray-800 tracking-tight dark:text-slate-100">Criar conta</h1>
            <p className="text-[13px] text-gray-400 mt-1 dark:text-slate-500">
              {step === 1 ? 'Seus dados pessoais' : 'Sua empresa'}
            </p>
          </div>

          {/* Step indicator */}
          <ol className="flex items-center gap-2 mb-6" aria-label="Etapas do cadastro">
            {['Você', 'Empresa'].map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <li key={label} className="flex-1">
                  <div className={`h-1 rounded-full ${done || active ? 'bg-slate-800 dark:bg-slate-200' : 'bg-gray-200 dark:bg-slate-700'}`} />
                  <p className={`text-[11px] mt-1.5 font-medium ${active ? 'text-slate-800 dark:text-slate-200' : 'text-gray-400 dark:text-slate-500'}`}>{label}</p>
                </li>
              );
            })}
          </ol>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="label">Seu nome</label>
                <input id="reg-name" type="text" value={form.name} onChange={(e) => update('name', e.target.value)} className="input" required autoFocus />
              </div>
              <div>
                <label htmlFor="reg-email" className="label">Email</label>
                <input id="reg-email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="input" required />
              </div>
              <div>
                <label htmlFor="reg-password" className="label">Senha</label>
                <div className="relative">
                  <input id="reg-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} className="input pr-10" required minLength={6} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="helper-text">Mínimo de 6 caracteres</p>
              </div>
              <button type="submit" className="btn-primary w-full h-10">
                Próximo <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-company" className="label">Nome da empresa *</label>
                <input id="reg-company" type="text" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} className="input" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-trade" className="label">Nome fantasia</label>
                  <input id="reg-trade" type="text" value={form.companyTradeName} onChange={(e) => update('companyTradeName', e.target.value)} className="input" />
                </div>
                <div>
                  <label htmlFor="reg-doc" className="label">CNPJ / CPF</label>
                  <input id="reg-doc" type="text" inputMode="numeric" value={form.companyDocument} onChange={(e) => update('companyDocument', maskDocumentInput(e.target.value))} className="input" placeholder="00.000.000/0000-00" maxLength={18} />
                </div>
              </div>

              <div>
                <p className="label">Tipo de atividade</p>
                <div className="grid grid-cols-3 gap-2">
                  {companyTypes.map((ct) => {
                    const Icon = ct.icon;
                    const selected = form.companyType === ct.value;
                    return (
                      <button
                        key={ct.value}
                        type="button"
                        onClick={() => update('companyType', ct.value)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          selected
                            ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800 dark:border-slate-300 dark:bg-slate-800 dark:ring-slate-300'
                            : 'border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-600'
                        }`}
                      >
                        <Icon size={20} className={`mx-auto mb-1.5 ${selected ? 'text-slate-800 dark:text-slate-200' : 'text-gray-400 dark:text-slate-500'}`} />
                        <p className={`text-[12px] font-medium ${selected ? 'text-slate-800 dark:text-slate-200' : 'text-gray-600 dark:text-slate-400'}`}>{ct.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 dark:text-slate-500">{ct.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">Voltar</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 h-10">
                  {loading ? <Spinner size={15} className="text-current" /> : <>Criar conta<ArrowRight size={14} /></>}
                </button>
              </div>
            </form>
          )}

          <p className="text-[13px] text-gray-400 text-center mt-6 dark:text-slate-500">
            Já tem conta? <Link to="/login" className="text-slate-800 font-medium hover:underline dark:text-slate-200">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
