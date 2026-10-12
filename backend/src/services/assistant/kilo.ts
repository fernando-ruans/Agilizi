/**
 * Provedor Kilo Gateway (OpenAI-compatible). Cadeia auto/free: o modelo
 * "kilo-auto/free" roteia para modelos gratuitos. Chave via KILO_API_KEY.
 */
import { config } from '../../config';
import {
  AssistantProvider,
  ChatTurn,
  ProviderResult,
  NativeToolDef,
  QuotaError,
} from './provider';

function apiUrl(): string {
  return config.kiloApiUrl.replace(/\/$/, '');
}

function extractChoiceText(data: any): string {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return '';
  if (typeof msg.content === 'string' && msg.content) return msg.content;
  const details = msg.reasoning_details;
  if (Array.isArray(details)) {
    return details
      .map((d: any) => (typeof d?.text === 'string' ? d.text : ''))
      .join('');
  }
  if (typeof msg.reasoning === 'string') return msg.reasoning;
  return '';
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as any;
    return data?.error?.message || data?.message || ('HTTP ' + res.status);
  } catch {
    return 'HTTP ' + res.status;
  }
}

export class KiloProvider implements AssistantProvider {
  id = 'kilo';

  isConfigured(): boolean {
    return config.kiloApiKey.length > 0;
  }

  private payload(system: string, history: ChatTurn[], userText: string, model: string, stream: boolean, tools?: NativeToolDef[]) {
    const body: Record<string, unknown> = {
      model,
      stream,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        ...history.map((t) => ({ role: t.role, content: t.text })),
        { role: 'user', content: userText },
      ],
    };
    if (tools && tools.length) {
      body.tools = tools.map((t) => ({ type: 'function', function: t }));
    }
    return body;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.kiloApiKey,
    };
  }

  async complete(args: {
    system: string;
    history: ChatTurn[];
    userText: string;
    model: string;
    tools?: NativeToolDef[];
    opts: { timeoutMs: number; onToken?: (token: string) => void };
  }): Promise<ProviderResult> {
    const model = args.model || 'kilo-auto/free';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), args.opts.timeoutMs);
    try {
      if (args.opts.onToken) {
        return await this.streamInto(args.system, args.history, args.userText, model, args.tools, args.opts, ctrl.signal);
      }
      const res = await fetch(apiUrl() + '/chat/completions', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.payload(args.system, args.history, args.userText, model, false, args.tools)),
        signal: ctrl.signal,
      });
      if (res.status === 429 || res.status === 402 || res.status === 403) {
        throw new QuotaError('Kilo: ' + (await readError(res)));
      }
      if (!res.ok) throw new Error('Kilo: ' + (await readError(res)));
      const data = await res.json();
      return { text: extractChoiceText(data), model, provider: 'kilo', toolCalls: extractToolCalls(data) };
    } finally {
      clearTimeout(timer);
    }
  }

  private async streamInto(
    system: string,
    history: ChatTurn[],
    userText: string,
    model: string,
    tools: NativeToolDef[] | undefined,
    opts: { timeoutMs: number; onToken?: (token: string) => void },
    signal: AbortSignal
  ): Promise<ProviderResult> {
    const res = await fetch(apiUrl() + '/chat/completions', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.payload(system, history, userText, model, true, tools)),
      signal,
    });
    if (res.status === 429 || res.status === 402 || res.status === 403) {
      throw new QuotaError('Kilo: ' + (await readError(res)));
    }
    if (!res.ok || !res.body) throw new Error('Kilo: ' + (await readError(res)));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const NL = String.fromCharCode(10);
    let buf = '';
    let full = '';
    const calls = new Map<number, { name: string; argsText: string }>();
    const emit = (piece: string) => {
      if (piece) {
        full += piece;
        opts.onToken?.(piece);
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split(NL);
      buf = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload);
          const delta = data?.choices?.[0]?.delta;
          if (delta) {
            if (typeof delta.content === 'string') emit(delta.content);
            else if (typeof delta.reasoning === 'string') emit(delta.reasoning);
            else if (Array.isArray(delta.reasoning_details)) {
              emit(
                delta.reasoning_details
                  .map((d: any) => (typeof d?.text === 'string' ? d.text : ''))
                  .join('')
              );
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = typeof tc?.index === 'number' ? tc.index : 0;
                const slot = calls.get(idx) || { name: '', argsText: '' };
                if (tc?.function?.name) slot.name = tc.function.name;
                if (typeof tc?.function?.arguments === 'string') slot.argsText += tc.function.arguments;
                calls.set(idx, slot);
              }
            }
          }
        } catch {
          // chunk parcial — ignora, o próximo completa
        }
      }
    }
    const toolCalls = [...calls.values()].filter((c) => c.name);
    return { text: full, model, provider: 'kilo', toolCalls };
  }
}

function extractToolCalls(data: any): Array<{ name: string; argsText: string }> {
  const calls = data?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls
    .filter((tc: any) => tc?.function?.name)
    .map((tc: any) => ({ name: tc.function.name, argsText: String(tc.function.arguments || '{}') }));
}
