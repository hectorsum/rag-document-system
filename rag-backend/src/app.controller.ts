import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { VectorDbService } from './modules/rag/vector-db.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    private prisma: PrismaService,
    private vectorDb: VectorDbService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Service health check' })
  async getHealth() {
    let dbStatus: 'connected' | 'error' = 'connected';
    let pineconeStatus: 'connected' | 'error' = 'connected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    try {
      await this.vectorDb.ping();
    } catch {
      pineconeStatus = 'error';
    }

    return {
      status: dbStatus === 'connected' && pineconeStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: { database: dbStatus, pinecone: pineconeStatus },
    };
  }
}
