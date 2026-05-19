import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
    // Mock the pipeline
    (service as unknown as { pipe: unknown }).pipe = async (text: string) => ({
      data: new Float32Array(384).fill(0.1),
    });
  });

  it('embed() returns an array of 384 numbers', async () => {
    const result = await service.embed('hello world');
    expect(result).toHaveLength(384);
    expect(typeof result[0]).toBe('number');
  });

  it('embed() handles empty string without throwing', async () => {
    await expect(service.embed('')).resolves.toHaveLength(384);
  });

  it('embedBatch() returns correct number of embeddings', async () => {
    const texts = ['a', 'b', 'c'];
    const result = await service.embedBatch(texts);
    expect(result).toHaveLength(3);
    result.forEach(r => expect(r).toHaveLength(384));
  });

  it('embedBatch() processes in batches of 10 without error', async () => {
    const texts = Array.from({ length: 25 }, (_, i) => `text ${i}`);
    const result = await service.embedBatch(texts);
    expect(result).toHaveLength(25);
  });
});
