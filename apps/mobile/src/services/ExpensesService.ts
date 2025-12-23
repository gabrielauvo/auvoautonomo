/**
 * Expenses Service
 *
 * Serviço para buscar dados de despesas da API.
 * Similar ao DashboardService, usa cache para suporte offline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from './AuthService';
import { getApiBaseUrl } from '../config/api';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// TYPES
// =============================================================================

export interface ExpenseSummary {
  total: {
    count: number;
    amount: number;
  };
  pending: {
    count: number;
    amount: number;
  };
  paid: {
    count: number;
    amount: number;
  };
  canceled: {
    count: number;
    amount: number;
  };
  overdue: {
    count: number;
    amount: number;
  };
}

interface CachedExpenseSummary {
  data: ExpenseSummary;
  timestamp: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY_PREFIX = '@expenses_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos para considerar "fresh"
const STALE_TTL = 24 * 60 * 60 * 1000; // 24 horas para manter dados "stale"

// =============================================================================
// CACHE HELPERS
// =============================================================================

function getCacheKey(startDate?: string, endDate?: string): string {
  return `${STORAGE_KEY_PREFIX}summary_${startDate || ''}_${endDate || ''}`;
}

async function getFromStorage(key: string): Promise<CachedExpenseSummary | null> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const parsed: CachedExpenseSummary = JSON.parse(stored);

    // Remove dados muito antigos (mais de 24h)
    if (Date.now() - parsed.timestamp > STALE_TTL) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[ExpensesService] Error reading from storage:', error);
    return null;
  }
}

async function saveToStorage(key: string, data: ExpenseSummary): Promise<void> {
  try {
    const cacheData: CachedExpenseSummary = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[ExpensesService] Error saving to storage:', error);
  }
}

// Memory cache for quick access
const memoryCache: Map<string, CachedExpenseSummary> = new Map();

// =============================================================================
// SERVICE
// =============================================================================

export const ExpensesService = {
  /**
   * Busca resumo das despesas
   * Retorna dados do cache se offline ou se dados são recentes
   */
  async getSummary(
    options?: { startDate?: string; endDate?: string; forceRefresh?: boolean }
  ): Promise<{ data: ExpenseSummary | null; fromCache: boolean; cacheAge: number | null }> {
    const cacheKey = getCacheKey(options?.startDate, options?.endDate);

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

      if (options?.startDate) params.append('startDate', options.startDate);
      if (options?.endDate) params.append('endDate', options.endDate);

      const queryString = params.toString();
      const url = `${baseUrl}/expenses/summary${queryString ? `?${queryString}` : ''}`;

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
        retries: 2,
      });

      if (!response.ok) {
        console.warn('[ExpensesService] Failed to fetch summary:', response.status);
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
      const newCacheData: CachedExpenseSummary = {
        data,
        timestamp: Date.now(),
      };
      memoryCache.set(cacheKey, newCacheData);
      await saveToStorage(cacheKey, data);

      return { data, fromCache: false, cacheAge: null };
    } catch (error) {
      console.warn('[ExpensesService] Error fetching summary:', error);
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
      const expenseKeys = keys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
      if (expenseKeys.length > 0) {
        await AsyncStorage.multiRemove(expenseKeys);
      }
    } catch (error) {
      console.warn('[ExpensesService] Error clearing cache:', error);
    }
  },
};

export default ExpensesService;
