/// <reference types="jest" />

/**
 * Testes de integração para ClientForm com internacionalização
 *
 * Testes focados na lógica de getTaxIdConfig e isPIXAvailable
 * Os testes do componente completo dependem do setup correto do TranslationsProvider
 */

import { getTaxIdConfig, isPIXAvailable, TaxIdLocale } from '@/lib/utils';

describe('ClientForm - Tax ID Configuration Integration', () => {
  describe('getTaxIdConfig for different locales', () => {
    describe('pt-BR (Brazil)', () => {
      const config = getTaxIdConfig('pt-BR');

      it('should have correct labels for Brazilian documents', () => {
        expect(config.label).toBe('CPF / CNPJ');
        expect(config.labelBusiness).toBe('CNPJ');
      });

      it('should require tax ID for Brazil', () => {
        expect(config.required).toBe(true);
      });

      it('should enable CNPJ lookup for Brazil', () => {
        expect(config.showCnpjLookup).toBe(true);
      });

      it('should format CPF correctly', () => {
        expect(config.mask('52998224725')).toBe('529.982.247-25');
      });

      it('should format CNPJ correctly', () => {
        expect(config.mask('10426136000111')).toBe('10.426.136/0001-11');
      });

      it('should validate valid CPF', () => {
        expect(config.validate?.('52998224725')).toBe(true);
      });

      it('should validate valid CNPJ', () => {
        expect(config.validate?.('10426136000111')).toBe(true);
      });

      it('should reject invalid CPF', () => {
        expect(config.validate?.('12345678900')).toBe(false);
      });

      it('should reject invalid CNPJ', () => {
        expect(config.validate?.('12345678000100')).toBe(false);
      });
    });

    describe('en-US (USA)', () => {
      const config = getTaxIdConfig('en-US');

      it('should have correct labels for US tax IDs', () => {
        expect(config.label).toBe('Tax ID (SSN/EIN)');
        expect(config.labelBusiness).toBe('EIN (Employer ID)');
      });

      it('should NOT require tax ID for USA', () => {
        expect(config.required).toBe(false);
      });

      it('should NOT enable CNPJ lookup for USA', () => {
        expect(config.showCnpjLookup).toBe(false);
      });

      it('should format EIN correctly', () => {
        expect(config.mask('123456789')).toBe('12-3456789');
      });

      it('should validate valid 9-digit tax ID', () => {
        expect(config.validate?.('123456789')).toBe(true);
      });

      it('should reject invalid tax ID length', () => {
        expect(config.validate?.('12345678')).toBe(false);
        expect(config.validate?.('1234567890')).toBe(false);
      });
    });

    describe('es (Mexico)', () => {
      const config = getTaxIdConfig('es');

      it('should have correct labels for Mexican RFC', () => {
        expect(config.label).toBe('RFC');
        expect(config.labelBusiness).toBe('RFC (Registro Federal)');
      });

      it('should NOT require RFC for Mexico', () => {
        expect(config.required).toBe(false);
      });

      it('should NOT enable CNPJ lookup for Mexico', () => {
        expect(config.showCnpjLookup).toBe(false);
      });

      it('should format RFC correctly (uppercase)', () => {
        expect(config.mask('abc123456789')).toBe('ABC123456789');
      });

      it('should validate valid 12-char business RFC', () => {
        expect(config.validate?.('ABC123456789')).toBe(true);
      });

      it('should validate valid 13-char individual RFC', () => {
        expect(config.validate?.('XAXX010101000')).toBe(true);
      });

      it('should reject invalid RFC length', () => {
        expect(config.validate?.('ABC12345')).toBe(false);
        expect(config.validate?.('ABC12345678901')).toBe(false);
      });
    });
  });

  describe('isPIXAvailable integration with ClientForm', () => {
    it('should show PIX only for pt-BR locale', () => {
      expect(isPIXAvailable('pt-BR')).toBe(true);
      expect(isPIXAvailable('en-US')).toBe(false);
      expect(isPIXAvailable('es')).toBe(false);
    });
  });

  describe('Locale-specific validation behavior', () => {
    it('pt-BR: should require valid CPF/CNPJ', () => {
      const config = getTaxIdConfig('pt-BR');

      // Required field
      expect(config.required).toBe(true);

      // Valid documents pass
      expect(config.validate?.('52998224725')).toBe(true);
      expect(config.validate?.('10426136000111')).toBe(true);

      // Invalid documents fail
      expect(config.validate?.('11111111111')).toBe(false);
      expect(config.validate?.('00000000000000')).toBe(false);
    });

    it('en-US: should accept empty tax ID', () => {
      const config = getTaxIdConfig('en-US');

      // Not required
      expect(config.required).toBe(false);

      // If provided, must be valid
      expect(config.validate?.('123456789')).toBe(true);
      expect(config.validate?.('12345')).toBe(false);
    });

    it('es: should accept empty RFC', () => {
      const config = getTaxIdConfig('es');

      // Not required
      expect(config.required).toBe(false);

      // If provided, must be valid (12 or 13 chars)
      expect(config.validate?.('ABC123456789')).toBe(true);
      expect(config.validate?.('XAXX010101000')).toBe(true);
      expect(config.validate?.('ABC')).toBe(false);
    });
  });

  describe('Form field rendering logic', () => {
    const locales: TaxIdLocale[] = ['pt-BR', 'en-US', 'es'];

    it.each(locales)('should have placeholder for %s locale', (locale) => {
      const config = getTaxIdConfig(locale);
      expect(config.placeholder).toBeTruthy();
      expect(config.placeholder.length).toBeGreaterThan(0);
    });

    it.each(locales)('should have max length for %s locale', (locale) => {
      const config = getTaxIdConfig(locale);
      expect(config.maxLength).toBeGreaterThan(0);
    });

    it.each(locales)('should have mask function for %s locale', (locale) => {
      const config = getTaxIdConfig(locale);
      expect(typeof config.mask).toBe('function');
    });

    it.each(locales)('should have validate function for %s locale', (locale) => {
      const config = getTaxIdConfig(locale);
      expect(typeof config.validate).toBe('function');
    });
  });
});
