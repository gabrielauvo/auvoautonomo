import {
  capitalize,
  slugify,
  isValidEmail,
  formatDate,
  delay,
  sanitizeString,
  isValidCpf,
  isValidCnpj,
  formatCurrency,
} from './index';

describe('shared-utils', () => {
  describe('capitalize', () => {
    it('should capitalize the first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('World');
    });

    it('should handle empty strings', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('should handle null/undefined gracefully', () => {
      expect(capitalize(null as unknown as string)).toBe('');
      expect(capitalize(undefined as unknown as string)).toBe('');
    });
  });

  describe('slugify', () => {
    it('should convert text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('  Test  String  ')).toBe('test-string');
    });

    it('should handle accented characters', () => {
      expect(slugify('São Paulo')).toBe('sao-paulo');
      expect(slugify('Café com Açúcar')).toBe('cafe-com-acucar');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello! @World#')).toBe('hello-world');
    });

    it('should handle strings with only special characters', () => {
      expect(slugify('!!!')).toBe('');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(slugify('-hello-world-')).toBe('hello-world');
    });
  });

  describe('isValidEmail', () => {
    it('should validate email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isValidEmail(null as unknown as string)).toBe(false);
      expect(isValidEmail(undefined as unknown as string)).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('should format date to ISO string', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(formatDate(date)).toBe('2024-01-15');
    });

    it('should throw for invalid dates', () => {
      expect(() => formatDate(new Date('invalid'))).toThrow('Invalid date');
    });

    it('should throw for non-Date objects', () => {
      expect(() => formatDate('2024-01-15' as unknown as Date)).toThrow(
        'Invalid date',
      );
      expect(() => formatDate(null as unknown as Date)).toThrow('Invalid date');
    });
  });

  describe('delay', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small margin
    });

    it('should throw for negative values', () => {
      expect(() => delay(-100)).toThrow('positive finite number');
    });

    it('should throw for non-finite values', () => {
      expect(() => delay(NaN)).toThrow('positive finite number');
      expect(() => delay(Infinity)).toThrow('positive finite number');
    });

    it('should be abortable', async () => {
      const controller = new AbortController();

      const delayPromise = delay(10000, controller.signal);

      setTimeout(() => controller.abort(), 50);

      await expect(delayPromise).rejects.toThrow('Delay aborted');
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeString('<script>alert(1)</script>')).toBe(
        'scriptalert(1)/script',
      );
      expect(sanitizeString('onclick="hack()"')).toBe('"hack()"');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeString(null as unknown as string)).toBe('');
      expect(sanitizeString(undefined as unknown as string)).toBe('');
    });
  });

  describe('isValidCpf', () => {
    it('should validate correct CPFs', () => {
      expect(isValidCpf('529.982.247-25')).toBe(true);
      expect(isValidCpf('52998224725')).toBe(true);
    });

    it('should reject invalid CPFs', () => {
      expect(isValidCpf('111.111.111-11')).toBe(false);
      expect(isValidCpf('123.456.789-00')).toBe(false);
      expect(isValidCpf('12345')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isValidCpf('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isValidCpf(null as unknown as string)).toBe(false);
      expect(isValidCpf(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isValidCnpj', () => {
    it('should validate correct CNPJs', () => {
      expect(isValidCnpj('11.444.777/0001-61')).toBe(true);
      expect(isValidCnpj('11444777000161')).toBe(true);
    });

    it('should reject invalid CNPJs', () => {
      expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
      expect(isValidCnpj('12.345.678/0001-00')).toBe(false);
      expect(isValidCnpj('12345')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isValidCnpj('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isValidCnpj(null as unknown as string)).toBe(false);
      expect(isValidCnpj(undefined as unknown as string)).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency in BRL', () => {
      expect(formatCurrency(1234.56)).toBe('R$\xa01.234,56');
    });

    it('should format currency in USD', () => {
      const result = formatCurrency(1234.56, 'USD', 'en-US');
      expect(result).toContain('1,234.56');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('R$\xa00,00');
    });

    it('should return empty for non-finite numbers', () => {
      expect(formatCurrency(NaN)).toBe('');
      expect(formatCurrency(Infinity)).toBe('');
    });
  });
});
