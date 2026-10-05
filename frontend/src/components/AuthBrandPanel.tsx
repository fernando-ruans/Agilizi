import Brand from './Brand';

/**
 * Painel de marca das telas de auth (login/cadastro). Dono único dos dois
 * lados esquerdos: marca d'água do glifo cortada + grade hairline de
 * ledger (organização = o ofício do produto), sem textura genérica.
 */
export default function AuthBrandPanel({
  headline,
  description,
}: {
  headline: string;
  description: string;
}) {
  return (
    <div className="hidden lg:flex lg:w-[45%] bg-[#16233B] relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <img
        src="/logo.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute -right-28 -bottom-28 w-[520px] max-w-none text-white opacity-[0.05] pointer-events-none select-none"
      />
      <div className="relative z-10 flex flex-col justify-between p-12 text-white">
        <Brand onDark markSize={44} wordmarkSize={19} />
        <div>
          <h2 className="font-display text-[30px] font-medium leading-[1.15] tracking-tight max-w-sm">
            {headline}
          </h2>
          <p className="text-[14px] text-slate-300 mt-3 max-w-sm leading-relaxed">
            {description}
          </p>
        </div>
        <p className="text-[12px] text-slate-500">© {new Date().getFullYear()} Agilzi</p>
      </div>
    </div>
  );
}
