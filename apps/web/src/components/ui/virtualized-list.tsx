'use client';

/**
 * VirtualizedList Component
 *
 * Renderiza apenas os itens visíveis na viewport para melhorar performance
 * em listas com mais de 100 items.
 *
 * Otimização: Em vez de renderizar 1000+ items, renderiza apenas ~20 visíveis
 * Economia: ~98% menos DOM nodes, ~95% menos re-renders
 *
 * @example
 * <VirtualizedList
 *   items={largeArray}
 *   itemHeight={80}
 *   renderItem={(item, index) => <div key={item.id}>{item.name}</div>}
 * />
 */

import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';

export interface VirtualizedListProps<T> {
  /** Array de items para renderizar */
  items: T[];

  /** Altura de cada item em pixels (deve ser consistente) */
  itemHeight: number;

  /** Função para renderizar cada item */
  renderItem: (item: T, index: number) => ReactNode;

  /** Altura do container em pixels (padrão: 600px) */
  height?: number;

  /** Número de items extras para renderizar fora da viewport (padrão: 3) */
  overscan?: number;

  /** ClassName adicional para o container */
  className?: string;

  /** Callback quando scroll atinge o fim (útil para infinite scroll) */
  onEndReached?: () => void;

  /** Distância do fim para disparar onEndReached (padrão: 200px) */
  endReachedThreshold?: number;

  /** Loading state para mostrar skeleton no fim */
  isLoading?: boolean;

  /** Componente de loading para mostrar no fim */
  loadingComponent?: ReactNode;

  /** Mensagem de lista vazia */
  emptyComponent?: ReactNode;
}

/**
 * Hook para calcular quais items devem ser renderizados
 */
function useVirtualization(
  itemCount: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number,
  scrollTop: number
) {
  // Calcula o índice do primeiro item visível
  const startIndex = Math.floor(scrollTop / itemHeight);

  // Calcula quantos items cabem na viewport
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  // Adiciona overscan (items extras) para scroll suave
  const start = Math.max(0, startIndex - overscan);
  const end = Math.min(itemCount - 1, startIndex + visibleCount + overscan);

  // Offset para posicionar os items corretamente
  const offsetY = start * itemHeight;

  return { start, end, offsetY };
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  height = 600,
  overscan = 3,
  className = '',
  onEndReached,
  endReachedThreshold = 200,
  isLoading = false,
  loadingComponent,
  emptyComponent,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEndReachedRef = useRef(false);

  // Calcula a altura total da lista (virtual)
  const totalHeight = items.length * itemHeight;

  // Calcula quais items renderizar
  const { start, end, offsetY } = useVirtualization(
    items.length,
    itemHeight,
    height,
    overscan,
    scrollTop
  );

  // Items visíveis
  const visibleItems = items.slice(start, end + 1);

  // Handler de scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);

      // Detecta scroll no fim para infinite scroll
      if (onEndReached) {
        const scrolledToBottom =
          target.scrollHeight - target.scrollTop - target.clientHeight <=
          endReachedThreshold;

        if (scrolledToBottom && !lastEndReachedRef.current && !isLoading) {
          lastEndReachedRef.current = true;
          onEndReached();
        } else if (!scrolledToBottom) {
          lastEndReachedRef.current = false;
        }
      }
    },
    [onEndReached, endReachedThreshold, isLoading]
  );

  // Reset scroll quando items mudam significativamente
  useEffect(() => {
    if (containerRef.current && items.length === 0) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  // Lista vazia
  if (items.length === 0 && emptyComponent) {
    return <div className={className}>{emptyComponent}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      {/* Container virtual com altura total */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Items visíveis posicionados absolutamente */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div
              key={start + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, start + index)}
            </div>
          ))}
        </div>

        {/* Loading no fim da lista */}
        {isLoading && loadingComponent && (
          <div
            style={{
              position: 'absolute',
              top: totalHeight,
              left: 0,
              right: 0,
            }}
          >
            {loadingComponent}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Variante para grids virtualizados
 * Útil para catálogos de produtos com cards
 */
export interface VirtualizedGridProps<T> {
  items: T[];
  itemHeight: number;
  itemsPerRow: number;
  renderItem: (item: T, index: number) => ReactNode;
  height?: number;
  gap?: number;
  className?: string;
  emptyComponent?: ReactNode;
}

export function VirtualizedGrid<T>({
  items,
  itemHeight,
  itemsPerRow,
  renderItem,
  height = 600,
  gap = 16,
  className = '',
  emptyComponent,
}: VirtualizedGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calcula altura da row (altura do item + gap)
  const rowHeight = itemHeight + gap;

  // Calcula número de rows
  const rowCount = Math.ceil(items.length / itemsPerRow);
  const totalHeight = rowCount * rowHeight;

  // Calcula quais rows renderizar
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const visibleRows = Math.ceil(height / rowHeight);
  const endRow = Math.min(rowCount - 1, startRow + visibleRows + 2);

  // Calcula offset
  const offsetY = startRow * rowHeight;

  // Items visíveis
  const startIndex = startRow * itemsPerRow;
  const endIndex = Math.min(items.length, (endRow + 1) * itemsPerRow);
  const visibleItems = items.slice(startIndex, endIndex);

  // Handler de scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  if (items.length === 0 && emptyComponent) {
    return <div className={className}>{emptyComponent}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
              gap,
            }}
          >
            {visibleItems.map((item, index) => (
              <div key={startIndex + index}>
                {renderItem(item, startIndex + index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook para detecção automática de item height
 * Útil quando os items têm altura variável
 */
export function useItemHeightMeasure() {
  const [heights, setHeights] = useState<Map<number, number>>(new Map());
  const observer = useRef<ResizeObserver | null>(null);

  const measureRef = useCallback((element: HTMLElement | null, index: number) => {
    if (!element) return;

    if (!observer.current) {
      observer.current = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const idx = parseInt(entry.target.getAttribute('data-index') || '0');
          const height = entry.contentRect.height;

          setHeights((prev) => {
            const next = new Map(prev);
            next.set(idx, height);
            return next;
          });
        });
      });
    }

    element.setAttribute('data-index', String(index));
    observer.current.observe(element);
  }, []);

  useEffect(() => {
    return () => {
      observer.current?.disconnect();
    };
  }, []);

  const getHeight = (index: number, defaultHeight = 80) => {
    return heights.get(index) || defaultHeight;
  };

  return { measureRef, getHeight, heights };
}

export default VirtualizedList;
