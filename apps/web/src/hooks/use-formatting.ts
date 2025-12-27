/**
 * Formatting Hook
 *
 * Hook for currency and date formatting using company settings.
 */

'use client';

import { useCompanySettings } from '@/context/company-settings-context';

export function useFormatting() {
  const {
    settings,
    formatCurrency: formatCurrencyFromContext,
    formatDate: formatDateFromContext,
    formatDateTimeStr,
  } = useCompanySettings();

  // Get locale based on country
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

  const locale = countryToLocale[settings?.country?.toUpperCase()] || 'pt-BR';
  const currency = settings?.currency || 'BRL';

  // Wrapper for formatCurrency that handles null/undefined/string values
  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return formatCurrencyFromContext(numValue);
  };

  // Wrapper for formatDate that handles null/undefined values
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    return formatDateFromContext(date);
  };

  // Wrapper for formatDateTime that handles null/undefined values
  const formatDateTime = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    return formatDateTimeStr(date);
  };

  return {
    locale,
    currency,
    formatCurrency,
    formatDate,
    formatDateTime,
  };
}
