/**
 * Prisma Health Indicator
 *
 * Indicador de saúde customizado para o Prisma/Database.
 */

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Verifica se o banco de dados está acessível
   *
   * @param key - Chave para identificar o indicador
   * @returns Resultado do health check
   * @throws HealthCheckError se o banco não estiver acessível
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      // Query simples para verificar conectividade
      await this.prisma.$queryRaw`SELECT 1`;

      const responseTime = Date.now() - startTime;

      // Considerar unhealthy se response time > 5s
      if (responseTime > 5000) {
        throw new HealthCheckError(
          'Database is slow',
          this.getStatus(key, false, {
            message: `Response time too high: ${responseTime}ms`,
            responseTime,
          }),
        );
      }

      return this.getStatus(key, true, {
        responseTime,
        message: 'Database is reachable',
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Se for HealthCheckError, re-throw
      if (error instanceof HealthCheckError) {
        throw error;
      }

      // Outro erro - DB não acessível
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
          responseTime,
        }),
      );
    }
  }

  /**
   * Verifica status de conexão do Prisma
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        connected: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
