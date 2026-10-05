import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-[64px] font-bold text-gray-200 leading-none tabular-nums dark:text-slate-800">404</p>
      <h1 className="text-[20px] font-semibold text-gray-800 mt-4 dark:text-slate-100">Página não encontrada</h1>
      <p className="text-[13px] text-gray-400 mt-2 max-w-sm dark:text-slate-500">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <div className="flex gap-3 mt-8">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft size={14} /> Voltar
        </button>
        <Link to="/dashboard" className="btn-primary">
          <Home size={14} /> Ir ao painel
        </Link>
      </div>
    </div>
  );
}
