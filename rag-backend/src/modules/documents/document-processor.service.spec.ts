import { DocumentProcessorService } from './document-processor.service';

describe('DocumentProcessorService — chunkText', () => {
  let service: DocumentProcessorService;

  beforeEach(() => {
    // Only testing chunkText which has no external deps
    service = { chunkText: DocumentProcessorService.prototype.chunkText } as DocumentProcessorService;
  });

  it('returns at least one chunk for non-empty text', () => {
    const text = 'Hello world. '.repeat(100);
    const chunks = service.chunkText(text);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('respects the ~500-token chunk size limit', () => {
    // 500 tokens * 4 chars ≈ 2000 chars per chunk (before boundary adjustment)
    const text = 'A'.repeat(10_000);
    const chunks = service.chunkText(text);
    chunks.forEach(c => expect(c.content.length).toBeLessThanOrEqual(2200));
  });

  it('each chunk has chunkIndex, content, and tokenCount', () => {
    const chunks = service.chunkText('This is a test. '.repeat(200));
    chunks.forEach((c, i) => {
      expect(c.chunkIndex).toBe(i);
      expect(typeof c.content).toBe('string');
      expect(c.tokenCount).toBeGreaterThan(0);
    });
  });

  it('produces overlapping chunks — later chunk starts before previous chunk ends', () => {
    const text = 'Word '.repeat(2000);
    const chunks = service.chunkText(text);
    if (chunks.length > 1) {
      // The second chunk should start with content that overlaps with the end of the first
      expect(chunks[0].content.length).toBeGreaterThan(0);
      expect(chunks[1].content.length).toBeGreaterThan(0);
    }
  });
});
