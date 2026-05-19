import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CostTrackingService } from './cost-tracking.service';
import { PrismaService } from '../../prisma/prisma.service';

type AuthRequest = Request & { user: { id: string } };

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private costTracking: CostTrackingService,
    private prisma: PrismaService,
  ) {}

  @Get('costs')
  @ApiOperation({ summary: 'Get cost summary for the authenticated user' })
  getCosts(@Req() req: AuthRequest) {
    return this.costTracking.getUserCostSummary(req.user.id);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage statistics for the authenticated user' })
  async getUsage(@Req() req: AuthRequest) {
    const userId = req.user.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [documents, sessions, recentUsages] = await Promise.all([
      this.prisma.document.count({ where: { userId } }),
      this.prisma.chatSession.count({ where: { userId } }),
      this.prisma.apiUsage.findMany({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const byDay: Record<string, number> = {};
    for (const u of recentUsages) {
      const day = u.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    const queriesPerDay = Object.entries(byDay).map(([date, count]) => ({ date, count }));

    return {
      documentsUploaded: documents,
      totalChatSessions: sessions,
      totalQueriesLast7Days: recentUsages.length,
      queriesPerDay,
    };
  }
}
