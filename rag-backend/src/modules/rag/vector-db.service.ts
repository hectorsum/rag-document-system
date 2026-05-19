import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import type { Index, RecordMetadata } from '@pinecone-database/pinecone';
import type { ChunkVector, SimilarChunk } from '../../common/types';

export interface ChunkMetadata extends RecordMetadata {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
}

const UPSERT_BATCH_SIZE = 100;
const EMBEDDING_DIM = 384;

@Injectable()
export class VectorDbService implements OnModuleInit {
  private readonly logger = new Logger(VectorDbService.name);
  private client: Pinecone;
  private index: Index<ChunkMetadata>;

  constructor(private config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = new Pinecone({
      apiKey: this.config.get<string>('PINECONE_API_KEY', ''),
    });
    const indexName = this.config.get<string>('PINECONE_INDEX_NAME', 'rag-documents');
    this.index = this.client.index<ChunkMetadata>(indexName);
    this.logger.log(`Connected to Pinecone index: ${indexName}`);
    const stats = await this.index.describeIndexStats();
    this.logger.log(`Pinecone index stats: totalRecordCount=${stats.totalRecordCount}, namespaces=${JSON.stringify(stats.namespaces)}`);
  }

  async storeChunk(
    chunkId: string,
    vector: number[],
    metadata: ChunkMetadata,
  ): Promise<void> {
    await this.index.upsert({ records: [{ id: chunkId, values: vector, metadata }] });
  }

  async storeChunkBatch(chunks: ChunkVector[]): Promise<void> {
    for (let i = 0; i < chunks.length; i += UPSERT_BATCH_SIZE) {
      const batch = chunks.slice(i, i + UPSERT_BATCH_SIZE);
      await this.index.upsert({
        records: batch.map(c => ({
          id: c.chunkId,
          values: c.vector,
          metadata: c.metadata as ChunkMetadata,
        })),
      });
    }
  }

  async searchSimilar(
    queryVector: number[],
    topK = 5,
    filter?: { documentId: string },
  ): Promise<SimilarChunk[]> {
    const result = await this.index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      ...(filter ? { filter: { documentId: { $eq: filter.documentId } } } : {}),
    });

    return (result.matches ?? [])
      .filter(m => m.metadata != null)
      .map(m => ({
        id: m.id,
        score: m.score ?? 0,
        content: String(m.metadata!.content),
        documentName: String(m.metadata!.documentName),
        documentId: String(m.metadata!.documentId),
        chunkIndex: Number(m.metadata!.chunkIndex),
      }));
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    // Query with zero vector + metadata filter to discover chunk IDs, then delete.
    const zeroVector = new Array(EMBEDDING_DIM).fill(0) as number[];
    const result = await this.index.query({
      vector: zeroVector,
      topK: 10000,
      filter: { documentId: { $eq: documentId } },
      includeMetadata: false,
      includeValues: false,
    });

    const ids = (result.matches ?? []).map(m => m.id);
    if (ids.length === 0) return;

    await this.index.deleteMany({ ids });
    this.logger.log(`Deleted ${ids.length} vectors for document ${documentId}`);
  }

  async ping(): Promise<void> {
    await this.index.describeIndexStats();
  }

  /** @deprecated use storeChunk / storeChunkBatch */
  async storeEmbedding(id: string, vector: number[], metadata: ChunkMetadata): Promise<void> {
    return this.storeChunk(id, vector, metadata);
  }

  /** @deprecated use deleteChunksByDocument */
  async deleteDocumentEmbeddings(embeddingIds: string[]): Promise<void> {
    if (embeddingIds.length === 0) return;
    await this.index.deleteMany({ ids: embeddingIds });
  }
}
