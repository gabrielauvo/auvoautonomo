/**
 * DeepLinkHandler Tests
 *
 * Testes para o sistema de deep link navigation.
 */

import { EntityType, PushNotificationPayload } from '../../../src/services/notifications/types';

describe('DeepLinkHandler', () => {
  describe('Route Mapping', () => {
    const ENTITY_ROUTES: Record<EntityType, string> = {
      work_order: '/(tabs)/workorders',
      quote: '/(tabs)/quotes',
      invoice: '/(tabs)/invoices',
      client: '/(tabs)/clients',
      payment: '/(tabs)/payments',
    };

    it('should map work_order to correct route', () => {
      expect(ENTITY_ROUTES['work_order']).toBe('/(tabs)/workorders');
    });

    it('should map quote to correct route', () => {
      expect(ENTITY_ROUTES['quote']).toBe('/(tabs)/quotes');
    });

    it('should map invoice to correct route', () => {
      expect(ENTITY_ROUTES['invoice']).toBe('/(tabs)/invoices');
    });

    it('should map client to correct route', () => {
      expect(ENTITY_ROUTES['client']).toBe('/(tabs)/clients');
    });

    it('should map payment to correct route', () => {
      expect(ENTITY_ROUTES['payment']).toBe('/(tabs)/payments');
    });
  });

  describe('Detail Route Building', () => {
    const DETAIL_ROUTES: Record<EntityType, (id: string) => string> = {
      work_order: (id) => `/(tabs)/workorders/${id}`,
      quote: (id) => `/(tabs)/quotes/${id}`,
      invoice: (id) => `/(tabs)/invoices/${id}`,
      client: (id) => `/(tabs)/clients/${id}`,
      payment: (id) => `/(tabs)/payments/${id}`,
    };

    it('should build work_order detail route', () => {
      expect(DETAIL_ROUTES['work_order']('wo-123')).toBe('/(tabs)/workorders/wo-123');
    });

    it('should build quote detail route', () => {
      expect(DETAIL_ROUTES['quote']('qt-456')).toBe('/(tabs)/quotes/qt-456');
    });

    it('should build invoice detail route', () => {
      expect(DETAIL_ROUTES['invoice']('inv-789')).toBe('/(tabs)/invoices/inv-789');
    });

    it('should build client detail route', () => {
      expect(DETAIL_ROUTES['client']('cli-000')).toBe('/(tabs)/clients/cli-000');
    });

    it('should build payment detail route', () => {
      expect(DETAIL_ROUTES['payment']('pay-111')).toBe('/(tabs)/payments/pay-111');
    });
  });

  describe('Navigation Decision', () => {
    const shouldNavigateToDetail = (
      entityId: string | undefined,
      scopeHint: string | undefined
    ): boolean => {
      return scopeHint !== 'list' && !!entityId;
    };

    it('should navigate to detail for single scope with entityId', () => {
      expect(shouldNavigateToDetail('123', 'single')).toBe(true);
    });

    it('should navigate to list for list scope', () => {
      expect(shouldNavigateToDetail('123', 'list')).toBe(false);
    });

    it('should navigate to list when no entityId', () => {
      expect(shouldNavigateToDetail(undefined, 'single')).toBe(false);
    });

    it('should navigate to detail for full scope with entityId', () => {
      expect(shouldNavigateToDetail('123', 'full')).toBe(true);
    });

    it('should navigate to detail when scopeHint is undefined', () => {
      expect(shouldNavigateToDetail('123', undefined)).toBe(true);
    });
  });

  describe('Deep Link URL Building', () => {
    const buildDeepLink = (entity: EntityType, entityId?: string): string => {
      const baseScheme = 'auvotech://';
      if (entityId) {
        return `${baseScheme}${entity}/${entityId}`;
      }
      return `${baseScheme}${entity}`;
    };

    it('should build deep link with entityId', () => {
      expect(buildDeepLink('work_order', 'wo-123')).toBe('auvotech://work_order/wo-123');
    });

    it('should build deep link without entityId', () => {
      expect(buildDeepLink('quote')).toBe('auvotech://quote');
    });
  });

  describe('Deep Link URL Parsing', () => {
    const parseDeepLink = (url: string): { entity: EntityType; entityId?: string } | null => {
      try {
        const path = url.replace(/^[a-z]+:\/\//, '');
        const parts = path.split('/');

        if (parts.length === 0) return null;

        const entity = parts[0] as EntityType;
        const entityId = parts[1];

        const validEntities = ['work_order', 'quote', 'invoice', 'client', 'payment'];
        if (!validEntities.includes(entity)) {
          return null;
        }

        return { entity, entityId };
      } catch {
        return null;
      }
    };

    it('should parse deep link with entityId', () => {
      const result = parseDeepLink('auvotech://work_order/wo-123');
      expect(result).toEqual({ entity: 'work_order', entityId: 'wo-123' });
    });

    it('should parse deep link without entityId', () => {
      const result = parseDeepLink('auvotech://quote');
      expect(result).toEqual({ entity: 'quote', entityId: undefined });
    });

    it('should return null for invalid entity', () => {
      const result = parseDeepLink('auvotech://invalid_entity/123');
      expect(result).toBeNull();
    });

    it('should handle different URL schemes', () => {
      const result = parseDeepLink('myapp://invoice/inv-456');
      expect(result).toEqual({ entity: 'invoice', entityId: 'inv-456' });
    });
  });

  describe('Payload Handling', () => {
    const createPayload = (
      entity: EntityType,
      entityId: string,
      scopeHint?: 'single' | 'list' | 'full'
    ): PushNotificationPayload => ({
      eventType: `${entity}.updated` as any,
      entity,
      entityId,
      action: 'update',
      scopeHint,
      timestamp: new Date().toISOString(),
    });

    it('should extract entity and entityId from payload', () => {
      const payload = createPayload('work_order', 'wo-123');
      expect(payload.entity).toBe('work_order');
      expect(payload.entityId).toBe('wo-123');
    });

    it('should extract scopeHint from payload', () => {
      const payload = createPayload('quote', 'qt-456', 'list');
      expect(payload.scopeHint).toBe('list');
    });

    it('should handle undefined scopeHint', () => {
      const payload = createPayload('invoice', 'inv-789');
      expect(payload.scopeHint).toBeUndefined();
    });
  });

  describe('Navigation Queue', () => {
    let pendingNavigation: { entity: EntityType; entityId: string } | null = null;
    let isNavigationReady = false;

    const queueNavigation = (entity: EntityType, entityId: string) => {
      if (!isNavigationReady) {
        pendingNavigation = { entity, entityId };
        return false;
      }
      pendingNavigation = null;
      return true;
    };

    const processPendingNavigation = (): { entity: EntityType; entityId: string } | null => {
      if (!isNavigationReady || !pendingNavigation) return null;
      const pending = pendingNavigation;
      pendingNavigation = null;
      return pending;
    };

    beforeEach(() => {
      pendingNavigation = null;
      isNavigationReady = false;
    });

    it('should queue navigation when not ready', () => {
      expect(queueNavigation('work_order', 'wo-123')).toBe(false);
      expect(pendingNavigation).toEqual({ entity: 'work_order', entityId: 'wo-123' });
    });

    it('should navigate immediately when ready', () => {
      isNavigationReady = true;
      expect(queueNavigation('quote', 'qt-456')).toBe(true);
      expect(pendingNavigation).toBeNull();
    });

    it('should process pending navigation when ready', () => {
      queueNavigation('invoice', 'inv-789');
      expect(pendingNavigation).not.toBeNull();

      isNavigationReady = true;
      const pending = processPendingNavigation();
      expect(pending).toEqual({ entity: 'invoice', entityId: 'inv-789' });
      expect(pendingNavigation).toBeNull();
    });

    it('should return null if no pending navigation', () => {
      isNavigationReady = true;
      const pending = processPendingNavigation();
      expect(pending).toBeNull();
    });
  });
});
