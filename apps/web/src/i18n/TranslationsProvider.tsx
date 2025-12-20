'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Locale, defaultLocale, locales } from './config';

// Import all messages statically
import ptBR from '../../messages/pt-BR.json';
import enUS from '../../messages/en-US.json';
import es from '../../messages/es.json';

type Messages = typeof ptBR;

const messages: Record<Locale, Messages> = {
  'pt-BR': ptBR,
  'en-US': enUS as Messages,
  'es': es as Messages,
};

interface TranslationsContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const TranslationsContext = createContext<TranslationsContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'app-locale';

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

export function TranslationsProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Load locale from localStorage on mount - usando isMounted para evitar hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    // Só acessar localStorage após montagem no cliente
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
      if (savedLocale && locales.includes(savedLocale)) {
        setLocaleState(savedLocale);
      }
    }
    setIsLoading(false);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    if (locales.includes(newLocale)) {
      setLocaleState(newLocale);
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const currentMessages = messages[locale] || messages[defaultLocale];
    let value = getNestedValue(currentMessages as unknown as Record<string, unknown>, key);

    if (value === undefined) {
      // Fallback to default locale
      value = getNestedValue(messages[defaultLocale] as unknown as Record<string, unknown>, key);
    }

    if (value === undefined) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }

    // Replace parameters like {name} with actual values
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }

    return value;
  }, [locale]);

  return (
    <TranslationsContext.Provider value={{ locale, setLocale, t, isLoading }}>
      {children}
    </TranslationsContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const context = useContext(TranslationsContext);
  if (context === undefined) {
    throw new Error('useTranslations must be used within a TranslationsProvider');
  }

  const { locale, setLocale, t: baseT, isLoading } = context;

  // If namespace is provided, prefix all keys with it
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return baseT(fullKey, params);
  }, [namespace, baseT]);

  return { locale, setLocale, t, isLoading };
}

// Export the raw context hook for cases where namespace isn't needed
export function useLocale() {
  const context = useContext(TranslationsContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a TranslationsProvider');
  }
  return { locale: context.locale, setLocale: context.setLocale };
}
