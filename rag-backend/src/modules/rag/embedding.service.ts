import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

type EmbedFn = (text: string, opts: object) => Promise<{ data: Float32Array }>;

const MAX_CHARS = 512 * 4; // ~512 tokens at 4 chars/token
const BATCH_SIZE = 10;

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private pipe: EmbedFn | null = null;

  async onModuleInit(): Promise<void> {
    this.logger.log('Loading embedding model Xenova/all-MiniLM-L6-v2…');
    const { pipeline } = await import('@xenova/transformers');
    this.pipe = (await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    )) as unknown as EmbedFn;
    this.logger.log('Embedding model ready');
  }

  async embed(text: string): Promise<number[]> {
    if (!this.pipe) throw new Error('Embedding pipeline not initialised');
    const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    const output = await this.pipe(truncated, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await Promise.all(batch.map(t => this.embed(t)));
      results.push(...embeddings);
    }
    return results;
  }
}
