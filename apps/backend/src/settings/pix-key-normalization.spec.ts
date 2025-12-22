/**
 * Pix Key Normalization Tests
 *
 * These tests verify the normalization logic for Pix keys by type.
 */

describe('Pix Key Normalization', () => {
  // Normalization function (mirrors the one in settings.controller.ts)
  const normalizePixKey = (key: string | null | undefined, keyType?: string | null): string | null => {
    if (!key || key.trim() === '') return null;
    const trimmedKey = key.trim();

    switch (keyType) {
      case 'CPF':
      case 'CNPJ':
        // Remove non-digits for CPF/CNPJ
        return trimmedKey.replace(/\D/g, '');

      case 'PHONE':
        // Normalize to E.164 format
        let phone = trimmedKey.replace(/\D/g, '');
        // If doesn't start with country code, add Brazil's
        if (phone.length <= 11) {
          phone = '55' + phone;
        }
        return '+' + phone;

      case 'EMAIL':
        // Lowercase for email
        return trimmedKey.toLowerCase();

      case 'RANDOM':
      default:
        // Keep as-is for random keys
        return trimmedKey;
    }
  };

  describe('CPF normalization', () => {
    it('should remove formatting from CPF', () => {
      expect(normalizePixKey('123.456.789-00', 'CPF')).toBe('12345678900');
    });

    it('should handle CPF without formatting', () => {
      expect(normalizePixKey('12345678900', 'CPF')).toBe('12345678900');
    });

    it('should remove any non-digit characters', () => {
      expect(normalizePixKey('123abc456def789ghi00', 'CPF')).toBe('12345678900');
    });
  });

  describe('CNPJ normalization', () => {
    it('should remove formatting from CNPJ', () => {
      expect(normalizePixKey('12.345.678/0001-00', 'CNPJ')).toBe('12345678000100');
    });

    it('should handle CNPJ without formatting', () => {
      expect(normalizePixKey('12345678000100', 'CNPJ')).toBe('12345678000100');
    });
  });

  describe('PHONE normalization', () => {
    it('should add country code for Brazilian mobile', () => {
      expect(normalizePixKey('11999887766', 'PHONE')).toBe('+5511999887766');
    });

    it('should add country code for Brazilian landline', () => {
      expect(normalizePixKey('1133334444', 'PHONE')).toBe('+551133334444');
    });

    it('should handle phone with formatting', () => {
      expect(normalizePixKey('(11) 99988-7766', 'PHONE')).toBe('+5511999887766');
    });

    it('should keep country code if already present (13+ digits)', () => {
      expect(normalizePixKey('+5511999887766', 'PHONE')).toBe('+5511999887766');
    });

    it('should handle phone starting with 55 already', () => {
      // If user enters 5511999887766 (13 digits), keep as-is
      expect(normalizePixKey('5511999887766', 'PHONE')).toBe('+5511999887766');
    });
  });

  describe('EMAIL normalization', () => {
    it('should lowercase email', () => {
      expect(normalizePixKey('User@Example.COM', 'EMAIL')).toBe('user@example.com');
    });

    it('should handle already lowercase email', () => {
      expect(normalizePixKey('user@example.com', 'EMAIL')).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      expect(normalizePixKey('  user@example.com  ', 'EMAIL')).toBe('user@example.com');
    });
  });

  describe('RANDOM key normalization', () => {
    it('should keep random key as-is', () => {
      const randomKey = 'abc123-def456-ghi789';
      expect(normalizePixKey(randomKey, 'RANDOM')).toBe(randomKey);
    });

    it('should only trim whitespace', () => {
      expect(normalizePixKey('  abc123-def456  ', 'RANDOM')).toBe('abc123-def456');
    });
  });

  describe('Edge cases', () => {
    it('should return null for null input', () => {
      expect(normalizePixKey(null, 'CPF')).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(normalizePixKey(undefined, 'CPF')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(normalizePixKey('', 'CPF')).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      expect(normalizePixKey('   ', 'CPF')).toBeNull();
    });

    it('should handle unknown key type as RANDOM', () => {
      const key = 'some-key-value';
      expect(normalizePixKey(key, 'UNKNOWN')).toBe(key);
    });

    it('should handle null key type as RANDOM', () => {
      const key = 'some-key-value';
      expect(normalizePixKey(key, null)).toBe(key);
    });
  });
});
