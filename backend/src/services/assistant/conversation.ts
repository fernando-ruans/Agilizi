/**
 * Orquestração do bot: monta o prompt com contexto total, chama a cadeia
 * auto/free, extrai propostas de ação e só executa escrita após
 * confirmação explícita (status pending → confirmed → executed).
 */
import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../utils/errors';
import { runChain, ChatTurn, ProviderResult, AssistantProvider } from './provider';
import { NativeToolDef } from './provider';
import { GeminiProvider } from './gemini';
import { KiloProvider } from './kilo';
import { buildCompanySnapshot, buildHistory, PageContext, describePageContext } from './context';
import { tools, getTool, toolsPrompt } from './tools';
import { logger } from '../../utils/logger';

export interface ProposedAction {
  id: string;
  tool: string;
  summary: string;
  destructive: boolean;
}

export interface AssistantReply {
  text: string;
  model: string;
  actions: ProposedAction[];
}

const BT = String.fromCharCode(96);
const FENCE_OPEN = BT + BT + BT + 'agilizi-action';
const FENCE_CLOSE = BT + BT + BT;
const NL = String.fromCharCode(10);
// Modelos free variam o bloco (ex.: ``` agilizi-action com espaço). Normaliza
// antes de extrair/remover para nada vazar para o usuário nem se perder.
function normalizeBlocks(text: string): string {
  return String(text || '').replace(/```\s+agilizi-action/g, FENCE_OPEN);
}
// Modelos gratuitos as vezes emitem JSON quase-valido (virgula extra,
// comentarios ou prosa colada no bloco). Repara de forma conservadora
// antes de desistir, para a proposta nao sumir em silencio.
export function tryParseActionBlock(body: string): unknown {
  const text = String(body || '').trim();
  const clean = (s: string): string =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')
      .replace(/,(\s*[}\]])/g, '$1');
  const candidates: string[] = [text];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start && (start > 0 || end < text.length - 1)) candidates.push(text.slice(start, end + 1));
  for (const c of candidates) {
    const variants = [c, clean(c)];
    for (const v of variants) {
      try {
        return JSON.parse(v);
      } catch {
        // tenta a proxima variacao
      }
    }
  }
  return null;
}
// Conta blocos cercados que nao viraram proposta: serve para pedir
// reemissao em vez de devolver erro generico.
export function countUnparsedBlocks(text: string): number {
  let n = 0;
  for (const chunk of normalizeBlocks(text).split(FENCE_OPEN).slice(1)) {
    const body = chunk.split(FENCE_CLOSE)[0];
    if (!body) continue;
    if (!tryParseActionBlock(body)) n += 1;
  }
  return n;
}

// Modelos free às vezes vazam chamadas de ferramenta em formato próprio
// (ex.: <dots_function_call>). Isso nunca chega ao usuário.
const DOTS_OPEN = '<dots_function_call>';
const DOTS_CLOSE = '</dots_function_call>';

function stripDotsBlocks(text: string): string {
  let out = text;
  for (;;) {
    const start = out.indexOf(DOTS_OPEN);
    if (start < 0) break;
    const end = out.indexOf(DOTS_CLOSE, start + DOTS_OPEN.length);
    out = (out.slice(0, start) + (end < 0 ? '' : out.slice(end + DOTS_CLOSE.length))).trim();
  }
  return out;
}

// O modelo às vezes chama ferramentas no formato nativo dele, reusando
// nosso nome de protocolo: <invoke name="agilizi-action">{...}</invoke>.
// Extrai esses JSONs como propostas normais em vez de descartar.
const INVOKE_OPEN = '<invoke';
const INVOKE_CLOSE = '</invoke>';

function extractDotsInvokes(text: string): Array<{ tool: string; args: any; summary: string }> {
  const out: Array<{ tool: string; args: any; summary: string }> = [];
  for (const chunk of text.split(INVOKE_OPEN).slice(1)) {
    const body = chunk.split(INVOKE_CLOSE)[0];
    if (!body) continue;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(body.slice(start, end + 1));
      if (parsed && typeof parsed.tool === 'string' && parsed.args && typeof parsed.args === 'object') {
        out.push({ tool: parsed.tool, args: parsed.args, summary: String(parsed.summary || parsed.tool) });
      }
    } catch {
      // ignora
    }
  }
  return out;
}

const providers = new Map<string, AssistantProvider>([
  [new GeminiProvider().id, new GeminiProvider()],
  [new KiloProvider().id, new KiloProvider()],
]);

export function isBotAvailable(): boolean {
  if (!config.aiBotEnabled) return false;
  return [...providers.values()].some((p) => p.isConfigured());
}

export async function dailyUsage(companyId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.assistantMessage.count({
    where: { role: 'user', createdAt: { gte: start }, thread: { companyId } },
  });
}

function buildSystemPrompt(snapshot: string, page: PageContext): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'Você é o assistente do Agilizi, sistema de gestão para lojas e prestadores de serviço. Responda em pt-BR, direto e sem jargão.',
    'Hoje é ' + today + ' (use esta data quando o usuário disser "hoje"). Despesas/recibos "pagos" usam status "pago"; "a pagar" usam "pendente". Nunca invente campos fora do schema de cada ferramenta.',
    'Números sempre como número JSON com ponto decimal (42.50), nunca como texto com vírgula nem com "R$" — blocos com número inválido são descartados.',
    'Você enxerga os dados da empresa abaixo. Nunca invente ids, valores ou registros: use só o que está no contexto ou nas ferramentas.',
    'Leitura é livre. Para ALTERAR qualquer dado, proponha a ação num bloco de código com a linguagem agilizi-action (JSON válido) em vez de executar — a execução acontece só após o usuário confirmar no app.',
    'Exemplo de bloco: ' + FENCE_OPEN + ' {"tool": "expense.create", "args": {"description": "Aluguel", "value": 1500}, "summary": "Lançar aluguel de R$ 1.500 como pago"} ' + FENCE_CLOSE,
    'Fluxo obrigatório para criar venda, orçamento ou OS: primeiro chame search para obter os IDs (clientId, productId/serviceId) e SÓ DEPOIS proponha o bloco de escrita com esses IDs. Nunca proponha sale.create, budget.create ou order.create com nome no lugar do ID.',
    'Vendas são de PRODUTOS (sale.create com productId). Orçamentos e OS são de SERVIÇOS (budget.create / order.create com serviceId). Se pedirem orçamento/OS com produto, explique e ofereça registrar uma venda em vez disso.',
    'Uma ação por bloco. Ferramentas marcadas [DESTRUTIVA] (excluir, cancelar venda) exigem motivo claro no texto antes do bloco.',
    'PROIBIDO emitir chamadas de ferramenta em qualquer outro formato: nada de XML, tags <invoke>, <arg_key>, <dots_function_call> ou similar. Se precisar de dados, use as ferramentas de leitura abaixo no formato agilizi-action — leituras executam sozinhas, sem confirmação.',
    'REGRA DE OURO: sua resposta visível é sempre texto corrido em pt-BR. Blocos de ferramenta aparecem no máximo uma vez por ação e nunca como conteúdo principal. Se você se pegar escrevendo <dots_function_call> ou <invoke>, pare e reescreva tudo em texto corrido + bloco agilizi-action.',
    'Ferramentas disponíveis:',
    toolsPrompt(),
    'Contexto da empresa:',
    snapshot,
    describePageContext(page),
  ].join(NL);
}

export function extractProposals(text: string): Array<{ tool: string; args: any; summary: string }> {
  const out: Array<{ tool: string; args: any; summary: string }> = [];
  const push = (parsed: any) => {
    if (parsed && typeof parsed.tool === 'string' && parsed.args && typeof parsed.args === 'object') {
      out.push({ tool: parsed.tool, args: parsed.args, summary: String(parsed.summary || parsed.tool) });
    }
  };
  for (const chunk of normalizeBlocks(text).split(FENCE_OPEN).slice(1)) {
    const body = chunk.split(FENCE_CLOSE)[0];
    if (!body) continue;
    const parsed = tryParseActionBlock(body);
    if (parsed) push(parsed);
  }
  for (const p of extractDotsInvokes(normalizeBlocks(text))) out.push(p);
  return out;
}

export function stripProposals(text: string): string {
  const src = normalizeBlocks(text);
  const noFence = src.split(FENCE_OPEN).map((chunk, i) => (i === 0 ? chunk : chunk.split(FENCE_CLOSE).slice(1).join(FENCE_CLOSE))).join('');
  return stripDotsBlocks(noFence).trim();
}

// Leitura executa sozinha (sem confirmação); escrita vira cartão pendente.
const READ_TOOLS = ['overview', 'search', 'get_details'];

// Schemas JSON das ferramentas de leitura para function-calling nativo
// (espelham os schemas zod em tools.ts — manter sincronizado).
const READ_JSON_SCHEMAS: NativeToolDef[] = [
  {
    name: 'overview',
    description: 'Resumo da empresa: totais, caixa, estoque baixo, vendas/despesas/OS recentes.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search',
    description: 'Busca entidades por texto ou número (client, supplier, product, service, sale, expense, order, budget).',
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ['client', 'supplier', 'product', 'service', 'sale', 'expense', 'order', 'budget'] },
        query: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 30 },
      },
      required: ['entity'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_details',
    description: 'Detalhe de um registro por id (vendas e OS incluem itens).',
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ['client', 'supplier', 'product', 'service', 'sale', 'expense', 'order'] },
        id: { type: 'string' },
      },
      required: ['entity', 'id'],
      additionalProperties: false,
    },
  },
];

function nativeToProposals(calls?: Array<{ name: string; argsText: string }>): Array<{ tool: string; args: any; summary: string }> {
  if (!calls) return [];
  const out: Array<{ tool: string; args: any; summary: string }> = [];
  for (const c of calls) {
    try {
      const args = JSON.parse(c.argsText || '{}');
      if (args && typeof args === 'object') out.push({ tool: c.name, args, summary: c.name });
    } catch {
      // argumentos fragmentados — ignora
    }
  }
  return out;
}

// Junta todos os dialetos (blocos agilizi-action, invokes nativos e
// function-calling OpenAI) com dedupe por ferramenta+args.
function collectProposals(text: string, toolCalls?: Array<{ name: string; argsText: string }>): Array<{ tool: string; args: any; summary: string }> {
  const seen = new Set<string>();
  const out: Array<{ tool: string; args: any; summary: string }> = [];
  for (const p of [...extractProposals(text), ...nativeToProposals(toolCalls)]) {
    const k = proposalKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function proposalKey(p: { tool: string; args: any }): string {
  return p.tool + ':' + JSON.stringify(p.args);
}

// Fallback deterministico quando o modelo gratuito devolve resposta vazia
// mesmo apos retries: mostra os dados lidos em vez do beco sem saida
// generico ("nao consegui formatar"). Nunca inventa IDs ou valores.
export function buildReadFallback(userText: string, readResults: string): string {
  const excerpt = String(readResults || '').slice(0, 1500).trim();
  if (excerpt) {
    return (
      'Encontrei os dados abaixo, mas nao consegui montar a resposta completa agora. ' +
      'Se o pedido era uma alteracao (criar/editar/excluir), repita com os nomes exatos - nada foi alterado.' +
      NL + NL + 'Dados consultados:' + NL + excerpt
    );
  }
  return (
    'Consultei os dados, mas nao consegui formatar a resposta agora. ' +
    'Tente reformular a pergunta (ex.: "liste meus clientes com nome e email"). Nada foi alterado.'
  );
}

async function runReadCalls(
  companyId: string,
  userId: string,
  proposals: Array<{ tool: string; args: any; summary: string }>
): Promise<string> {
  void userId;
  const lines: string[] = [];
  for (const p of proposals.slice(0, 3)) {
    const tool = getTool(p.tool);
    if (!tool) continue;
    const parsed = tool.schema.safeParse(p.args);
    if (!parsed.success) {
      lines.push('- ' + p.tool + ': argumentos inválidos, ignore e responda sem esses dados.');
      continue;
    }
    try {
      const result = await tool.execute(companyId, userId, parsed.data);
      lines.push('- ' + p.tool + ': ' + JSON.stringify(result.data ?? result.summary).slice(0, 3000));
    } catch (err: any) {
      lines.push('- ' + p.tool + ': erro (' + String(err?.message || err) + '). Diga ao usuário que não conseguiu esses dados.');
    }
  }
  return lines.join(NL);
}

export async function runAssistantReply(args: {
  threadId: string;
  companyId: string;
  userId: string;
  userText: string;
  page: PageContext;
  onToken?: (token: string) => void;
}): Promise<AssistantReply> {
  const thread = await prisma.assistantThread.findFirst({
    where: { id: args.threadId, companyId: args.companyId },
  });
  if (!thread) throw new AppError('Conversa não encontrada', 404);
  if ((await dailyUsage(args.companyId)) >= config.aiDailyCap) {
    throw new AppError('Limite diário de mensagens do assistente atingido. Tente novamente amanhã.', 429);
  }
  await prisma.assistantMessage.create({
    data: { threadId: args.threadId, role: 'user', content: args.userText.slice(0, 4000) },
  });
  const [snapshot, history] = await Promise.all([
    buildCompanySnapshot(args.companyId),
    buildHistory(args.threadId, args.companyId),
  ]);
  const system = buildSystemPrompt(snapshot, args.page);
  // O histórico já inclui a mensagem recém-salva; filtra para não duplicar.
  const prior: ChatTurn[] = history.filter((h) => h.text !== args.userText.slice(0, 2000)).slice(-10);
  let result: ProviderResult | null = null;
  let readResults = '';
  try {
    // Round 1 silencioso: pode conter chamadas de leitura.
    let r1 = await runChain({
      chain: config.aiChain,
      providers,
      system,
      history: prior,
      userText: args.userText,
      tools: READ_JSON_SCHEMAS,
      opts: { timeoutMs: config.aiTimeoutMs },
    });
    // Propostas em qualquer dialeto: blocos agilizi-action, invokes
    // nativos do modelo e function-calling OpenAI.
    let r1Proposals = collectProposals(r1.text, r1.toolCalls);
    if (!r1Proposals.length && countUnparsedBlocks(r1.text) > 0) {
      logger.debug('Assistente: round 1 com blocos malformados, tentando novamente');
      r1 = await runChain({
        chain: config.aiChain,
        providers,
        system,
        history: prior,
        userText: args.userText + NL + 'Reemita a resposta com os blocos agilizi-action em JSON estrito: chaves com aspas duplas, sem comentarios e sem virgula apos o ultimo item.',
        tools: READ_JSON_SCHEMAS,
        opts: { timeoutMs: config.aiTimeoutMs },
      });
      r1Proposals = collectProposals(r1.text, r1.toolCalls);
    }
    logger.debug('Assistente: round 1', {
      model: r1.model,
      proposals: r1Proposals.length,
      tools: r1Proposals.map((p) => p.tool + ':' + JSON.stringify(p.args).slice(0, 160)),
      nativeCalls: (r1.toolCalls || []).length,
      preview: r1.text.slice(0, 500),
    });
    const reads = r1Proposals.filter((p) => READ_TOOLS.includes(p.tool));
    const writes = r1Proposals.filter((p) => !READ_TOOLS.includes(p.tool));
    if (reads.length) {
      readResults = await runReadCalls(args.companyId, args.userId, reads);
      const history2: ChatTurn[] = [
        ...prior,
        { role: 'user', text: args.userText },
        { role: 'assistant', text: stripProposals(r1.text) || '(consultando os dados...)' },
      ];
      // Round 2 com streaming ao vivo: resposta final para o usuário.
      const round2Text =
        'Pedido atual do usuário: ' + args.userText.slice(0, 1000) + NL +
        'Resultado das ferramentas de leitura:' + NL + readResults + NL +
        'Responda ao pedido atual com base nesses dados. Proponha ação de escrita (bloco agilizi-action) só se o pedido atual pedir alteração — nunca reaproveite ações de mensagens antigas. Não emita markup de ferramenta, não invente registros.';
      result = await runChain({
        chain: config.aiChain,
        providers,
        system,
        history: history2.slice(-10),
        userText: round2Text,
        opts: { timeoutMs: config.aiTimeoutMs, onToken: args.onToken },
      });
      // Modelo gratuito as vezes devolve vazio: tenta ate 2 vezes antes de
      // cair no fallback deterministico (que mostra os dados lidos).
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (stripProposals(result.text) || (result.toolCalls && result.toolCalls.length)) break;
        logger.debug('Assistente: round 2 vazio, tentando novamente', { model: result.model, attempt });
        result = await runChain({
          chain: config.aiChain,
          providers,
          system,
          history: history2.slice(-10),
          userText:
            round2Text + NL +
            'Sua resposta anterior veio vazia. Responda agora em texto corrido em pt-BR, sem tags nem XML, resumindo o resultado e incluindo o bloco agilizi-action se o pedido pedir alteração.',
          opts: { timeoutMs: config.aiTimeoutMs, onToken: args.onToken },
        });
      }
      // Propostas de escrita podem vir nos dois rounds.
      logger.debug('Assistente: round 2', {
        model: result.model,
        preview: result.text.slice(0, 500),
      });
      const r2writes = collectProposals(result.text, result.toolCalls).filter((p) => !READ_TOOLS.includes(p.tool));
      const merged = collectProposals('', undefined);
      for (const p of [...writes, ...r2writes]) {
        if (!merged.some((m) => proposalKey(m) === proposalKey(p))) merged.push(p);
      }
      const stored = await storeMergedProposals(args.threadId, args.companyId, args.userId, merged);
      // Ultima rede de seguranca: em vez do generico vazio, devolve os dados
      // lidos de forma deterministica para o usuario nunca sair no escuro.
      if (!stripProposals(result.text) && !stored.length) {
        logger.debug('Assistente: round 2 vazio apos retries, usando fallback deterministico');
        const fallback = buildReadFallback(args.userText, readResults);
        args.onToken?.(fallback);
        result = { text: fallback, model: result.model, provider: result.provider };
      }
      return await finishReply(args.threadId, result, stored);
    }
    // Sem leituras: emite o texto de uma vez (streaming instantâneo) e segue o fluxo normal.
    // Emite já sanitizado para o usuário nunca ver markup de protocolo.
    args.onToken?.(stripProposals(r1.text) || 'Consultei os dados, mas não consegui formatar a resposta agora. Nada foi alterado.');
    result = r1;
  } catch {
    const degraded =
      'Estou sem acesso aos modelos de IA no momento (cota gratuita esgotada ou instabilidade). ' +
      'Tente de novo em alguns minutos — seus dados estão intactos e nada foi alterado.';
    args.onToken?.(degraded);
    await prisma.assistantMessage.create({
      data: { threadId: args.threadId, role: 'assistant', content: degraded, model: 'degraded' },
    });
    return { text: degraded, model: 'degraded', actions: [] };
  }
  const actions = await storeMergedProposals(
    args.threadId,
    args.companyId,
    args.userId,
    collectProposals(result.text, result.toolCalls)
  );
  return await finishReply(args.threadId, result, actions);
}

async function storeMergedProposals(
  threadId: string,
  companyId: string,
  userId: string,
  merged: Array<{ tool: string; args: any; summary: string }>
): Promise<ProposedAction[]> {
  const out: ProposedAction[] = [];
  for (const p of merged) {
    const tool = getTool(p.tool);
    if (!tool) continue;
    const parsed = tool.schema.safeParse(p.args);
    if (!parsed.success) continue;
    const saved = await prisma.assistantAction.create({
      data: {
        threadId,
        companyId,
        userId,
        tool: tool.name,
        args: JSON.stringify(parsed.data),
        summary: p.summary.slice(0, 200),
        status: 'pending',
      },
    });
    out.push({ id: saved.id, tool: tool.name, summary: saved.summary, destructive: tool.destructive });
  }
  return out;
}

async function finishReply(threadId: string, result: ProviderResult, actions: ProposedAction[]): Promise<AssistantReply> {
  let visible = stripProposals(result.text);
  // Nunca persiste nem exibe markup cru: se sobrou só lixo de protocolo,
  // troca por uma resposta honesta em vez de vazar o formato interno.
  const naked = visible.replace(/[<>{}"]/g, '').trim();
  // Com cartão pendente, orienta a confirmar em vez de dizer que nada mudou.
  if (!naked && actions.length) {
    visible =
      'Preparei a ação abaixo — confira os dados no cartão e clique em Confirmar para executar (ou Descartar para cancelar). Nada foi alterado ainda.';
  } else if (!naked) {
    visible =
      'Consultei os dados, mas não consegui formatar a resposta agora. ' +
      'Tente reformular a pergunta (ex.: "liste meus clientes com nome e email"). Nada foi alterado.';
  }
  await prisma.assistantMessage.create({
    data: { threadId, role: 'assistant', content: visible || result.text, model: result.model },
  });
  return { text: visible || result.text, model: result.model, actions };
}

/** Executa UMA ação pendente já confirmada. Qualquer outro estado recusa. */
export async function executeAction(actionId: string, companyId: string, userId: string): Promise<{ summary: string; data?: unknown }> {
  const action = await prisma.assistantAction.findFirst({
    where: { id: actionId, companyId, status: 'confirmed' },
  });
  if (!action) throw new AppError('Ação não encontrada ou ainda não confirmada', 404);
  const tool = getTool(action.tool);
  if (!tool) throw new AppError('Ferramenta desconhecida: ' + action.tool, 400);
  let args: any;
  try {
    args = JSON.parse(action.args);
  } catch {
    throw new AppError('Argumentos da ação inválidos', 400);
  }
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) throw new AppError('Argumentos da ação inválidos', 400);
  try {
    const result = await tool.execute(companyId, userId, parsed.data);
    await prisma.assistantAction.update({
      where: { id: action.id },
      data: { status: 'executed', result: result.summary.slice(0, 500) },
    });
    return result;
  } catch (err: any) {
    await prisma.assistantAction.update({
      where: { id: action.id },
      data: { status: 'failed', result: String(err?.message || err).slice(0, 500) },
    });
    throw err;
  }
}
