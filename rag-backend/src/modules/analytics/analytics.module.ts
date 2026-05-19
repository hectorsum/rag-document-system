import { Global, Module } from '@nestjs/common';
import { CostTrackingService } from './cost-tracking.service';
import { AnalyticsController } from './analytics.controller';

@Global()
@Module({
  controllers: [AnalyticsController],
  providers: [CostTrackingService],
  exports: [CostTrackingService],
})
export class AnalyticsModule {}
