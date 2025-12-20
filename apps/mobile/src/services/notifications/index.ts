/**
 * Notifications Module
 *
 * Exporta servicos de push notifications:
 * - NotificationService: gerencia push tokens e recebimento
 * - SyncTriggers: re-sync inteligente baseado em notificacoes
 * - DeepLinkHandler: navegacao a partir de notificacoes
 * - useNotifications: hook para integracao facil
 */

export { NotificationService } from './NotificationService';
export { SyncTriggers } from './SyncTriggers';
export { DeepLinkHandler } from './DeepLinkHandler';
export { useNotifications } from './useNotifications';
export * from './types';
