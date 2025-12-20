// @ts-nocheck
/**
 * useNotifications Hook
 *
 * Hook React para integrar push notifications no app.
 * Gerencia:
 * - Inicializacao automatica apos login
 * - Handlers de notificacao
 * - Re-sync triggers
 * - Deep link navigation
 *
 * Uso:
 * ```tsx
 * function App() {
 *   useNotifications({
 *     onWorkOrderSync: (id) => syncWorkOrder(id),
 *     onQuoteSync: (id) => syncQuote(id),
 *     // ...
 *   });
 *
 *   return <AppContent />;
 * }
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NotificationService } from './NotificationService';
import { SyncTriggers } from './SyncTriggers';
import { DeepLinkHandler } from './DeepLinkHandler';
import { PushNotificationPayload } from './types';

// =============================================================================
// TYPES
// =============================================================================

interface UseNotificationsOptions {
  /**
   * URL base da API
   */
  apiBaseUrl: string;

  /**
   * Token de autenticacao
   */
  authToken: string | null;

  /**
   * Habilitar notificacoes (default: true quando autenticado)
   */
  enabled?: boolean;

  /**
   * Callbacks de sync por entidade
   */
  onWorkOrderSync?: (entityId?: string) => void | Promise<void>;
  onWorkOrderListSync?: () => void | Promise<void>;

  onQuoteSync?: (entityId?: string) => void | Promise<void>;
  onQuoteListSync?: () => void | Promise<void>;

  onInvoiceSync?: (entityId?: string) => void | Promise<void>;
  onInvoiceListSync?: () => void | Promise<void>;

  onClientSync?: (entityId?: string) => void | Promise<void>;
  onClientListSync?: () => void | Promise<void>;

  onPaymentSync?: (entityId?: string) => void | Promise<void>;
  onPaymentListSync?: () => void | Promise<void>;

  /**
   * Full sync callback
   */
  onFullSync?: () => void | Promise<void>;

  /**
   * Navegacao pronta (passar true quando navigator montado)
   */
  navigationReady?: boolean;

  /**
   * Debug mode
   */
  debug?: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useNotifications(options: UseNotificationsOptions): void {
  const {
    apiBaseUrl,
    authToken,
    enabled = !!authToken,
    onWorkOrderSync,
    onWorkOrderListSync,
    onQuoteSync,
    onQuoteListSync,
    onInvoiceSync,
    onInvoiceListSync,
    onClientSync,
    onClientListSync,
    onPaymentSync,
    onPaymentListSync,
    onFullSync,
    navigationReady = false,
    debug = __DEV__,
  } = options;

  const isInitialized = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // ==========================================================================
  // NOTIFICATION HANDLERS
  // ==========================================================================

  /**
   * Handler para notificacao em foreground
   */
  const handleForeground = useCallback((payload: PushNotificationPayload) => {
    if (debug) {
      console.log('[useNotifications] Foreground notification:', payload);
    }

    // Trigger sync baseado no payload
    SyncTriggers.handleNotification(payload);
  }, [debug]);

  /**
   * Handler para tap em notificacao
   */
  const handleTap = useCallback((payload: PushNotificationPayload) => {
    if (debug) {
      console.log('[useNotifications] Notification tapped:', payload);
    }

    // Navegar para tela
    DeepLinkHandler.handleNotificationTap(payload);

    // Tambem trigger sync
    SyncTriggers.handleNotification(payload);
  }, [debug]);

  /**
   * Handler para app state changes
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    // Quando app volta do background, verificar notificacoes perdidas
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      if (debug) {
        console.log('[useNotifications] App came to foreground');
      }

      // Verificar se tem notificacao que abriu o app
      NotificationService.getLastNotificationResponse()
        .then((payload) => {
          if (payload) {
            handleTap(payload);
          }
        })
        .catch(console.error);
    }

    appStateRef.current = nextAppState;
  }, [debug, handleTap]);

  // ==========================================================================
  // SETUP SYNC TRIGGERS
  // ==========================================================================

  useEffect(() => {
    // Configurar callbacks de sync
    SyncTriggers.configure({ debug });

    SyncTriggers.registerCallbacks({
      work_order: {
        syncSingle: onWorkOrderSync,
        syncList: onWorkOrderListSync,
      },
      quote: {
        syncSingle: onQuoteSync,
        syncList: onQuoteListSync,
      },
      invoice: {
        syncSingle: onInvoiceSync,
        syncList: onInvoiceListSync,
      },
      client: {
        syncSingle: onClientSync,
        syncList: onClientListSync,
      },
      payment: {
        syncSingle: onPaymentSync,
        syncList: onPaymentListSync,
      },
      fullSync: onFullSync,
    });

    return () => {
      SyncTriggers.cleanup();
    };
  }, [
    debug,
    onWorkOrderSync,
    onWorkOrderListSync,
    onQuoteSync,
    onQuoteListSync,
    onInvoiceSync,
    onInvoiceListSync,
    onClientSync,
    onClientListSync,
    onPaymentSync,
    onPaymentListSync,
    onFullSync,
  ]);

  // ==========================================================================
  // SETUP NOTIFICATION SERVICE
  // ==========================================================================

  useEffect(() => {
    if (!enabled || !authToken || !apiBaseUrl) {
      return;
    }

    const initNotifications = async () => {
      if (isInitialized.current) return;

      // Configurar servico
      NotificationService.configure(apiBaseUrl, authToken);

      // Configurar handlers
      NotificationService.setHandlers({
        onForeground: handleForeground,
        onTap: handleTap,
      });

      // Inicializar (solicitar permissao, obter token, registrar device)
      const success = await NotificationService.initialize();

      if (success) {
        isInitialized.current = true;

        if (debug) {
          console.log('[useNotifications] Initialized successfully');
          console.log('[useNotifications] Token:', NotificationService.getToken());
        }

        // Verificar notificacao inicial (app aberto via notificacao)
        const initialPayload = await NotificationService.getLastNotificationResponse();
        if (initialPayload) {
          handleTap(initialPayload);
        }
      }
    };

    initNotifications();

    // Cleanup ao deslogar
    return () => {
      if (isInitialized.current) {
        NotificationService.unregister();
        isInitialized.current = false;
      }
    };
  }, [enabled, authToken, apiBaseUrl, handleForeground, handleTap, debug]);

  // ==========================================================================
  // SETUP APP STATE LISTENER
  // ==========================================================================

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  // ==========================================================================
  // SETUP NAVIGATION
  // ==========================================================================

  useEffect(() => {
    DeepLinkHandler.setNavigationReady(navigationReady);

    if (navigationReady) {
      // Processar navegacao pendente
      DeepLinkHandler.processPendingNavigation();
    }
  }, [navigationReady]);
}

export default useNotifications;
