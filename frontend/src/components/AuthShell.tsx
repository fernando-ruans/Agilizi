import Brand from './Brand';
import { FileText, Wallet, BarChart3 } from 'lucide-react';

/**
 * Moldura única das telas de auth (login/cadastro): no desktop, lateral
 * institucional escura e contida (marca, frase editorial e três capacidades
 * factuais do produto) + coluna de formulário; no mobile, só a coluna de
 * formulário centralizada, como antes. Sem gradientes, sem texturas, sem
 * mock de produto — só tipografia e divisórias hairline.
 */
const POINTS = [
  { icon: FileText, text: 'Orçamentos e ordens de serviço' },
  { icon: Wallet, text: 'Caixa atualizado a cada lançamento' },
  { icon: BarChart3, text: 'Relatórios e propostas em PDF' },
];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside aria-label="Sobre o Agilizi" className="relative hidden flex-col justify-between bg-slate-900 px-12 py-10 lg:flex xl:px-16">
        <Brand height={32} tone="onDark" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Agilizi · gestão local
          </p>
          <p className="mt-4 max-w-[380px] font-display text-[34px] leading-[1.15] tracking-tight text-slate-50">
            Vendas, serviços e caixa em um só lugar.
          </p>
          <ul className="mt-8 max-w-[360px] divide-y divide-white/10 border-y border-white/10">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 py-3 text-[13px] text-slate-300">
                <p.icon size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-slate-500">
          © {year} Agilizi · Seus dados ficam na sua máquina.
        </p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex justify-center lg:hidden">
            <Brand height={36} />
          </div>
          {children}
          <p className="mt-10 text-center text-[12px] text-gray-400 lg:hidden dark:text-slate-500">
            © {year} Agilizi · Seus dados ficam na sua máquina.
          </p>
        </div>
      </main>
    </div>
  );
}
