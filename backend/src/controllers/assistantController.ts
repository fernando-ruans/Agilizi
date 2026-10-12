import { Request, Response } from 'express';
import prisma from '../config/database';
import { AppError } from '../utils/errors';
import {
  isBotAvailable,
  dailyUsage,
  runAssistantReply,
  executeAction,
} from '../services/assistant/conversation';
import { config } from '../config';

const NL = String.fromCharCode(10);

function sse(res: Response, event: string, data: unknown) {
  res.write('event: ' + event + NL);
  res.write('data: ' + JSON.stringify(data) + NL + NL);
}

export class AssistantController {
  async status(req: Request, res: Response) {
    res.json({
      status: 'success',
      data: {
        enabled: isBotAvailable(),
        dailyCap: config.aiDailyCap,
        usedToday: await dailyUsage(req.user!.companyId),
      },
    });
  }

  async listThreads(req: Request, res: Response) {
    const threads = await prisma.assistantThread.findMany({
      where: { companyId: req.user!.companyId },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    res.json({ status: 'success', data: threads });
  }

  async createThread(req: Request, res: Response) {
    const title = String(req.body?.title || 'Nova conversa').slice(0, 80);
    const thread = await prisma.assistantThread.create({
      data: { companyId: req.user!.companyId, userId: req.user!.userId, title },
    });
    res.status(201).json({ status: 'success', data: thread });
  }

  async getThread(req: Request, res: Response) {
    const thread = await prisma.assistantThread.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 100 },
        actions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!thread) throw new AppError('Conversa não encontrada', 404);
    res.json({ status: 'success', data: thread });
  }

  async deleteThread(req: Request, res: Response) {
    const thread = await prisma.assistantThread.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!thread) throw new AppError('Conversa não encontrada', 404);
    await prisma.assistantThread.delete({ where: { id: thread.id } });
    res.json({ status: 'success', message: 'Conversa excluída' });
  }

  // POST em SSE (tokens + done). O frontend lê via fetch com o
  // Authorization header — EventSource puro não seria autenticado.
  async chat(req: Request, res: Response) {
    const message = String(req.body?.message || '').slice(0, 4000);
    if (!message.trim()) throw new AppError('Mensagem vazia', 400);
    const thread = await prisma.assistantThread.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!thread) throw new AppError('Conversa não encontrada', 404);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    try {
      const reply = await runAssistantReply({
        threadId: thread.id,
        companyId: req.user!.companyId,
        userId: req.user!.userId,
        userText: message,
        page: { route: String(req.body?.route || ''), recordId: req.body?.recordId ? String(req.body.recordId) : undefined },
        onToken: (t) => sse(res, 'token', { t }),
      });
      sse(res, 'done', { text: reply.text, model: reply.model, actions: reply.actions });
    } catch (err: any) {
      sse(res, 'error', { message: err?.message || 'Erro no assistente' });
    } finally {
      res.end();
    }
    await prisma.assistantThread.update({
      where: { id: thread.id },
      data: { title: thread.title === 'Nova conversa' ? message.slice(0, 60) : thread.title },
    });
  }

  // Confirma E executa na mesma chamada: um clique, uma ação.
  async confirmAction(req: Request, res: Response) {
    const action = await prisma.assistantAction.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId, status: 'pending' },
    });
    if (!action) throw new AppError('Ação não encontrada ou já decidida', 404);
    await prisma.assistantAction.update({ where: { id: action.id }, data: { status: 'confirmed' } });
    try {
      const result = await executeAction(action.id, req.user!.companyId, req.user!.userId);
      res.json({ status: 'success', data: { summary: result.summary, result: result.data ?? null } });
    } catch (err: any) {
      throw new AppError('Ação falhou: ' + (err?.message || err), 400);
    }
  }

  async rejectAction(req: Request, res: Response) {
    const action = await prisma.assistantAction.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId, status: 'pending' },
    });
    if (!action) throw new AppError('Ação não encontrada ou já decidida', 404);
    await prisma.assistantAction.update({ where: { id: action.id }, data: { status: 'rejected' } });
    res.json({ status: 'success', message: 'Ação descartada — nada foi alterado' });
  }
}

export const assistantController = new AssistantController();
