/**
 * API Client - HTTP Client para comunicação com o backend
 *
 * Configuração centralizada de requisições HTTP com:
 * - Base URL configurável
 * - Interceptors para token de autenticação
 * - Tratamento de erros 401 (redirect para login)
 * - Retry com exponential backoff
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

// Configuração da URL base do backend (usada para uploads e URLs absolutas)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// URL do proxy para requisições autenticadas (usa cookies HttpOnly)
// Isso resolve o problema de autenticação com cookies HttpOnly
const PROXY_BASE_URL = '/api/proxy';

/**
 * Constrói URL completa para recursos estáticos do backend (uploads)
 * URLs relativas (/uploads/...) são prefixadas com a URL base
 * URLs absolutas (http://...) são retornadas sem modificação
 */
export function getUploadUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Se já é URL absoluta, retorna como está
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Prefixar com URL base do backend
  return `${API_BASE_URL}${path}`;
}

// Token storage key
export const AUTH_TOKEN_KEY = 'auth_token';

// Configuração de retry
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 segundo

/**
 * Sleep helper para retry delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Instância do Axios configurada
 *
 * SEGURANÇA:
 * - withCredentials: envia cookies HttpOnly automaticamente
 * - timeout: previne requisições longas (DoS)
 * - baseURL validada via env var
 */
export const api = axios.create({
  baseURL: PROXY_BASE_URL, // Usa proxy para autenticação via HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos (ajustado para uploads)
  withCredentials: true, // CRÍTICO: Envia cookies HttpOnly
});

/**
 * Interceptor de Request
 * NOTA: Token é adicionado automaticamente pelo proxy /api/proxy via cookies HttpOnly
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Token é gerenciado pelo proxy, não precisa adicionar aqui
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Interceptor de Response - Trata erros de autenticação e retry
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

    // Se receber 401, NÃO redireciona automaticamente
    // O auth-context é responsável por gerenciar estado de autenticação
    // Isso evita loops de redirect quando múltiplas chamadas falham simultaneamente
    if (error.response?.status === 401) {
      // Apenas loga o erro, deixa a aplicação decidir o que fazer
      console.warn('[API] Unauthorized (401):', config?.url);
    }

    // Tratamento específico para erro 403 (Forbidden)
    if (error.response?.status === 403) {
      const errorMessage = (error.response?.data as any)?.message || 'Acesso negado';
      return Promise.reject(new Error(errorMessage));
    }

    // Retry com exponential backoff para erros de rede ou 5xx
    const shouldRetry =
      !error.response || // Erro de rede
      (error.response.status >= 500 && error.response.status < 600); // Erro do servidor

    if (shouldRetry && config && (!config._retryCount || config._retryCount < MAX_RETRIES)) {
      config._retryCount = config._retryCount || 0;
      config._retryCount++;

      // Calcula delay com exponential backoff
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, config._retryCount - 1);

      await sleep(delay);

      return api(config);
    }

    return Promise.reject(error);
  }
);

/**
 * Helper para extrair mensagem de erro
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    return axiosError.response?.data?.message || axiosError.message || 'Erro de conexão';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Erro desconhecido';
}

/**
 * Helper para verificar se erro é de rede
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response && error.code === 'ERR_NETWORK';
  }
  return false;
}

export default api;
