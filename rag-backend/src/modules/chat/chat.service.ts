import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private ragService: RagService,
  ) {}

  async createSession(userId: string, title?: string) {
    return this.prisma.chatSession.create({
      data: { userId, title: title ?? 'New Chat' },
    });
  }

  async listSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  async deleteSession(sessionId: string, userId: string): Promise<{ success: true }> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    await this.prisma.chatSession.delete({ where: { id: sessionId } });
    return { success: true };
  }

  async sendMessage(
    sessionId: string,
    userId: string,
    question: string,
    res: Response,
  ): Promise<void> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const { sources } = await this.ragService.answerQuestion(
        question,
        sessionId,
        userId,
        chunk => res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`),
      );

      res.write(`data: ${JSON.stringify({ type: 'done', sources })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI service temporarily unavailable';
      this.logger.error(`sendMessage failed: ${message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    }

    res.end();
  }
}
