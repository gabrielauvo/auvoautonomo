/**
 * Catalog Service - Serviço de Catálogo
 *
 * Gerencia:
 * - CRUD de itens (produtos, serviços, kits)
 * - CRUD de categorias
 * - Composição de kits (bundle items)
 * - Estatísticas do catálogo
 */

import api, { getErrorMessage } from './api';

/**
 * Tipo de item do catálogo
 */
export type ItemType = 'PRODUCT' | 'SERVICE' | 'BUNDLE';

/**
 * Categoria do catálogo
 */
export interface Category {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

/**
 * Item do catálogo (produto, serviço ou kit)
 */
export interface CatalogItem {
  id: string;
  userId: string;
  categoryId?: string;
  name: string;
  description?: string;
  type: ItemType;
  sku?: string;
  unit: string;
  basePrice: number;
  costPrice?: number;
  defaultDurationMinutes?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
    color?: string;
  };
  _count?: {
    bundleAsParent: number;
    quoteItems: number;
    workOrderItems: number;
  };
}

/**
 * Item de composição de kit (bundle item)
 */
export interface BundleItem {
  id: string;
  bundleId: string;
  itemId: string;
  quantity: number;
  createdAt: string;
  item: {
    id: string;
    name: string;
    type: ItemType;
    unit: string;
    basePrice: number;
  };
}

/**
 * DTO para criar categoria
 */
export interface CreateCategoryDto {
  name: string;
  description?: string;
  color?: string;
}

/**
 * DTO para atualizar categoria
 */
export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

/**
 * DTO para criar item
 */
export interface CreateItemDto {
  categoryId?: string;
  name: string;
  description?: string;
  type: ItemType;
  sku?: string;
  unit: string;
  basePrice: number;
  costPrice?: number;
  defaultDurationMinutes?: number;
}

/**
 * DTO para atualizar item
 */
export interface UpdateItemDto {
  categoryId?: string;
  name?: string;
  description?: string;
  type?: ItemType;
  sku?: string;
  unit?: string;
  basePrice?: number;
  costPrice?: number;
  defaultDurationMinutes?: number;
  isActive?: boolean;
}

/**
 * DTO para adicionar item ao kit
 */
export interface CreateBundleItemDto {
  itemId: string;
  quantity: number;
}

/**
 * Parâmetros de busca de itens
 */
export interface ItemSearchParams {
  type?: ItemType;
  categoryId?: string;
  search?: string;
  isActive?: boolean;
}

/**
 * Estatísticas do catálogo
 */
export interface CatalogStats {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  productCount: number;
  serviceCount: number;
  bundleCount: number;
  categoryCount: number;
}

// ============================================
// CATEGORIES
// ============================================

/**
 * Listar todas as categorias
 */
export async function listCategories(isActive?: boolean): Promise<Category[]> {
  try {
    const params: Record<string, string> = {};
    if (isActive !== undefined) {
      params.isActive = String(isActive);
    }
    const response = await api.get<Category[]>('/products/categories', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter categoria por ID
 */
export async function getCategoryById(id: string): Promise<Category> {
  try {
    const response = await api.get<Category>(`/products/categories/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar categoria
 */
export async function createCategory(data: CreateCategoryDto): Promise<Category> {
  try {
    const response = await api.post<Category>('/products/categories', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar categoria
 */
export async function updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
  try {
    const response = await api.put<Category>(`/products/categories/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar categoria
 */
export async function deleteCategory(id: string): Promise<void> {
  try {
    await api.delete(`/products/categories/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// ITEMS (PRODUCTS/SERVICES/BUNDLES)
// ============================================

/**
 * Listar itens do catálogo
 */
export async function listItems(params?: ItemSearchParams): Promise<CatalogItem[]> {
  try {
    const queryParams: Record<string, string> = {};
    if (params?.type) queryParams.type = params.type;
    if (params?.categoryId) queryParams.categoryId = params.categoryId;
    if (params?.search) queryParams.search = params.search;
    if (params?.isActive !== undefined) queryParams.isActive = String(params.isActive);

    const response = await api.get<CatalogItem[]>('/products/items', { params: queryParams });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter item por ID
 */
export async function getItemById(id: string): Promise<CatalogItem> {
  try {
    const response = await api.get<CatalogItem>(`/products/items/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar item
 */
export async function createItem(data: CreateItemDto): Promise<CatalogItem> {
  try {
    const response = await api.post<CatalogItem>('/products/items', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar item
 */
export async function updateItem(id: string, data: UpdateItemDto): Promise<CatalogItem> {
  try {
    const response = await api.put<CatalogItem>(`/products/items/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar item
 */
export async function deleteItem(id: string): Promise<void> {
  try {
    await api.delete(`/products/items/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Alternar status ativo/inativo do item
 */
export async function toggleItemStatus(id: string, isActive: boolean): Promise<CatalogItem> {
  try {
    const response = await api.put<CatalogItem>(`/products/items/${id}`, { isActive });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// BUNDLE ITEMS (COMPOSIÇÃO DE KITS)
// ============================================

/**
 * Obter itens de um kit
 */
export async function getBundleItems(bundleId: string): Promise<BundleItem[]> {
  try {
    const response = await api.get<BundleItem[]>(`/products/items/${bundleId}/bundle-items`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Adicionar item a um kit
 */
export async function addBundleItem(bundleId: string, data: CreateBundleItemDto): Promise<BundleItem> {
  try {
    const response = await api.post<BundleItem>(`/products/items/${bundleId}/bundle-items`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Remover item de um kit
 */
export async function removeBundleItem(bundleItemId: string): Promise<void> {
  try {
    await api.delete(`/products/bundle-items/${bundleItemId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Obter estatísticas do catálogo
 */
export async function getCatalogStats(): Promise<CatalogStats> {
  try {
    const response = await api.get<CatalogStats>('/products/stats');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Formata o tipo do item para exibição
 */
export function formatItemType(type: ItemType): string {
  const labels: Record<ItemType, string> = {
    PRODUCT: 'Produto',
    SERVICE: 'Serviço',
    BUNDLE: 'Kit',
  };
  return labels[type] || type;
}

/**
 * Retorna a cor do badge para o tipo do item
 */
export function getItemTypeBadgeColor(type: ItemType): string {
  const colors: Record<ItemType, string> = {
    PRODUCT: 'info',
    SERVICE: 'success',
    BUNDLE: 'warning',
  };
  return colors[type] || 'default';
}

/**
 * Calcula o preço total de um kit baseado em seus itens
 */
export function calculateBundlePrice(bundleItems: BundleItem[] | undefined | null): number {
  if (!bundleItems || !Array.isArray(bundleItems)) {
    return 0;
  }
  return bundleItems.reduce((total, bi) => {
    return total + bi.quantity * (bi.item?.basePrice || 0);
  }, 0);
}

/**
 * Verifica se um item pode ser deletado (não está em uso)
 */
export function canDeleteItem(item: CatalogItem): boolean {
  const usageCount =
    (item._count?.quoteItems || 0) +
    (item._count?.workOrderItems || 0) +
    (item._count?.bundleAsParent || 0);
  return usageCount === 0;
}

export const catalogService = {
  // Categories
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Items
  listItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  toggleItemStatus,
  // Bundle Items
  getBundleItems,
  addBundleItem,
  removeBundleItem,
  // Stats
  getCatalogStats,
  // Helpers
  formatItemType,
  getItemTypeBadgeColor,
  calculateBundlePrice,
  canDeleteItem,
};

export default catalogService;
