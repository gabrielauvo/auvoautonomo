'use client';

/**
 * Company Settings Context - Contexto de Configurações da Empresa
 *
 * Gerencia configurações regionais da empresa:
 * - País, Moeda e Fuso Horário
 * - Funções de formatação de moeda e data
 * - Sincronização com backend
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useAuth } from './auth-context';

// ============================================================================
// Utility Functions (inline to avoid shared-utils dependency)
// ============================================================================

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

function getLocaleForCountry(countryCode: string): string {
  return countryToLocale[countryCode?.toUpperCase()] || 'en-US';
}

function formatCurrencyUtil(value: number, currency: string, locale: string): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
  locale: string
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      ...options,
    }).format(dateObj);
  } catch {
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
  }
}

function formatShortDate(date: Date | string, timezone: string, locale: string): string {
  return formatDateInTimezone(
    date,
    timezone,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    locale
  );
}

function formatDateTime(date: Date | string, timezone: string, locale: string): string {
  return formatDateInTimezone(
    date,
    timezone,
    { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
    locale
  );
}

function formatTime(date: Date | string, timezone: string, locale: string): string {
  return formatDateInTimezone(
    date,
    timezone,
    { hour: '2-digit', minute: '2-digit' },
    locale
  );
}

/**
 * Regional Settings from API
 */
export interface RegionalSettings {
  country: string;
  currency: string;
  timezone: string;
}

/**
 * Country data from API
 */
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

/**
 * Timezone info from API
 */
export interface TimezoneInfo {
  id: string;
  name: string;
  offset: string;
}

/**
 * Currency info from API
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

/**
 * Context type
 */
interface CompanySettingsContextType {
  // Settings
  settings: RegionalSettings | null;
  isLoading: boolean;
  error: string | null;

  // Data
  countries: CountryInfo[];
  timezones: TimezoneInfo[];
  currencies: CurrencyInfo[];

  // Actions
  updateSettings: (data: Partial<RegionalSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  loadTimezones: (countryCode: string) => Promise<void>;

  // Formatting helpers (use record currency if provided, otherwise company currency)
  formatCurrency: (value: number, recordCurrency?: string) => string;
  formatDate: (date: Date | string) => string;
  formatDateTimeStr: (date: Date | string) => string;
  formatTimeStr: (date: Date | string) => string;
}

/**
 * Default settings (Brazil)
 */
const DEFAULT_SETTINGS: RegionalSettings = {
  country: 'BR',
  currency: 'BRL',
  timezone: 'America/Sao_Paulo',
};

/**
 * Context
 */
const CompanySettingsContext = createContext<
  CompanySettingsContextType | undefined
>(undefined);

/**
 * API base URL
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Provider
 */
export function CompanySettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();

  const [settings, setSettings] = useState<RegionalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [timezones, setTimezones] = useState<TimezoneInfo[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);

  /**
   * Get auth token from localStorage
   */
  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }, []);

  /**
   * Fetch company settings from API
   */
  const fetchSettings = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/settings/regional`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          country: data.country || DEFAULT_SETTINGS.country,
          currency: data.currency || DEFAULT_SETTINGS.currency,
          timezone: data.timezone || DEFAULT_SETTINGS.timezone,
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Failed to fetch regional settings:', err);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  /**
   * Fetch countries list
   */
  const fetchCountries = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/settings/regional/countries`);
      if (response.ok) {
        const data = await response.json();
        setCountries(data);
      }
    } catch (err) {
      console.error('Failed to fetch countries:', err);
    }
  }, []);

  /**
   * Fetch currencies list
   */
  const fetchCurrencies = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/settings/regional/currencies`);
      if (response.ok) {
        const data = await response.json();
        setCurrencies(data);
      }
    } catch (err) {
      console.error('Failed to fetch currencies:', err);
    }
  }, []);

  /**
   * Load timezones for a specific country
   */
  const loadTimezones = useCallback(async (countryCode: string) => {
    try {
      const response = await fetch(
        `${API_URL}/settings/regional/timezones/${countryCode}`,
      );
      if (response.ok) {
        const data = await response.json();
        setTimezones(data.timezones || []);
      }
    } catch (err) {
      console.error('Failed to fetch timezones:', err);
      setTimezones([]);
    }
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback(
    async (data: Partial<RegionalSettings>) => {
      const token = getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      setError(null);

      try {
        const response = await fetch(`${API_URL}/settings/regional`, {
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
        setSettings({
          country: updatedSettings.country,
          currency: updatedSettings.currency,
          timezone: updatedSettings.timezone,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update settings';
        setError(message);
        throw err;
      }
    },
    [getToken],
  );

  /**
   * Refresh settings
   */
  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    await fetchSettings();
  }, [fetchSettings]);

  // Load settings and reference data on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    } else {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchSettings]);

  // Load countries and currencies on mount
  useEffect(() => {
    fetchCountries();
    fetchCurrencies();
  }, [fetchCountries, fetchCurrencies]);

  // Load timezones when country changes
  useEffect(() => {
    if (settings?.country) {
      loadTimezones(settings.country);
    }
  }, [settings?.country, loadTimezones]);

  /**
   * Get current locale based on country
   */
  const locale = useMemo(() => {
    return settings?.country
      ? getLocaleForCountry(settings.country)
      : 'pt-BR';
  }, [settings?.country]);

  /**
   * Format currency with company or record currency
   */
  const formatCurrency = useCallback(
    (value: number, recordCurrency?: string) => {
      const currency = recordCurrency || settings?.currency || 'BRL';
      return formatCurrencyUtil(value, currency, locale);
    },
    [settings?.currency, locale],
  );

  /**
   * Format date
   */
  const formatDate = useCallback(
    (date: Date | string) => {
      const timezone = settings?.timezone || 'America/Sao_Paulo';
      return formatShortDate(date, timezone, locale);
    },
    [settings?.timezone, locale],
  );

  /**
   * Format date and time
   */
  const formatDateTimeStr = useCallback(
    (date: Date | string) => {
      const timezone = settings?.timezone || 'America/Sao_Paulo';
      return formatDateTime(date, timezone, locale);
    },
    [settings?.timezone, locale],
  );

  /**
   * Format time only
   */
  const formatTimeStr = useCallback(
    (date: Date | string) => {
      const timezone = settings?.timezone || 'America/Sao_Paulo';
      return formatTime(date, timezone, locale);
    },
    [settings?.timezone, locale],
  );

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      error,
      countries,
      timezones,
      currencies,
      updateSettings,
      refreshSettings,
      loadTimezones,
      formatCurrency,
      formatDate,
      formatDateTimeStr,
      formatTimeStr,
    }),
    [
      settings,
      isLoading,
      error,
      countries,
      timezones,
      currencies,
      updateSettings,
      refreshSettings,
      loadTimezones,
      formatCurrency,
      formatDate,
      formatDateTimeStr,
      formatTimeStr,
    ],
  );

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

/**
 * Hook to use company settings
 */
export function useCompanySettings() {
  const context = useContext(CompanySettingsContext);

  if (context === undefined) {
    throw new Error(
      'useCompanySettings must be used within a CompanySettingsProvider',
    );
  }

  return context;
}

/**
 * Hook to get just the formatting functions (for components that only need formatting)
 */
export function useFormatting() {
  const { formatCurrency, formatDate, formatDateTimeStr, formatTimeStr, settings } =
    useCompanySettings();

  return {
    formatCurrency,
    formatDate,
    formatDateTime: formatDateTimeStr,
    formatTime: formatTimeStr,
    currency: settings?.currency || 'BRL',
    timezone: settings?.timezone || 'America/Sao_Paulo',
  };
}
