// @ts-nocheck
/**
 * Sync Triggers
 *
 * Sistema de re-sincronizacao inteligente baseado em push notifications.
 *
 * PRINCIPIOS:
 * 1. Push NAO substitui sync - apenas notifica que existe mudanca
 * 2. Nunca fazer full sync a partir de push (exceto sync.full_required)
 * 3. Usar scopeHint para decidir o que sincronizar
 * 4. Debounce/cooldown para evitar sync excessivo
 *
 * COMPORTAMENTO:
 * - scopeHint='single': sync apenas a entidade especifica
 * - scopeHint='list': refresh da lista daquela entidade
 * - scopeHint='full': full sync (raro, apenas quando necessario)
 */

import { PushNotificationPayload, EntityType, ScopeHint } from './types';

// =============================================================================
// TYPES
// =============================================================================

type SyncCallback = (entityId?: string) => void | Promise<void>;

interface SyncCallbacks {
  work_order?: {
    syncSingle?: SyncCallback;
    syncList?: SyncCallback;
    syncFull?: SyncCallback;
  };
  quote?: {
    syncSingle?: SyncCallback;
    syncList?: SyncCallback;
    syncFull?: SyncCallback;
  };
  invoice?: {
    syncSingle?: SyncCallback;
    syncList?: SyncCallback;
    syncFull?: SyncCallback;
  };
  client?: {
    syncSingle?: SyncCallback;
    syncList?: SyncCallback;
    syncFull?: SyncCallback;
  };
  payment?: {
    syncSingle?: SyncCallback;
    syncList?: SyncCallback;
    syncFull?: SyncCallback;
  };
  fullSync?: () => void | Promise<void>;
}

interface SyncTriggerOptions {
  /**
   * Cooldown em ms entre syncs do mesmo tipo (default: 5000ms)
   */
  cooldownMs?: number;

  /**
   * Debounce em ms para agrupar multiplos triggers (default: 1000ms)
   */
  debounceMs?: number;

  /**
   * Log detalhado de triggers
   */
  debug?: boolean;
}

// =============================================================================
// SYNC TRIGGERS CLASS
// =============================================================================

class SyncTriggersClass {
  private callbacks: SyncCallbacks = {};
  private options: Required<SyncTriggerOptions>;

  // Timestamps do ultimo sync por entidade
  private lastSyncTime: Record<string, number> = {};

  // Timers de debounce pendentes
  private pendingDebounce: Record<string, NodeJS.Timeout> = {};

  // Syncs pendentes (agrupados durante debounce)
  private pendingSyncs: Map<string, { entityId?: string; scope: ScopeHint }> = new Map();

  constructor() {
    this.options = {
      cooldownMs: 5000,
      debounceMs: 1000,
      debug: __DEV__,
    };
  }

  /**
   * Configurar opcoes
   */
  configure(options: SyncTriggerOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Registrar callbacks de sync
   */
  registerCallbacks(callbacks: SyncCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
    this.log('Callbacks registered');
  }

  /**
   * Processar notificacao e triggerar sync apropriado
   */
  handleNotification(payload: PushNotificationPayload): void {
    const { entity, entityId, scopeHint = 'single', eventType } = payload;

    this.log(`Handling notification: ${eventType} for ${entity}/${entityId} (scope: ${scopeHint})`);

    // Caso especial: full sync required
    if (eventType === 'sync.full_required') {
      this.triggerFullSync();
      return;
    }

    // Determinar a chave para debounce/cooldown
    const key = scopeHint === 'single' ? `${entity}:${entityId}` : entity;

    // Verificar cooldown
    if (this.isInCooldown(key)) {
      this.log(`Skipping sync for ${key} - in cooldown`);
      return;
    }

    // Agendar sync com debounce
    this.scheduleSync(entity, entityId, scopeHint);
  }

  /**
   * Forcar sync imediato (bypass debounce/cooldown)
   */
  forceSync(entity: EntityType, entityId?: string, scope: ScopeHint = 'single'): void {
    this.log(`Force sync: ${entity}/${entityId} (scope: ${scope})`);
    this.executeSync(entity, entityId, scope);
  }

  /**
   * Verificar se esta em cooldown
   */
  private isInCooldown(key: string): boolean {
    const lastSync = this.lastSyncTime[key];
    if (!lastSync) return false;

    const elapsed = Date.now() - lastSync;
    return elapsed < this.options.cooldownMs;
  }

  /**
   * Agendar sync com debounce
   */
  private scheduleSync(entity: EntityType, entityId: string, scope: ScopeHint): void {
    const key = scope === 'single' ? `${entity}:${entityId}` : entity;

    // Cancelar debounce existente
    if (this.pendingDebounce[key]) {
      clearTimeout(this.pendingDebounce[key]);
    }

    // Armazenar sync pendente
    this.pendingSyncs.set(key, { entityId, scope });

    // Agendar execucao
    this.pendingDebounce[key] = setTimeout(() => {
      this.executePendingSync(key);
    }, this.options.debounceMs);

    this.log(`Scheduled sync for ${key} in ${this.options.debounceMs}ms`);
  }

  /**
   * Executar sync pendente
   */
  private executePendingSync(key: string): void {
    const pending = this.pendingSyncs.get(key);
    if (!pending) return;

    // Extrair entity do key
    const [entity] = key.split(':') as [EntityType, string];

    // Executar sync
    this.executeSync(entity, pending.entityId, pending.scope);

    // Limpar
    this.pendingSyncs.delete(key);
    delete this.pendingDebounce[key];
  }

  /**
   * Executar sync
   */
  private executeSync(entity: EntityType, entityId: string | undefined, scope: ScopeHint): void {
    const key = scope === 'single' && entityId ? `${entity}:${entityId}` : entity;

    // Atualizar timestamp
    this.lastSyncTime[key] = Date.now();

    // Obter callbacks para a entidade
    const entityCallbacks = this.callbacks[entity];
    if (!entityCallbacks) {
      this.log(`No callbacks for ${entity}`);
      return;
    }

    // Chamar callback apropriado baseado no scope
    try {
      switch (scope) {
        case 'single':
          if (entityCallbacks.syncSingle) {
            this.log(`Executing syncSingle for ${entity}/${entityId}`);
            entityCallbacks.syncSingle(entityId);
          }
          break;

        case 'list':
          if (entityCallbacks.syncList) {
            this.log(`Executing syncList for ${entity}`);
            entityCallbacks.syncList();
          }
          break;

        case 'full':
          if (entityCallbacks.syncFull) {
            this.log(`Executing syncFull for ${entity}`);
            entityCallbacks.syncFull();
          } else if (this.callbacks.fullSync) {
            this.log('Executing fullSync');
            this.callbacks.fullSync();
          }
          break;
      }
    } catch (error) {
      console.error(`[SyncTriggers] Sync error for ${entity}:`, error);
    }
  }

  /**
   * Trigger full sync (caso raro)
   */
  private triggerFullSync(): void {
    this.log('Triggering full sync');

    // Reset cooldowns
    this.lastSyncTime = {};

    // Chamar fullSync callback
    if (this.callbacks.fullSync) {
      this.callbacks.fullSync();
    } else {
      // Fallback: sync todas as entidades
      ['work_order', 'quote', 'invoice', 'client', 'payment'].forEach((entity) => {
        const cb = this.callbacks[entity as EntityType];
        if (cb?.syncFull) {
          cb.syncFull();
        } else if (cb?.syncList) {
          cb.syncList();
        }
      });
    }
  }

  /**
   * Limpar todos os timers pendentes
   */
  cleanup(): void {
    Object.values(this.pendingDebounce).forEach((timer) => clearTimeout(timer));
    this.pendingDebounce = {};
    this.pendingSyncs.clear();
    this.log('Cleanup complete');
  }

  /**
   * Log helper
   */
  private log(message: string): void {
    if (this.options.debug) {
      console.log(`[SyncTriggers] ${message}`);
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const SyncTriggers = new SyncTriggersClass();

export default SyncTriggers;
