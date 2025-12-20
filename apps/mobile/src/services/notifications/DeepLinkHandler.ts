// @ts-nocheck
/**
 * Deep Link Handler
 *
 * Gerencia navegacao para telas especificas quando usuario
 * toca em uma notificacao.
 *
 * Mapeia entity types para rotas do app.
 */

import { router } from 'expo-router';
import { PushNotificationPayload, EntityType, DomainEventType } from './types';

// =============================================================================
// ROUTE MAPPING
// =============================================================================

/**
 * Mapeamento de entidades para rotas base
 */
const ENTITY_ROUTES: Record<EntityType, string> = {
  work_order: '/(tabs)/workorders',
  quote: '/(tabs)/quotes',
  invoice: '/(tabs)/invoices',
  client: '/(tabs)/clients',
  payment: '/(tabs)/payments', // ou outra rota apropriada
};

/**
 * Rotas de detalhe por entidade
 */
const DETAIL_ROUTES: Record<EntityType, (id: string) => string> = {
  work_order: (id) => `/(tabs)/workorders/${id}`,
  quote: (id) => `/(tabs)/quotes/${id}`,
  invoice: (id) => `/(tabs)/invoices/${id}`,
  client: (id) => `/(tabs)/clients/${id}`,
  payment: (id) => `/(tabs)/payments/${id}`,
};

// =============================================================================
// DEEP LINK HANDLER
// =============================================================================

class DeepLinkHandlerClass {
  private isNavigationReady = false;

  /**
   * Marcar navegacao como pronta
   * Deve ser chamado quando o Navigator estiver montado
   */
  setNavigationReady(ready: boolean): void {
    this.isNavigationReady = ready;
  }

  /**
   * Navegar para tela baseado no payload da notificacao
   */
  handleNotificationTap(payload: PushNotificationPayload): void {
    const { entity, entityId, eventType, scopeHint } = payload;

    console.log(`[DeepLinkHandler] Handling tap: ${eventType} for ${entity}/${entityId}`);

    if (!this.isNavigationReady) {
      console.warn('[DeepLinkHandler] Navigation not ready, queueing...');
      // Guardar para processar depois
      this.pendingNavigation = { entity, entityId, eventType, scopeHint };
      return;
    }

    this.navigate(entity, entityId, scopeHint);
  }

  private pendingNavigation: {
    entity: EntityType;
    entityId: string;
    eventType: DomainEventType;
    scopeHint?: string;
  } | null = null;

  /**
   * Processar navegacao pendente (chamar apos navigation ready)
   */
  processPendingNavigation(): void {
    if (!this.pendingNavigation) return;

    const { entity, entityId, scopeHint } = this.pendingNavigation;
    this.pendingNavigation = null;

    this.navigate(entity, entityId, scopeHint as any);
  }

  /**
   * Navegar para a tela apropriada
   */
  private navigate(entity: EntityType, entityId: string, scopeHint?: string): void {
    try {
      // Se scopeHint for 'list' ou nao tivermos entityId, ir para lista
      if (scopeHint === 'list' || !entityId) {
        const listRoute = ENTITY_ROUTES[entity];
        if (listRoute) {
          console.log(`[DeepLinkHandler] Navigating to list: ${listRoute}`);
          router.push(listRoute as any);
          return;
        }
      }

      // Caso contrario, ir para detalhe
      const detailRouteBuilder = DETAIL_ROUTES[entity];
      if (detailRouteBuilder) {
        const detailRoute = detailRouteBuilder(entityId);
        console.log(`[DeepLinkHandler] Navigating to detail: ${detailRoute}`);
        router.push(detailRoute as any);
        return;
      }

      // Fallback: ir para home
      console.log('[DeepLinkHandler] No route found, going to home');
      router.push('/(tabs)' as any);
    } catch (error) {
      console.error('[DeepLinkHandler] Navigation error:', error);
      // Fallback para home em caso de erro
      try {
        router.push('/(tabs)' as any);
      } catch {
        // Ignorar se falhar
      }
    }
  }

  /**
   * Construir URL de deep link para uma entidade
   * Util para criar links compartilhaveis
   */
  buildDeepLink(entity: EntityType, entityId?: string): string {
    const baseScheme = 'auvotech://'; // Configurar no app.json

    if (entityId) {
      return `${baseScheme}${entity}/${entityId}`;
    }

    return `${baseScheme}${entity}`;
  }

  /**
   * Parsear URL de deep link
   */
  parseDeepLink(url: string): { entity: EntityType; entityId?: string } | null {
    try {
      // Remover scheme
      const path = url.replace(/^[a-z]+:\/\//, '');
      const parts = path.split('/');

      if (parts.length === 0) return null;

      const entity = parts[0] as EntityType;
      const entityId = parts[1];

      // Validar entity
      if (!ENTITY_ROUTES[entity]) {
        return null;
      }

      return { entity, entityId };
    } catch {
      return null;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const DeepLinkHandler = new DeepLinkHandlerClass();

export default DeepLinkHandler;
