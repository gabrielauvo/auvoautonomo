/**
 * Health Module
 *
 * Módulo de health checks para Kubernetes, Docker e load balancers.
 * Essencial para deployments de alta disponibilidade com 1M+ usuários.
 *
 * Endpoints:
 * - /health/live: Liveness probe - verifica se a aplicação está rodando
 * - /health/ready: Readiness probe - verifica se está pronta para receber tráfego
 */

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    TerminusModule.forRoot({
      // Configurar error logging
      errorLogStyle: 'pretty',
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
