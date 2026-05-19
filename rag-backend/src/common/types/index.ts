export interface ChunkResult {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface ChunkVector {
  chunkId: string;
  vector: number[];
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    content: string;
  };
}

export interface SimilarChunk {
  id: string;
  score: number;
  content: string;
  documentName: string;
  documentId: string;
  chunkIndex: number;
}

export interface Source {
  documentName: string;
  documentId: string;
  chunkIndex: number;
}
