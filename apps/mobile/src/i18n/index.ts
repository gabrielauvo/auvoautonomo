/**
 * i18n Module Index
 *
 * Exporta todos os componentes e hooks de internacionalizacao.
 */

// Config
export {
  locales,
  defaultLocale,
  localeNames,
  localeFlags,
  isValidLocale,
  getLocaleDisplayName,
  getDeviceLocale,
  type Locale,
} from './config';

// Locales
export { ptBR, enUS, es, type Translations } from './locales';

// Provider and Hooks
export {
  I18nProvider,
  useI18n,
  useTranslation,
  useLocale,
} from './I18nProvider';

// Components
export {
  LanguageSelectorButton,
  LanguageSelectorModal,
  LanguageSelectorInline,
} from './LanguageSelector';
