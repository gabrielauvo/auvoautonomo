// @ts-nocheck
/**
 * Charges Cache Service
 *
 * Serviço para cache local de cobranças.
 * As cobranças são criadas online (integração com Asaas),
 * mas cacheadas localmente para visualização offline.
 *
 * Features:
 * - Cache local para leitura offline
 * - Sync incremental do servidor
 * - Stats cacheados para exibição rápida
 * - Busca e filtros locais
 */

import type { SQLiteBindValue } from 'expo-sqlite';
import {
  findAll,
  findById,
  rawQuery,
  count,
  getDatabase,
} from '../../db/database';
import { syncEngine } from '../../sync';
import type {
  Charge,
  ChargeListResponse,
  ChargeSearchParams,
  ChargeStats,
  ChargeStatus,
  BillingType,
} from './types';

// ============================================
// TYPES
// ============================================

interface CachedCharge {
  id: string;
  asaasId: string | null;
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  workOrderId: string | null;
  quoteId: string | null;
  value: number;
  netValue: number | null;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate: string | null;
  description: string | null;
  externalReference: string | null;
  discountValue: number | null;
  discountDueDateLimit: string | null;
  discountType: string | null;
  fineValue: number | null;
  fineType: string | null;
  interestValue: number | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCodeUrl: string | null;
  pixCopiaECola: string | null;
  transactionReceiptUrl: string | null;
  publicToken: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  technicianId: string;
}

interface CachedChargeStats {
  id: number;
  total: number;
  pending: number;
  overdue: number;
  confirmed: number;
  canceled: number;
  totalValue: number;
  receivedValue: number;
  pendingValue: number;
  overdueValue: number;
  updatedAt: string;
  technicianId: string;
}

// ============================================
// CACHE TABLE NAMES
// ============================================

const CHARGES_TABLE = 'charges_cache';
const STATS_TABLE = 'charges_stats_cache';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert cached charge to Charge type
 */
function cachedToCharge(cached: CachedCharge): Charge {
  return {
    id: cached.id,
    asaasId: cached.asaasId || undefined,
    userId: cached.technicianId,
    clientId: cached.clientId,
    workOrderId: cached.workOrderId || undefined,
    quoteId: cached.quoteId || undefined,
    value: cached.value,
    netValue: cached.netValue || undefined,
    billingType: cached.billingType as BillingType,
    status: cached.status as ChargeStatus,
    dueDate: cached.dueDate,
    paymentDate: cached.paymentDate || undefined,
    description: cached.description || undefined,
    externalReference: cached.externalReference || undefined,
    discount: cached.discountValue
      ? {
          value: cached.discountValue,
          dueDateLimitDays: cached.discountDueDateLimit
            ? parseInt(cached.discountDueDateLimit, 10)
            : undefined,
          type: (cached.discountType as 'FIXED' | 'PERCENTAGE') || 'FIXED',
        }
      : undefined,
    fine: cached.fineValue
      ? {
          value: cached.fineValue,
          type: (cached.fineType as 'FIXED' | 'PERCENTAGE') || 'FIXED',
        }
      : undefined,
    interest: cached.interestValue
      ? {
          value: cached.interestValue,
          type: 'PERCENTAGE',
        }
      : undefined,
    urls: {
      invoiceUrl: cached.invoiceUrl || undefined,
      bankSlipUrl: cached.bankSlipUrl || undefined,
      pixQrCodeUrl: cached.pixQrCodeUrl || undefined,
      pixCopiaECola: cached.pixCopiaECola || undefined,
      transactionReceiptUrl: cached.transactionReceiptUrl || undefined,
    },
    client: {
      id: cached.clientId,
      name: cached.clientName || 'Cliente',
      email: cached.clientEmail || undefined,
      phone: cached.clientPhone || undefined,
    },
    publicToken: cached.publicToken || undefined,
    createdAt: cached.createdAt,
    updatedAt: cached.updatedAt,
    syncedAt: cached.syncedAt || undefined,
    technicianId: cached.technicianId,
    clientName: cached.clientName || undefined,
  };
}

/**
 * Convert Charge to cached format
 */
function chargeToCached(charge: Charge, technicianId: string): CachedCharge {
  return {
    id: charge.id,
    asaasId: charge.asaasId || null,
    clientId: charge.clientId,
    clientName: charge.client?.name || charge.clientName || null,
    clientEmail: charge.client?.email || null,
    clientPhone: charge.client?.phone || null,
    workOrderId: charge.workOrderId || null,
    quoteId: charge.quoteId || null,
    value: charge.value,
    netValue: charge.netValue || null,
    billingType: charge.billingType,
    status: charge.status,
    dueDate: charge.dueDate,
    paymentDate: charge.paymentDate || null,
    description: charge.description || null,
    externalReference: charge.externalReference || null,
    discountValue: charge.discount?.value || null,
    discountDueDateLimit: charge.discount?.dueDateLimitDays?.toString() || null,
    discountType: charge.discount?.type || null,
    fineValue: charge.fine?.value || null,
    fineType: charge.fine?.type || null,
    interestValue: charge.interest?.value || null,
    invoiceUrl: charge.urls?.invoiceUrl || null,
    bankSlipUrl: charge.urls?.bankSlipUrl || null,
    pixQrCodeUrl: charge.urls?.pixQrCodeUrl || null,
    pixCopiaECola: charge.urls?.pixCopiaECola || null,
    transactionReceiptUrl: charge.urls?.transactionReceiptUrl || null,
    publicToken: charge.publicToken || null,
    createdAt: charge.createdAt,
    updatedAt: charge.updatedAt,
    syncedAt: new Date().toISOString(),
    technicianId,
  };
}

// ============================================
// CACHE SERVICE CLASS
// ============================================

class ChargesCacheServiceClass {
  private technicianId: string | null = null;
  private isSyncing: boolean = false;
  private lastSyncAt: string | null = null;

  /**
   * Configure the service with technician ID
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
    console.log('[ChargesCacheService] Configured for technician:', technicianId);
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.technicianId !== null;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): { isSyncing: boolean; lastSyncAt: string | null } {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
    };
  }

  // ============================================
  // READ OPERATIONS (from cache)
  // ============================================

  /**
   * Get all cached charges with pagination and filters
   */
  async getCachedCharges(
    params?: ChargeSearchParams
  ): Promise<ChargeListResponse> {
    if (!this.technicianId) {
      return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Build query with filters
    let sql = `SELECT * FROM ${CHARGES_TABLE} WHERE technicianId = ?`;
    const sqlParams: SQLiteBindValue[] = [this.technicianId];

    // Status filter
    if (params?.status) {
      sql += ` AND status = ?`;
      sqlParams.push(params.status);
    }

    // Billing type filter
    if (params?.billingType) {
      sql += ` AND billingType = ?`;
      sqlParams.push(params.billingType);
    }

    // Client filter
    if (params?.clientId) {
      sql += ` AND clientId = ?`;
      sqlParams.push(params.clientId);
    }

    // Date range filter
    if (params?.startDate) {
      sql += ` AND dueDate >= ?`;
      sqlParams.push(params.startDate);
    }
    if (params?.endDate) {
      sql += ` AND dueDate <= ?`;
      sqlParams.push(params.endDate);
    }

    // Search filter (client name or description)
    if (params?.search) {
      const searchTerm = `%${params.search}%`;
      sql += ` AND (clientName LIKE ? OR description LIKE ?)`;
      sqlParams.push(searchTerm, searchTerm);
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await rawQuery<{ count: number }>(countSql, sqlParams);
    const total = countResult[0]?.count || 0;

    // Add ordering and pagination
    sql += ` ORDER BY dueDate DESC, createdAt DESC LIMIT ? OFFSET ?`;
    sqlParams.push(pageSize, offset);

    const cached = await rawQuery<CachedCharge>(sql, sqlParams);
    const charges = cached.map(cachedToCharge);

    return {
      data: charges,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get a single cached charge by ID
   */
  async getCachedChargeById(id: string): Promise<Charge | null> {
    const cached = await findById<CachedCharge>(CHARGES_TABLE, id);
    return cached ? cachedToCharge(cached) : null;
  }

  /**
   * Get cached stats
   */
  async getCachedStats(): Promise<ChargeStats | null> {
    if (!this.technicianId) return null;

    const results = await rawQuery<CachedChargeStats>(
      `SELECT * FROM ${STATS_TABLE} WHERE technicianId = ? LIMIT 1`,
      [this.technicianId]
    );

    if (results.length === 0) return null;

    const stats = results[0];
    return {
      total: stats.total,
      pending: stats.pending,
      overdue: stats.overdue,
      confirmed: stats.confirmed,
      canceled: stats.canceled,
      totalValue: stats.totalValue,
      receivedValue: stats.receivedValue,
      pendingValue: stats.pendingValue,
      overdueValue: stats.overdueValue,
    };
  }

  /**
   * Check if cache has data
   */
  async hasCachedData(): Promise<boolean> {
    if (!this.technicianId) return false;
    const total = await count(CHARGES_TABLE, { technicianId: this.technicianId });
    return total > 0;
  }

  /**
   * Get cache count
   */
  async getCacheCount(): Promise<number> {
    if (!this.technicianId) return 0;
    return count(CHARGES_TABLE, { technicianId: this.technicianId });
  }

  // ============================================
  // WRITE OPERATIONS (update cache from server)
  // ============================================

  /**
   * Save charges to cache (upsert)
   */
  async saveToCache(charges: Charge[]): Promise<void> {
    if (!this.technicianId || charges.length === 0) return;

    const db = await getDatabase();
    const now = new Date().toISOString();

    // Use batch insert with upsert
    for (const charge of charges) {
      const cached = chargeToCached(charge, this.technicianId);

      const sql = `
        INSERT OR REPLACE INTO ${CHARGES_TABLE} (
          id, asaasId, clientId, clientName, clientEmail, clientPhone,
          workOrderId, quoteId, value, netValue, billingType, status,
          dueDate, paymentDate, description, externalReference,
          discountValue, discountDueDateLimit, discountType,
          fineValue, fineType, interestValue,
          invoiceUrl, bankSlipUrl, pixQrCodeUrl, pixCopiaECola,
          transactionReceiptUrl, publicToken, createdAt, updatedAt,
          syncedAt, technicianId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await db.runAsync(sql, [
        cached.id,
        cached.asaasId,
        cached.clientId,
        cached.clientName,
        cached.clientEmail,
        cached.clientPhone,
        cached.workOrderId,
        cached.quoteId,
        cached.value,
        cached.netValue,
        cached.billingType,
        cached.status,
        cached.dueDate,
        cached.paymentDate,
        cached.description,
        cached.externalReference,
        cached.discountValue,
        cached.discountDueDateLimit,
        cached.discountType,
        cached.fineValue,
        cached.fineType,
        cached.interestValue,
        cached.invoiceUrl,
        cached.bankSlipUrl,
        cached.pixQrCodeUrl,
        cached.pixCopiaECola,
        cached.transactionReceiptUrl,
        cached.publicToken,
        cached.createdAt,
        cached.updatedAt,
        now,
        cached.technicianId,
      ]);
    }

    console.log(`[ChargesCacheService] Saved ${charges.length} charges to cache`);
  }

  /**
   * Save stats to cache
   */
  async saveStatsToCache(stats: ChargeStats): Promise<void> {
    if (!this.technicianId) return;

    const db = await getDatabase();
    const now = new Date().toISOString();

    // Delete existing stats for this technician
    await db.runAsync(
      `DELETE FROM ${STATS_TABLE} WHERE technicianId = ?`,
      [this.technicianId]
    );

    // Insert new stats
    const sql = `
      INSERT INTO ${STATS_TABLE} (
        id, total, pending, overdue, confirmed, canceled,
        totalValue, receivedValue, pendingValue, overdueValue,
        updatedAt, technicianId
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.runAsync(sql, [
      stats.total,
      stats.pending,
      stats.overdue,
      stats.confirmed,
      stats.canceled,
      stats.totalValue,
      stats.receivedValue,
      stats.pendingValue,
      stats.overdueValue,
      now,
      this.technicianId,
    ]);

    console.log('[ChargesCacheService] Stats saved to cache');
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (!this.technicianId) return;

    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM ${CHARGES_TABLE} WHERE technicianId = ?`,
      [this.technicianId]
    );
    await db.runAsync(
      `DELETE FROM ${STATS_TABLE} WHERE technicianId = ?`,
      [this.technicianId]
    );

    console.log('[ChargesCacheService] Cache cleared');
  }

  /**
   * Remove a single charge from cache
   */
  async removeFromCache(chargeId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM ${CHARGES_TABLE} WHERE id = ?`,
      [chargeId]
    );
    console.log(`[ChargesCacheService] Charge ${chargeId} removed from cache`);
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Sync charges from server to cache
   * Returns true if sync was successful
   */
  async syncFromServer(): Promise<boolean> {
    if (!this.technicianId) {
      console.warn('[ChargesCacheService] Not configured, skipping sync');
      return false;
    }

    if (this.isSyncing) {
      console.log('[ChargesCacheService] Sync already in progress');
      return false;
    }

    if (!syncEngine.isNetworkOnline()) {
      console.log('[ChargesCacheService] Offline, skipping sync');
      return false;
    }

    this.isSyncing = true;

    try {
      console.log('[ChargesCacheService] Starting sync from server...');

      // Get auth token from sync engine
      const authToken = (syncEngine as any).authToken;
      const baseUrl = (syncEngine as any).baseUrl;

      if (!authToken || !baseUrl) {
        throw new Error('SyncEngine not configured with auth');
      }

      // Fetch all charges (with pagination if needed)
      let allCharges: Charge[] = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 100;

      while (hasMore) {
        const url = new URL(`${baseUrl}/billing/charges`);
        url.searchParams.set('page', String(page));
        url.searchParams.set('pageSize', String(pageSize));

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch charges: ${response.status}`);
        }

        const data: ChargeListResponse = await response.json();
        allCharges = [...allCharges, ...data.data];
        hasMore = page < data.totalPages;
        page++;

        // Safety limit
        if (page > 50) {
          console.warn('[ChargesCacheService] Reached page limit');
          break;
        }
      }

      // Save to cache
      await this.saveToCache(allCharges);

      // Fetch and cache stats
      const statsUrl = new URL(`${baseUrl}/billing/charges/stats`);
      const statsResponse = await fetch(statsUrl.toString(), {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (statsResponse.ok) {
        const stats: ChargeStats = await statsResponse.json();
        await this.saveStatsToCache(stats);
      }

      this.lastSyncAt = new Date().toISOString();
      console.log(`[ChargesCacheService] Sync complete. ${allCharges.length} charges cached.`);

      return true;
    } catch (error) {
      console.error('[ChargesCacheService] Sync failed:', error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Update a single charge in cache after modification
   */
  async refreshCharge(chargeId: string): Promise<Charge | null> {
    if (!syncEngine.isNetworkOnline()) {
      return this.getCachedChargeById(chargeId);
    }

    try {
      const authToken = (syncEngine as any).authToken;
      const baseUrl = (syncEngine as any).baseUrl;

      if (!authToken || !baseUrl) {
        return this.getCachedChargeById(chargeId);
      }

      const response = await fetch(`${baseUrl}/billing/charges/${chargeId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return this.getCachedChargeById(chargeId);
      }

      const charge: Charge = await response.json();
      await this.saveToCache([charge]);

      return charge;
    } catch (error) {
      console.error('[ChargesCacheService] Failed to refresh charge:', error);
      return this.getCachedChargeById(chargeId);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const ChargesCacheService = new ChargesCacheServiceClass();

export default ChargesCacheService;
