import { RagService } from './rag.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EmbeddingService } from './embedding.service';
import type { LlmService } from './llm.service';
import type { VectorDbService } from './vector-db.service';
import type { CostTrackingService } from '../analytics/cost-tracking.service';

const mockPrisma = {
  chatMessage: { create: jest.fn().mockResolvedValue({}) },
  chatSession: { update: jest.fn().mockResolvedValue({}) },
} as unknown as PrismaService;

const mockEmbedding = {
  embed: jest.fn().mockResolvedValue(new Array(384).fill(0)),
} as unknown as EmbeddingService;

const mockLlm = {
  generateAnswer: jest.fn().mockResolvedValue({ text: 'Test answer', inputTokens: 100, outputTokens: 50 }),
  generateAnswerStream: jest.fn().mockResolvedValue({ inputTokens: 100, outputTokens: 50 }),
} as unknown as LlmService;

const mockVectorDb = {
  searchSimilar: jest.fn(),
} as unknown as VectorDbService;

const mockCostTracking = {
  recordLLMUsage: jest.fn().mockResolvedValue(undefined),
} as unknown as CostTrackingService;

describe('RagService', () => {
  let service: RagService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RagService(mockPrisma, mockEmbedding, mockLlm, mockVectorDb, mockCostTracking);
  });

  it('returns fallback message when no relevant chunks found', async () => {
    (mockVectorDb.searchSimilar as jest.Mock).mockResolvedValue([]);
    const result = await service.answerQuestion('Q?', 'session1', 'user1');
    expect(result.answer).toContain('could not find relevant information');
    expect(result.sources).toHaveLength(0);
  });

  it('returns answer + sources when relevant chunks exist', async () => {
    (mockVectorDb.searchSimilar as jest.Mock).mockResolvedValue([
      { id: '1', score: 0.8, content: 'JS is great', documentName: 'doc.pdf', documentId: 'doc1', chunkIndex: 0 },
    ]);
    const result = await service.answerQuestion('Q?', 'session1', 'user1');
    expect(result.answer).toBe('Test answer');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].documentName).toBe('doc.pdf');
  });

  it('saves user and assistant messages to DB', async () => {
    (mockVectorDb.searchSimilar as jest.Mock).mockResolvedValue([
      { id: '1', score: 0.8, content: 'content', documentName: 'doc.pdf', documentId: 'doc1', chunkIndex: 0 },
    ]);
    await service.answerQuestion('Q?', 'session1', 'user1');
    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(2);
  });

  it('filters chunks below score threshold (0.3)', async () => {
    (mockVectorDb.searchSimilar as jest.Mock).mockResolvedValue([
      { id: '1', score: 0.1, content: 'low', documentName: 'doc.pdf', documentId: 'doc1', chunkIndex: 0 },
    ]);
    const result = await service.answerQuestion('Q?', 'session1', 'user1');
    expect(result.answer).toContain('could not find relevant information');
  });
});
