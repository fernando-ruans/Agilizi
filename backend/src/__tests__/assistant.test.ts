import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import prisma from '../config/database';
import { registerCompany, auth } from './helpers';
import { extractProposals, stripProposals } from '../services/assistant/conversation';
import { config } from '../config';
import { runChain } from '../services/assistant/provider';
import { getTool } from '../services/assistant/tools';

function sseEvents(text: string): Array<{ event: string; data: any }> {
  const out: Array<{ event: string; data: any }> = [];
  const blocks = text.split('event:').slice(1);
  for (const b of blocks) {
    const lines = b.split(String.fromCharCode(10));
    const event = (lines[0] || '').trim();
    const dataLine = lines.find((l) => l.startsWith('data:'));
    if (!dataLine) continue;
    try {
      out.push({ event, data: JSON.parse(dataLine.slice(5).trim()) });
    } catch {
      // ignora
    }
  }
  return out;
}

describe('Assistente IA', () => {
  it('extrai propostas de ação do texto e limpa o visível', () => {
    const BT = String.fromCharCode(96).repeat(3);
    const text =
      'Claro! Vou lançar a despesa.' + String.fromCharCode(10) +
      BT + 'agilizi-action' + String.fromCharCode(10) +
      '{"tool": "expense.create", "args": {"description": "Aluguel", "value": 1500}, "summary": "Lançar aluguel"}' +
      String.fromCharCode(10) + BT;
    const proposals = extractProposals(text);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].tool).toBe('expense.create');
    expect(proposals[0].args).toEqual({ description: 'Aluguel', value: 1500 });
    expect(stripProposals(text)).toBe('Claro! Vou lançar a despesa.');
    expect(extractProposals('só texto, sem bloco')).toHaveLength(0);
  });

  it('cadeia auto/free pula provedor sem chave e cai no próximo', async () => {
    const calls: string[] = [];
    const failer = {
      id: 'falho',
      isConfigured: () => true,
      complete: async () => {
        calls.push('falho');
        throw new Error('cota esgotada');
      },
    };
    const ok = {
      id: 'reserva',
      isConfigured: () => true,
      complete: async () => {
        calls.push('reserva');
        return { text: 'oi', model: 'm2', provider: 'reserva' };
      },
    };
    const off = {
      id: 'desligado',
      isConfigured: () => false,
      complete: async () => {
        calls.push('desligado');
        return { text: 'x', model: 'x', provider: 'x' };
      },
    };
    const result = await runChain({
      chain: ['desligado:m1', 'falho:m1', 'reserva:m2'],
      providers: new Map([[failer.id, failer], [ok.id, ok], [off.id, off]]),
      system: 's',
      history: [],
      userText: 'oi',
      opts: { timeoutMs: 5000 },
    });
    expect(result.text).toBe('oi');
    expect(calls).toEqual(['falho', 'reserva']);
  });

  it('cadeia sem provedor disponível falha com mensagem útil', async () => {
    await expect(
      runChain({
        chain: ['fantasma:m'],
        providers: new Map(),
        system: 's',
        history: [],
        userText: 'oi',
        opts: { timeoutMs: 1000 },
      })
    ).rejects.toThrow('Nenhum modelo disponível');
  });

  it('status, threads e isolamento por empresa', async () => {
    const a = await registerCompany({ prefix: 'bota' });
    const b = await registerCompany({ prefix: 'botb' });

    const status = await request(app).get('/api/v1/assistant/status').set(auth(a.token)).expect(200);
    expect(typeof status.body.data.enabled).toBe('boolean');

    const created = await request(app)
      .post('/api/v1/assistant/threads')
      .set(auth(a.token))
      .send({ title: 'Teste bot' })
      .expect(201);
    const threadId = created.body.data.id;

    // Empresa B não enxerga a conversa da A
    await request(app).get('/api/v1/assistant/threads/' + threadId).set(auth(b.token)).expect(404);
    const mine = await request(app).get('/api/v1/assistant/threads/' + threadId).set(auth(a.token)).expect(200);
    expect(mine.body.data.messages).toEqual([]);
  });

  it('chat sem provedor responde degradação educada e persiste', async () => {
    // Hermético: sem chave nenhuma, a cadeia esgota e degrada (sem rede)
    const savedKilo = config.kiloApiKey;
    const savedGemini = config.geminiApiKey;
    config.kiloApiKey = '';
    config.geminiApiKey = '';
    try {
    const a = await registerCompany({ prefix: 'botdeg' });
    const created = await request(app)
      .post('/api/v1/assistant/threads')
      .set(auth(a.token))
      .send({})
      .expect(201);
    const res = await request(app)
      .post('/api/v1/assistant/threads/' + created.body.data.id + '/chat')
      .set(auth(a.token))
      .send({ message: 'qual meu saldo?', route: '/dashboard' })
      .expect(200);
    const events = sseEvents(res.text);
    const done = events.find((e) => e.event === 'done');
    expect(done).toBeDefined();
    // Sem GEMINI_API_KEY no ambiente de teste, cai na degradação
    expect(done!.data.model).toBe('degraded');
    expect(done!.data.text).toMatch(/nada foi alterado/);
    const stored = await prisma.assistantMessage.findMany({
      where: { threadId: created.body.data.id },
    });
    expect(stored.length).toBe(2);
    } finally {
      config.kiloApiKey = savedKilo;
      config.geminiApiKey = savedGemini;
    }
  });

  it('confirmar executa a mutação; sem confirmar nada muda', async () => {
    const a = await registerCompany({ prefix: 'botconf' });
    const b = await registerCompany({ prefix: 'botconfx' });
    const thread = await prisma.assistantThread.create({
      data: { companyId: a.companyId, userId: a.userId, title: 't' },
    });
    const action = await prisma.assistantAction.create({
      data: {
        threadId: thread.id,
        companyId: a.companyId,
        userId: a.userId,
        tool: 'client.create',
        args: JSON.stringify({ name: 'Cliente do Bot' }),
        summary: 'Cadastrar Cliente do Bot',
        status: 'pending',
      },
    });
    // Outra empresa: 404
    await request(app).post('/api/v1/assistant/actions/' + action.id + '/confirm').set(auth(b.token)).expect(404);
    // Rejeitar: nada muda
    const action2 = await prisma.assistantAction.create({
      data: {
        threadId: thread.id,
        companyId: a.companyId,
        userId: a.userId,
        tool: 'client.create',
        args: JSON.stringify({ name: 'Nunca Criado' }),
        summary: 'x',
        status: 'pending',
      },
    });
    await request(app).post('/api/v1/assistant/actions/' + action2.id + '/reject').set(auth(a.token)).expect(200);
    expect(
      await prisma.client.count({ where: { companyId: a.companyId, name: 'Nunca Criado' } })
    ).toBe(0);
    // Confirmar: executa
    const ok = await request(app)
      .post('/api/v1/assistant/actions/' + action.id + '/confirm')
      .set(auth(a.token))
      .expect(200);
    expect(ok.body.data.summary).toMatch('Cliente do Bot');
    expect(
      await prisma.client.count({ where: { companyId: a.companyId, name: 'Cliente do Bot' } })
    ).toBe(1);
    // Confirmar de novo: já decidida
    await request(app).post('/api/v1/assistant/actions/' + action.id + '/confirm').set(auth(a.token)).expect(404);
  });

  it('ferramenta inexistente ou argumento inválido não vira ação', async () => {
    expect(getTool('nao.existe')).toBeUndefined();
    const tool = getTool('expense.create')!;
    expect(tool.schema.safeParse({ description: 'x' }).success).toBe(false);
    expect(tool.schema.safeParse({ description: 'Aluguel', value: 1500 }).success).toBe(true);
  });
});
