/**
 * User Rate Limit Decorator
 *
 * Rate limiting por usuário autenticado (não por IP).
 * Útil para limitar ações específicas por conta de usuário.
 *
 * Casos de uso:
 * - Limitar criação de recursos por usuário
 * - Prevenir spam de ações
 * - Proteção contra abuso de API keys
 *
 * @example
 * ```typescript
 * @Post('create')
 * @UserRateLimit(10, 60) // 10 requests por minuto por usuário
 * async create(@CurrentUser() user: User) {
 *   // ...
 * }
 * ```
 */

import {
  SetMetadata,
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// =============================================================================
// METADATA KEYS
// =============================================================================

export const USER_RATE_LIMIT_KEY = 'user_rate_limit';

export interface UserRateLimitOptions {
  /** Número máximo de requests */
  limit: number;
  /** Janela de tempo em segundos */
  windowSeconds: number;
  /** Mensagem de erro customizada */
  message?: string;
  /** Chave para identificar o recurso (opcional, usa rota por padrão) */
  key?: string;
}

// =============================================================================
// IN-MEMORY STORE
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Store em memória para rate limiting por usuário.
 * Para produção com múltiplas instâncias, use Redis.
 */
class UserRateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpar entradas expiradas a cada 5 minutos
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Verificar e incrementar contador
   * @returns true se permitido, false se bloqueado
   */
  check(key: string, limit: number, windowSeconds: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entry = this.store.get(key);

    // Se não existe entrada ou expirou, criar nova
    if (!entry || now >= entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);

      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Incrementar contador existente
    entry.count++;

    // Verificar se excedeu limite
    if (entry.count > limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Resetar contador para uma chave
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Limpar entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Destruir store (para testes)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Store global singleton
const globalStore = new UserRateLimitStore();

// =============================================================================
// GUARD
// =============================================================================

@Injectable()
export class UserRateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Buscar configuração do decorator
    const options = this.reflector.get<UserRateLimitOptions>(
      USER_RATE_LIMIT_KEY,
      context.getHandler(),
    );

    // Se não tem configuração, permitir
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Extrair user ID do request (definido pelo JwtAuthGuard)
    const userId = request.user?.sub || request.user?.id;

    if (!userId) {
      // Se não tem usuário autenticado, usar IP como fallback
      const ip = request.ip || request.connection?.remoteAddress || 'unknown';
      return this.checkLimit(options, `ip:${ip}`, context);
    }

    return this.checkLimit(options, `user:${userId}`, context);
  }

  private checkLimit(
    options: UserRateLimitOptions,
    identifier: string,
    context: ExecutionContext,
  ): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Criar chave única combinando identificador + rota (ou key customizada)
    const routeKey = options.key || `${request.method}:${request.route?.path || request.url}`;
    const key = `${identifier}:${routeKey}`;

    // Verificar limite
    const result = globalStore.check(key, options.limit, options.windowSeconds);

    // Adicionar headers de rate limit na resposta
    response.setHeader('X-RateLimit-Limit', options.limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      const message =
        options.message ||
        `Limite excedido. Máximo de ${options.limit} requisições a cada ${options.windowSeconds} segundos.`;

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message,
          error: 'Too Many Requests',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

// =============================================================================
// DECORATOR
// =============================================================================

/**
 * Decorator para rate limiting por usuário autenticado
 *
 * @param limit - Número máximo de requests na janela
 * @param windowSeconds - Duração da janela em segundos (padrão: 60)
 * @param options - Opções adicionais (mensagem customizada, key)
 *
 * @example
 * // 10 requests por minuto
 * @UserRateLimit(10)
 *
 * @example
 * // 100 requests por hora
 * @UserRateLimit(100, 3600)
 *
 * @example
 * // Com mensagem customizada
 * @UserRateLimit(5, 60, { message: 'Você pode criar no máximo 5 orçamentos por minuto' })
 */
export function UserRateLimit(
  limit: number,
  windowSeconds: number = 60,
  additionalOptions?: Partial<Pick<UserRateLimitOptions, 'message' | 'key'>>,
) {
  const options: UserRateLimitOptions = {
    limit,
    windowSeconds,
    ...additionalOptions,
  };

  return applyDecorators(
    SetMetadata(USER_RATE_LIMIT_KEY, options),
    UseGuards(UserRateLimitGuard),
  );
}

/**
 * Rate limits pré-configurados para casos comuns
 */
export const RateLimits = {
  /** Criação de recursos: 10/minuto */
  CREATE: () => UserRateLimit(10, 60, { message: 'Limite de criação excedido. Aguarde um momento.' }),

  /** Uploads: 5/minuto */
  UPLOAD: () => UserRateLimit(5, 60, { message: 'Limite de uploads excedido. Aguarde um momento.' }),

  /** Login: 5 tentativas/minuto */
  LOGIN: () => UserRateLimit(5, 60, { message: 'Muitas tentativas de login. Aguarde 1 minuto.' }),

  /** Envio de emails: 10/hora */
  EMAIL: () => UserRateLimit(10, 3600, { message: 'Limite de envio de emails excedido. Aguarde.' }),

  /** Exportações: 5/hora */
  EXPORT: () => UserRateLimit(5, 3600, { message: 'Limite de exportações excedido. Aguarde.' }),

  /** API geral: 100/minuto */
  API: () => UserRateLimit(100, 60),

  /** Ações sensíveis: 3/minuto */
  SENSITIVE: () => UserRateLimit(3, 60, { message: 'Ação temporariamente bloqueada. Aguarde.' }),
};

// =============================================================================
// EXPORTS
// =============================================================================

export { globalStore as userRateLimitStore };
