/**
 * i18n Tests
 *
 * Testes para o sistema de internacionalizacao.
 */

import {
  locales,
  defaultLocale,
  localeNames,
  localeFlags,
  isValidLocale,
  getLocaleDisplayName,
  Locale,
} from '../../src/i18n/config';
import { ptBR, enUS, es, Translations } from '../../src/i18n/locales';

// =============================================================================
// CONFIG TESTS
// =============================================================================

describe('i18n Config', () => {
  describe('locales', () => {
    it('should have exactly 3 locales', () => {
      expect(locales).toHaveLength(3);
    });

    it('should contain pt-BR, en-US, and es', () => {
      expect(locales).toContain('pt-BR');
      expect(locales).toContain('en-US');
      expect(locales).toContain('es');
    });
  });

  describe('defaultLocale', () => {
    it('should be pt-BR', () => {
      expect(defaultLocale).toBe('pt-BR');
    });

    it('should be a valid locale', () => {
      expect(locales).toContain(defaultLocale);
    });
  });

  describe('localeNames', () => {
    it('should have names for all locales', () => {
      for (const locale of locales) {
        expect(localeNames[locale]).toBeDefined();
        expect(typeof localeNames[locale]).toBe('string');
        expect(localeNames[locale].length).toBeGreaterThan(0);
      }
    });

    it('should have correct names', () => {
      expect(localeNames['pt-BR']).toContain('Portug');
      expect(localeNames['en-US']).toContain('English');
      expect(localeNames['es']).toContain('Espa');
    });
  });

  describe('localeFlags', () => {
    it('should have flags for all locales', () => {
      for (const locale of locales) {
        expect(localeFlags[locale]).toBeDefined();
        expect(typeof localeFlags[locale]).toBe('string');
      }
    });
  });

  describe('isValidLocale', () => {
    it('should return true for valid locales', () => {
      expect(isValidLocale('pt-BR')).toBe(true);
      expect(isValidLocale('en-US')).toBe(true);
      expect(isValidLocale('es')).toBe(true);
    });

    it('should return false for invalid locales', () => {
      expect(isValidLocale('fr-FR')).toBe(false);
      expect(isValidLocale('de-DE')).toBe(false);
      expect(isValidLocale('')).toBe(false);
      expect(isValidLocale('invalid')).toBe(false);
    });
  });

  describe('getLocaleDisplayName', () => {
    it('should return flag and name for each locale', () => {
      for (const locale of locales) {
        const displayName = getLocaleDisplayName(locale);
        expect(displayName).toContain(localeFlags[locale]);
        expect(displayName).toContain(localeNames[locale]);
      }
    });
  });
});

// =============================================================================
// TRANSLATIONS STRUCTURE TESTS
// =============================================================================

describe('Translations Structure', () => {
  const allTranslations: Record<Locale, Translations> = {
    'pt-BR': ptBR,
    'en-US': enUS,
    'es': es,
  };

  describe('all translations have same structure', () => {
    const referenceKeys = Object.keys(ptBR);

    it('should have same top-level keys', () => {
      for (const locale of locales) {
        const translations = allTranslations[locale];
        const keys = Object.keys(translations);

        expect(keys.sort()).toEqual(referenceKeys.sort());
      }
    });

    it('should have common section with all required keys', () => {
      const commonKeys = [
        'save', 'cancel', 'delete', 'edit', 'create', 'add', 'remove',
        'search', 'filter', 'loading', 'error', 'success', 'confirm',
        'back', 'next', 'close', 'yes', 'no',
      ];

      for (const locale of locales) {
        const translations = allTranslations[locale];
        for (const key of commonKeys) {
          expect(translations.common[key as keyof typeof translations.common]).toBeDefined();
        }
      }
    });

    it('should have auth section with all required keys', () => {
      const authKeys = [
        'login', 'logout', 'email', 'password', 'forgotPassword',
      ];

      for (const locale of locales) {
        const translations = allTranslations[locale];
        for (const key of authKeys) {
          expect(translations.auth[key as keyof typeof translations.auth]).toBeDefined();
        }
      }
    });

    it('should have navigation section with all required keys', () => {
      const navKeys = [
        'home', 'dashboard', 'clients', 'workOrders', 'schedule',
        'settings', 'profile', 'sync',
      ];

      for (const locale of locales) {
        const translations = allTranslations[locale];
        for (const key of navKeys) {
          expect(translations.navigation[key as keyof typeof translations.navigation]).toBeDefined();
        }
      }
    });

    it('should have checklists section with questionTypes', () => {
      const questionTypeKeys = [
        'textShort', 'textLong', 'number', 'date', 'time', 'datetime',
        'checkbox', 'select', 'multiSelect', 'photoRequired', 'photoOptional',
        'fileUpload', 'signatureTechnician', 'signatureClient', 'sectionTitle',
        'rating', 'scale',
      ];

      for (const locale of locales) {
        const translations = allTranslations[locale];
        expect(translations.checklists.questionTypes).toBeDefined();

        for (const key of questionTypeKeys) {
          expect(
            translations.checklists.questionTypes[key as keyof typeof translations.checklists.questionTypes]
          ).toBeDefined();
        }
      }
    });

    it('should have settings section with language key', () => {
      for (const locale of locales) {
        const translations = allTranslations[locale];
        expect(translations.settings.language).toBeDefined();
        expect(translations.settings.selectLanguage).toBeDefined();
      }
    });

    it('should have errors section', () => {
      const errorKeys = [
        'generic', 'network', 'unauthorized', 'forbidden', 'notFound',
        'validation', 'serverError', 'timeout',
      ];

      for (const locale of locales) {
        const translations = allTranslations[locale];
        for (const key of errorKeys) {
          expect(translations.errors[key as keyof typeof translations.errors]).toBeDefined();
        }
      }
    });

    it('should have validation section', () => {
      const validationKeys = [
        'required', 'email', 'minLength', 'maxLength', 'phone',
      ];

      for (const locale of locales) {
        const translations = allTranslations[locale];
        for (const key of validationKeys) {
          expect(translations.validation[key as keyof typeof translations.validation]).toBeDefined();
        }
      }
    });
  });
});

// =============================================================================
// TRANSLATION VALUES TESTS
// =============================================================================

describe('Translation Values', () => {
  describe('pt-BR translations', () => {
    it('should have correct common translations', () => {
      expect(ptBR.common.save).toBe('Salvar');
      expect(ptBR.common.cancel).toBe('Cancelar');
      expect(ptBR.common.delete).toBe('Excluir');
      expect(ptBR.common.loading).toBe('Carregando...');
    });

    it('should have correct auth translations', () => {
      expect(ptBR.auth.login).toBe('Entrar');
      expect(ptBR.auth.logout).toBe('Sair');
      expect(ptBR.auth.email).toBe('Email');
    });

    it('should have correct checklist question types', () => {
      expect(ptBR.checklists.questionTypes.textShort).toBe('Texto Curto');
      expect(ptBR.checklists.questionTypes.photoRequired).toBe('Foto Obrigatoria');
      expect(ptBR.checklists.questionTypes.signatureClient).toBe('Assinatura Cliente');
    });
  });

  describe('en-US translations', () => {
    it('should have correct common translations', () => {
      expect(enUS.common.save).toBe('Save');
      expect(enUS.common.cancel).toBe('Cancel');
      expect(enUS.common.delete).toBe('Delete');
      expect(enUS.common.loading).toBe('Loading...');
    });

    it('should have correct auth translations', () => {
      expect(enUS.auth.login).toBe('Sign In');
      expect(enUS.auth.logout).toBe('Sign Out');
      expect(enUS.auth.email).toBe('Email');
    });

    it('should have correct checklist question types', () => {
      expect(enUS.checklists.questionTypes.textShort).toBe('Short Text');
      expect(enUS.checklists.questionTypes.photoRequired).toBe('Photo Required');
      expect(enUS.checklists.questionTypes.signatureClient).toBe('Client Signature');
    });
  });

  describe('es translations', () => {
    it('should have correct common translations', () => {
      expect(es.common.save).toBe('Guardar');
      expect(es.common.cancel).toBe('Cancelar');
      expect(es.common.delete).toBe('Eliminar');
      expect(es.common.loading).toBe('Cargando...');
    });

    it('should have correct auth translations', () => {
      expect(es.auth.login).toBe('Iniciar Sesion');
      expect(es.auth.logout).toBe('Cerrar Sesion');
      expect(es.auth.email).toBe('Correo electronico');
    });

    it('should have correct checklist question types', () => {
      expect(es.checklists.questionTypes.textShort).toBe('Texto Corto');
      expect(es.checklists.questionTypes.photoRequired).toBe('Foto Obligatoria');
      expect(es.checklists.questionTypes.signatureClient).toBe('Firma del Cliente');
    });
  });
});

// =============================================================================
// TEMPLATE PARAMS TESTS
// =============================================================================

describe('Template Parameters', () => {
  describe('validation messages with params', () => {
    it('should have minLength with {min} placeholder', () => {
      expect(ptBR.validation.minLength).toContain('{min}');
      expect(enUS.validation.minLength).toContain('{min}');
      expect(es.validation.minLength).toContain('{min}');
    });

    it('should have maxLength with {max} placeholder', () => {
      expect(ptBR.validation.maxLength).toContain('{max}');
      expect(enUS.validation.maxLength).toContain('{max}');
      expect(es.validation.maxLength).toContain('{max}');
    });
  });
});

// =============================================================================
// CONSISTENCY TESTS
// =============================================================================

describe('Translation Consistency', () => {
  it('all translations should be non-empty strings', () => {
    const checkStrings = (obj: Record<string, unknown>, path = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'object' && value !== null) {
          checkStrings(value as Record<string, unknown>, currentPath);
        } else if (typeof value === 'string') {
          expect(value.length).toBeGreaterThan(0);
        }
      }
    };

    checkStrings(ptBR as unknown as Record<string, unknown>);
    checkStrings(enUS as unknown as Record<string, unknown>);
    checkStrings(es as unknown as Record<string, unknown>);
  });

  it('should not have any undefined values', () => {
    const checkUndefined = (obj: Record<string, unknown>, path = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        expect(value).toBeDefined();

        if (typeof value === 'object' && value !== null) {
          checkUndefined(value as Record<string, unknown>, currentPath);
        }
      }
    };

    checkUndefined(ptBR as unknown as Record<string, unknown>);
    checkUndefined(enUS as unknown as Record<string, unknown>);
    checkUndefined(es as unknown as Record<string, unknown>);
  });
});
