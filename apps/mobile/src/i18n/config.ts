/**
 * i18n Configuration
 *
 * Configuracao de internacionalizacao do aplicativo mobile.
 * Alinhado com as configuracoes do web app.
 */

// =============================================================================
// TYPES
// =============================================================================

export const locales = ['pt-BR', 'en-US', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';

export const localeNames: Record<Locale, string> = {
  'pt-BR': 'Portugues (Brasil)',
  'en-US': 'English (US)',
  'es': 'Espanol',
};

// Flags for UI display (emoji)
export const localeFlags: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  'en-US': '🇺🇸',
  'es': '🇪🇸',
};

// =============================================================================
// HELPERS
// =============================================================================

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getLocaleDisplayName(locale: Locale): string {
  return `${localeFlags[locale]} ${localeNames[locale]}`;
}

/**
 * Get device locale and map to supported locale
 */
export function getDeviceLocale(): Locale {
  // This will be overridden by actual device locale detection
  // For now, return default
  return defaultLocale;
}
