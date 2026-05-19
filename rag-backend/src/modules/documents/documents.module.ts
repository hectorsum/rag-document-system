import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentProcessorService } from './document-processor.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [RagModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentProcessorService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
