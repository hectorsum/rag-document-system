import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../rag/embedding.service';
import { VectorDbService } from '../rag/vector-db.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ChunkResult, ChunkVector } from '../../common/types';

const CHUNK_CHARS = 500 * 4;   // ~500 tokens at 4 chars/token
const OVERLAP_CHARS = 50 * 4;  // ~50 tokens overlap

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private vectorDbService: VectorDbService,
    private supabase: SupabaseService,
  ) {}

  async extractTextFromPDF(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from(this.supabase.bucket)
      .download(storagePath);

    if (error) throw new Error(`Failed to download from Supabase: ${error.message}`);

    const buffer = Buffer.from(await data.arrayBuffer());
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const path = await import('path');
    const standardFontDataUrl = path.join(
      require.resolve('pdfjs-dist/package.json'),
      '../standard_fonts/',
    );

    const pdf = await pdfjsLib
      .getDocument({ data: new Uint8Array(buffer), standardFontDataUrl })
      .promise;

    const texts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map(item => ('str' in item ? (item as { str: string }).str : ''))
        .join(' ');
      texts.push(text);
    }

    return texts.join('\n').trim();
  }

  chunkText(text: string): ChunkResult[] {
    const chunks: ChunkResult[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      let end = Math.min(start + CHUNK_CHARS, text.length);

      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const boundary = Math.max(lastPeriod, lastNewline);
        if (boundary > start) end = boundary + 1;
      }

      const content = text.slice(start, end).trim();
      if (content) {
        chunks.push({
          content,
          chunkIndex: chunkIndex++,
          tokenCount: Math.ceil(content.length / 4),
        });
      }

      if (end >= text.length) break;
      start = end - OVERLAP_CHARS;
    }

    return chunks;
  }

  async processDocument(documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found`);

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'processing' },
      });

      const text = await this.extractTextFromPDF(doc.filePath);
      const chunks = this.chunkText(text);

      const vectors = await this.embeddingService.embedBatch(chunks.map(c => c.content));

      const chunkVectors: ChunkVector[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${documentId}-chunk-${chunk.chunkIndex}`;

        await this.prisma.documentChunk.create({
          data: {
            documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            embeddingId: chunkId,
          },
        });

        chunkVectors.push({
          chunkId,
          vector: vectors[i],
          metadata: {
            documentId,
            documentName: doc.fileName,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
          },
        });
      }

      await this.vectorDbService.storeChunkBatch(chunkVectors);

      const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'ready', totalChunks: chunks.length, totalTokens },
      });

      this.logger.log(`Document ${documentId} ready — ${chunks.length} chunks, ${totalTokens} tokens`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`processDocument ${documentId} failed: ${message}`);
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'error', errorMessage: message },
      });
    }
  }
}
