/**
 * Camada de provedores do bot (estilo Kilo Code auto/free): interface única
 * + cadeia ordenada via AI_CHAIN. O primeiro provedor configurado que
 * responder vence; cota esgotada / erro de rede cai para o próximo.
 * Nenhuma chave sai do backend — tudo via .env.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ProviderResult {
  text: string;
  model: string;
  provider: string;
  toolCalls?: Array<{ name: string; argsText: string }>;
}

export interface NativeToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CompleteOpts {
  timeoutMs: number;
  onToken?: (token: string) => void;
}

export interface AssistantProvider {
  /** Nome usado na cadeia (ex.: "gemini"). */
  id: string;
  /** false quando falta chave/config — o provedor é pulado na cadeia. */
  isConfigured(): boolean;
  complete(args: {
    system: string;
    history: ChatTurn[];
    userText: string;
    model: string;
    tools?: NativeToolDef[];
    opts: CompleteOpts;
  }): Promise<ProviderResult>;
}

/** Cota esgotada / 429 / chave inválida — a cadeia deve tentar o próximo. */
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
  }
}

export interface ChainLink {
  provider: string;
  model: string;
}

export function parseChain(chain: string[]): ChainLink[] {
  return chain
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf(':');
      if (i < 0) return { provider: s, model: '' };
      return { provider: s.slice(0, i), model: s.slice(i + 1) };
    });
}

export async function runChain(args: {
  chain: string[];
  providers: Map<string, AssistantProvider>;
  system: string;
  history: ChatTurn[];
  userText: string;
  tools?: NativeToolDef[];
  opts: CompleteOpts;
}): Promise<ProviderResult> {
  const links = parseChain(args.chain);
  const errors: string[] = [];
  for (const link of links) {
    const provider = args.providers.get(link.provider);
    if (!provider) {
      errors.push(link.provider + ': desconhecido');
      continue;
    }
    if (!provider.isConfigured()) {
      errors.push(link.provider + ': sem chave configurada');
      continue;
    }
    try {
      const res = await provider.complete({
        system: args.system,
        history: args.history,
        userText: args.userText,
        model: link.model,
        tools: args.tools,
        opts: args.opts,
      });
      const hasText = res && typeof res.text === 'string' && res.text.trim().length > 0;
      const hasCalls = res && Array.isArray(res.toolCalls) && res.toolCalls.length > 0;
      if (!hasText && !hasCalls) {
        errors.push(link.provider + '/' + link.model + ': resposta vazia');
        continue;
      }
      return res;
    } catch (err: any) {
      // Quota/rede: tenta o próximo. Outro erro: também tenta — o último
      // erro decide a mensagem de degradação.
      errors.push(link.provider + '/' + link.model + ': ' + (err?.message || 'erro'));
    }
  }
  const err = new Error(
    'Nenhum modelo disponível no momento (' + errors.join('; ') + ').'
  );
  (err as any).chainErrors = errors;
  throw err;
}
