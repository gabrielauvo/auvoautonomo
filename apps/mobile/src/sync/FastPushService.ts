/**
 * Fast Push Service (Item 7)
 *
 * Serviço para push rápido de mutações sem sync completo.
 * Implementa:
 * - Debounce/coalescing de múltiplas mutações
 * - Throttling de sync completo
 * - Push apenas (sem pull)
 * - Agendamento de sync completo em baixa prioridade
 *
 * DIAGRAMA DE FLUXO:
 *
 * ANTES (syncAll a cada mutação):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Mutação 1 ──► debounce 2s ──► syncAll() ──┐                            │
 * │  Mutação 2 ──► debounce 2s ──► syncAll() ──┼── Push + Pull (TUDO)       │
 * │  Mutação 3 ──► debounce 2s ──► syncAll() ──┘                            │
 * │                                                                          │
 * │  Problema: Se 5 mutações em 10s → 5 syncs completos                     │
 * │  (mesmo que debounce agrupe algumas, ainda faz pull desnecessário)      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DEPOIS (Fast Push + Throttled Full Sync):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Mutação 1 ──┐                                                          │
 * │  Mutação 2 ──┼── coalesce ──► pushOnly() ──► Push apenas (rápido)       │
 * │  Mutação 3 ──┘  (1.5s)                   │                              │
 * │                                           │                              │
 * │  Mutação 4 ──┐                            │                              │
 * │  Mutação 5 ──┼── coalesce ──► pushOnly() ─┴─► Schedule fullSync         │
 * │                                                  │                       │
 * │                                                  ▼ (throttled: 5min)    │
 * │                                              syncAll() ──► Pull dados   │
 * │                                                                          │
 * │  Benefícios:                                                             │
 * │  - 5 mutações em 10s → 1-2 pushes + 0-1 sync completo                   │
 * │  - Dados chegam no server em <3s                                        │
 * │  - Pull só quando realmente precisa                                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { SYNC_FLAGS } from '../config/syncFlags';
import NetInfo from '@react-native-community/netinfo';

// =============================================================================
// TYPES
// =============================================================================

export interface FastPushMetrics {
  mutationsCoalesced: number;
  pushCount: number;
  lastPushAt: number | null;
  lastFullSyncAt: number | null;
  fullSyncsThrottled: number;
  scheduledFullSyncPending: boolean;
}

export interface FastPushResult {
  pushed: number;
  failed: number;
  coalesced: number;
  fullSyncScheduled: boolean;
}

type PushOnlyFn = () => Promise<{ pushed: number; failed: number }>;
type FullSyncFn = () => Promise<void>;

// =============================================================================
// FAST PUSH SERVICE
// =============================================================================

class FastPushServiceImpl {
  // Debounce timer for coalescing mutations
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Count of mutations waiting in debounce
  private pendingMutationCount: number = 0;

  // Throttle state for full sync
  private lastFullSyncAt: number = 0;
  private scheduledFullSyncTimer: ReturnType<typeof setTimeout> | null = null;

  // Lock to prevent concurrent pushes
  private pushLock: boolean = false;

  // Metrics
  private metrics: FastPushMetrics = {
    mutationsCoalesced: 0,
    pushCount: 0,
    lastPushAt: null,
    lastFullSyncAt: null,
    fullSyncsThrottled: 0,
    scheduledFullSyncPending: false,
  };

  // Callbacks to be injected by SyncEngine
  private pushOnlyFn: PushOnlyFn | null = null;
  private fullSyncFn: FullSyncFn | null = null;

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Configura as funções de push e sync
   * Deve ser chamado pelo SyncEngine durante inicialização
   */
  configure(pushOnly: PushOnlyFn, fullSync: FullSyncFn): void {
    this.pushOnlyFn = pushOnly;
    this.fullSyncFn = fullSync;
    console.log('[FastPushService] Configured');
  }

  /**
   * Verifica se o serviço está configurado
   */
  isConfigured(): boolean {
    return this.pushOnlyFn !== null && this.fullSyncFn !== null;
  }

  // ==========================================================================
  // FAST PUSH (Item 7 Core)
  // ==========================================================================

  /**
   * Notifica que uma mutação foi adicionada
   * Inicia/reinicia o debounce timer para coalescing
   *
   * Chamado pelo MutationQueue.enqueue() quando SYNC_OPT_FAST_PUSH_ONLY = true
   */
  notifyMutationAdded(): void {
    if (!SYNC_FLAGS.SYNC_OPT_FAST_PUSH_ONLY) {
      return; // Feature desativada, usar fluxo original
    }

    this.pendingMutationCount++;
    this.metrics.mutationsCoalesced++;

    console.log(
      `[FastPushService] Mutation added, pending: ${this.pendingMutationCount}, ` +
        `coalesced total: ${this.metrics.mutationsCoalesced}`
    );

    // Verificar se atingiu max buffer → push imediato
    if (this.pendingMutationCount >= SYNC_FLAGS.FAST_PUSH_MAX_BUFFER_SIZE) {
      console.log(
        `[FastPushService] Max buffer size reached (${SYNC_FLAGS.FAST_PUSH_MAX_BUFFER_SIZE}), ` +
          `forcing immediate push`
      );
      this.clearDebounce();
      this.executeFastPush();
      return;
    }

    // Reiniciar debounce timer
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.executeFastPush();
    }, SYNC_FLAGS.FAST_PUSH_DEBOUNCE_MS);
  }

  /**
   * Executa o fast push (apenas mutações, sem pull)
   */
  private async executeFastPush(): Promise<FastPushResult> {
    const coalescedCount = this.pendingMutationCount;
    this.pendingMutationCount = 0;
    this.clearDebounce();

    if (!this.isConfigured()) {
      console.warn('[FastPushService] Not configured, skipping push');
      return { pushed: 0, failed: 0, coalesced: coalescedCount, fullSyncScheduled: false };
    }

    // Verificar concorrência
    if (this.pushLock) {
      console.log('[FastPushService] Push already in progress, skipping');
      return { pushed: 0, failed: 0, coalesced: coalescedCount, fullSyncScheduled: false };
    }

    // Verificar conectividade
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[FastPushService] Offline, skipping push');
      return { pushed: 0, failed: 0, coalesced: coalescedCount, fullSyncScheduled: false };
    }

    this.pushLock = true;

    try {
      console.log(
        `[FastPushService] Executing fast push (${coalescedCount} mutations coalesced)`
      );

      const result = await this.pushOnlyFn!();

      this.metrics.pushCount++;
      this.metrics.lastPushAt = Date.now();

      console.log(
        `[FastPushService] Push complete: ${result.pushed} pushed, ${result.failed} failed`
      );

      // Agendar sync completo se configurado
      let fullSyncScheduled = false;
      if (SYNC_FLAGS.FAST_PUSH_SCHEDULE_FULL_SYNC) {
        fullSyncScheduled = this.scheduleFullSync();
      }

      return {
        pushed: result.pushed,
        failed: result.failed,
        coalesced: coalescedCount,
        fullSyncScheduled,
      };
    } catch (error) {
      console.error('[FastPushService] Push failed:', error);
      return { pushed: 0, failed: coalescedCount, coalesced: coalescedCount, fullSyncScheduled: false };
    } finally {
      this.pushLock = false;
    }
  }

  // ==========================================================================
  // THROTTLED FULL SYNC
  // ==========================================================================

  /**
   * Agenda sync completo respeitando throttle
   * Retorna true se agendou, false se já havia agendamento ou throttle ativo
   */
  private scheduleFullSync(): boolean {
    // Já tem sync agendado?
    if (this.scheduledFullSyncTimer !== null) {
      console.log('[FastPushService] Full sync already scheduled');
      return false;
    }

    const now = Date.now();
    const timeSinceLastSync = now - this.lastFullSyncAt;
    const throttleMs = SYNC_FLAGS.FULL_SYNC_THROTTLE_MS;

    // Throttle ativo?
    if (timeSinceLastSync < throttleMs) {
      const remainingMs = throttleMs - timeSinceLastSync;
      console.log(
        `[FastPushService] Throttle active, scheduling full sync in ${Math.round(remainingMs / 1000)}s`
      );

      this.metrics.fullSyncsThrottled++;
      this.metrics.scheduledFullSyncPending = true;

      this.scheduledFullSyncTimer = setTimeout(() => {
        this.executeScheduledFullSync();
      }, remainingMs);

      return true;
    }

    // Pode executar agora, mas vamos agendar para dar prioridade ao UI
    console.log('[FastPushService] Scheduling full sync for next tick');
    this.metrics.scheduledFullSyncPending = true;

    this.scheduledFullSyncTimer = setTimeout(() => {
      this.executeScheduledFullSync();
    }, 100); // Pequeno delay para não bloquear UI

    return true;
  }

  /**
   * Executa o sync completo agendado
   */
  private async executeScheduledFullSync(): Promise<void> {
    this.scheduledFullSyncTimer = null;
    this.metrics.scheduledFullSyncPending = false;

    if (!this.isConfigured()) {
      console.warn('[FastPushService] Not configured, skipping scheduled sync');
      return;
    }

    // Verificar condições
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[FastPushService] Offline, skipping scheduled sync');
      return;
    }

    // Verificar preferência de WiFi
    if (SYNC_FLAGS.FULL_SYNC_PREFER_WIFI && netInfo.type !== 'wifi') {
      console.log('[FastPushService] Prefer WiFi, skipping scheduled sync on cellular');
      // Re-agendar para mais tarde
      this.scheduleFullSync();
      return;
    }

    console.log('[FastPushService] Executing scheduled full sync');

    try {
      await this.fullSyncFn!();
      this.lastFullSyncAt = Date.now();
      this.metrics.lastFullSyncAt = this.lastFullSyncAt;
      console.log('[FastPushService] Scheduled full sync complete');
    } catch (error) {
      console.error('[FastPushService] Scheduled full sync failed:', error);
    }
  }

  /**
   * Marca que um sync completo foi executado (por qualquer caminho)
   * Chamado pelo SyncEngine após syncAll()
   */
  notifyFullSyncCompleted(): void {
    this.lastFullSyncAt = Date.now();
    this.metrics.lastFullSyncAt = this.lastFullSyncAt;

    // Cancelar sync agendado se houver
    if (this.scheduledFullSyncTimer !== null) {
      clearTimeout(this.scheduledFullSyncTimer);
      this.scheduledFullSyncTimer = null;
      this.metrics.scheduledFullSyncPending = false;
      console.log('[FastPushService] Cancelled scheduled full sync (manual sync completed)');
    }
  }

  /**
   * Verifica se pode executar sync completo (não está em throttle)
   */
  canExecuteFullSync(): boolean {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastFullSyncAt;
    return timeSinceLastSync >= SYNC_FLAGS.FULL_SYNC_THROTTLE_MS;
  }

  /**
   * Tempo restante até poder fazer sync completo (ms)
   * Retorna 0 se pode executar agora
   */
  getThrottleRemainingMs(): number {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastFullSyncAt;
    const remaining = SYNC_FLAGS.FULL_SYNC_THROTTLE_MS - timeSinceLastSync;
    return Math.max(0, remaining);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Limpa o debounce timer
   */
  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Força push imediato (ignora debounce)
   * Útil para cenários onde o usuário sai do app
   */
  async flushNow(): Promise<FastPushResult> {
    console.log('[FastPushService] Flush now requested');
    return this.executeFastPush();
  }

  /**
   * Cancela todos os timers pendentes
   * Útil para cleanup ou testes
   */
  cancelAll(): void {
    this.clearDebounce();
    if (this.scheduledFullSyncTimer !== null) {
      clearTimeout(this.scheduledFullSyncTimer);
      this.scheduledFullSyncTimer = null;
    }
    this.pendingMutationCount = 0;
    this.metrics.scheduledFullSyncPending = false;
    console.log('[FastPushService] All timers cancelled');
  }

  /**
   * Retorna métricas para observabilidade
   */
  getMetrics(): FastPushMetrics {
    return { ...this.metrics };
  }

  /**
   * Reseta métricas (para testes)
   */
  resetMetrics(): void {
    this.metrics = {
      mutationsCoalesced: 0,
      pushCount: 0,
      lastPushAt: null,
      lastFullSyncAt: null,
      fullSyncsThrottled: 0,
      scheduledFullSyncPending: false,
    };
  }

  /**
   * Verifica se há push pendente (debounce ativo)
   */
  hasPendingPush(): boolean {
    return this.debounceTimer !== null || this.pendingMutationCount > 0;
  }

  /**
   * Retorna contagem de mutações aguardando push
   */
  getPendingCount(): number {
    return this.pendingMutationCount;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const FastPushService = new FastPushServiceImpl();

export default FastPushService;
