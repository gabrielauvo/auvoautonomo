/**
 * useImagePrefetch
 *
 * Hook para prefetch de imagens em listas virtualizadas.
 * Carrega imagens antes de ficarem visíveis para UX mais fluida.
 *
 * Uso com FlashList:
 * ```typescript
 * const { onViewableItemsChanged } = useImagePrefetch({
 *   items,
 *   getImageUrl: (item) => item.imageUrl,
 *   prefetchAhead: 10,
 * });
 *
 * <FlashList
 *   data={items}
 *   onViewableItemsChanged={onViewableItemsChanged}
 *   ...
 * />
 * ```
 */

import { useCallback, useRef } from 'react';
import { Image } from 'react-native';
import type { ViewToken } from '@react-native/virtualized-lists';

interface UseImagePrefetchOptions<T> {
  /** Lista de itens */
  items: T[];

  /** Função para extrair URL da imagem de um item */
  getImageUrl: (item: T) => string | undefined | null;

  /** Quantas imagens prefetch além das visíveis */
  prefetchAhead?: number;

  /** Máximo de prefetches simultâneos */
  maxConcurrent?: number;

  /** Callback quando imagem é prefetchada */
  onPrefetch?: (url: string, success: boolean) => void;
}

interface PrefetchState {
  prefetched: Set<string>;
  pending: Set<string>;
}

/**
 * Hook para prefetch de imagens em listas
 */
export function useImagePrefetch<T>({
  items,
  getImageUrl,
  prefetchAhead = 10,
  maxConcurrent = 3,
  onPrefetch,
}: UseImagePrefetchOptions<T>) {
  const stateRef = useRef<PrefetchState>({
    prefetched: new Set(),
    pending: new Set(),
  });

  /**
   * Prefetch de uma lista de URLs
   */
  const prefetchUrls = useCallback(
    async (urls: string[]) => {
      const state = stateRef.current;

      // Filtrar URLs já processadas
      const toPrefetch = urls.filter(
        (url) => url && !state.prefetched.has(url) && !state.pending.has(url)
      );

      if (toPrefetch.length === 0) return;

      // Limitar concorrência
      const batch = toPrefetch.slice(0, maxConcurrent);

      // Marcar como pendentes
      batch.forEach((url) => state.pending.add(url));

      // Prefetch em paralelo
      await Promise.all(
        batch.map(async (url) => {
          try {
            await Image.prefetch(url);
            state.prefetched.add(url);
            onPrefetch?.(url, true);
          } catch (error) {
            // Ignorar erros de prefetch (imagem pode não existir)
            onPrefetch?.(url, false);
          } finally {
            state.pending.delete(url);
          }
        })
      );

      // Continuar com próximo batch se houver mais
      const remaining = toPrefetch.slice(maxConcurrent);
      if (remaining.length > 0) {
        // Yield para event loop
        await new Promise((resolve) => setTimeout(resolve, 0));
        await prefetchUrls(remaining);
      }
    },
    [maxConcurrent, onPrefetch]
  );

  /**
   * Callback para onViewableItemsChanged do FlashList/FlatList
   */
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      if (viewableItems.length === 0) return;

      // Encontrar índice do último item visível
      const lastVisibleIndex = Math.max(
        ...viewableItems.map((item) => item.index ?? 0)
      );

      // Calcular range de prefetch
      const startIndex = lastVisibleIndex + 1;
      const endIndex = Math.min(startIndex + prefetchAhead, items.length);

      // Extrair URLs dos próximos itens
      const urlsToPrefetch: string[] = [];
      for (let i = startIndex; i < endIndex; i++) {
        const item = items[i];
        if (item) {
          const url = getImageUrl(item);
          if (url) {
            urlsToPrefetch.push(url);
          }
        }
      }

      // Prefetch em background
      if (urlsToPrefetch.length > 0) {
        prefetchUrls(urlsToPrefetch);
      }
    },
    [items, getImageUrl, prefetchAhead, prefetchUrls]
  );

  /**
   * Prefetch manual de URLs específicas
   */
  const prefetch = useCallback(
    (urls: string[]) => {
      prefetchUrls(urls);
    },
    [prefetchUrls]
  );

  /**
   * Limpar cache de prefetch
   */
  const clear = useCallback(() => {
    stateRef.current.prefetched.clear();
    stateRef.current.pending.clear();
  }, []);

  return {
    onViewableItemsChanged,
    prefetch,
    clear,
    prefetchedCount: stateRef.current.prefetched.size,
  };
}

export default useImagePrefetch;
