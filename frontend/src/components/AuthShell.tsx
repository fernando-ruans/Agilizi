import Brand from './Brand';

/**
 * Moldura única das telas de auth (login/cadastro): coluna estreita
 * centralizada no papel do app, lockup oficial no topo e uma linha
 * discreta de garantia no rodapé. Sem painel de marketing, sem textura,
 * sem headline decorativa — a tela existe só para entrar ou cadastrar.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fb] dark:bg-slate-950">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="flex justify-center mb-10">
            <Brand height={36} />
          </div>
          {children}
          <p className="text-[12px] text-gray-400 text-center mt-10 dark:text-slate-500">
            © {new Date().getFullYear()} Agilizi · Seus dados ficam na sua máquina.
          </p>
        </div>
      </main>
    </div>
  );
}
