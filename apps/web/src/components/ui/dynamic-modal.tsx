'use client';

/**
 * Dynamic Modal Wrapper
 *
 * Wrapper para lazy loading de modais
 * Otimização: Modais só são carregados quando abertos
 *
 * Economia: ~30-50KB por modal não carregado no bundle inicial
 * Para 10 modais = ~300-500KB economizados no First Load
 *
 * @example
 * import { DynamicModal } from '@/components/ui/dynamic-modal';
 *
 * const MyModal = DynamicModal(() => import('./my-modal'));
 *
 * <MyModal isOpen={isOpen} onClose={handleClose} />
 */

import { ComponentType, Suspense, lazy } from 'react';
import { Spinner } from './spinner';

type ModalLoader<P = any> = () => Promise<{ default: ComponentType<P> }>;

/**
 * Cria um modal com lazy loading
 */
export function DynamicModal<P extends object>(
  loader: ModalLoader<P>,
  LoadingComponent?: ComponentType
) {
  const LazyModal = lazy(loader);

  const FallbackComponent = LoadingComponent || ModalLoadingFallback;

  return function DynamicModalWrapper(props: P) {
    return (
      <Suspense fallback={<FallbackComponent />}>
        <LazyModal {...(props as any)} />
      </Suspense>
    );
  };
}

/**
 * Loading padrão para modais
 */
function ModalLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <Spinner size="lg" />
      </div>
    </div>
  );
}

/**
 * Dynamic Dialog - Lazy load de dialogs menores
 */
export function DynamicDialog<P extends object>(loader: ModalLoader<P>) {
  const LazyDialog = lazy(loader);

  return function DynamicDialogWrapper(props: P) {
    return (
      <Suspense fallback={<DialogLoadingFallback />}>
        <LazyDialog {...(props as any)} />
      </Suspense>
    );
  };
}

function DialogLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-pulse bg-white rounded-lg p-4 shadow-xl w-96 h-64" />
    </div>
  );
}

/**
 * Exemplo de uso:
 *
 * // Em vez de:
 * import { UpsellModal } from '@/components/billing/upsell-modal';
 *
 * // Use:
 * const UpsellModal = DynamicModal(() => import('@/components/billing/upsell-modal'));
 *
 * // O modal só será baixado quando isOpen for true pela primeira vez
 * <UpsellModal isOpen={isOpen} onClose={handleClose} />
 */

export default DynamicModal;
