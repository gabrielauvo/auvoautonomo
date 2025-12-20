import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';

/**
 * RedisHealthIndicator - Verifica saúde do Redis
 *
 * Tenta conectar e executar PING
 * Se falhar, marca como unhealthy
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: Redis | null = null;

  constructor() {
    super();

    // Só conecta se REDIS_URL estiver configurado
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          lazyConnect: true,
          enableReadyCheck: true,
        });

        // Tenta conectar
        this.redis.connect().catch(() => {
          // Ignora erro na inicialização, será reportado no health check
        });
      } catch (error) {
        console.warn('Failed to initialize Redis health indicator:', error);
      }
    }
  }

  /**
   * Verifica se Redis está healthy
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // Se Redis não está configurado, considera healthy
    // (aplicação pode funcionar sem Redis)
    if (!this.redis) {
      return this.getStatus(key, true, {
        message: 'Redis not configured (optional)',
      });
    }

    try {
      // Tenta PING com timeout de 2s
      const start = Date.now();
      const result = await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        ),
      ]);

      const latency = Date.now() - start;

      if (result === 'PONG') {
        return this.getStatus(key, true, {
          latency: `${latency}ms`,
        });
      }

      throw new Error('Invalid PING response');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, {
          message,
        }),
      );
    }
  }

  /**
   * Cleanup ao destruir
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
