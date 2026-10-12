import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AssistantPanel from '../components/AssistantPanel';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function sseStream(events: Array<{ event: string; data: unknown }>): Response {
  const text = events
    .map((e) => 'event: ' + e.event + String.fromCharCode(10) + 'data: ' + JSON.stringify(e.data))
    .join(String.fromCharCode(10, 10)) + String.fromCharCode(10, 10);
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(text));
      c.close();
    },
  });
  return { ok: true, body: stream } as unknown as Response;
}

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AssistantPanel />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/assistant/status') return Promise.resolve({ data: { data: { enabled: true } } });
    if (url === '/assistant/threads') return Promise.resolve({ data: { data: [] } });
    return Promise.reject(new Error('404'));
  });
  mockedApi.post.mockResolvedValue({ data: { data: {} } });
});

describe('AssistantPanel', () => {
  it('mostra o botão flutuante e abre o painel', async () => {
    const user = userEvent.setup();
    renderPanel();
    const fab = screen.getByRole('button', { name: 'Abrir assistente de IA' });
    await user.click(fab);
    expect(await screen.findByRole('dialog', { name: 'Assistente de IA' })).toBeInTheDocument();
    expect(screen.getByText(/Pergunte sobre vendas/)).toBeInTheDocument();
  });

  it('mostra estado desativado quando o backend não tem chave', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/assistant/status') return Promise.resolve({ data: { data: { enabled: false } } });
      return Promise.reject(new Error('404'));
    });
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Abrir assistente de IA' }));
    expect(await screen.findByText(/assistente está desativado/)).toBeInTheDocument();
  });

  it('envia mensagem, exibe streaming e cartão de confirmação', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/assistant/threads') {
        return Promise.resolve({ data: { data: { id: 't1', title: 'Nova conversa' } } });
      }
      return Promise.reject(new Error('unexpected POST ' + url));
    });
    const sse = sseStream([
      { event: 'token', data: { t: 'Claro! ' } },
      { event: 'token', data: { t: 'Proponho lançar.' } },
      {
        event: 'done',
        data: {
          text: 'Proponho lançar.',
          model: 'gemini-2.0-flash',
          actions: [{ id: 'a1', tool: 'expense.create', summary: 'Lançar aluguel de R$ 1.500', destructive: false }],
        },
      },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse));
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Abrir assistente de IA' }));
    await user.click(await screen.findByRole('button', { name: 'Nova conversa' }));
    await user.type(screen.getByLabelText('Mensagem para o assistente'), 'lance o aluguel');
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    expect(await screen.findByText('Proponho lançar.')).toBeInTheDocument();
    expect(screen.getByText('Lançar aluguel de R$ 1.500')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('confirmar chama o endpoint e mostra o resumo', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/assistant/status') return Promise.resolve({ data: { data: { enabled: true } } });
      if (url === '/assistant/threads') {
        return Promise.resolve({ data: { data: [{ id: 't1', title: 'Aluguel', updatedAt: '' }] } });
      }
      if (url === '/assistant/threads/t1') {
        return Promise.resolve({
          data: {
            data: {
              id: 't1',
              title: 'Aluguel',
              messages: [{ id: 'm1', role: 'user', content: 'lance o aluguel' }],
              actions: [{ id: 'a1', tool: 'expense.create', summary: 'Lançar aluguel', destructive: false, status: 'pending' }],
            },
          },
        });
      }
      return Promise.reject(new Error('404'));
    });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/assistant/actions/a1/confirm') {
        return Promise.resolve({ data: { data: { summary: 'Despesa lançada' } } });
      }
      return Promise.reject(new Error('unexpected POST ' + url));
    });
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Abrir assistente de IA' }));
    await user.click(await screen.findByText('Aluguel'));
    expect(await screen.findByText('Lançar aluguel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Despesa lançada')).toBeInTheDocument();
    expect(mockedApi.post).toHaveBeenCalledWith('/assistant/actions/a1/confirm', {});
  });

  it('sugestão na conversa vazia envia a mensagem', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/assistant/threads') {
        return Promise.resolve({ data: { data: { id: 't1', title: 'Nova conversa' } } });
      }
      return Promise.reject(new Error('unexpected POST ' + url));
    });
    const sse = sseStream([
      {
        event: 'done',
        data: { text: 'Vendi R$ 0 este mês.', model: 'kilo-auto/free', actions: [] },
      },
    ]);
    const fetchMock = vi.fn().mockResolvedValue(sse);
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Abrir assistente de IA' }));
    await user.click(await screen.findByRole('button', { name: 'Nova conversa' }));
    await user.click(await screen.findByRole('button', { name: 'Quanto vendi este mês?' }));
    expect(await screen.findByText('Vendi R$ 0 este mês.')).toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message).toBe('Quanto vendi este mês?');
    vi.unstubAllGlobals();
  });

  it('cartão destrutivo mostra selo de irreversível', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/assistant/status') return Promise.resolve({ data: { data: { enabled: true } } });
      if (url === '/assistant/threads') {
        return Promise.resolve({ data: { data: [{ id: 't1', title: 'Limpeza', updatedAt: '' }] } });
      }
      if (url === '/assistant/threads/t1') {
        return Promise.resolve({
          data: {
            data: {
              id: 't1',
              title: 'Limpeza',
              messages: [{ id: 'm1', role: 'user', content: 'exclua o cliente X' }],
              actions: [{ id: 'a9', tool: 'client.delete', summary: 'Excluir cliente X', destructive: true, status: 'pending' }],
            },
          },
        });
      }
      return Promise.reject(new Error('404'));
    });
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Abrir assistente de IA' }));
    await user.click(await screen.findByText('Limpeza'));
    await waitFor(() => expect(screen.getByText('irreversível')).toBeInTheDocument());
    expect(screen.getByText('Confirmar ação destrutiva')).toBeInTheDocument();
  });
});
