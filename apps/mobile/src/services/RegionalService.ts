/**
 * Regional Service
 *
 * Serviço para gerenciamento de configurações regionais (país, moeda, timezone)
 */

import { AuthService } from './AuthService';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

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
      const url = `${API_URL}/settings/regional/countries`;
      console.log('[RegionalService] Fetching countries from:', url);
      const response = await fetchWithTimeout(url);
      console.log('[RegionalService] Countries response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[RegionalService] Countries loaded:', data?.length || 0);
        return data;
      }
      console.warn('[RegionalService] Countries request failed with status:', response.status);
      return [];
    } catch (error) {
      console.warn('[RegionalService] Failed to fetch countries:', error);
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
        // Backend returns { countryCode, timezones: string[] }
        // We need to transform to TimezoneInfo[]
        const timezoneStrings: string[] = data.timezones || [];
        return timezoneStrings.map((tz: string) => ({
          id: tz,
          name: this.formatTimezoneName(tz),
          offset: this.getTimezoneOffset(tz),
        }));
      }
      return [];
    } catch (error) {
      console.warn('Failed to fetch timezones:', error);
      return [];
    }
  },

  /**
   * Format timezone name for display
   */
  formatTimezoneName(timezone: string): string {
    // Convert America/Sao_Paulo to "São Paulo"
    const parts = timezone.split('/');
    const city = parts[parts.length - 1];
    return city.replace(/_/g, ' ').replace(/Sao/g, 'São');
  },

  /**
   * Get timezone offset string
   */
  getTimezoneOffset(timezone: string): string {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
      });
      const parts = formatter.formatToParts(now);
      const offsetPart = parts.find(p => p.type === 'timeZoneName');
      if (offsetPart) {
        // Convert "GMT-3" to "-03:00"
        const match = offsetPart.value.match(/GMT([+-]?)(\d+)?/);
        if (match) {
          const sign = match[1] || '+';
          const hours = match[2] ? match[2].padStart(2, '0') : '00';
          return `${sign}${hours}:00`;
        }
      }
      return '+00:00';
    } catch {
      return '+00:00';
    }
  },

  /**
   * Get available currencies
   */
  async getCurrencies(): Promise<CurrencyInfo[]> {
    try {
      const url = `${API_URL}/settings/regional/currencies`;
      console.log('[RegionalService] Fetching currencies from:', url);
      const response = await fetchWithTimeout(url);
      console.log('[RegionalService] Currencies response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[RegionalService] Currencies loaded:', data?.length || 0);
        return data;
      }
      console.warn('[RegionalService] Currencies request failed with status:', response.status);
      return [];
    } catch (error) {
      console.warn('[RegionalService] Failed to fetch currencies:', error);
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
