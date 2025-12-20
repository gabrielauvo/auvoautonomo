'use client';

/**
 * Query Provider - Configuração do React Query
 *
 * Gerencia:
 * - Cache de requisições
 * - Revalidação automática
 * - Estado de loading global
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Tempo de cache padrão: 5 minutos
            staleTime: 5 * 60 * 1000,
            // Tempo de cache em memória: 10 minutos
            gcTime: 10 * 60 * 1000,
            // Retry em caso de erro
            retry: 1,
            // Refetch ao focar na janela
            refetchOnWindowFocus: false,
          },
          mutations: {
            // Retry em mutations
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export default QueryProvider;
