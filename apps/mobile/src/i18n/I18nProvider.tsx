/**
 * I18n Provider
 *
 * Provider de contexto para internacionalizacao do aplicativo.
 * Gerencia o estado do idioma atual e fornece funcoes de traducao.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Locale, defaultLocale, isValidLocale, locales } from './config';
import { ptBR, enUS, es, Translations } from './locales';

// =============================================================================
// TYPES
// =============================================================================

type TranslationPath = string;
type TranslationParams = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (path: TranslationPath, params?: TranslationParams) => string;
  translations: Translations;
  isLoading: boolean;
}

// =============================================================================
// TRANSLATIONS MAP
// =============================================================================

const translationsMap: Record<Locale, Translations> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es': es,
};

// =============================================================================
// STORAGE
// =============================================================================

const LOCALE_STORAGE_KEY = '@banquinho:locale';

async function loadStoredLocale(): Promise<Locale | null> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isValidLocale(stored)) {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Detect device locale and map to supported locale
 * Maps: es-* -> es, en-* -> en-US, pt-* -> pt-BR
 */
function detectDeviceLocale(): Locale {
  let deviceLocale: string | undefined;

  try {
    if (Platform.OS === 'ios') {
      // iOS: Get locale from settings
      deviceLocale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
    } else if (Platform.OS === 'android') {
      // Android: Get locale from I18nManager
      deviceLocale = NativeModules.I18nManager?.localeIdentifier;
    }
  } catch {
    // Ignore errors, use default
  }

  if (!deviceLocale) {
    return defaultLocale;
  }

  const normalizedLocale = deviceLocale.toLowerCase().replace('_', '-');

  // Check for exact match first
  for (const loc of locales) {
    if (normalizedLocale === loc.toLowerCase()) {
      return loc;
    }
  }

  // Map language families to supported locales
  if (normalizedLocale.startsWith('pt')) {
    return 'pt-BR';
  }
  if (normalizedLocale.startsWith('es')) {
    return 'es';
  }
  if (normalizedLocale.startsWith('en')) {
    return 'en-US';
  }

  return defaultLocale;
}

// =============================================================================
// CONTEXT
// =============================================================================

const I18nContext = createContext<I18nContextValue | null>(null);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Replace template params in string
 * Example: "Minimum {min} characters" with { min: 8 } => "Minimum 8 characters"
 */
function replaceParams(text: string, params: TranslationParams): string {
  let result = text;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored locale on mount, or detect from device if first launch
  useEffect(() => {
    async function init() {
      if (!initialLocale) {
        const stored = await loadStoredLocale();
        if (stored) {
          // User has previously selected a locale - use it
          setLocaleState(stored);
        } else {
          // First launch - detect from device and save
          const detectedLocale = detectDeviceLocale();
          setLocaleState(detectedLocale);
          await saveLocale(detectedLocale);
        }
      }
      setIsLoading(false);
    }
    init();
  }, [initialLocale]);

  // Set locale and persist
  const setLocale = useCallback(async (newLocale: Locale) => {
    if (!isValidLocale(newLocale)) {
      console.warn(`Invalid locale: ${newLocale}`);
      return;
    }
    setLocaleState(newLocale);
    await saveLocale(newLocale);
  }, []);

  // Translation function
  const t = useCallback(
    (path: TranslationPath, params?: TranslationParams): string => {
      const translations = translationsMap[locale];
      const value = getNestedValue(translations as unknown as Record<string, unknown>, path);

      if (typeof value !== 'string') {
        // Fallback to default locale
        if (locale !== defaultLocale) {
          const defaultTranslations = translationsMap[defaultLocale];
          const defaultValue = getNestedValue(
            defaultTranslations as unknown as Record<string, unknown>,
            path
          );
          if (typeof defaultValue === 'string') {
            return params ? replaceParams(defaultValue, params) : defaultValue;
          }
        }

        // Return path as fallback
        console.warn(`Translation not found: ${path}`);
        return path;
      }

      return params ? replaceParams(value, params) : value;
    },
    [locale]
  );

  // Memoizar contextValue para evitar re-renders desnecessários
  // Todos os descendentes só re-renderizam quando locale ou isLoading mudam
  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      translations: translationsMap[locale],
      isLoading,
    }),
    [locale, setLocale, t, isLoading]
  );

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access i18n context
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

/**
 * Hook to get translation function
 * Shorthand for useI18n().t
 */
export function useTranslation() {
  const { t, locale } = useI18n();
  return { t, locale };
}

/**
 * Hook to get and set locale
 */
export function useLocale() {
  const { locale, setLocale, isLoading } = useI18n();
  return { locale, setLocale, isLoading, locales };
}
