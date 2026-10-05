<div align="center">

<img src="frontend/public/favicon.svg" alt="Agilzi" width="160"/>

# Agilzi

**Gestão local para lojas e prestadores de serviço.**

Clientes, vendas, ordens de serviço, caixa e relatórios — multi-empresa, 100% local, sem mensalidade. Seus dados nunca saem da sua máquina.

`React` `Express` `Prisma` `SQLite`

> 🧪 **Testar em 2 minutos:** suba o backend e o frontend ([Começando](#começando)) e entre com `admin@demo.com` / `admin123` — ou crie sua empresa em `/register`.

</div>

---

## Sumário

- [Começando](#começando)
- [Funcionalidades](#funcionalidades)
- [Como funciona por dentro](#como-funciona-por-dentro)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Testes](#testes)
- [Produção](#produção)
- [Roadmap](#roadmap)
- [Licença](#licença)

---

## Começando

Pré-requisitos: **Node.js 18+** e npm.

```bash
# 1) Backend — http://localhost:3333
cd backend
cp .env.example .env   # ajuste JWT_SECRET em produção
npm install
npx prisma migrate dev # cria o banco e roda o seed sozinho
npm run dev

# 2) Frontend — http://localhost:5173
cd frontend
npm install
npm run dev
```

| Acesso | Onde |
|--------|------|
| App | `http://localhost:5173` |
| API | `http://localhost:3333/api/v1` |
| Health | `http://localhost:3333/health` |
| Login demo | `admin@demo.com` / `admin123` |

O menu lateral se adapta sozinho ao tipo da empresa (`loja`, `prestador` ou `ambos`) e ao perfil do usuário (`admin`, `gerente`, `operacional`).

---

## Funcionalidades

### Loja
- **Produtos** com preço de custo, estoque e alerta de estoque baixo — com margem por produto.
- **Vendas** com baixa atômica de estoque; cancelar restaura estoque e remove o caixa.
- **Relatório de rentabilidade**: faturamento, custo (congelado na venda), lucro e margem + PDF.

### Prestador
- **Orçamentos** com PDF de proposta, aprovação/rejeição e conversão em OS em 1 clique (sem duplicar).
- **Ordens de serviço** com técnico, prioridade, histórico de status e baixa no caixa ao concluir.

### Gestão
- **Caixa** centralizado: toda venda, OS concluída e despesa paga gera lançamento automático (sem digitação dupla).
- **Despesas** com status, fornecedor e sincronia total com o caixa.
- **Relatórios em PDF**: financeiro, vendas, despesas, OS e rentabilidade, todos com prévia por período.
- **Configurações**: dados da empresa (CNPJ/CPF, telefone e CEP com máscara BR), usuários por perfil e PWA instalável.
- **Multi-empresa de verdade**: cada empresa enxerga só os próprios dados (invariante coberta por teste).

---

## Como funciona por dentro

```
┌──────────────────────────────────────────────────────┐
│              Frontend (React + TS + Vite)            │
│  Páginas por módulo · DataTable · Modal · Brand      │
│  Interceptor JWT · máscaras BR · PDFs client-side    │
└─────────────────────────┬────────────────────────────┘
                          │  REST /api/v1 (Bearer JWT)
┌─────────────────────────▼────────────────────────────┐
│              Backend (Express + TS + Zod)            │
│  Controllers por módulo · authorize(admin/gerente/   │
│  operacional) · cashSync (centralização do caixa)    │
└─────────────────────────┬────────────────────────────┘
                          │  Prisma
┌─────────────────────────▼────────────────────────────┐
│              SQLite (dev.db — o banco é 1 arquivo)   │
│  Tudo escopado por companyId · contadores por empresa│
└──────────────────────────────────────────────────────┘
```

| Camada | Tecnologia |
|--------|-----------|
| Interface | React 18 + TS + Vite + Tailwind + Recharts + pdfmake |
| API | Express + Prisma + Zod + JWT + Multer/Sharp |
| Banco | SQLite (backup = copiar `backend/prisma/dev.db`) |
| Testes | Vitest + Supertest (API), Testing Library + Playwright (front) |

O caixa nunca é digitado à toa: vendas, OS concluídas e despesas pagas criam/atualizam/removem o lançamento sozinhas via `backend/src/services/cashSync.ts` — com reparo idempotente a cada boot.

---

## Estrutura do projeto

```
gestao-empresas/
├── backend/          # API REST (src/, prisma/, uploads/)
├── frontend/         # App React (pages/, components/, e2e/)
├── DESIGN.md         # memória de gosto (identidade, tipo, cor)
├── CHANGELOG.md      # histórico por lote
└── render.yaml       # Blueprint de deploy no Render
```

---

## Testes

```bash
cd backend  && npm test       # API: 124 testes (auth, multi-tenancy, permissões, estoque)
cd frontend && npm test       # componentes: 79 testes
cd frontend && npx playwright test  # ponta a ponta: 53 testes (jornada total inclusa)
```

A suíte e2e inclui a **jornada completa** (`e2e/full-journey.spec.ts`): registra empresa do zero e atravessa todos os módulos — do cliente ao PDF, do caixa ao logout.

> 💡 Cada mudança entra no [CHANGELOG.md](./CHANGELOG.md) no padrão data + tipo + arquivos.

---

## Produção

```bash
cd backend && npm run build && NODE_ENV=production node dist/server.js
```

Ou suba pelo [Render](./render.yaml) (Blueprint pronto: API + frontend estático).

Checklist antes de publicar:

1. **`JWT_SECRET` forte** no `.env` — nunca o placeholder
2. **`NODE_ENV=production`** e **`FRONTEND_URL`** apontando para o domínio final
3. **Backup** de `backend/prisma/dev.db` (é todo o banco)
4. Health check: `GET /health`

---

## Roadmap

- [ ] Contas a pagar/receber com baixa parcial
- [ ] Recibos/romaneio impressos para OS
- [ ] Uploads em provedor externo (sair do disco local)
- [ ] CI rodando as 3 suítes a cada push

---

## Licença

MIT
