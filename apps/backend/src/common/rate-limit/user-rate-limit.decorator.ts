import { SetMetadata } from '@nestjs/common';

export const USER_RATE_LIMIT_KEY = 'userRateLimit';

export interface UserRateLimitOptions {
  /**
   * Número máximo de requisições permitidas
   */
  limit: number;

  /**
   * Janela de tempo em milissegundos
   * Ex: 60000 = 1 minuto
   */
  ttl: number;

  /**
   * Prefixo da chave (opcional)
   * Útil para ter limites diferentes por endpoint
   * Ex: 'export', 'import', 'report'
   */
  keyPrefix?: string;

  /**
   * Mensagem customizada de erro
   */
  message?: string;
}

/**
 * @UserRateLimit - Decorator para limitar requisições por usuário autenticado
 *
 * Exemplos de uso:
 *
 * ```typescript
 * // Limite: 10 requisições por minuto
 * @UserRateLimit({ limit: 10, ttl: 60000 })
 * @Get('expensive-operation')
 * async expensiveOperation() { ... }
 *
 * // Limite: 5 exports por hora
 * @UserRateLimit({
 *   limit: 5,
 *   ttl: 3600000,
 *   keyPrefix: 'export',
 *   message: 'You can only export 5 times per hour'
 * })
 * @Get('export')
 * async exportData() { ... }
 *
 * // Limite: 100 requisições por 15 minutos (API padrão)
 * @UserRateLimit({ limit: 100, ttl: 900000 })
 * @Get('list')
 * async list() { ... }
 * ```
 *
 * Limites recomendados para 1M+ usuários:
 * - Leitura (GET): 100-1000/15min
 * - Escrita (POST/PUT/PATCH): 50-100/15min
 * - Operações custosas (export, import, reports): 5-10/hora
 * - Operações críticas (delete, bulk): 10-20/hora
 */
export const UserRateLimit = (options: UserRateLimitOptions) =>
  SetMetadata(USER_RATE_LIMIT_KEY, options);
