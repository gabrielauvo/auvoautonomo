/**
 * Health Controller
 *
 * Endpoints de health check para monitoramento.
 *
 * Liveness vs Readiness:
 * - Liveness: "O app está vivo?" - Se falhar, K8s reinicia o pod
 * - Readiness: "O app está pronto?" - Se falhar, K8s para de enviar tráfego
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('Health')
@Controller('health')
@SkipThrottle() // Health checks não devem ter rate limiting
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  /**
   * Liveness Probe
   *
   * Verifica se a aplicação está viva (respondendo).
   * Não verifica dependências externas para evitar cascata de falhas.
   *
   * K8s: Se falhar, o pod é reiniciado.
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe - app está rodando?' })
  @ApiResponse({ status: 200, description: 'App está vivo' })
  @ApiResponse({ status: 503, description: 'App não está respondendo' })
  @HealthCheck()
  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Apenas verifica se consegue alocar memória (app não travou)
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // 500MB
    ]);
  }

  /**
   * Readiness Probe
   *
   * Verifica se a aplicação está pronta para receber tráfego.
   * Inclui verificação de dependências (DB, etc).
   *
   * K8s: Se falhar, o pod é removido do load balancer.
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - app está pronto para tráfego?' })
  @ApiResponse({ status: 200, description: 'App está pronto' })
  @ApiResponse({ status: 503, description: 'App não está pronto' })
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database - essencial para operação
      () => this.prisma.isHealthy('database'),
      // Redis - se configurado
      () => this.redis.isHealthy('redis'),
      // Memória heap
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024), // 500MB
      // Memória RSS (total process)
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB
    ]);
  }

  /**
   * Health Check Completo
   *
   * Endpoint detalhado para monitoramento e debugging.
   * Inclui todas as verificações disponíveis.
   */
  @Get()
  @ApiOperation({ summary: 'Health check completo com detalhes' })
  @ApiResponse({ status: 200, description: 'Status de saúde completo' })
  @ApiResponse({ status: 503, description: 'Algum componente não está saudável' })
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database
      () => this.prisma.isHealthy('database'),
      // Redis
      () => this.redis.isHealthy('redis'),
      // Memória
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),
      // Disco (se disponível) - path pode variar por ambiente
      () =>
        this.disk.checkStorage('disk_storage', {
          thresholdPercent: 0.9, // Alerta se > 90% usado
          path: process.platform === 'win32' ? 'C:\\' : '/',
        }),
    ]);
  }

  /**
   * Startup Probe
   *
   * Usado durante inicialização lenta.
   * K8s espera este endpoint retornar OK antes de iniciar liveness/readiness.
   */
  @Get('startup')
  @ApiOperation({ summary: 'Startup probe - app inicializou?' })
  @ApiResponse({ status: 200, description: 'App inicializado' })
  @ApiResponse({ status: 503, description: 'App ainda inicializando' })
  @HealthCheck()
  async startup(): Promise<HealthCheckResult> {
    return this.health.check([
      // Apenas verifica se o DB está acessível
      () => this.prisma.isHealthy('database'),
    ]);
  }
}
