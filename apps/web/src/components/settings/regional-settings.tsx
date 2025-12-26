'use client';

/**
 * Regional Settings Components
 *
 * Componentes para seleção de País, Moeda e Fuso Horário
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { ChevronDown, Check, Search, Globe, Clock, DollarSign } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useCompanySettings, type CountryInfo, type CurrencyInfo, type TimezoneInfo } from '@/context';

// ============================================================================
// Country Select
// ============================================================================

interface CountrySelectProps {
  value: string;
  onChange: (countryCode: string, country: CountryInfo) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  autoFillCurrencyAndTimezone?: boolean;
}

export function CountrySelect({
  value,
  onChange,
  label,
  disabled = false,
  className,
  autoFillCurrencyAndTimezone = true,
}: CountrySelectProps) {
  const t = useTranslations('settings');
  const { countries, loadTimezones } = useCompanySettings();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCountry = useMemo(
    () => countries.find((c) => c.code === value),
    [countries, value]
  );

  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const lowerSearch = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.localName.toLowerCase().includes(lowerSearch) ||
        c.code.toLowerCase().includes(lowerSearch)
    );
  }, [countries, search]);

  const handleSelect = useCallback(
    (country: CountryInfo) => {
      onChange(country.code, country);
      if (autoFillCurrencyAndTimezone) {
        loadTimezones(country.code);
      }
      setIsOpen(false);
      setSearch('');
    },
    [onChange, autoFillCurrencyAndTimezone, loadTimezones]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-country-select]')) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div className={cn('relative', className)} data-country-select>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 border rounded-lg transition-colors text-left',
          'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
          'hover:border-gray-400 dark:hover:border-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Globe className="h-4 w-4 text-gray-400" />
        {selectedCountry ? (
          <>
            <span className="text-xl" role="img" aria-label={selectedCountry.name}>
              {selectedCountry.flag}
            </span>
            <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
              {selectedCountry.localName}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selectedCountry.code}
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-gray-400">{t('selectCountry')}</span>
        )}
        <ChevronDown
          className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchCountry')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Countries list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredCountries.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('noCountryFound')}
              </div>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelect(country)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                    value === country.code && 'bg-primary-50 dark:bg-primary-900/20'
                  )}
                >
                  <span className="text-xl" role="img" aria-label={country.name}>
                    {country.flag}
                  </span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                    {country.localName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {country.code}
                  </span>
                  {value === country.code && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Currency Select
// ============================================================================

interface CurrencySelectProps {
  value: string;
  onChange: (currencyCode: string, currency?: CurrencyInfo) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencySelect({
  value,
  onChange,
  label,
  disabled = false,
  className,
}: CurrencySelectProps) {
  const t = useTranslations('settings');
  const { currencies } = useCompanySettings();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCurrency = useMemo(
    () => currencies.find((c) => c.code === value),
    [currencies, value]
  );

  const filteredCurrencies = useMemo(() => {
    if (!search) return currencies;
    const lowerSearch = search.toLowerCase();
    return currencies.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.code.toLowerCase().includes(lowerSearch) ||
        c.symbol.includes(search)
    );
  }, [currencies, search]);

  const handleSelect = useCallback(
    (currency: CurrencyInfo) => {
      onChange(currency.code, currency);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-currency-select]')) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div className={cn('relative', className)} data-currency-select>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 border rounded-lg transition-colors text-left',
          'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
          'hover:border-gray-400 dark:hover:border-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <DollarSign className="h-4 w-4 text-gray-400" />
        {selectedCurrency ? (
          <>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedCurrency.symbol}
            </span>
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {selectedCurrency.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {selectedCurrency.code}
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-gray-400">{t('selectCurrency')}</span>
        )}
        <ChevronDown
          className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchCurrency')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Currencies list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredCurrencies.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('noCurrencyFound')}
              </div>
            ) : (
              filteredCurrencies.map((currency) => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleSelect(currency)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                    value === currency.code && 'bg-primary-50 dark:bg-primary-900/20'
                  )}
                >
                  <span className="w-8 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currency.symbol}
                  </span>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {currency.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {currency.code}
                  </span>
                  {value === currency.code && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Timezone Select
// ============================================================================

interface TimezoneSelectProps {
  value: string;
  onChange: (timezoneId: string, timezone?: TimezoneInfo) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function TimezoneSelect({
  value,
  onChange,
  label,
  disabled = false,
  className,
}: TimezoneSelectProps) {
  const t = useTranslations('settings');
  const { timezones } = useCompanySettings();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedTimezone = useMemo(
    () => timezones.find((t) => t.id === value),
    [timezones, value]
  );

  const filteredTimezones = useMemo(() => {
    if (!search) return timezones;
    const lowerSearch = search.toLowerCase();
    return timezones.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerSearch) ||
        t.id.toLowerCase().includes(lowerSearch) ||
        t.offset.includes(search)
    );
  }, [timezones, search]);

  const handleSelect = useCallback(
    (timezone: TimezoneInfo) => {
      onChange(timezone.id, timezone);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-timezone-select]')) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div className={cn('relative', className)} data-timezone-select>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 border rounded-lg transition-colors text-left',
          'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
          'hover:border-gray-400 dark:hover:border-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Clock className="h-4 w-4 text-gray-400" />
        {selectedTimezone ? (
          <>
            <span className="text-sm font-mono text-primary dark:text-primary-400">
              {selectedTimezone.offset}
            </span>
            <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
              {selectedTimezone.name}
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-gray-400">{t('selectTimezone')}</span>
        )}
        <ChevronDown
          className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchTimezone')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Timezones list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredTimezones.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {timezones.length === 0
                  ? t('selectCountryFirst')
                  : t('noTimezoneFound')}
              </div>
            ) : (
              filteredTimezones.map((timezone) => (
                <button
                  key={timezone.id}
                  type="button"
                  onClick={() => handleSelect(timezone)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                    value === timezone.id && 'bg-primary-50 dark:bg-primary-900/20'
                  )}
                >
                  <span className="w-16 text-xs font-mono text-primary dark:text-primary-400">
                    {timezone.offset}
                  </span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                    {timezone.name}
                  </span>
                  {value === timezone.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Combined Regional Settings Form
// ============================================================================

interface RegionalSettingsFormProps {
  className?: string;
  disabled?: boolean;
  showLabels?: boolean;
  compact?: boolean;
}

export function RegionalSettingsForm({
  className,
  disabled = false,
  showLabels = true,
  compact = false,
}: RegionalSettingsFormProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    loadTimezones,
  } = useCompanySettings();

  const [localCountry, setLocalCountry] = useState(settings?.country || 'BR');
  const [localCurrency, setLocalCurrency] = useState(settings?.currency || 'BRL');
  const [localTimezone, setLocalTimezone] = useState(settings?.timezone || 'America/Sao_Paulo');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local state with settings
  useEffect(() => {
    if (settings) {
      setLocalCountry(settings.country);
      setLocalCurrency(settings.currency);
      setLocalTimezone(settings.timezone);
    }
  }, [settings]);

  const handleCountryChange = useCallback(
    (countryCode: string, country: CountryInfo) => {
      setLocalCountry(countryCode);
      setLocalCurrency(country.currency);
      setLocalTimezone(country.timezone);
      loadTimezones(countryCode);
    },
    [loadTimezones]
  );

  const handleCurrencyChange = useCallback((currencyCode: string) => {
    setLocalCurrency(currencyCode);
  }, []);

  const handleTimezoneChange = useCallback((timezoneId: string) => {
    setLocalTimezone(timezoneId);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await updateSettings({
        country: localCountry,
        currency: localCurrency,
        timezone: localTimezone,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('errorSavingSettings'));
    } finally {
      setIsSaving(false);
    }
  }, [localCountry, localCurrency, localTimezone, updateSettings, t]);

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return (
      settings.country !== localCountry ||
      settings.currency !== localCurrency ||
      settings.timezone !== localTimezone
    );
  }, [settings, localCountry, localCurrency, localTimezone]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {(error || saveError) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error || saveError}</p>
        </div>
      )}

      <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'md:grid-cols-3')}>
        <CountrySelect
          value={localCountry}
          onChange={handleCountryChange}
          label={showLabels ? t('country') : undefined}
          disabled={disabled || isSaving}
        />

        <CurrencySelect
          value={localCurrency}
          onChange={handleCurrencyChange}
          label={showLabels ? t('currency') : undefined}
          disabled={disabled || isSaving}
        />

        <TimezoneSelect
          value={localTimezone}
          onChange={handleTimezoneChange}
          label={showLabels ? t('timezone') : undefined}
          disabled={disabled || isSaving}
        />
      </div>

      {hasChanges && (
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg',
              'hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSaving ? t('saving') : t('saveChanges')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (settings) {
                setLocalCountry(settings.country);
                setLocalCurrency(settings.currency);
                setLocalTimezone(settings.timezone);
              }
            }}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {tCommon('cancel')}
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('currencyNote')}
      </p>
    </div>
  );
}

export default RegionalSettingsForm;
