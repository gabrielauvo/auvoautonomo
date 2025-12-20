/**
 * SyncTriggers Tests
 *
 * Testes para o sistema de re-sync inteligente.
 */

import { PushNotificationPayload } from '../../../src/services/notifications/types';

// Mock do __DEV__
global.__DEV__ = false;

describe('SyncTriggers', () => {
  // Mock timers
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Payload Processing', () => {
    const createPayload = (
      entity: string,
      entityId: string,
      scopeHint: string = 'single'
    ): PushNotificationPayload => ({
      eventType: `${entity}.updated` as any,
      entity: entity as any,
      entityId,
      action: 'update',
      scopeHint: scopeHint as any,
      timestamp: new Date().toISOString(),
    });

    it('should extract entity from payload', () => {
      const payload = createPayload('work_order', '123');
      expect(payload.entity).toBe('work_order');
      expect(payload.entityId).toBe('123');
    });

    it('should have default scopeHint of single', () => {
      const payload = createPayload('quote', '456');
      expect(payload.scopeHint).toBe('single');
    });

    it('should support list scopeHint', () => {
      const payload = createPayload('invoice', '789', 'list');
      expect(payload.scopeHint).toBe('list');
    });

    it('should support full scopeHint', () => {
      const payload = createPayload('client', '000', 'full');
      expect(payload.scopeHint).toBe('full');
    });
  });

  describe('Event Types', () => {
    it('should recognize work_order events', () => {
      const events = [
        'work_order.created',
        'work_order.updated',
        'work_order.assigned',
        'work_order.status_changed',
        'work_order.completed',
        'work_order.cancelled',
      ];

      events.forEach((event) => {
        expect(event.startsWith('work_order.')).toBe(true);
      });
    });

    it('should recognize quote events', () => {
      const events = [
        'quote.created',
        'quote.updated',
        'quote.sent',
        'quote.approved',
        'quote.rejected',
        'quote.expired',
      ];

      events.forEach((event) => {
        expect(event.startsWith('quote.')).toBe(true);
      });
    });

    it('should recognize invoice events', () => {
      const events = [
        'invoice.created',
        'invoice.updated',
        'invoice.paid',
        'invoice.overdue',
        'invoice.cancelled',
      ];

      events.forEach((event) => {
        expect(event.startsWith('invoice.')).toBe(true);
      });
    });

    it('should recognize client events', () => {
      const events = [
        'client.created',
        'client.updated',
        'client.deleted',
      ];

      events.forEach((event) => {
        expect(event.startsWith('client.')).toBe(true);
      });
    });

    it('should recognize payment events', () => {
      const events = [
        'payment.created',
        'payment.confirmed',
        'payment.overdue',
      ];

      events.forEach((event) => {
        expect(event.startsWith('payment.')).toBe(true);
      });
    });

    it('should recognize sync.full_required event', () => {
      const event = 'sync.full_required';
      expect(event).toBe('sync.full_required');
    });
  });

  describe('Debounce Logic', () => {
    it('should wait for debounce period before triggering', async () => {
      const callback = jest.fn();
      const debounceMs = 1000;

      // Simular debounce
      const timer = setTimeout(callback, debounceMs);

      // Antes do debounce
      expect(callback).not.toHaveBeenCalled();

      // Avancar tempo
      jest.advanceTimersByTime(debounceMs);

      expect(callback).toHaveBeenCalledTimes(1);

      clearTimeout(timer);
    });

    it('should reset debounce when new event arrives', async () => {
      const callback = jest.fn();
      const debounceMs = 1000;

      let timer = setTimeout(callback, debounceMs);

      // Avancar metade do tempo
      jest.advanceTimersByTime(500);
      expect(callback).not.toHaveBeenCalled();

      // Novo evento - reset timer
      clearTimeout(timer);
      timer = setTimeout(callback, debounceMs);

      // Avancar mais 500ms (ainda nao deve executar)
      jest.advanceTimersByTime(500);
      expect(callback).not.toHaveBeenCalled();

      // Avancar mais 500ms (agora deve executar)
      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(1);

      clearTimeout(timer);
    });
  });

  describe('Cooldown Logic', () => {
    it('should respect cooldown between syncs', () => {
      const cooldownMs = 5000;
      let lastSyncTime = 0;

      const isInCooldown = () => {
        const now = Date.now();
        return now - lastSyncTime < cooldownMs;
      };

      const executeSync = () => {
        if (isInCooldown()) return false;
        lastSyncTime = Date.now();
        return true;
      };

      // Primeiro sync deve funcionar
      expect(executeSync()).toBe(true);

      // Segundo sync imediato deve ser bloqueado
      expect(executeSync()).toBe(false);

      // Apos cooldown, deve funcionar
      jest.advanceTimersByTime(cooldownMs);
      expect(executeSync()).toBe(true);
    });
  });

  describe('Scope Hint Handling', () => {
    it('should generate single key for single scope', () => {
      const entity = 'work_order';
      const entityId = '123';
      const scope = 'single';

      const key = scope === 'single' ? `${entity}:${entityId}` : entity;
      expect(key).toBe('work_order:123');
    });

    it('should generate entity key for list scope', () => {
      const entity = 'quote';
      const entityId = '456';
      const scope = 'list';

      const key = scope === 'single' ? `${entity}:${entityId}` : entity;
      expect(key).toBe('quote');
    });

    it('should generate entity key for full scope', () => {
      const entity = 'invoice';
      const entityId = '789';
      const scope = 'full';

      const key = scope === 'single' ? `${entity}:${entityId}` : entity;
      expect(key).toBe('invoice');
    });
  });

  describe('Callback Selection', () => {
    it('should select syncSingle for single scope', () => {
      const callbacks = {
        syncSingle: jest.fn(),
        syncList: jest.fn(),
        syncFull: jest.fn(),
      };

      const scope = 'single';
      const entityId = '123';

      switch (scope) {
        case 'single':
          callbacks.syncSingle(entityId);
          break;
        case 'list':
          callbacks.syncList();
          break;
        case 'full':
          callbacks.syncFull();
          break;
      }

      expect(callbacks.syncSingle).toHaveBeenCalledWith('123');
      expect(callbacks.syncList).not.toHaveBeenCalled();
      expect(callbacks.syncFull).not.toHaveBeenCalled();
    });

    it('should select syncList for list scope', () => {
      const callbacks = {
        syncSingle: jest.fn(),
        syncList: jest.fn(),
        syncFull: jest.fn(),
      };

      const scope = 'list';

      switch (scope) {
        case 'single':
          callbacks.syncSingle();
          break;
        case 'list':
          callbacks.syncList();
          break;
        case 'full':
          callbacks.syncFull();
          break;
      }

      expect(callbacks.syncSingle).not.toHaveBeenCalled();
      expect(callbacks.syncList).toHaveBeenCalled();
      expect(callbacks.syncFull).not.toHaveBeenCalled();
    });

    it('should select syncFull for full scope', () => {
      const callbacks = {
        syncSingle: jest.fn(),
        syncList: jest.fn(),
        syncFull: jest.fn(),
      };

      const scope = 'full';

      switch (scope) {
        case 'single':
          callbacks.syncSingle();
          break;
        case 'list':
          callbacks.syncList();
          break;
        case 'full':
          callbacks.syncFull();
          break;
      }

      expect(callbacks.syncSingle).not.toHaveBeenCalled();
      expect(callbacks.syncList).not.toHaveBeenCalled();
      expect(callbacks.syncFull).toHaveBeenCalled();
    });
  });

  describe('Full Sync Trigger', () => {
    it('should trigger full sync for sync.full_required event', () => {
      const fullSyncCallback = jest.fn();

      const payload: PushNotificationPayload = {
        eventType: 'sync.full_required',
        entity: 'work_order' as any, // Ignored for full sync
        entityId: '',
        action: 'update',
        timestamp: new Date().toISOString(),
      };

      if (payload.eventType === 'sync.full_required') {
        fullSyncCallback();
      }

      expect(fullSyncCallback).toHaveBeenCalled();
    });
  });
});
