# 📒 Changelog — Agilzi Gestão

> Registro das principais mudanças após cada alteração, para visualização e compreensão futura.

## [2026-10-05] — Lote 11: deploy Render (debug)

### `fix` — Build instalava só `dependencies` (`render.yaml`)
- `npm install --include=dev`: tsc + `@types/*` vivem em devDependencies.

### `fix` — Migração consolida drift `migrations/20261006_consolidate_schema_drift`
- Produção falhava com `expenses.paymentMethod` inexistente: `migrate deploy` só conhecia 2 migrations antigas; `db push` local nunca gerou as intermediárias. Nova migração validada via sqlite3 (17 tabelas, colunas OK).

## [2026-10-05] — Lote 10: painel de auth redesenhado

### `style` — Fim das “cruzes” (`AuthBrandPanel`)
- Painel esquerdo de login/cadastro agora tem grade hairline de ledger + glifo gigante cortado como marca d'água, no lugar da textura genérica de cruzes.
- `AuthBrandPanel` é dono único dos dois lados (login e cadastro deixaram de duplicar o markup).
- DESIGN.md atualizado com o novo dono canônico.

## [2026-10-05] — Lote 9: GitHub + preparo Render

### `chore` — Repo `fernando-ruans/Agilizi` no ar (push via VSCode)
- `rootDir` do Blueprint corrigido para `gestao-empresas/*` (repo raiz é `teste/`).
- Deploy: Dashboard → New → Blueprint → repo Agilizi; depois conferir `FRONTEND_URL` e o rewrite `/api/*`.

## [2026-10-05] — Lote 8: README padrão ViraTudo + Blueprint Render

### `docs` — README reescrito
- Herói centralizado com logo, tagline, badges e bloco de teste em 2 minutos; sumário, tabelas de acesso, diagrama da arquitetura, contagens reais de testes (124 API + 79 componentes + 53 e2e) e roadmap.

### `chore` — `render.yaml` (API Node + SQLite em disco + frontend estático)
- API com `healthCheckPath`, `DATABASE_URL` em disco persistente e `JWT_SECRET` gerado; frontend com rewrite de `/api/*`. Falta só o repo no GitHub para aplicar o Blueprint.

## [2026-10-05] — Lote 7: commit geral + cadastro refinado + marca v2

### `chore` — Commit geral dos lotes 1–6
- Tudo commitado na `main` após checar que só arquivos intencionais entram (`.env`, `*.db`, `dist`, `uploads` ignorados).

### `feat` — Marca v2 com backup
- Traço 5, geometria mais fechada, barra âmbar com mais fuga — melhor em tamanhos pequenos. v1 guardada em `frontend/public/brand-v1/`.
- Canva segue pedindo religar a conexão (`UNAUTHORIZED`); SVGs prontos para importar quando religar.

### `style` — Página de cadastro refinada
- Logo maior no painel (44px), etapas rotuladas `Você`/`Empresa`, máscara viva em CNPJ/CPF, olho na senha e `document` do cadastro salvo só com dígitos (igual ao update).

## [2026-10-05] — Lote 6: máscaras brasileiras nos formulários

### `feat` — CPF/CNPJ, telefone, CEP e UF padronizados
- `maskPhoneInput`/`maskDocumentInput`/`UF_LIST` em `utils/formatters.ts`; máscara viva em clientes (CPF↔CNPJ com re-máscara ao trocar o tipo), fornecedores, empresa (`CNPJ / CPF` auto-detecta, aceita MEI) e `inputMode` numérico/tel.
- `Estado` virou select de UF em `AddressFields` (vale para cliente, fornecedor e empresa, com CEP dando autofill); CEP já era mascarado.
- Backend não precisou mudar: empresa salva só dígitos e a listagem já exibia formatado.
- Testes: máscaras + 27 UFs + select de UF; suíte 79/79 verde; screenshot da tela de configurações conferido.

## [2026-10-05] — Lote 5: menu do usuário ancorado à direita

### `fix` — Dropdown do admin cortado (`Layout`)
- O menu abria preso ao botão (`absolute right-0`) e ficava espremido/cortado. Agora é `fixed right-4 md:right-6 top-[62px]`, sempre visível no lado direito, com limite de altura e rolagem em telas baixas.

## [2026-10-05] — Lote 4: teste de jornada total + aprovar orçamento na UI

### `feat` — Aprovar/Rejeitar orçamento na interface (`BudgetsPage`)
- Achado da varredura: nada na UI levava um orçamento a `aprovado`, então o botão `Converter em OS` era inalcançável sem API. Detalhe agora tem `Aprovar orçamento`/`Rejeitar`.

### `test` — Nova suíte `e2e/full-journey.spec.ts` (3 atos, empresas isoladas)
- A: comercial — cliente, fornecedor, produto com custo, serviço, venda 3×R$50 e entrada de R$150 no caixa.
- B: serviços — orçamento → aprovar → converter → OS iniciar/concluir → entrada de serviço → despesa paga.
- C: gestão — prévia + PDF financeiro com download, empresa, novo gerente, perfil, tema persistente, logout.
- Resultado: 3/3 verde (~32s). Suíte total vai a 53 testes.
  - Resultado: 3/3 verde (~32s). Suíte total vai a 53 testes — rodada completa **53/53 verde**.

## [2026-10-05] — Lote 3: identidade, tipografia anti-slop e teste real de usuário

### `feat` — Marca Agilzi (glifo Λ + barra âmbar)
- Nova arte `frontend/public/logo.svg` (herda `currentColor`, funciona nos dois temas) e `favicon.svg` (tile `#1B2A41`).
- PNGs `icon-192/512` + `apple-touch-icon` gerados via sharp; `manifest.json` com `purpose`, `index.html` com favicon/description/apple-touch.
- Componente único `frontend/src/components/Brand.tsx` (marca + wordmark Fraunces) usado em sidebar, login, cadastro e colapsado.
- Canva: conexão da sessão exige religar (`UNAUTHORIZED` no generate-image) — SVG final entregue pronto para importar no Canva.

### `style` — Tipografia com papéis fixos
- Inter Variable (UI/dados) + Fraunces Variable (marca e headlines de login/cadastro) via Fontsource; `font-display` no Tailwind.
- `tabular-nums` em `.table td`/`.tnum`; `::selection` âmbar; `font-optical-sizing`.
- Novo `DESIGN.md` (memória de gosto: identidade, papéis de tipo/cor, componentes canônicos, regras anti-slop).

### `test` — Sessão real no navegador (iab, como usuário)
- Login, dashboard, criar cliente/produto, venda com baixa de estoque, caixa com entrada, despesa, relatórios com Faturamento, trava de desconto na UI, configurações. Console: zero erros.
- Achado: cliques sintéticos do canal iab não ativam controles (Enter/teclado funciona; cliques reais passam no e2e CLI) — artefato do canal, não do app.

### Verificado
- `typecheck` + unitário front 75/75 OK; screenshots de login/dashboard conferidos.

## [2026-10-05] — Lote 2: correção dos 8 bugs da auditoria

### `fix` — Desconto limitado ao subtotal (vendas, OS, orçamentos)
- Backend (`saleController`, `orderController`, `budgetController` store+update): 400 `Desconto não pode ser maior que o valor dos itens`.
- Frontend (`SalesPage`, `OrdersPage`, `BudgetsPage`): toast e aborto do submit antes de chamar a API.
- Provado: orçamento/venda com desconto 150 em subtotal 100 agora retorna 400, sem tocar estoque nem caixa.

### `fix` — Caixa acompanha a OS até o fim (`cashSync`, `orderController`)
- Excluir OS concluída remove a entrada `order:<id>` (`removeOrderFromCash`); backfill agora limpa órfãos `order:*` além de `expense:*`.
- Editar itens/valor de OS concluída atualiza o valor da entrada (`syncOrderToCash` sincroniza em vez de ignorar); `update` chama o sync.
- Provado: concluir (200) → editar para 999 (caixa 999) → excluir (caixa vazio).

### `fix` — Total consistente ao editar itens (`orderController`, `budgetController`)
- Update com itens e sem `discount` reaproveita o desconto salvo em vez de zerar no cálculo. Provado: 200 − 10 = 190.

### `fix` — Gerente volta a listar usuários (`user.routes`)
- `router.use` ficou só com `authenticate`; cada rota tem seu `authorize` (listar: admin+gerente; gerenciar: admin). Era o `authorize('admin')` global que anulava o do GET.
- Provado: gerente `GET /users` saiu de 401 para 200; campo de técnico volta a aparecer na OS.

### `fix` — Trava anti-lockout de administrador (`userController`)
- Ninguém remove a própria permissão (rebaixar/desativar/excluir a si mesmo → 400) e a empresa sempre mantém ≥1 admin ativo.
- Provado em empresa isolada: self-demote/self-delete 400, desativar segundo admin 200, renomear a si mesmo 200.

### `fix` — Contadores à prova de base legada + conversão sem duplicar (`sale/order/budgetController`)
- `find+update` virou `upsert` em `next_sale/order/budget_number`; conversão orçamento→OS em transação com flip condicional (`updateMany` status) — duplo clique retorna erro em vez de duplicar OS. Provado: C1 201, C2 erro.

### `fix` — Email global único no perfil + paginação sanitizada
- `PUT /auth/me` verifica email no mundo todo (o login é global) — tomar email de outra empresa agora dá 409.
- Novo `utils/pagination.ts` aplicado a 7 controllers + `crudService`: `page=abc`/`-1` volta ao padrão (200) em vez de 500; limite teto 100.

### `test` — E2E independente de restos de dados
- `cash-source-link` (venda) e `margin-profit` (prévia) criam produto+venda via API antes de assertar. Alvo 8/8 verde (inclui as 2 falhas anteriores).

### Verificado
- `typecheck` back+front OK; unitário front 75/75; sondas P1–P6 reexecutadas contra o servidor recarregado.
- Fica para depois (decisão de produto ou ambiente): margem ignora desconto; edição de orçamento aprovado travada; role do JWT só atualiza no relogin; `prisma db push` quebrado neste ambiente (suíte de API segue sem rodar aqui).

## [2026-10-05] — Auditoria funcional completa (sem alterar código)

### Resultado geral
- Frontend unitário: 75/75 verde. E2E Playwright: 48/50 (2 falhas analisadas abaixo).
- Sondas ao vivo em empresas de teste isoladas provaram 5 bugs; demais itens por leitura de código.
- O essencial está redondinho: cancelamento restaura estoque e remove caixa; despesa paga sincroniza; CEP com fallback; tema; rotas guardadas; deep-link de despesa; PDF de rentabilidade.

### Bugs provados ao vivo (próximo lote de correção)
- Desconto maior que o subtotal gera total negativo em orçamentos, OS e vendas — inclusive lançamento negativo no caixa (`total -50`, caixa `-50`).
- Excluir OS concluída deixa a entrada do caixa órfã (`[200]` permanece após DELETE).
- Editar itens/valor de OS concluída não atualiza o caixa (pedido vira 999, caixa fica 200).
- Editar itens sem reenviar desconto recalcula com 0 mas mantém o desconto antigo salvo (total 200 × discount 150).
- Gerente recebe 401 em `GET /users` (authorize admin no `router.use` anula o `authorize(admin, gerente)` do GET) — campo de técnico some na OS.

### Discrepâncias de cálculo a revisar
- Lucro/margem usam receita bruta e ignoram desconto; `cash.monthly.total` soma entradas e saídas; `missingCostCount` conta quantidades; low-stock alerta `stock 0/minStock 0`.

### Infra e testes
- `prisma db push` quebra neste ambiente (schema-engine vazio) — suíte de API não roda aqui; `prisma/test.db` foi removido pela tentativa e será recriado quando o push voltar a funcionar.
- As 2 falhas do e2e são dependência de dados (vendas de setembro fora do mês vigente), não bugs do app: a suíte deveria criar os próprios dados em vez de reaproveitar restos.

## [2026-10-05] — Lote 1: drawer mobile + login + silenciar Prisma

### `feat` — Drawer mobile no Layout (`frontend/src/components/Layout.tsx`)
- Sidebar vira drawer `fixed` com backdrop e botão hamburger no header (só mobile); desktop preservado com collapse.
- Fecha ao trocar de rota e com `Escape`; `aria-label` Abrir/Fechar menu; `main` com `p-4 md:p-6`.

### `feat` — Mostrar/ocultar senha no login (`frontend/src/pages/LoginPage.tsx`)
- Botão Eye/EyeOff com `aria-pressed`; sem mudar fluxo de auth.

### `chore` — Prisma silencioso em dev (`backend/src/config/database.ts`)
- Query log só com `DEBUG_PRISMA=true`; padrão passa a `['error','warn']` (backfill poluía o boot).

### Verificado
- `typecheck` front + back OK; `Layout.test.tsx` 9/9 OK.
- Playwright (fallback — Browser plugin ausente na sessão): login desktop + mobile sem erros de console; drawer abre/fecha no mobile 390px.

## [2026-10-05] — Raio-X completo + ambiente live + changelog

- Backend em `http://localhost:3333` (`npm run dev`, `/health` OK, backfill de caixa executado).
- Frontend em `http://localhost:5173` (`vite dev`, proxy `/api` → `:3333`).
- Preview no painel lateral do Codex (`http://localhost:5173`).
- Login de teste: `admin@demo.com` / `admin123`.
## [2026-10-06] — Revisão mobile: fim da rolagem horizontal

### fix — presets com rolagem contida (DateRangePicker)
- Fileira de chips era flex sem quebra e alargava a página no mobile; agora rola só dentro do card.
- Inputs de data personalizada dividem a linha em 360 px.

### fix — Dashboard empilha no mobile (DashboardPage)
- Ordens por status vira coluna abaixo de sm; gráfico de barras com wrapper min-w-0; cards contidos.

### fix — travas globais (index.css, Layout, PageHeader, ReportsPage, CashPage)
- body overflow-x clip; main overflow-x-clip + min-w-0; PageHeader com quebra; valores do Caixa com quebra.

### test — regressão de overflow (e2e/mobile-overflow.spec.ts)
- 16 testes em 360 px: scrollWidth <= innerWidth em todas as rotas + Personalizado aberto.
## [2026-10-07] — Presets com quebra em linhas (DateRangePicker)

- A rolagem contida escondia chips no Caixa; a fileira agora quebra em linhas e mostra todas as opções sem rolagem.
## [2026-10-07] — Foto do usuário + avatar no sistema

### feat — avatar do usuário (backend + frontend)
- `users.avatar` (migration `20261007_user_avatar`); upload com `entityType=user` reaproveita o pipeline de imagens (WebP, 5MB, disco) e sincroniza `user.avatar` como o logo da empresa faz.
- Não-admin só altera a própria foto (403 no resto); login/`/auth/me`/listas de usuários retornam `avatar`.
- Perfil ganha botão de câmera + remover; topo do Layout e lista de Usuários mostram a foto com fallback de iniciais.

### test — cobertura de avatar + setup resiliente
- Novos testes: upload sincroniza `avatar`, 403 para foto alheia, remoção zera `avatar`.
- `globalSetup` com fallback: se `prisma db push` falhar (schema engine), aplica o SQL das migrations direto.
- `permissions.test.ts` alinhado à rota: gerente pode listar usuários (só leitura, picker de técnico).
## [2026-10-07] — Rodapé do app (Layout)

+- Rodapé discreto abaixo do conteúdo: marca + nome da empresa, sem altura fixa nem overflow no mobile.
