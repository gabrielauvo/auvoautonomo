import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { USER_RATE_LIMIT_KEY, UserRateLimitOptions } from './user-rate-limit.decorator';

/**
 * UserRateLimitGuard - Rate limiting por usuário autenticado
 *
 * Diferente do rate limiting por IP (@nestjs/throttler), este guard
 * limita requisições por userId, essencial para:
 * - Prevenir abuso de usuários autenticados
 * - Proteger APIs em produção com proxies/load balancers (IP pode ser compartilhado)
 * - Limitar ações custosas (exports, reports, imports)
 *
 * Funciona mesmo se o IP mudar (mobile, VPN, etc)
 */
@Injectable()
export class UserRateLimitGuard implements CanActivate {
  // In-memory storage: userId -> { count: number, resetAt: number }
  // Em produção, use Redis para cluster multi-node
  private readonly storage = new Map<string, { count: number; resetAt: number }>();

  // Cleanup interval para evitar memory leak
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly reflector: Reflector) {
    // Limpa entradas expiradas a cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Busca configuração do decorator
    const options = this.reflector.get<UserRateLimitOptions>(
      USER_RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      // Se não tem decorator, permite
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    // Se não está autenticado, permite (ou pode lançar erro)
    if (!user || !user.userId) {
      // Permite mas pode mudar para bloquear se necessário
      return true;
    }

    const userId = user.userId;
    const key = `${userId}:${options.keyPrefix || context.getHandler().name}`;
    const now = Date.now();

    // Busca ou cria entrada
    let entry = this.storage.get(key);

    // Se não existe ou expirou, cria nova
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + options.ttl,
      };
      this.storage.set(key, entry);
    }

    // Incrementa contador
    entry.count++;

    // Calcula tempo restante para reset
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);

    // Adiciona headers informativos
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', options.limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, options.limit - entry.count));
    response.setHeader('X-RateLimit-Reset', resetIn);

    // Verifica se excedeu limite
    if (entry.count > options.limit) {
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
  }

  /**
   * Remove entradas expiradas para evitar memory leak
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.storage.entries()) {
      if (now > entry.resetAt) {
        this.storage.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`UserRateLimitGuard: cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Método para limpar storage manualmente (útil para testes)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Cleanup ao destruir guard
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
