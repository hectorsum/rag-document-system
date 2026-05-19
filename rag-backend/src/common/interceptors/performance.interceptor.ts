import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

const SLOW_THRESHOLD_MS = 2000;

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        if (!res.headersSent) {
          res.setHeader('X-Response-Time', `${duration}ms`);
        }
        if (duration > SLOW_THRESHOLD_MS) {
          this.logger.warn(
            `Slow response: ${req.method} ${req.url} took ${duration}ms`,
          );
        }
      }),
    );
  }
}
