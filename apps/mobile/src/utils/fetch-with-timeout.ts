/**
 * Fetch with Timeout
 *
 * Helper para fazer requisições HTTP com timeout e cancelamento usando AbortController.
 * Essencial para apps com 1M+ usuários em redes instáveis.
 *
 * Features:
 * - Timeout configurável (padrão 30s)
 * - AbortController para cancelamento limpo
 * - Retry automático opcional
 * - Tratamento de erros de rede
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FetchWithTimeoutOptions extends RequestInit {
  /**
   * Timeout em milissegundos (padrão: 30000ms = 30s)
   */
  timeout?: number;

  /**
   * Número de tentativas em caso de falha (padrão: 1 = sem retry)
   */
  retries?: number;

  /**
   * Delay entre tentativas em ms (padrão: 1000ms)
   */
  retryDelay?: number;

  /**
   * Callback chamado antes de cada retry
   */
  onRetry?: (attempt: number, error: Error) => void;
}

export class FetchTimeoutError extends Error {
  constructor(url: string, timeout: number) {
    super(`Request to ${url} timed out after ${timeout}ms`);
    this.name = 'FetchTimeoutError';
  }
}

export class FetchNetworkError extends Error {
  constructor(url: string, originalError: unknown) {
    super(`Network request to ${url} failed: ${originalError instanceof Error ? originalError.message : String(originalError)}`);
    this.name = 'FetchNetworkError';
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 segundos
const DEFAULT_RETRIES = 1; // Sem retry por padrão
const DEFAULT_RETRY_DELAY = 1000; // 1 segundo

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sleep helper para delays entre retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifica se o erro é recuperável (deve fazer retry)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof FetchTimeoutError) {
    return true; // Timeout pode ser temporário
  }

  if (error instanceof FetchNetworkError) {
    return true; // Erro de rede pode ser temporário
  }

  // Erros HTTP 5xx são recuperáveis
  if (error instanceof Response && error.status >= 500) {
    return true;
  }

  return false;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Fetch com timeout e retry automático
 *
 * @example
 * ```ts
 * // Básico com timeout padrão de 30s
 * const response = await fetchWithTimeout('https://api.example.com/data');
 *
 * // Com timeout customizado de 10s
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   timeout: 10000
 * });
 *
 * // Com retry automático (3 tentativas)
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   retries: 3,
 *   retryDelay: 2000,
 *   onRetry: (attempt, error) => {
 *     console.log(`Retry ${attempt}: ${error.message}`);
 *   }
 * });
 *
 * // Com cancelamento manual
 * const controller = new AbortController();
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   signal: controller.signal
 * });
 * // Cancelar depois de 5s
 * setTimeout(() => controller.abort(), 5000);
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    onRetry,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  // Tentar até o número de retries
  for (let attempt = 0; attempt < retries; attempt++) {
    // Delay antes de retry (não aplicar na primeira tentativa)
    if (attempt > 0 && retryDelay > 0) {
      await sleep(retryDelay);
    }

    try {
      // Criar um novo AbortController para cada tentativa
      const controller = new AbortController();
      let timeoutId: NodeJS.Timeout | null = null;

      // Se há um signal externo, propagá-lo
      if (externalSignal) {
        // Se o signal externo já foi abortado, abortar imediatamente
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          // Abortar quando o signal externo for abortado
          externalSignal.addEventListener('abort', () => {
            controller.abort();
          });
        }
      }

      // Configurar timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);
      }

      try {
        // Fazer a requisição
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        // Limpar timeout se a requisição completou
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Retornar response imediatamente se for sucesso ou erro client (4xx)
        // Erros 4xx não devem fazer retry (bad request, unauthorized, etc)
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }

        // Erro 5xx - servidor com problema, pode fazer retry
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

        if (attempt < retries - 1 && onRetry) {
          onRetry(attempt + 1, lastError);
        }

        // Continuar para próxima tentativa
        continue;
      } catch (error: unknown) {
        // Limpar timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Verificar se foi timeout
        if (error instanceof Error && error.name === 'AbortError') {
          // Foi abortado - verificar se foi por timeout ou signal externo
          if (externalSignal?.aborted) {
            // Foi o signal externo - não fazer retry
            throw error;
          }
          lastError = new FetchTimeoutError(url, timeout);
        } else if (error instanceof TypeError) {
          // Network error (sem internet, DNS falhou, etc)
          lastError = new FetchNetworkError(url, error);
        } else {
          // Outro erro
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        // Callback de retry
        if (attempt < retries - 1 && onRetry) {
          onRetry(attempt + 1, lastError);
        }

        // Se não é recuperável, lançar imediatamente
        if (!isRetryableError(lastError)) {
          throw lastError;
        }

        // Continuar para próxima tentativa
        continue;
      }
    } catch (error) {
      // Se chegou aqui, capturar erro e continuar
      lastError = error instanceof Error ? error : new Error(String(error));

      // Se não deve fazer retry, lançar
      if (!isRetryableError(lastError)) {
        throw lastError;
      }
    }
  }

  // Se chegou aqui, esgotou todas as tentativas
  throw lastError || new Error('All retries exhausted');
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * GET com timeout
 */
export async function fetchGet(url: string, options?: FetchWithTimeoutOptions): Promise<Response> {
  return fetchWithTimeout(url, { ...options, method: 'GET' });
}

/**
 * POST com timeout
 */
export async function fetchPost(
  url: string,
  body?: BodyInit | object,
  options?: FetchWithTimeoutOptions
): Promise<Response> {
  const finalBody = typeof body === 'object' && !(body instanceof FormData)
    ? JSON.stringify(body)
    : body as BodyInit;

  return fetchWithTimeout(url, {
    ...options,
    method: 'POST',
    body: finalBody,
  });
}

/**
 * PUT com timeout
 */
export async function fetchPut(
  url: string,
  body?: BodyInit | object,
  options?: FetchWithTimeoutOptions
): Promise<Response> {
  const finalBody = typeof body === 'object' && !(body instanceof FormData)
    ? JSON.stringify(body)
    : body as BodyInit;

  return fetchWithTimeout(url, {
    ...options,
    method: 'PUT',
    body: finalBody,
  });
}

/**
 * DELETE com timeout
 */
export async function fetchDelete(url: string, options?: FetchWithTimeoutOptions): Promise<Response> {
  return fetchWithTimeout(url, { ...options, method: 'DELETE' });
}

/**
 * PATCH com timeout
 */
export async function fetchPatch(
  url: string,
  body?: BodyInit | object,
  options?: FetchWithTimeoutOptions
): Promise<Response> {
  const finalBody = typeof body === 'object' && !(body instanceof FormData)
    ? JSON.stringify(body)
    : body as BodyInit;

  return fetchWithTimeout(url, {
    ...options,
    method: 'PATCH',
    body: finalBody,
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default fetchWithTimeout;
