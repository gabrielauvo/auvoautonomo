import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Hook para fazer debounce de um valor
 * Otimização: Reduz re-renders desnecessários em inputs de busca
 *
 * @param value - Valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 500ms)
 * @returns Valor com debounce aplicado
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   // Busca só será executada após 300ms sem digitação
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Configura o timer para atualizar o valor com debounce
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpa o timer se o valor mudar antes do delay
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para fazer debounce de uma função callback
 * Otimização: Evita execuções excessivas de funções pesadas
 *
 * @param callback - Função a ser debounced
 * @param delay - Delay em milissegundos (padrão: 500ms)
 * @returns Função com debounce aplicado
 *
 * @example
 * const debouncedSearch = useDebouncedCallback((term: string) => {
 *   fetchResults(term);
 * }, 300);
 *
 * <input onChange={(e) => debouncedSearch(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay = 500
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Mantém a referência da callback atualizada
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Limpa o timeout quando o componente desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      // Limpa o timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Configura um novo timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * Hook para controlar o estado de loading durante debounce
 * Útil para mostrar indicadores de loading durante a espera
 *
 * @param value - Valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 500ms)
 * @returns [debouncedValue, isDebouncing]
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const [debouncedSearch, isSearching] = useDebouncedValue(searchTerm, 300);
 *
 * {isSearching && <Spinner />}
 */
export function useDebouncedValue<T>(
  value: T,
  delay = 500
): [T, boolean] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    setIsDebouncing(true);

    const timer = setTimeout(() => {
      setDebouncedValue(value);
      setIsDebouncing(false);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return [debouncedValue, isDebouncing];
}
