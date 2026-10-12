# DESIGN.md — Agilizi (memória de gosto do projeto)

> Documento vivo: registrar aqui toda decisão visual durável. Componentes e
> tokens mudam apenas junto com esta fonte.

## Identidade

- **Marca**: lockup oficial em PNG por tema (`logo-tema-claro.png` /
  `logo-tema-escuro.png`, proporção 3.74:1) + marca "A" quadrada
  (`logo-sidebar-encolhida.png`) para sidebar recolhida, rodapé e PWA.
  Dono único: `frontend/src/components/Brand.tsx` (largura/altura sempre
  explícitas — a imagem nunca estica). Backup da v1 em
  `frontend/public/brand-v1/`.
- **Registro**: produto/admin (SaaS). Sem landing page; sem gradientes
  decorativos, sem vidro, sem blobs. Ousadia concentrada num lugar só:
  a marca + a tipografia de marca.

## Tipografia (papéis fixos)

- **UI/prosa/dados**: Inter Variable (`font-sans`). Tabelas e KPIs usam
  `tabular-nums` via `.table td` / `.tnum` — valores financeiros alinham
  pelos algarismos, nunca pelo ritmo da prosa.
- **Marca/momento de marca**: o wordmark vive no PNG oficial; telas de
  auth usam Inter semibold, como todo o resto. Nada de fonte decorativa.
- **Caixa**: tudo em sentence case pt-BR; dinheiro sempre `formatCurrency`.

## Cor (papéis fixos)

- **Tinta**: slate (`slate-800` claro / `slate-100` escuro). Superfícies:
  papel `#f8f9fb` claro, `slate-950` escuro.
- **Acento**: `brand` (âmbar) só para ação primária alternativa, seleção
  de texto e a barra da marca. Estado nunca comunicado só por cor
  (badge sempre tem texto).
- **Semântica**: emerald (ok/lucro), amber (alerta), red (perigo/prejuízo).

## Componentes canônicos

- `Brand` (marca), `AuthShell` (moldura única de login/cadastro: coluna
  centralizada, lockup no topo, linha de garantia no rodapé — sem painel
  de marketing), `PageHeader` (título único por página), `DataTable` (lista + vazio + paginação), `Modal`/`ConfirmDialog` (Escape fecha),
  `DateRangePicker` (mês vigente por padrão), `AddressFields` (CEP com
  fallback manual), `ImageUploader`/`ImageGallery`, `Loading`/`SkeletonCard`.
- Fluxo novo reaproveita estes donos; nada de implementação equivalente
  por tela.

## Anti-slop (regras de revisão)

- Nada de herói centralizado, grade de cards uniformes, gradiente
  roxo-azul, pílulas em excesso, blur de vidro ou animação em tudo.
- Nada de painel de marketing em tela de login: a tela existe só para
  entrar ou cadastrar, sem headline, textura ou lista de recursos.
- Números grandes só com rótulo pequeno e fonte dos dados — nunca
  métrica decorativa.
- Telas vazias convidam à ação; erros dizem o que houve e como corrigir.
