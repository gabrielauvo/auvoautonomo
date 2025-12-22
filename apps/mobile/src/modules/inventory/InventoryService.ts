/**
 * Inventory Service
 *
 * Serviço de alto nível para operações de estoque.
 * Gerencia lógica de negócio, validações e integração com sync offline.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  InventoryRepository,
  InventorySettings,
  InventoryBalance,
  InventoryMovement,
  InventoryMovementOutbox,
} from './InventoryRepository';

// =============================================================================
// TYPES
// =============================================================================

export interface AdjustStockInput {
  itemId: string;
  newQuantity: number;
  notes?: string;
}

export interface InventoryStats {
  totalProducts: number;
  totalQuantity: number;
  lowStockCount: number;
  pendingSyncCount: number;
}

export interface InventoryServiceError extends Error {
  code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'NEGATIVE_STOCK' | 'NOT_CONFIGURED';
}

// =============================================================================
// SERVICE
// =============================================================================

class InventoryServiceClass {
  private userId: string | null = null;

  /**
   * Configurar o serviço com o ID do usuário
   */
  configure(userId: string): void {
    this.userId = userId;
  }

  /**
   * Obter ID do usuário configurado
   */
  private getUserId(): string {
    if (!this.userId) {
      const error = new Error('InventoryService not configured. Call configure() first.') as InventoryServiceError;
      error.code = 'NOT_CONFIGURED';
      throw error;
    }
    return this.userId;
  }

  // ===========================================================================
  // SETTINGS
  // ===========================================================================

  /**
   * Obter configurações de estoque do usuário
   */
  async getSettings(): Promise<InventorySettings | null> {
    return InventoryRepository.getSettings(this.getUserId());
  }

  /**
   * Verificar se o módulo de estoque está habilitado
   */
  async isEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings?.isEnabled === 1;
  }

  /**
   * Obter status de dedução configurado
   */
  async getDeductOnStatus(): Promise<string> {
    const settings = await this.getSettings();
    return settings?.deductOnStatus || 'DONE';
  }

  /**
   * Verificar se permite estoque negativo
   */
  async allowsNegativeStock(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings?.allowNegativeStock === 1;
  }

  // ===========================================================================
  // BALANCES
  // ===========================================================================

  /**
   * Listar todos os saldos de estoque
   */
  async getBalances(): Promise<InventoryBalance[]> {
    return InventoryRepository.getBalances(this.getUserId());
  }

  /**
   * Obter saldo de um item específico
   */
  async getBalance(itemId: string): Promise<InventoryBalance | null> {
    return InventoryRepository.getBalanceByItemId(itemId);
  }

  /**
   * Buscar saldos por texto
   */
  async searchBalances(query: string): Promise<InventoryBalance[]> {
    return InventoryRepository.searchBalances(this.getUserId(), query);
  }

  /**
   * Obter produtos com estoque baixo
   */
  async getLowStockItems(threshold: number = 5): Promise<InventoryBalance[]> {
    return InventoryRepository.getLowStockBalances(this.getUserId(), threshold);
  }

  /**
   * Ajustar estoque de um produto (offline-first)
   */
  async adjustStock(input: AdjustStockInput): Promise<InventoryMovement> {
    const userId = this.getUserId();
    const { itemId, newQuantity, notes } = input;

    // Validate new quantity
    if (newQuantity < 0) {
      const allowNegative = await this.allowsNegativeStock();
      if (!allowNegative) {
        const error = new Error('Estoque negativo não permitido') as InventoryServiceError;
        error.code = 'NEGATIVE_STOCK';
        throw error;
      }
    }

    // Get current balance
    let currentBalance = await InventoryRepository.getBalanceByItemId(itemId);
    const currentQuantity = currentBalance?.quantity || 0;
    const difference = newQuantity - currentQuantity;

    if (difference === 0) {
      const error = new Error('Novo saldo igual ao atual') as InventoryServiceError;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const now = new Date().toISOString();
    const movementId = uuidv4();

    // Determine movement type
    const movementType = difference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

    // Create movement record
    const movement: InventoryMovement = {
      id: movementId,
      itemId,
      type: movementType,
      source: 'MANUAL',
      quantity: difference,
      balanceAfter: newQuantity,
      notes,
      createdBy: userId,
      createdAt: now,
      syncStatus: 'pending',
    };

    // Update or create balance
    if (currentBalance) {
      await InventoryRepository.updateBalanceQuantity(itemId, newQuantity);
    } else {
      await InventoryRepository.upsertBalance({
        id: uuidv4(),
        itemId,
        quantity: newQuantity,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Insert movement
    await InventoryRepository.insertMovement(movement);

    // Add to outbox for sync
    const outboxEntry: InventoryMovementOutbox = {
      id: uuidv4(),
      movementId,
      itemId,
      type: movementType,
      source: 'MANUAL',
      quantity: difference,
      balanceAfter: newQuantity,
      notes,
      createdAt: now,
      syncStatus: 'pending',
      syncAttempts: 0,
    };
    await InventoryRepository.addToOutbox(outboxEntry);

    return movement;
  }

  // ===========================================================================
  // MOVEMENTS
  // ===========================================================================

  /**
   * Listar movimentações de estoque
   */
  async getMovements(options?: {
    itemId?: string;
    type?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<InventoryMovement[]> {
    return InventoryRepository.getMovements(this.getUserId(), options);
  }

  /**
   * Obter movimentações recentes
   */
  async getRecentMovements(limit: number = 10): Promise<InventoryMovement[]> {
    return InventoryRepository.getRecentMovements(this.getUserId(), limit);
  }

  /**
   * Obter movimentações de um item específico
   */
  async getItemMovements(itemId: string, limit: number = 20): Promise<InventoryMovement[]> {
    return InventoryRepository.getMovements(this.getUserId(), { itemId, limit });
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Obter estatísticas de estoque
   */
  async getStats(): Promise<InventoryStats> {
    const userId = this.getUserId();

    const [totalProducts, totalQuantity, lowStockItems, pendingOutbox] = await Promise.all([
      InventoryRepository.countBalances(userId),
      InventoryRepository.getTotalQuantity(userId),
      InventoryRepository.getLowStockBalances(userId, 5),
      InventoryRepository.getPendingOutbox(),
    ]);

    return {
      totalProducts,
      totalQuantity,
      lowStockCount: lowStockItems.length,
      pendingSyncCount: pendingOutbox.length,
    };
  }

  // ===========================================================================
  // SYNC HELPERS
  // ===========================================================================

  /**
   * Obter movimentações pendentes de sync
   */
  async getPendingSync(): Promise<InventoryMovementOutbox[]> {
    return InventoryRepository.getPendingOutbox();
  }

  /**
   * Marcar item do outbox como sincronizado
   */
  async markAsSynced(outboxId: string): Promise<void> {
    await InventoryRepository.removeFromOutbox(outboxId);
  }

  /**
   * Marcar item do outbox com erro
   */
  async markSyncError(outboxId: string, error: string): Promise<void> {
    await InventoryRepository.updateOutboxStatus(outboxId, 'error', error);
  }

  /**
   * Limpar outbox sincronizado
   */
  async clearSyncedOutbox(): Promise<void> {
    await InventoryRepository.clearSyncedOutbox();
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Formatar quantidade para exibição
   */
  formatQuantity(quantity: number, unit?: string): string {
    const formatted = quantity % 1 === 0
      ? quantity.toString()
      : quantity.toFixed(2);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  /**
   * Obter label do tipo de movimentação
   */
  getMovementTypeLabel(type: InventoryMovement['type']): string {
    const labels: Record<InventoryMovement['type'], string> = {
      ADJUSTMENT_IN: 'Entrada Manual',
      ADJUSTMENT_OUT: 'Saída Manual',
      WORK_ORDER_OUT: 'Baixa por OS',
      INITIAL: 'Saldo Inicial',
    };
    return labels[type] || type;
  }

  /**
   * Obter cor do tipo de movimentação
   */
  getMovementTypeColor(type: InventoryMovement['type']): string {
    const isPositive = type === 'ADJUSTMENT_IN' || type === 'INITIAL';
    return isPositive ? '#22c55e' : '#ef4444';
  }

  /**
   * Verificar se é movimentação de entrada
   */
  isInboundMovement(type: InventoryMovement['type']): boolean {
    return type === 'ADJUSTMENT_IN' || type === 'INITIAL';
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const InventoryService = new InventoryServiceClass();

export default InventoryService;
