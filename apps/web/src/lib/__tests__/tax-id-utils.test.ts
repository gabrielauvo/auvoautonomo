/// <reference types="jest" />

/**
 * Testes unitários para funções de Tax ID internacionais
 *
 * Cobre:
 * - getTaxIdConfig: Configuração por locale (pt-BR, en-US, es)
 * - isPIXAvailable: Disponibilidade do PIX por locale
 * - usesBrazilianTaxId: Verificação de sistema brasileiro
 * - maskUSATaxId, maskEIN, maskSSN: Máscaras USA
 * - maskMexicoRFC: Máscara México
 * - isValidUSATaxId: Validação USA
 * - isValidMexicoRFC: Validação México
 */

import {
  getTaxIdConfig,
  isPIXAvailable,
  usesBrazilianTaxId,
  maskUSATaxId,
  maskEIN,
  maskSSN,
  maskMexicoRFC,
  isValidUSATaxId,
  isValidMexicoRFC,
  TaxIdLocale,
} from '../utils';

describe('getTaxIdConfig', () => {
  describe('pt-BR (Brazil)', () => {
    it('should return correct config for pt-BR locale', () => {
      const config = getTaxIdConfig('pt-BR');

      expect(config.label).toBe('CPF / CNPJ');
      expect(config.labelBusiness).toBe('CNPJ');
      expect(config.placeholder).toContain('000.000.000-00');
      expect(config.maxLength).toBe(18);
      expect(config.required).toBe(true);
      expect(config.showCnpjLookup).toBe(true);
    });

    it('should have a mask function that formats CPF correctly', () => {
      const config = getTaxIdConfig('pt-BR');

      expect(config.mask('52998224725')).toBe('529.982.247-25');
    });

    it('should have a mask function that formats CNPJ correctly', () => {
      const config = getTaxIdConfig('pt-BR');

      expect(config.mask('10426136000111')).toBe('10.426.136/0001-11');
    });

    it('should have a validate function that validates CPF', () => {
      const config = getTaxIdConfig('pt-BR');

      expect(config.validate?.('52998224725')).toBe(true);
      expect(config.validate?.('12345678900')).toBe(false);
    });

    it('should have a validate function that validates CNPJ', () => {
      const config = getTaxIdConfig('pt-BR');

      expect(config.validate?.('10426136000111')).toBe(true);
      expect(config.validate?.('12345678000100')).toBe(false);
    });
  });

  describe('en-US (USA)', () => {
    it('should return correct config for en-US locale', () => {
      const config = getTaxIdConfig('en-US');

      expect(config.label).toBe('Tax ID (SSN/EIN)');
      expect(config.labelBusiness).toBe('EIN (Employer ID)');
      expect(config.placeholder).toContain('XX-XXXXXXX');
      expect(config.maxLength).toBe(11);
      expect(config.required).toBe(false);
      expect(config.showCnpjLookup).toBe(false);
    });

    it('should have a mask function that formats EIN correctly', () => {
      const config = getTaxIdConfig('en-US');

      expect(config.mask('123456789')).toBe('12-3456789');
    });

    it('should have a validate function that validates 9-digit tax ID', () => {
      const config = getTaxIdConfig('en-US');

      expect(config.validate?.('123456789')).toBe(true);
      expect(config.validate?.('12345678')).toBe(false);
      expect(config.validate?.('1234567890')).toBe(false);
    });
  });

  describe('es (Mexico)', () => {
    it('should return correct config for es locale', () => {
      const config = getTaxIdConfig('es');

      expect(config.label).toBe('RFC');
      expect(config.labelBusiness).toBe('RFC (Registro Federal)');
      expect(config.placeholder).toContain('XXX');
      expect(config.maxLength).toBe(13);
      expect(config.required).toBe(false);
      expect(config.showCnpjLookup).toBe(false);
    });

    it('should have a mask function that formats RFC correctly', () => {
      const config = getTaxIdConfig('es');

      expect(config.mask('ABC123456789')).toBe('ABC123456789');
      expect(config.mask('XAXX010101000')).toBe('XAXX010101000');
    });

    it('should have a validate function that validates RFC length', () => {
      const config = getTaxIdConfig('es');

      // Business RFC (12 chars)
      expect(config.validate?.('ABC123456789')).toBe(true);
      // Individual RFC (13 chars)
      expect(config.validate?.('XAXX010101000')).toBe(true);
      // Invalid length
      expect(config.validate?.('ABC12345')).toBe(false);
      expect(config.validate?.('ABC12345678901')).toBe(false);
    });
  });

  describe('default locale', () => {
    it('should return pt-BR config for unknown locale', () => {
      const config = getTaxIdConfig('unknown' as TaxIdLocale);

      expect(config.label).toBe('CPF / CNPJ');
      expect(config.required).toBe(true);
      expect(config.showCnpjLookup).toBe(true);
    });
  });
});

describe('isPIXAvailable', () => {
  it('should return true for pt-BR', () => {
    expect(isPIXAvailable('pt-BR')).toBe(true);
  });

  it('should return false for en-US', () => {
    expect(isPIXAvailable('en-US')).toBe(false);
  });

  it('should return false for es', () => {
    expect(isPIXAvailable('es')).toBe(false);
  });
});

describe('usesBrazilianTaxId', () => {
  it('should return true for pt-BR', () => {
    expect(usesBrazilianTaxId('pt-BR')).toBe(true);
  });

  it('should return false for en-US', () => {
    expect(usesBrazilianTaxId('en-US')).toBe(false);
  });

  it('should return false for es', () => {
    expect(usesBrazilianTaxId('es')).toBe(false);
  });
});

describe('maskUSATaxId', () => {
  it('should mask EIN format (XX-XXXXXXX)', () => {
    expect(maskUSATaxId('123456789')).toBe('12-3456789');
  });

  it('should handle partial input', () => {
    expect(maskUSATaxId('12')).toBe('12');
    expect(maskUSATaxId('123')).toBe('12-3');
    expect(maskUSATaxId('12345')).toBe('12-345');
  });

  it('should strip non-numeric characters', () => {
    expect(maskUSATaxId('12-345-6789')).toBe('12-3456789');
    expect(maskUSATaxId('12.345.6789')).toBe('12-3456789');
  });

  it('should limit to 9 digits', () => {
    expect(maskUSATaxId('1234567890123')).toBe('12-3456789');
  });

  it('should handle empty input', () => {
    expect(maskUSATaxId('')).toBe('');
  });
});

describe('maskEIN', () => {
  it('should mask EIN format (XX-XXXXXXX)', () => {
    expect(maskEIN('123456789')).toBe('12-3456789');
  });

  it('should handle partial input', () => {
    expect(maskEIN('12')).toBe('12');
    expect(maskEIN('123')).toBe('12-3');
  });

  it('should limit to 9 digits', () => {
    expect(maskEIN('1234567890')).toBe('12-3456789');
  });
});

describe('maskSSN', () => {
  it('should mask SSN format (XXX-XX-XXXX)', () => {
    expect(maskSSN('123456789')).toBe('123-45-6789');
  });

  it('should handle partial input', () => {
    expect(maskSSN('123')).toBe('123');
    expect(maskSSN('12345')).toBe('123-45');
    expect(maskSSN('123456')).toBe('123-45-6');
  });

  it('should strip non-numeric characters', () => {
    expect(maskSSN('123-45-6789')).toBe('123-45-6789');
  });

  it('should handle empty input', () => {
    expect(maskSSN('')).toBe('');
  });
});

describe('maskMexicoRFC', () => {
  it('should keep alphanumeric characters only', () => {
    expect(maskMexicoRFC('ABC123456789')).toBe('ABC123456789');
  });

  it('should convert to uppercase', () => {
    expect(maskMexicoRFC('abc123456789')).toBe('ABC123456789');
  });

  it('should limit to 13 characters', () => {
    expect(maskMexicoRFC('ABCD1234567890')).toBe('ABCD123456789');
  });

  it('should strip special characters', () => {
    expect(maskMexicoRFC('ABC-123-456-789')).toBe('ABC123456789');
    expect(maskMexicoRFC('ABC.123.456.789')).toBe('ABC123456789');
  });

  it('should handle empty input', () => {
    expect(maskMexicoRFC('')).toBe('');
  });

  it('should handle individual RFC (13 chars)', () => {
    expect(maskMexicoRFC('XAXX010101000')).toBe('XAXX010101000');
  });
});

describe('isValidUSATaxId', () => {
  it('should return true for valid 9-digit EIN', () => {
    expect(isValidUSATaxId('123456789')).toBe(true);
  });

  it('should return true for valid 9-digit SSN', () => {
    expect(isValidUSATaxId('123456789')).toBe(true);
  });

  it('should return false for less than 9 digits', () => {
    expect(isValidUSATaxId('12345678')).toBe(false);
    expect(isValidUSATaxId('1234567')).toBe(false);
  });

  it('should return false for more than 9 digits', () => {
    expect(isValidUSATaxId('1234567890')).toBe(false);
  });

  it('should strip non-numeric characters before validation', () => {
    expect(isValidUSATaxId('12-3456789')).toBe(true);
    expect(isValidUSATaxId('123-45-6789')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidUSATaxId('')).toBe(false);
  });
});

describe('isValidMexicoRFC', () => {
  it('should return true for valid 12-char business RFC', () => {
    expect(isValidMexicoRFC('ABC123456789')).toBe(true);
  });

  it('should return true for valid 13-char individual RFC', () => {
    expect(isValidMexicoRFC('XAXX010101000')).toBe(true);
  });

  it('should return false for less than 12 characters', () => {
    expect(isValidMexicoRFC('ABC12345678')).toBe(false);
    expect(isValidMexicoRFC('ABC1234')).toBe(false);
  });

  it('should return false for more than 13 characters', () => {
    expect(isValidMexicoRFC('XAXX0101010001')).toBe(false);
  });

  it('should strip special characters before validation', () => {
    expect(isValidMexicoRFC('ABC-123-456-789')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidMexicoRFC('')).toBe(false);
  });
});
