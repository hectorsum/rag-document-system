import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { LlmService } from './llm.service';
import { VectorDbService } from './vector-db.service';
import { RagService } from './rag.service';

@Module({
  providers: [EmbeddingService, LlmService, VectorDbService, RagService],
  exports: [RagService, EmbeddingService, VectorDbService],
})
export class RagModule {}
