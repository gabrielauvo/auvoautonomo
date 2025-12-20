/**
 * useCSRFToken Hook
 *
 * Hook para obter e gerenciar token CSRF para proteção de formulários.
 *
 * SEGURANÇA CRÍTICA:
 * - Use em todos os formulários que fazem POST/PUT/DELETE
 * - Token é armazenado em HttpOnly cookie
 * - Token é validado no servidor
 *
 * @example
 * ```tsx
 * function MyForm() {
 *   const { csrfToken, loading, error } = useCSRFToken();
 *
 *   const handleSubmit = async (data) => {
 *     await fetch('/api/submit', {
 *       method: 'POST',
 *       headers: {
 *         'Content-Type': 'application/json',
 *         'X-CSRF-Token': csrfToken, // Importante!
 *       },
 *       body: JSON.stringify(data),
 *     });
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */

import { useState, useEffect } from 'react';

interface UseCSRFTokenReturn {
  /** Token CSRF para incluir nos headers das requisições */
  csrfToken: string | null;
  /** Indica se está carregando o token */
  loading: boolean;
  /** Erro ao obter token, se houver */
  error: Error | null;
  /** Função para renovar/recarregar o token */
  refresh: () => Promise<void>;
}

/**
 * Hook para obter token CSRF
 *
 * @returns Objeto com token, loading e error
 */
export function useCSRFToken(): UseCSRFTokenReturn {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchToken = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include', // Importante para receber cookie
      });

      if (!response.ok) {
        throw new Error('Falha ao obter token CSRF');
      }

      const data = await response.json();
      setCsrfToken(data.csrfToken);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido');
      setError(error);
      console.error('CSRF token fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, []);

  return {
    csrfToken,
    loading,
    error,
    refresh: fetchToken,
  };
}

/**
 * Helper para adicionar CSRF token aos headers de uma requisição
 *
 * @param headers - Headers existentes
 * @param csrfToken - Token CSRF
 * @returns Headers com CSRF token adicionado
 *
 * @example
 * ```ts
 * const headers = addCSRFHeader({ 'Content-Type': 'application/json' }, csrfToken);
 * ```
 */
export function addCSRFHeader(
  headers: Record<string, string>,
  csrfToken: string | null
): Record<string, string> {
  if (!csrfToken) {
    console.warn('CSRF token not available');
    return headers;
  }

  return {
    ...headers,
    'X-CSRF-Token': csrfToken,
  };
}

/**
 * Helper para criar FormData com CSRF token
 *
 * @param formData - FormData existente ou dados do form
 * @param csrfToken - Token CSRF
 * @returns FormData com CSRF token
 *
 * @example
 * ```ts
 * const formData = new FormData();
 * formData.append('file', file);
 * const secureFormData = addCSRFToFormData(formData, csrfToken);
 * ```
 */
export function addCSRFToFormData(
  formData: FormData | Record<string, any>,
  csrfToken: string | null
): FormData {
  const fd = formData instanceof FormData ? formData : new FormData();

  if (csrfToken) {
    fd.append('_csrf', csrfToken);
  } else {
    console.warn('CSRF token not available');
  }

  if (!(formData instanceof FormData)) {
    // Se recebeu objeto, adiciona todos os campos
    Object.entries(formData).forEach(([key, value]) => {
      if (value instanceof File || value instanceof Blob) {
        fd.append(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((item) => fd.append(key, item));
      } else if (value !== null && value !== undefined) {
        fd.append(key, String(value));
      }
    });
  }

  return fd;
}

export default useCSRFToken;
