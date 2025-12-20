// @ts-nocheck
/**
 * Catalog Service
 *
 * Serviço para acessar o catálogo de produtos, serviços e kits.
 * Dados são sincronizados do servidor e disponíveis offline.
 */

import { CategoryRepository } from '../../db/repositories/CategoryRepository';
import { CatalogItemRepository } from '../../db/repositories/CatalogItemRepository';
import { ProductCategory, CatalogItem, BundleItem, ItemType } from '../../db/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryWithItems extends ProductCategory {
  items?: CatalogItem[];
}

export interface CatalogItemWithBundle extends CatalogItem {
  bundleItems?: BundleItem[];
  bundleTotal?: number;
}

export interface CatalogSearchOptions {
  query?: string;
  type?: ItemType;
  categoryId?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}

export interface CatalogStats {
  totalItems: number;
  totalProducts: number;
  totalServices: number;
  totalBundles: number;
  totalCategories: number;
}

// =============================================================================
// CATALOG SERVICE
// =============================================================================

class CatalogServiceClass {
  private technicianId: string | null = null;

  /**
   * Configurar o serviço com o ID do técnico
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
  }

  // =============================================================================
  // CATEGORIES
  // =============================================================================

  /**
   * Listar todas as categorias ativas
   */
  async getCategories(): Promise<ProductCategory[]> {
    if (!this.technicianId) {
      throw new Error('CatalogService not configured. Call configure() first.');
    }
    return CategoryRepository.getAll(this.technicianId);
  }

  /**
   * Buscar categoria por ID
   */
  async getCategoryById(id: string): Promise<ProductCategory | null> {
    return CategoryRepository.getById(id);
  }

  /**
   * Buscar categorias por texto
   */
  async searchCategories(query: string, limit: number = 50): Promise<ProductCategory[]> {
    if (!this.technicianId) {
      throw new Error('CatalogService not configured. Call configure() first.');
    }
    return CategoryRepository.search(this.technicianId, query, limit);
  }

  // =============================================================================
  // ITEMS
  // =============================================================================

  /**
   * Listar todos os itens ativos
   */
  async getItems(type?: ItemType): Promise<CatalogItem[]> {
    if (!this.technicianId) {
      throw new Error('CatalogService not configured. Call configure() first.');
    }

    if (type) {
      return CatalogItemRepository.getByType(this.technicianId, type);
    }
    return CatalogItemRepository.getAll(this.technicianId);
  }

  /**
   * Buscar item por ID
   */
  async getItemById(id: string): Promise<CatalogItem | null> {
    return CatalogItemRepository.getById(id);
  }

  /**
   * Buscar item por ID com bundle items (se for BUNDLE)
   */
  async getItemWithBundle(id: string): Promise<CatalogItemWithBundle | null> {
    const item = await CatalogItemRepository.getByIdWithBundleItems(id);
    if (!item) return null;

    if (item.type === 'BUNDLE' && item.bundleItems) {
      const bundleTotal = await CatalogItemRepository.calculateBundlePrice(id);
      return { ...item, bundleTotal };
    }

    return item;
  }

  /**
   * Buscar itens por categoria
   */
  async getItemsByCategory(categoryId: string): Promise<CatalogItem[]> {
    if (!this.technicianId) {
      throw new Error('CatalogService not configured. Call configure() first.');
    }
    return CatalogItemRepository.getByCategory(this.technicianId, categoryId);
  }

  /**
   * Buscar itens por tipo
   */
  async getItemsByType(type: ItemType): Promise<CatalogItem[]> {
    if (!this.technicianId) {
      throw new Error('CatalogService not configured. Call configure() first.');
    }
    return CatalogItemRepository.getByType(this.technicianId, type);
  }

  /**
   * Buscar itens por texto
   */
  async searchItems(options: CatalogSearchOptions = {}): Promise<CatalogItem[]> {
    if (!this.technicianId) {
      throw new Error('CatalogService not configured. Call configure() first.');
    }

    return CatalogItemRepository.search(this.technicianId, options.query || '', {
      limit: options.limit,
      type: options.type,
      categoryId: options.categoryId,
    });
  }

  /**
   * Buscar itens com paginação
   */
  async getItemsPaginated(
    page: number = 1,
    pageSize: number = 50,
    filters?: {
      type?: ItemType;
      categoryId?: string;
      search?: string;
    }
  ): Promise<{ data: CatalogItem[]; total: number; pages: number }> {
    if (!this.technicianId) {
      throw new Error('CatalogService not configured. Call configure() first.');
    }

    return CatalogItemRepository.getPaginated(this.technicianId, page, pageSize, filters);
  }

  // =============================================================================
  // BUNDLES
  // =============================================================================

  /**
   * Listar todos os bundles/kits
   */
  async getBundles(): Promise<CatalogItem[]> {
    return this.getItemsByType('BUNDLE');
  }

  /**
   * Obter itens de um bundle
   */
  async getBundleItems(bundleId: string): Promise<BundleItem[]> {
    return CatalogItemRepository.getBundleItems(bundleId);
  }

  /**
   * Calcular preço total de um bundle
   */
  async calculateBundlePrice(bundleId: string): Promise<number> {
    return CatalogItemRepository.calculateBundlePrice(bundleId);
  }

  // =============================================================================
  // STATISTICS
  // =============================================================================

  /**
   * Obter estatísticas do catálogo
   */
  async getStats(): Promise<CatalogStats> {
    if (!this.technicianId) {
      return {
        totalItems: 0,
        totalProducts: 0,
        totalServices: 0,
        totalBundles: 0,
        totalCategories: 0,
      };
    }

    const [totalItems, totalProducts, totalServices, totalBundles, totalCategories] =
      await Promise.all([
        CatalogItemRepository.count(this.technicianId),
        CatalogItemRepository.count(this.technicianId, { type: 'PRODUCT' }),
        CatalogItemRepository.count(this.technicianId, { type: 'SERVICE' }),
        CatalogItemRepository.count(this.technicianId, { type: 'BUNDLE' }),
        CategoryRepository.count(this.technicianId),
      ]);

    return {
      totalItems,
      totalProducts,
      totalServices,
      totalBundles,
      totalCategories,
    };
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Formatar preço para exibição
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  /**
   * Obter label do tipo
   */
  getTypeLabel(type: ItemType): string {
    const labels: Record<ItemType, string> = {
      PRODUCT: 'Produto',
      SERVICE: 'Serviço',
      BUNDLE: 'Kit',
    };
    return labels[type] || type;
  }

  /**
   * Obter cor do tipo para badge
   */
  getTypeColor(type: ItemType): string {
    const colors: Record<ItemType, string> = {
      PRODUCT: '#3498db', // Azul
      SERVICE: '#2ecc71', // Verde
      BUNDLE: '#9b59b6', // Roxo
    };
    return colors[type] || '#95a5a6';
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const CatalogService = new CatalogServiceClass();

export default CatalogService;
