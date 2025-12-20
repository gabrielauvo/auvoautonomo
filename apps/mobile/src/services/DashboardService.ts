/**
 * Dashboard Service
 *
 * Serviço para buscar dados financeiros do dashboard.
 * Dados são buscados da API quando online, com cache persistente via AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from './AuthService';
import { getApiBaseUrl } from '../config/api';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// TYPES
// =============================================================================

export interface DashboardOverview {
  period: string;
  startDate: string;
  endDate: string;
  received: number;
  pending: number;
  overdue: number;
  canceled: number;
  refused: number;
  totalExpected: number;
  netRevenue: number;
  invoicedCount: number;
  paidCount: number;
  overdueCount: number;
  averageTicket: number;
  averageTicketPaid: number;
  paymentDistribution: {
    PIX: number;
    BOLETO: number;
    CREDIT_CARD: number;
  };
}

export interface CachedDashboardData {
  data: DashboardOverview;
  timestamp: number;
  period: string;
}

export type DashboardPeriod = 'current_month' | 'last_month' | 'current_year' | 'last_7_days' | 'last_30_days' | 'custom';

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY_PREFIX = '@dashboard_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos para considerar "fresh"
const STALE_TTL = 24 * 60 * 60 * 1000; // 24 horas para manter dados "stale"

// =============================================================================
// CACHE HELPERS
// =============================================================================

function getCacheKey(period: string, startDate?: string, endDate?: string): string {
  return `${STORAGE_KEY_PREFIX}${period}_${startDate || ''}_${endDate || ''}`;
}

async function getFromStorage(key: string): Promise<CachedDashboardData | null> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const parsed: CachedDashboardData = JSON.parse(stored);

    // Remove dados muito antigos (mais de 24h)
    if (Date.now() - parsed.timestamp > STALE_TTL) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[DashboardService] Error reading from storage:', error);
    return null;
  }
}

async function saveToStorage(key: string, data: DashboardOverview, period: string): Promise<void> {
  try {
    const cacheData: CachedDashboardData = {
      data,
      timestamp: Date.now(),
      period,
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[DashboardService] Error saving to storage:', error);
  }
}

// Memory cache for quick access
const memoryCache: Map<string, CachedDashboardData> = new Map();

// =============================================================================
// SERVICE
// =============================================================================

export const DashboardService = {
  /**
   * Busca overview financeiro do dashboard
   * Retorna dados do cache se offline ou se dados são recentes
   */
  async getOverview(
    period: DashboardPeriod = 'last_30_days',
    options?: { startDate?: string; endDate?: string; forceRefresh?: boolean }
  ): Promise<{ data: DashboardOverview | null; fromCache: boolean; cacheAge: number | null }> {
    const cacheKey = getCacheKey(period, options?.startDate, options?.endDate);

    // 1. Tenta memória primeiro
    let cached = memoryCache.get(cacheKey);

    // 2. Se não tem em memória, tenta AsyncStorage
    if (!cached) {
      cached = await getFromStorage(cacheKey) || undefined;
      if (cached) {
        memoryCache.set(cacheKey, cached);
      }
    }

    // 3. Se tem cache e não é forceRefresh e dados são frescos, retorna cache
    const isFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL);
    if (cached && !options?.forceRefresh && isFresh) {
      return {
        data: cached.data,
        fromCache: true,
        cacheAge: Date.now() - cached.timestamp,
      };
    }

    // 4. Tenta buscar da API
    const token = await AuthService.getAccessToken();
    if (!token) {
      // Sem token, retorna cache se tiver
      if (cached) {
        return {
          data: cached.data,
          fromCache: true,
          cacheAge: Date.now() - cached.timestamp,
        };
      }
      return { data: null, fromCache: false, cacheAge: null };
    }

    try {
      const baseUrl = getApiBaseUrl();
      const params = new URLSearchParams();

      // Map period to API format
      let apiPeriod = period;
      if (period === 'last_7_days' || period === 'last_30_days') {
        apiPeriod = 'custom';
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - (period === 'last_7_days' ? 7 : 30) * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else {
        params.append('period', apiPeriod);
      }

      if (options?.startDate) params.append('startDate', options.startDate);
      if (options?.endDate) params.append('endDate', options.endDate);

      const response = await fetchWithTimeout(`${baseUrl}/financial/dashboard/overview?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000, // 20s timeout para dashboard (pode ser pesado)
        retries: 2,
      });

      if (!response.ok) {
        console.warn('[DashboardService] Failed to fetch overview:', response.status);
        // Retorna cache se tiver
        if (cached) {
          return {
            data: cached.data,
            fromCache: true,
            cacheAge: Date.now() - cached.timestamp,
          };
        }
        return { data: null, fromCache: false, cacheAge: null };
      }

      const data = await response.json();

      // Salva em memória e storage
      const newCacheData: CachedDashboardData = {
        data,
        timestamp: Date.now(),
        period,
      };
      memoryCache.set(cacheKey, newCacheData);
      await saveToStorage(cacheKey, data, period);

      return { data, fromCache: false, cacheAge: null };
    } catch (error) {
      console.warn('[DashboardService] Error fetching overview:', error);
      // Em caso de erro de rede, retorna cache se tiver
      if (cached) {
        return {
          data: cached.data,
          fromCache: true,
          cacheAge: Date.now() - cached.timestamp,
        };
      }
      return { data: null, fromCache: false, cacheAge: null };
    }
  },

  /**
   * Limpa todo o cache (memória e storage)
   */
  async clearCache(): Promise<void> {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const dashboardKeys = keys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
      if (dashboardKeys.length > 0) {
        await AsyncStorage.multiRemove(dashboardKeys);
      }
    } catch (error) {
      console.warn('[DashboardService] Error clearing cache:', error);
    }
  },

  /**
   * Verifica se há dados em cache para um período
   */
  async hasCachedData(period: DashboardPeriod = 'last_30_days', startDate?: string, endDate?: string): Promise<boolean> {
    const cacheKey = getCacheKey(period, startDate, endDate);

    // Check memory first
    if (memoryCache.has(cacheKey)) return true;

    // Check storage
    const stored = await getFromStorage(cacheKey);
    return stored !== null;
  },

  /**
   * Formata a idade do cache para exibição
   */
  formatCacheAge(ageMs: number | null): string {
    if (ageMs === null) return '';

    const minutes = Math.floor(ageMs / 60000);
    const hours = Math.floor(ageMs / 3600000);

    if (hours > 0) {
      return `há ${hours}h`;
    }
    if (minutes > 0) {
      return `há ${minutes}min`;
    }
    return 'agora';
  },
};

export default DashboardService;
