import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X, Send, Plus, Trash2, Check, ChevronLeft } from 'lucide-react';
import api from '../services/api';

interface ProposedAction {
  id: string;
  tool: string;
  summary: string;
  destructive: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string | null;
}

interface Thread {
  id: string;
  title: string;
  updatedAt: string;
}

interface ThreadDetail extends Thread {
  messages: Message[];
  actions: Array<ProposedAction & { status: string }>;
}

function token(): string {
  return localStorage.getItem('agilzi_token') || '';
}

async function streamChat(threadId: string, message: string, route: string, onToken: (t: string) => void) {
  const res = await fetch('/api/v1/assistant/threads/' + threadId + '/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token(),
    },
    body: JSON.stringify({ message, route }),
  });
  if (!res.ok || !res.body) throw new Error('Falha ao falar com o assistente');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let done: { text: string; model: string; actions: ProposedAction[] } | null = null;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split(String.fromCharCode(10, 10));
    buf = blocks.pop() || '';
    for (const b of blocks) {
      const lines = b.split(String.fromCharCode(10));
      const event = (lines.find((l) => l.startsWith('event:')) || '').slice(6).trim();
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const data = JSON.parse(dataLine.slice(5).trim());
      if (event === 'token' && data.t) onToken(data.t);
      else if (event === 'done') done = data;
      else if (event === 'error') throw new Error(data.message || 'Erro no assistente');
    }
  }
  if (!done) throw new Error('Resposta incompleta do assistente');
  return done;
}

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Array<ProposedAction & { status: string }>>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const location = useLocation();
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    const res = await api.get('/assistant/threads');
    setThreads(res.data.data);
  }, []);

  useEffect(() => {
    api.get('/assistant/status').then(
      (res) => setEnabled(res.data.data.enabled),
      () => setEnabled(false)
    );
  }, []);

  useEffect(() => {
    if (open && enabled) refreshThreads().catch(() => undefined);
  }, [open, enabled, refreshThreads]);

  useEffect(() => {
    // scrollIntoView pode não existir (jsdom, navegadores antigos) — nunca pode derrubar o painel
    try {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    } catch {
      // rolagem é conveniência, não requisito
    }
  }, [messages, streaming, pending, sending]);

  const openThread = useCallback(async (id: string) => {
    const res = await api.get('/assistant/threads/' + id);
    const detail: ThreadDetail = res.data.data;
    setThreadId(detail.id);
    setMessages(detail.messages);
    setPending(detail.actions.filter((a) => a.status === 'pending'));
  }, []);

  const newThread = useCallback(async () => {
    const res = await api.post('/assistant/threads', {});
    setThreadId(res.data.data.id);
    setMessages([]);
    setPending([]);
    refreshThreads().catch(() => undefined);
  }, [refreshThreads]);

  const deleteThread = useCallback(async (id: string) => {
    await api.delete('/assistant/threads/' + id);
    if (threadId === id) {
      setThreadId(null);
      setMessages([]);
      setPending([]);
    }
    refreshThreads().catch(() => undefined);
  }, [threadId, refreshThreads]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    let tid = threadId;
    if (!tid) {
      const res = await api.post('/assistant/threads', {});
      tid = res.data.data.id;
      setThreadId(tid);
      refreshThreads().catch(() => undefined);
    }
    const userMsg: Message = { id: 'local-' + Date.now(), role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setSending(true);
    setStreaming('');
    try {
      const done = await streamChat(tid as string, text, location.pathname, (t) =>
        setStreaming((s) => s + t)
      );
      setStreaming('');
      setMessages((m) => [
        ...m,
        { id: 'local-a-' + Date.now(), role: 'assistant', content: done.text, model: done.model },
      ]);
      setPending(done.actions.map((a) => ({ ...a, status: 'pending' })));
      refreshThreads().catch(() => undefined);
    } catch (err: any) {
      setStreaming('');
      setMessages((m) => [
        ...m,
        { id: 'local-e-' + Date.now(), role: 'assistant', content: err?.message || 'Erro no assistente' },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, threadId, location.pathname, refreshThreads]);

  const decide = useCallback(async (id: string, ok: boolean) => {
    try {
      const res = await api.post('/assistant/actions/' + id + (ok ? '/confirm' : '/reject'), {});
      setPending((p) => p.filter((a) => a.id !== id));
      setMessages((m) => [
        ...m,
        {
          id: 'local-s-' + Date.now() + id,
          role: 'assistant',
          content: ok ? (res.data.data.summary || 'Ação executada.') : 'Ação descartada — nada foi alterado.',
        },
      ]);
    } catch (err: any) {
      // Mantém o cartão para nova tentativa e avisa no chat em vez de falhar em silêncio.
      const msg = err?.response?.data?.message || err?.message || 'Erro ao processar a ação';
      // Ação morta no servidor (já decidida/expirada): remove o cartão e orienta a pedir de novo.
      if (String(msg).includes('já decidida')) {
        setPending((p) => p.filter((a) => a.id !== id));
      }
      setMessages((m) => [
        ...m,
        {
          id: 'local-f-' + Date.now() + id,
          role: 'assistant',
          content: 'Não consegui ' + (ok ? 'executar' : 'descartar') + ' a ação: ' + msg + ' — nada foi alterado.' +
            (String(msg).includes('já decidida') ? ' Peça novamente no chat para gerar um novo cartão.' : ''),
        },
      ]);
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente de IA'}
        title="Assistente de IA"
        className="fixed bottom-5 right-5 z-50 grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-white shadow-dropdown transition-transform hover:scale-105 active:scale-95 dark:bg-slate-200 dark:text-slate-900"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Assistente de IA"
          className="fixed bottom-[76px] right-4 z-50 flex h-[min(560px,calc(100vh-120px))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-modal sm:right-5 sm:w-[400px] dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-slate-800">
            {threadId && (
              <button
                onClick={() => { setThreadId(null); setMessages([]); setPending([]); }}
                aria-label="Voltar às conversas"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <Sparkles size={15} className="text-slate-500 dark:text-slate-400" />
            <p className="flex-1 text-[13px] font-semibold text-gray-800 dark:text-slate-100">Assistente</p>
            <button
              onClick={newThread}
              aria-label="Nova conversa"
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-800"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-800"
            >
              <X size={15} />
            </button>
          </div>
          {enabled === false ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="text-[13px] text-gray-400 dark:text-slate-500">
                O assistente está desativado — configure a chave de IA no servidor para ativar.
              </p>
            </div>
          ) : !threadId ? (
            <div className="flex-1 overflow-y-auto p-2">
              {threads.length === 0 && (
                <p className="px-3 py-8 text-center text-[13px] text-gray-400 dark:text-slate-500">
                  Pergunte sobre vendas, estoque, caixa ou peça para lançar algo — eu proponho e você confirma.
                </p>
              )}
              {threads.map((t) => (
                <div key={t.id} className="group flex items-center gap-1 rounded-md px-2 py-2 hover:bg-gray-50 dark:hover:bg-slate-800">
                  <button onClick={() => openThread(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px] text-gray-700 dark:text-slate-200">
                    {t.title}
                  </button>
                  <button
                    onClick={() => deleteThread(t.id)}
                    aria-label={'Excluir conversa ' + t.title}
                    className="rounded p-1 text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100 dark:text-slate-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        m.role === 'user'
                          ? 'max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-slate-800 px-3 py-2 text-[13px] text-white dark:bg-slate-200 dark:text-slate-900'
                          : 'max-w-[92%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-gray-100 bg-gray-50 px-3 py-2 text-[13px] text-gray-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200'
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && !streaming && (
                  <div className="flex justify-start">
                    <div
                      role="status"
                      aria-label="Assistente está pensando"
                      className="flex max-w-[92%] items-center gap-2 rounded-lg rounded-bl-sm border border-gray-100 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"
                    >
                      <span className="flex items-center gap-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span>Pensando…</span>
                    </div>
                  </div>
                )}
                {streaming && (
                  <div className="flex justify-start">
                    <div
                      role="status"
                      aria-label="Assistente está escrevendo"
                      className="max-w-[92%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-gray-100 bg-gray-50 px-3 py-2 text-[13px] text-gray-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                    >
                      {streaming}
                      <span aria-hidden="true" className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-current align-middle" />
                    </div>
                  </div>
                )}
                {pending.map((a) => (
                  <div key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                    <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                      {a.destructive ? 'Confirmar ação destrutiva' : 'Confirmar ação'}
                    </p>
                    <p className="mt-1 text-[13px] text-gray-700 dark:text-slate-200">{a.summary}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-gray-400 dark:text-slate-500">{a.tool}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => decide(a.id, true)} className="btn-primary btn-sm flex-1">
                        <Check size={13} /> Confirmar
                      </button>
                      <button onClick={() => decide(a.id, false)} className="btn-secondary btn-sm flex-1">
                        Descartar
                      </button>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-gray-100 p-3 dark:border-slate-800">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={sending ? 'Aguarde a resposta…' : 'Pergunte ou peça para lançar algo…'}
                    aria-label="Mensagem para o assistente"
                    aria-busy={sending}
                    className="input"
                    disabled={sending}
                  />
                  <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    aria-label={sending ? 'Enviando mensagem' : 'Enviar mensagem'}
                    className="btn-primary shrink-0 !px-3 disabled:opacity-70"
                  >
                    {sending ? (
                      <span aria-hidden="true" className="block h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-slate-900/30 dark:border-t-slate-900" />
                    ) : (
                      <Send size={15} />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
