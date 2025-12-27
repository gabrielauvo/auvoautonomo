/**
 * LazyComponent
 *
 * Componente para lazy loading de módulos pesados em React Native.
 * Reduz o tempo de carregamento inicial e uso de memória em dispositivos low-end.
 *
 * Características:
 * - Carrega componentes sob demanda
 * - Mostra placeholder/loading enquanto carrega
 * - Trata erros de carregamento
 * - Funciona com React.lazy e Suspense
 */

import React, { Suspense, ComponentType, ReactNode, useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../design-system/tokens';

// =============================================================================
// TYPES
// =============================================================================

interface LazyWrapperProps {
  /** Componente a ser renderizado (já importado) */
  children: ReactNode;

  /** Componente de fallback durante loading */
  fallback?: ReactNode;

  /** Altura mínima do placeholder */
  minHeight?: number;
}

interface LazyLoadProps<P extends object> {
  /** Factory function que retorna a Promise do import dinâmico */
  factory: () => Promise<{ default: ComponentType<P> }>;

  /** Props a serem passadas para o componente carregado */
  componentProps: P;

  /** Componente de fallback durante loading */
  fallback?: ReactNode;

  /** Callback quando ocorre erro de carregamento */
  onError?: (error: Error) => void;

  /** Altura mínima do placeholder */
  minHeight?: number;
}

// =============================================================================
// LAZY WRAPPER (para uso com React.lazy)
// =============================================================================

/**
 * Wrapper para componentes que usam React.lazy
 * Fornece Suspense boundary com fallback customizável
 */
export function LazyWrapper({
  children,
  fallback,
  minHeight = 100,
}: LazyWrapperProps) {
  const defaultFallback = (
    <View style={[styles.loadingContainer, { minHeight }]}>
      <ActivityIndicator size="large" color={colors.primary[500]} />
    </View>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

// =============================================================================
// LAZY LOAD COMPONENT (carrega sob demanda)
// =============================================================================

/**
 * Componente que carrega outro componente sob demanda
 * Útil quando o componente não precisa existir até ser necessário
 */
export function LazyLoad<P extends object>({
  factory,
  componentProps,
  fallback,
  onError,
  minHeight = 100,
}: LazyLoadProps<P>) {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const module = await factory();
      setComponent(() => module.default);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load component');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [factory, onError]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      fallback || (
        <View style={[styles.loadingContainer, { minHeight }]}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { minHeight }]}>
        <Text style={styles.errorText}>Erro ao carregar componente</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!Component) {
    return null;
  }

  return <Component {...componentProps} />;
}

// =============================================================================
// CONDITIONAL LAZY LOAD
// =============================================================================

interface ConditionalLazyLoadProps<P extends object> extends Omit<LazyLoadProps<P>, 'factory'> {
  /** Condição para carregar o componente */
  condition: boolean;

  /** Factory function que retorna a Promise do import dinâmico */
  factory: () => Promise<{ default: ComponentType<P> }>;

  /** Placeholder quando condição é falsa */
  placeholder?: ReactNode;
}

/**
 * Carrega componente apenas quando uma condição é atendida
 * Útil para componentes que só aparecem em certas situações
 */
export function ConditionalLazyLoad<P extends object>({
  condition,
  factory,
  componentProps,
  placeholder,
  ...rest
}: ConditionalLazyLoadProps<P>) {
  if (!condition) {
    return <>{placeholder}</> || null;
  }

  return (
    <LazyLoad
      factory={factory}
      componentProps={componentProps}
      {...rest}
    />
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Cria um componente lazy que pode ser usado com LazyWrapper
 * Similar ao React.lazy mas com retry automático
 */
export function createLazyComponent<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  retries = 3,
  delay = 1000
): React.LazyExoticComponent<ComponentType<P>> {
  return React.lazy(async () => {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Wait before retry (with exponential backoff)
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }

    throw lastError || new Error('Failed to load component after retries');
  });
}

// =============================================================================
// PRELOAD HELPER
// =============================================================================

/**
 * Pré-carrega um módulo para que esteja pronto quando necessário
 * Útil para antecipar carregamento de componentes que serão usados em breve
 */
export function preloadComponent<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>
): void {
  // Fire and forget - carrega em background
  factory().catch(() => {
    // Ignore errors during preload
  });
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: 8,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.error[50],
    borderRadius: 8,
    padding: spacing[4],
  },
  errorText: {
    color: colors.error[700],
    fontSize: 14,
    marginBottom: spacing[2],
  },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 4,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LazyLoad;
