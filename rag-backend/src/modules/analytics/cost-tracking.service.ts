import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const INPUT_COST_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15.0 / 1_000_000;

export interface RecordLLMUsageDto {
  userId: string;
  sessionId?: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  queryType: 'question' | 'summary';
}

export interface CostSummary {
  totalSpent: number;
  totalQueries: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageCostPerQuery: number;
  costByDay: { date: string; cost: number }[];
  mostExpensiveQuery: { sessionId: string | null; cost: number; date: string } | null;
}

@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);

  constructor(private prisma: PrismaService) {}

  async recordLLMUsage(data: RecordLLMUsageDto): Promise<void> {
    const inputCost = data.inputTokens * INPUT_COST_PER_TOKEN;
    const outputCost = data.outputTokens * OUTPUT_COST_PER_TOKEN;
    const totalCost = inputCost + outputCost;

    await this.prisma.apiUsage.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        inputCost,
        outputCost,
        totalCost,
        queryType: data.queryType,
      },
    });

    this.logger.log(
      `Usage recorded — user:${data.userId} model:${data.model} ` +
      `in:${data.inputTokens} out:${data.outputTokens} cost:$${totalCost.toFixed(6)}`,
    );
  }

  async getUserCostSummary(userId: string): Promise<CostSummary> {
    const usages = await this.prisma.apiUsage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalSpent = usages.reduce((s, u) => s + u.totalCost, 0);
    const totalQueries = usages.length;
    const totalInputTokens = usages.reduce((s, u) => s + u.inputTokens, 0);
    const totalOutputTokens = usages.reduce((s, u) => s + u.outputTokens, 0);
    const averageCostPerQuery = totalQueries > 0 ? totalSpent / totalQueries : 0;

    // Cost by day — last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsages = usages.filter(u => u.createdAt >= thirtyDaysAgo);
    const byDay: Record<string, number> = {};
    for (const u of recentUsages) {
      const day = u.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + u.totalCost;
    }
    const costByDay = Object.entries(byDay)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Most expensive query
    const mostExpensive = usages.reduce<(typeof usages)[0] | null>(
      (max, u) => (!max || u.totalCost > max.totalCost ? u : max),
      null,
    );
    const mostExpensiveQuery = mostExpensive
      ? { sessionId: mostExpensive.sessionId, cost: mostExpensive.totalCost, date: mostExpensive.createdAt.toISOString() }
      : null;

    return {
      totalSpent,
      totalQueries,
      totalInputTokens,
      totalOutputTokens,
      averageCostPerQuery,
      costByDay,
      mostExpensiveQuery,
    };
  }
}
