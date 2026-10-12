/**
 * Provedor Gemini (plano gratuito do Google AI Studio). Sem dependências
 * novas: usa o fetch global do Node 20+ e SSE via streamGenerateContent.
 */
import { config } from '../../config';
import {
  AssistantProvider,
  CompleteOpts,
  ChatTurn,
  ProviderResult,
  QuotaError,
} from './provider';

const API = 'https://generativelanguage.googleapis.com/v1beta';

function toGeminiRole(role: ChatTurn['role']): string {
  return role === 'assistant' ? 'model' : 'user';
}

function extractText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('');
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as any;
    return data?.error?.message || 'HTTP ' + res.status;
  } catch {
    return 'HTTP ' + res.status;
  }
}

export class GeminiProvider implements AssistantProvider {
  id = 'gemini';

  isConfigured(): boolean {
    return config.geminiApiKey.length > 0;
  }

  private body(system: string, history: ChatTurn[], userText: string) {
    return {
      system_instruction: { parts: [{ text: system }] },
      contents: [
        ...history.map((t) => ({
          role: toGeminiRole(t.role),
          parts: [{ text: t.text }],
        })),
        { role: 'user', parts: [{ text: userText }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    };
  }

  async complete(args: {
    system: string;
    history: ChatTurn[];
    userText: string;
    model: string;
    opts: CompleteOpts;
  }): Promise<ProviderResult> {
    const model = args.model || 'gemini-2.0-flash';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), args.opts.timeoutMs);
    try {
      if (args.opts.onToken) {
        return await this.streamInto(args.system, args.history, args.userText, model, args.opts, ctrl.signal);
      }
      const res = await fetch(
        API + '/models/' + model + ':generateContent?key=' + config.geminiApiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.body(args.system, args.history, args.userText)),
          signal: ctrl.signal,
        }
      );
      if (res.status === 429 || res.status === 403) {
        throw new QuotaError('Gemini: ' + (await readError(res)));
      }
      if (!res.ok) throw new Error('Gemini: ' + (await readError(res)));
      const text = extractText(await res.json());
      return { text, model, provider: 'gemini' };
    } finally {
      clearTimeout(timer);
    }
  }

  private async streamInto(
    system: string,
    history: ChatTurn[],
    userText: string,
    model: string,
    opts: CompleteOpts,
    signal: AbortSignal
  ): Promise<ProviderResult> {
    const res = await fetch(
      API + '/models/' + model + ':streamGenerateContent?alt=sse&key=' + config.geminiApiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.body(system, history, userText)),
        signal,
      }
    );
    if (res.status === 429 || res.status === 403) {
      throw new QuotaError('Gemini: ' + (await readError(res)));
    }
    if (!res.ok || !res.body) throw new Error('Gemini: ' + (await readError(res)));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload) continue;
        try {
          const piece = extractText(JSON.parse(payload));
          if (piece) {
            full += piece;
            opts.onToken?.(piece);
          }
        } catch {
          // chunk parcial — ignora, o próximo completa
        }
      }
    }
    return { text: full, model, provider: 'gemini' };
  }
}
