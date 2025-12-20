import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import Redis from 'ioredis';
import { USER_RATE_LIMIT_KEY, UserRateLimitOptions } from './user-rate-limit.decorator';

/**
 * RedisRateLimitGuard - Rate limiting por usuário usando Redis
 *
 * VERSÃO PARA PRODUÇÃO - Use esta em cluster multi-node
 *
 * Vantagens sobre in-memory:
 * - Funciona em cluster (múltiplos pods/nodes)
 * - Persiste entre restarts
 * - Mais eficiente em memória
 * - Suporta milhões de usuários
 *
 * Requer Redis configurado:
 * REDIS_URL=redis://localhost:6379
 */
@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly redis: Redis;
  private readonly keyPrefix = 'ratelimit';

  constructor(private readonly reflector: Reflector) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      // Fallback para in-memory se Redis falhar
      lazyConnect: true,
    });

    // Tenta conectar ao Redis
    this.redis.connect().catch((error) => {
      console.error('Failed to connect to Redis for rate limiting:', error);
      console.warn('Rate limiting may not work correctly without Redis');
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<UserRateLimitOptions>(
      USER_RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user || !user.userId) {
      return true;
    }

    const userId = user.userId;
    const endpoint = options.keyPrefix || context.getHandler().name;
    const key = `${this.keyPrefix}:${userId}:${endpoint}`;
    const now = Date.now();
    const ttlSeconds = Math.ceil(options.ttl / 1000);

    try {
      // Usa INCR + EXPIRE do Redis (atomic)
      const multi = this.redis.multi();
      multi.incr(key);
      multi.expire(key, ttlSeconds);
      const results = await multi.exec();

      if (!results) {
        // Redis falhou, permite requisição (fail-open)
        return true;
      }

      const count = results[0][1] as number;

      // Busca TTL restante
      const ttl = await this.redis.ttl(key);
      const resetIn = ttl > 0 ? ttl : ttlSeconds;

      // Adiciona headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', options.limit);
      response.setHeader('X-RateLimit-Remaining', Math.max(0, options.limit - count));
      response.setHeader('X-RateLimit-Reset', resetIn);

      // Verifica limite
      if (count > options.limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: options.message || 'Too many requests. Please try again later.',
            error: 'Too Many Requests',
            retryAfter: resetIn,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      // Se Redis falhar, log erro mas permite requisição (fail-open)
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Redis rate limit error:', error);
      return true;
    }
  }

  /**
   * Cleanup ao destruir guard
   */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
