/**
 * useAsyncEffect
 *
 * Hook para executar efeitos assíncronos com cleanup automático.
 * Previne memory leaks de requisições pendentes após unmount.
 *
 * Uso:
 * ```typescript
 * useAsyncEffect(async (signal) => {
 *   const data = await fetchData();
 *   if (!signal.aborted) {
 *     setData(data);
 *   }
 * }, [dependency]);
 * ```
 */

import { useEffect, useRef, DependencyList } from 'react';

type AsyncEffectCallback = (signal: AbortSignal) => Promise<void>;

/**
 * Hook que executa um efeito assíncrono com suporte a cancelamento.
 *
 * @param effect - Função async que recebe um AbortSignal para verificar cancelamento
 * @param deps - Lista de dependências (como useEffect)
 *
 * Features:
 * - Cancela operações pendentes no unmount
 * - Cancela operações pendentes quando dependências mudam
 * - Previne setState após unmount
 * - Compatível com fetch API (suporta signal nativo)
 */
export function useAsyncEffect(
  effect: AsyncEffectCallback,
  deps: DependencyList
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const controller = new AbortController();

    // Executar efeito
    effect(controller.signal).catch((error) => {
      // Ignorar erros de abort
      if (error?.name === 'AbortError') {
        return;
      }
      // Log outros erros
      console.error('[useAsyncEffect] Error:', error);
    });

    // Cleanup: cancelar operações pendentes
    return () => {
      controller.abort();
    };
  }, deps);
}

/**
 * Hook para verificar se o componente ainda está montado.
 * Útil quando não é possível usar AbortSignal.
 *
 * Uso:
 * ```typescript
 * const isMounted = useMountedRef();
 *
 * useEffect(() => {
 *   async function load() {
 *     const data = await fetchData();
 *     if (isMounted.current) {
 *       setData(data);
 *     }
 *   }
 *   load();
 * }, []);
 * ```
 */
export function useMountedRef(): React.MutableRefObject<boolean> {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

/**
 * Hook que combina useAsyncEffect com useFocusEffect.
 * Executa o efeito quando a tela ganha foco e cancela quando perde.
 *
 * Uso:
 * ```typescript
 * useAsyncFocusEffect(async (signal) => {
 *   const data = await fetchData();
 *   if (!signal.aborted) {
 *     setData(data);
 *   }
 * }, [dependency]);
 * ```
 */
export function useAsyncFocusEffect(
  effect: AsyncEffectCallback,
  deps: DependencyList
): void {
  // Import dinâmico para evitar erro se react-navigation não estiver disponível
  const { useFocusEffect } = require('@react-navigation/native');
  const { useCallback } = require('react');

  useFocusEffect(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(() => {
      const controller = new AbortController();

      effect(controller.signal).catch((error) => {
        if (error?.name === 'AbortError') return;
        console.error('[useAsyncFocusEffect] Error:', error);
      });

      return () => {
        controller.abort();
      };
    }, deps)
  );
}

export default useAsyncEffect;
