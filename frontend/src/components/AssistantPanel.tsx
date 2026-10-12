import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X, Send, Plus, Trash2, Check, ChevronLeft, MessageSquareText, ShieldAlert, ClipboardCheck } from 'lucide-react';
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

const SUGGESTIONS = [
  'Quanto vendi este mês?',
  'Quais produtos estão com estoque baixo?',
  'Liste meus clientes com nome e email',
];

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
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const send = useCallback(async (preset?: string) => {
    const text = (preset !== undefined ? preset : input).trim();
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
    if (busyId) return;
    setBusyId(id);
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
    } finally {
      setBusyId(null);
    }
  }, [busyId]);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente de IA'}
        title="Assistente de IA"
        className="fixed bottom-5 right-5 z-50 grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-white shadow-dropdown ring-1 ring-slate-900/10 transition-transform hover:scale-105 active:scale-95 dark:bg-slate-200 dark:text-slate-900 dark:ring-white/20"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
        {!open && enabled && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Assistente de IA"
          className="fixed bottom-[76px] right-4 z-50 flex h-[min(600px,calc(100vh-120px))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-modal sm:right-5 sm:w-[420px] dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
            {threadId && (
              <button
                onClick={() => { setThreadId(null); setMessages([]); setPending([]); }}
                aria-label="Voltar às conversas"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" aria-hidden="true">
              <Sparkles size={15} />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold text-gray-800 dark:text-slate-100">Assistente Agilizi</p>
              <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500">
                <span className={'inline-block h-1.5 w-1.5 rounded-full ' + (enabled === false ? 'bg-gray-300 dark:bg-slate-600' : 'bg-emerald-500')} aria-hidden="true" />
                {enabled === false ? 'Desativado' : 'Online • usa os dados da sua empresa'}
              </p>
            </div>
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
            <div className="flex-1 overflow-y-auto p-3">
              <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Conversas
              </p>
              {threads.length === 0 && (
                <div className="flex flex-col items-center px-4 py-10 text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" aria-hidden="true">
                    <MessageSquareText size={20} />
                  </span>
                  <p className="mt-3 text-[13px] font-medium text-gray-600 dark:text-slate-300">Nenhuma conversa ainda</p>
                  <p className="mt-1 max-w-[260px] text-[12px] leading-5 text-gray-400 dark:text-slate-500">
                    Pergunte sobre vendas, estoque, caixa ou peça para lançar algo — eu proponho e você confirma.
                  </p>
                  <button onClick={newThread} className="btn-primary btn-sm mt-4">
                    <Plus size={13} /> Começar agora
                  </button>
                </div>
              )}
              {threads.map((t) => (
                <div key={t.id} className="group flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 hover:border-gray-100 hover:bg-gray-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/60">
                  <MessageSquareText size={14} className="shrink-0 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                  <button onClick={() => openThread(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px] text-gray-700 dark:text-slate-200">
                    {t.title || 'Conversa sem título'}
                  </button>
                  <button
                    onClick={() => deleteThread(t.id)}
                    aria-label={'Excluir conversa ' + t.title}
                    className="rounded p-1 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                {messages.length === 0 && !sending && !streaming && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <p className="text-[13px] font-medium leading-5 text-gray-700 dark:text-slate-200">
                      Olá! Consulto vendas, estoque, caixa e clientes — e preparo lançamentos para você confirmar.
                    </p>
                    <p className="mt-1 text-[12px] text-gray-400 dark:text-slate-500">Comece por uma sugestão:</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-left text-[12px] text-gray-600 transition-colors hover:border-slate-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m) => (
                  m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-800 px-3.5 py-2 text-[13px] leading-5 text-white dark:bg-slate-200 dark:text-slate-900">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-start justify-start gap-1.5">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" aria-hidden="true">
                        <Sparkles size={12} />
                      </span>
                      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-gray-100 bg-white px-3.5 py-2 text-[13px] leading-5 text-gray-700 shadow-card dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:shadow-none">
                        {m.content}
                      </div>
                    </div>
                  )
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
                  <div
                    key={a.id}
                    className={
                      a.destructive
                        ? 'rounded-xl border border-red-200 bg-red-50/60 p-3.5 dark:border-red-900/70 dark:bg-red-950/30'
                        : 'rounded-xl border border-slate-200 bg-white p-3.5 shadow-card dark:border-slate-700 dark:bg-slate-800/60 dark:shadow-none'
                    }
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={
                          a.destructive
                            ? 'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400'
                            : 'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                        }
                        aria-hidden="true"
                      >
                        {a.destructive ? <ShieldAlert size={15} /> : <ClipboardCheck size={15} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={'text-[12px] font-semibold ' + (a.destructive ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-slate-200')}>
                          {a.destructive ? 'Confirmar ação destrutiva' : 'Confirmar ação'}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-5 text-gray-600 dark:text-slate-300">{a.summary}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="badge badge-gray font-mono normal-case tracking-normal">{a.tool}</span>
                          {a.destructive && <span className="badge badge-danger">irreversível</span>}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => decide(a.id, true)}
                        disabled={busyId !== null}
                        className={(a.destructive ? 'btn-danger-solid' : 'btn-primary') + ' btn-sm flex-1'}
                      >
                        {busyId === a.id
                          ? <span aria-hidden="true" className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          : <Check size={13} />}
                        Confirmar
                      </button>
                      <button
                        onClick={() => decide(a.id, false)}
                        disabled={busyId !== null}
                        className="btn-secondary btn-sm flex-1"
                      >
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
                    onClick={() => send()}
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
                <p className="mt-2 text-center text-[11px] leading-4 text-gray-400 dark:text-slate-500">
                  O assistente propõe — você confirma. Nada muda sem confirmação.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
