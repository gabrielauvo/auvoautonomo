/**
 * Regional Service
 *
 * Serviço para gerenciamento de configurações regionais (país, moeda, timezone)
 */

import { AuthService } from './AuthService';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import Constants from 'expo-constants';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001';

// =============================================================================
// TYPES
// =============================================================================

export interface RegionalSettings {
  country: string;
  currency: string;
  timezone: string;
}

export interface CountryInfo {
  code: string;
  name: string;
  localName: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  flag: string;
  region: string;
}

export interface TimezoneInfo {
  id: string;
  name: string;
  offset: string;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

// Default settings (Brazil)
const DEFAULT_SETTINGS: RegionalSettings = {
  country: 'BR',
  currency: 'BRL',
  timezone: 'America/Sao_Paulo',
};

// Country to locale mapping
const countryToLocale: Record<string, string> = {
  BR: 'pt-BR',
  US: 'en-US',
  MX: 'es-MX',
  AR: 'es-AR',
  CO: 'es-CO',
  CL: 'es-CL',
  PE: 'es-PE',
  CA: 'en-CA',
};

// =============================================================================
// REGIONAL SERVICE
// =============================================================================

export const RegionalService = {
  /**
   * Get current regional settings
   */
  async getSettings(): Promise<RegionalSettings> {
    try {
      const token = await AuthService.getAccessToken();
      if (!token) {
        return DEFAULT_SETTINGS;
      }

      const response = await fetchWithTimeout(`${API_URL}/settings/regional`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          country: data.country || DEFAULT_SETTINGS.country,
          currency: data.currency || DEFAULT_SETTINGS.currency,
          timezone: data.timezone || DEFAULT_SETTINGS.timezone,
        };
      }

      return DEFAULT_SETTINGS;
    } catch (error) {
      console.warn('Failed to fetch regional settings:', error);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Update regional settings
   */
  async updateSettings(data: Partial<RegionalSettings>): Promise<RegionalSettings> {
    const token = await AuthService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetchWithTimeout(`${API_URL}/settings/regional`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update settings');
    }

    const updatedSettings = await response.json();
    return {
      country: updatedSettings.country,
      currency: updatedSettings.currency,
      timezone: updatedSettings.timezone,
    };
  },

  /**
   * Get list of available countries
   */
  async getCountries(): Promise<CountryInfo[]> {
    try {
      const response = await fetchWithTimeout(`${API_URL}/settings/regional/countries`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.warn('Failed to fetch countries:', error);
      return [];
    }
  },

  /**
   * Get timezones for a specific country
   */
  async getTimezones(countryCode: string): Promise<TimezoneInfo[]> {
    try {
      const response = await fetchWithTimeout(
        `${API_URL}/settings/regional/timezones/${countryCode}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.timezones || [];
      }
      return [];
    } catch (error) {
      console.warn('Failed to fetch timezones:', error);
      return [];
    }
  },

  /**
   * Get available currencies
   */
  async getCurrencies(): Promise<CurrencyInfo[]> {
    try {
      const response = await fetchWithTimeout(`${API_URL}/settings/regional/currencies`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.warn('Failed to fetch currencies:', error);
      return [];
    }
  },

  /**
   * Get locale for a country code
   */
  getLocaleForCountry(countryCode: string): string {
    return countryToLocale[countryCode?.toUpperCase()] || 'en-US';
  },

  /**
   * Format currency value
   */
  formatCurrency(value: number, currency: string = 'BRL', countryCode: string = 'BR'): string {
    if (!Number.isFinite(value)) {
      return '';
    }

    const locale = this.getLocaleForCountry(countryCode);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value);
  },

  /**
   * Format date in timezone
   */
  formatDate(date: Date | string, timezone: string = 'America/Sao_Paulo', countryCode: string = 'BR'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '';
    }

    const locale = this.getLocaleForCountry(countryCode);
    try {
      return new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(dateObj);
    } catch {
      return dateObj.toLocaleDateString(locale);
    }
  },

  /**
   * Format date and time in timezone
   */
  formatDateTime(date: Date | string, timezone: string = 'America/Sao_Paulo', countryCode: string = 'BR'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '';
    }

    const locale = this.getLocaleForCountry(countryCode);
    try {
      return new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dateObj);
    } catch {
      return dateObj.toLocaleString(locale);
    }
  },

  /**
   * Format time only
   */
  formatTime(date: Date | string, timezone: string = 'America/Sao_Paulo', countryCode: string = 'BR'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '';
    }

    const locale = this.getLocaleForCountry(countryCode);
    try {
      return new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
      }).format(dateObj);
    } catch {
      return dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
  },
};
