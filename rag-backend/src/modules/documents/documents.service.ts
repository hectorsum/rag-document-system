import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { VectorDbService } from '../rag/vector-db.service';
import { DocumentProcessorService } from './document-processor.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { Document } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private vectorDbService: VectorDbService,
    private documentProcessor: DocumentProcessorService,
    private supabase: SupabaseService,
  ) {}

  async saveUploadedFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<Document> {
    const ext = path.extname(file.originalname);
    const storagePath = `documents/${userId}/${randomUUID()}${ext}`;

    const fileBuffer = file.buffer ?? (await fs.promises.readFile(file.path));

    const { error } = await this.supabase.client.storage
      .from(this.supabase.bucket)
      .upload(storagePath, fileBuffer, { contentType: file.mimetype });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    // Clean up local temp file if multer wrote to disk
    if (file.path) {
      fs.promises.unlink(file.path).catch(() => {});
    }

    const doc = await this.prisma.document.create({
      data: {
        userId,
        fileName: file.originalname,
        fileSize: file.size,
        filePath: storagePath,
        mimeType: file.mimetype,
        status: 'uploading',
      },
    });

    return doc;
  }

  uploadDocument(file: Express.Multer.File, userId: string): Promise<Document> {
    return this.saveUploadedFile(file, userId).then(doc => {
      this.documentProcessor
        .processDocument(doc.id)
        .catch(err =>
          this.logger.error(
            `Background processing failed for ${doc.id}: ${(err as Error).message}`,
          ),
        );
      return doc;
    });
  }

  async listDocuments(userId: string): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentStatus(id: string, userId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, userId },
      select: { id: true, status: true, errorMessage: true, totalChunks: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async deleteDocument(id: string, userId: string): Promise<{ success: true }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId) throw new ForbiddenException('Access denied');

    // Delete vectors from Pinecone (log and continue on failure)
    await this.vectorDbService
      .deleteChunksByDocument(id)
      .catch(err =>
        this.logger.warn(`Pinecone delete failed for ${id}: ${(err as Error).message}`),
      );

    // Delete file from Supabase Storage
    await this.supabase.client.storage
      .from(this.supabase.bucket)
      .remove([doc.filePath])
      .catch(err =>
        this.logger.warn(`Supabase delete failed for ${doc.filePath}: ${String(err)}`),
      );

    // Delete from Prisma (cascades DocumentChunk)
    await this.prisma.document.delete({ where: { id } });

    return { success: true };
  }
}
