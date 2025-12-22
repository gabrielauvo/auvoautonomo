import { api } from './api';

// ============================================================================
// Types
// ============================================================================

export interface InventorySettings {
  id: string;
  userId: string;
  isEnabled: boolean;
  deductOnStatus: 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
  allowNegativeStock: boolean;
  deductOnlyOncePerWorkOrder: boolean;
  featureEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInventorySettingsDto {
  isEnabled?: boolean;
  deductOnStatus?: 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
  allowNegativeStock?: boolean;
  deductOnlyOncePerWorkOrder?: boolean;
}

export interface InventoryBalance {
  id: string;
  itemId: string;
  itemName: string;
  itemSku?: string;
  itemUnit: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBalanceList {
  items: InventoryBalance[];
  total: number;
  totalSkus: number;
  totalQuantity: number;
}

export interface UpdateBalanceDto {
  quantity: number;
  notes?: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName?: string;
  itemSku?: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'WORK_ORDER_OUT' | 'INITIAL';
  source: 'MANUAL' | 'WORK_ORDER' | 'IMPORT' | 'SYSTEM';
  quantity: number;
  balanceAfter: number;
  sourceId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface CreateMovementDto {
  itemId: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  notes?: string;
}

export interface MovementListQuery {
  itemId?: string;
  type?: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'WORK_ORDER_OUT' | 'INITIAL';
  source?: 'MANUAL' | 'WORK_ORDER' | 'IMPORT' | 'SYSTEM';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface MovementListResponse {
  items: InventoryMovement[];
  total: number;
  limit: number;
  offset: number;
}

export interface InventoryDashboard {
  totalSkus: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  recentMovements: InventoryMovement[];
}

// ============================================================================
// Settings
// ============================================================================

export async function getInventorySettings(): Promise<InventorySettings> {
  const response = await api.get<InventorySettings>('/inventory/settings');
  return response.data;
}

export async function updateInventorySettings(
  data: UpdateInventorySettingsDto
): Promise<InventorySettings> {
  const response = await api.put<InventorySettings>('/inventory/settings', data);
  return response.data;
}

// ============================================================================
// Balances
// ============================================================================

export async function getInventoryBalances(): Promise<InventoryBalanceList> {
  const response = await api.get<InventoryBalanceList>('/inventory/balances');
  return response.data;
}

export async function getInventoryBalance(itemId: string): Promise<InventoryBalance> {
  const response = await api.get<InventoryBalance>(`/inventory/balances/${itemId}`);
  return response.data;
}

export async function updateInventoryBalance(
  itemId: string,
  data: UpdateBalanceDto
): Promise<InventoryBalance> {
  const response = await api.put<InventoryBalance>(
    `/inventory/balances/${itemId}`,
    data
  );
  return response.data;
}

/**
 * Define estoque inicial para um produto recém-criado.
 * Este endpoint NÃO exige que o controle de estoque esteja ativo.
 */
export async function setInitialStock(
  itemId: string,
  quantity: number,
  notes?: string
): Promise<InventoryBalance> {
  const response = await api.post<InventoryBalance>(
    `/inventory/balances/${itemId}/initial`,
    { quantity, notes }
  );
  return response.data;
}

// ============================================================================
// Movements
// ============================================================================

export async function createInventoryMovement(
  data: CreateMovementDto
): Promise<InventoryMovement> {
  const response = await api.post<InventoryMovement>('/inventory/movements', data);
  return response.data;
}

export async function getInventoryMovements(
  query?: MovementListQuery
): Promise<MovementListResponse> {
  const params = new URLSearchParams();
  if (query?.itemId) params.append('itemId', query.itemId);
  if (query?.type) params.append('type', query.type);
  if (query?.source) params.append('source', query.source);
  if (query?.startDate) params.append('startDate', query.startDate);
  if (query?.endDate) params.append('endDate', query.endDate);
  if (query?.limit) params.append('limit', query.limit.toString());
  if (query?.offset) params.append('offset', query.offset.toString());

  const response = await api.get<MovementListResponse>(
    `/inventory/movements?${params.toString()}`
  );
  return response.data;
}

// ============================================================================
// Dashboard
// ============================================================================

export async function getInventoryDashboard(): Promise<InventoryDashboard> {
  const response = await api.get<InventoryDashboard>('/inventory/dashboard');
  return response.data;
}
