import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { LlmService } from './llm.service';
import { VectorDbService } from './vector-db.service';
import { CostTrackingService } from '../analytics/cost-tracking.service';
import type { Source } from '../../common/types';

// Only reject results that are essentially noise (cosine similarity near zero).
// The LLM's system prompt handles the case where context isn't directly relevant.
const SCORE_THRESHOLD = 0.05;
const NO_CONTEXT_REPLY = "I could not find relevant information in your documents.";
const NO_DOCS_REPLY = "You don't have any processed documents yet. Please upload a PDF and wait for it to finish processing.";

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private llmService: LlmService,
    private vectorDbService: VectorDbService,
    private costTracking: CostTrackingService,
  ) {}

  async answerQuestion(
    question: string,
    sessionId: string,
    userId: string,
    onChunk?: (chunk: string) => void,
  ): Promise<{ answer: string; sources: Source[] }> {
    // Only search within the user's own ready documents
    const userDocs = await this.prisma.document.findMany({
      where: { userId, status: 'ready' },
      select: { id: true },
    });

    const saveMessages = async (answer: string, sources: Source[]) => {
      await this.prisma.chatMessage.create({
        data: { sessionId, role: 'user', content: question },
      });
      await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: answer,
          sourceDocuments: sources as unknown as Prisma.InputJsonValue,
        },
      });
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    };

    if (userDocs.length === 0) {
      await saveMessages(NO_DOCS_REPLY, []);
      return { answer: NO_DOCS_REPLY, sources: [] };
    }

    const queryVector = await this.embeddingService.embed(question);
    const documentIds = userDocs.map(d => d.id);
    const matches = await this.vectorDbService.searchSimilar(queryVector, 5, { documentIds });
    this.logger.log(
      `Pinecone returned ${matches.length} matches for user ${userId}: ${
        matches.map(m => `${m.documentName}(${m.score.toFixed(3)})`).join(', ') || 'none'
      }`,
    );
    const relevant = matches.filter(m => m.score > SCORE_THRESHOLD);

    if (relevant.length === 0) {
      await saveMessages(NO_CONTEXT_REPLY, []);
      return { answer: NO_CONTEXT_REPLY, sources: [] };
    }

    const context = relevant
      .map(m => `[Document: ${m.documentName}]\n${m.content}`)
      .join('\n\n');

    const sources: Source[] = relevant.map(m => ({
      documentName: m.documentName,
      documentId: m.documentId,
      chunkIndex: m.chunkIndex,
    }));

    let answer: string;
    let inputTokens: number;
    let outputTokens: number;

    if (onChunk) {
      const parts: string[] = [];
      const tokens = await this.llmService.generateAnswerStream(context, question, chunk => {
        parts.push(chunk);
        onChunk(chunk);
      });
      answer = parts.join('');
      inputTokens = tokens.inputTokens;
      outputTokens = tokens.outputTokens;
    } else {
      const result = await this.llmService.generateAnswer(context, question);
      answer = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    }

    // Track cost asynchronously — don't let failures block the response
    this.costTracking
      .recordLLMUsage({ userId, sessionId, inputTokens, outputTokens, model: 'claude-sonnet-4-5', queryType: 'question' })
      .catch(err => this.logger.warn(`Cost tracking failed: ${(err as Error).message}`));

    await saveMessages(answer, sources);
    return { answer, sources };
  }
}
