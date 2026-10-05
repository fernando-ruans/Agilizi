# DESIGN.md — Agilzi (memória de gosto do projeto)

> Documento vivo: registrar aqui toda decisão visual durável. Componentes e
> tokens mudam apenas junto com esta fonte.

## Identidade

- **Marca**: glifo Λ geométrico com barra âmbar ascendente que rompe a
  silhueta (movimento = "agil"). Dono único: `frontend/src/components/Brand.tsx`;
  arte: `frontend/public/logo.svg` (glifo, herda `currentColor`) e
  `frontend/public/favicon.svg` (tile `#1B2A41`). v2 (atual): traço 5,
  pernas mais fechadas, barra com mais fuga. Backup da v1 em
  `frontend/public/brand-v1/` para troca futura. Nada de monograma de
  duas letras — foi removido em 2026-10-05.
- **Registro**: produto/admin (SaaS). Sem landing page; sem gradientes
  decorativos, sem vidro, sem blobs. Ousadia concentrada num lugar só:
  a marca + a tipografia de marca.

## Tipografia (papéis fixos)

- **UI/prosa/dados**: Inter Variable (`font-sans`). Tabelas e KPIs usam
  `tabular-nums` via `.table td` / `.tnum` — valores financeiros alinham
  pelos algarismos, nunca pelo ritmo da prosa.
- **Marca/momento de marca**: Fraunces Variable (`font-display`), só no
  wordmark e nos headlines dos painéis de login/cadastro. Nunca em
  títulos de páginas internas, tabelas ou formulários.
- **Caixa**: tudo em sentence case pt-BR; dinheiro sempre `formatCurrency`.

## Cor (papéis fixos)

- **Tinta**: slate (`slate-800` claro / `slate-100` escuro). Superfícies:
  papel `#f8f9fb` claro, `slate-950` escuro.
- **Acento**: `brand` (âmbar) só para ação primária alternativa, seleção
  de texto e a barra da marca. Estado nunca comunicado só por cor
  (badge sempre tem texto).
- **Semântica**: emerald (ok/lucro), amber (alerta), red (perigo/prejuízo).

## Componentes canônicos

- `Brand` (marca), `AuthBrandPanel` (lado esquerdo de login/cadastro: grade ledger + glifo cortado), `PageHeader` (título único por página), `DataTable` (lista + vazio + paginação), `Modal`/`ConfirmDialog` (Escape fecha),
  `DateRangePicker` (mês vigente por padrão), `AddressFields` (CEP com
  fallback manual), `ImageUploader`/`ImageGallery`, `Loading`/`SkeletonCard`.
- Fluxo novo reaproveita estes donos; nada de implementação equivalente
  por tela.

## Anti-slop (regras de revisão)

- Nada de herói centralizado, grade de cards uniformes, gradiente
  roxo-azul, pílulas em excesso, blur de vidro ou animação em tudo.
- Números grandes só com rótulo pequeno e fonte dos dados — nunca
  métrica decorativa.
- Telas vazias convidam à ação; erros dizem o que houve e como corrigir.
