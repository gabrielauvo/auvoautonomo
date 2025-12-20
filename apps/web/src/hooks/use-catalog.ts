/**
 * Hooks para o módulo de Catálogo
 *
 * React Query hooks para:
 * - Listagem de itens e categorias
 * - CRUD de itens (produtos, serviços, kits)
 * - CRUD de categorias
 * - Composição de kits (bundle items)
 * - Estatísticas do catálogo
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  catalogService,
  CatalogItem,
  Category,
  BundleItem,
  CatalogStats,
  CreateItemDto,
  UpdateItemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateBundleItemDto,
  ItemSearchParams,
} from '@/services/catalog.service';

// ============================================
// CATEGORIES
// ============================================

/**
 * Hook para listar categorias
 */
export function useCategories(isActive?: boolean) {
  return useQuery<Category[]>({
    queryKey: ['catalog', 'categories', { isActive }],
    queryFn: () => catalogService.listCategories(isActive),
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para obter categoria por ID
 */
export function useCategory(id: string | undefined) {
  return useQuery<Category>({
    queryKey: ['catalog', 'category', id],
    queryFn: () => catalogService.getCategoryById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para criar categoria
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryDto) => catalogService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'stats'] });
    },
  });
}

/**
 * Hook para atualizar categoria
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryDto }) =>
      catalogService.updateCategory(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'category', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] });
    },
  });
}

/**
 * Hook para deletar categoria
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => catalogService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'stats'] });
    },
  });
}

// ============================================
// ITEMS (PRODUCTS/SERVICES/BUNDLES)
// ============================================

/**
 * Hook para listar itens do catálogo
 */
export function useCatalogItems(params?: ItemSearchParams) {
  return useQuery<CatalogItem[]>({
    queryKey: ['catalog', 'items', params],
    queryFn: () => catalogService.listItems(params),
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obter item por ID
 */
export function useCatalogItem(id: string | undefined) {
  return useQuery<CatalogItem>({
    queryKey: ['catalog', 'item', id],
    queryFn: () => catalogService.getItemById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para criar item
 */
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemDto) => catalogService.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] }); // Atualiza contagem
    },
  });
}

/**
 * Hook para atualizar item
 */
export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateItemDto }) =>
      catalogService.updateItem(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] }); // Atualiza contagem
    },
  });
}

/**
 * Hook para deletar item
 */
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => catalogService.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] }); // Atualiza contagem
    },
  });
}

/**
 * Hook para alternar status ativo/inativo do item
 */
export function useToggleItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      catalogService.toggleItemStatus(id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'item', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'stats'] });
    },
  });
}

// ============================================
// BUNDLE ITEMS (COMPOSIÇÃO DE KITS)
// ============================================

/**
 * Hook para obter itens de um kit
 */
export function useBundleItems(bundleId: string | undefined) {
  return useQuery<BundleItem[]>({
    queryKey: ['catalog', 'bundle-items', bundleId],
    queryFn: () => catalogService.getBundleItems(bundleId!),
    enabled: !!bundleId,
  });
}

/**
 * Hook para adicionar item a um kit
 */
export function useAddBundleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bundleId, data }: { bundleId: string; data: CreateBundleItemDto }) =>
      catalogService.addBundleItem(bundleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'bundle-items', variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'item', variables.bundleId] });
    },
  });
}

/**
 * Hook para remover item de um kit
 */
export function useRemoveBundleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bundleItemId, bundleId }: { bundleItemId: string; bundleId: string }) =>
      catalogService.removeBundleItem(bundleItemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', 'bundle-items', variables.bundleId] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'item', variables.bundleId] });
    },
  });
}

// ============================================
// STATISTICS
// ============================================

/**
 * Hook para obter estatísticas do catálogo
 */
export function useCatalogStats() {
  return useQuery<CatalogStats>({
    queryKey: ['catalog', 'stats'],
    queryFn: () => catalogService.getCatalogStats(),
    staleTime: 60000, // 1 minuto
  });
}
