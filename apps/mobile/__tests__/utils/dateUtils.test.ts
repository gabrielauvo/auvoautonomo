/**
 * Date Utilities Tests
 *
 * Testes para funções de manipulação de datas no timezone local.
 */

import {
  formatLocalDate,
  formatLocalDateTime,
  getTodayLocalDate,
  extractDatePart,
  compareDates,
  isToday,
  isBeforeToday,
  isAfterToday,
  parseLocalDate,
  addDays,
  formatDateBR,
  formatDateTimeBR,
  formatTimeBR,
} from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('formatLocalDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date(2025, 0, 15); // January 15, 2025
      expect(formatLocalDate(date)).toBe('2025-01-15');
    });

    it('should pad single digit month and day', () => {
      const date = new Date(2025, 0, 5); // January 5, 2025
      expect(formatLocalDate(date)).toBe('2025-01-05');
    });

    it('should format December correctly', () => {
      const date = new Date(2025, 11, 25); // December 25, 2025
      expect(formatLocalDate(date)).toBe('2025-12-25');
    });
  });

  describe('formatLocalDateTime', () => {
    it('should format date and time as YYYY-MM-DDTHH:mm:ss', () => {
      const date = new Date(2025, 0, 15, 14, 30, 45); // January 15, 2025 14:30:45
      expect(formatLocalDateTime(date)).toBe('2025-01-15T14:30:45');
    });

    it('should pad single digit hours, minutes, seconds', () => {
      const date = new Date(2025, 0, 5, 9, 5, 3); // January 5, 2025 09:05:03
      expect(formatLocalDateTime(date)).toBe('2025-01-05T09:05:03');
    });

    it('should handle midnight', () => {
      const date = new Date(2025, 5, 10, 0, 0, 0); // June 10, 2025 00:00:00
      expect(formatLocalDateTime(date)).toBe('2025-06-10T00:00:00');
    });
  });

  describe('getTodayLocalDate', () => {
    it('should return today as YYYY-MM-DD', () => {
      const result = getTodayLocalDate();
      const today = new Date();
      const expected = formatLocalDate(today);
      expect(result).toBe(expected);
    });

    it('should match the pattern YYYY-MM-DD', () => {
      const result = getTodayLocalDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('extractDatePart', () => {
    it('should extract date from ISO string', () => {
      expect(extractDatePart('2025-01-15T14:30:00.000Z')).toBe('2025-01-15');
    });

    it('should return date string as is', () => {
      expect(extractDatePart('2025-01-15')).toBe('2025-01-15');
    });

    it('should return null for null input', () => {
      expect(extractDatePart(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(extractDatePart(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractDatePart('')).toBeNull();
    });
  });

  describe('compareDates', () => {
    it('should return -1 when date1 is before date2', () => {
      expect(compareDates('2025-01-10', '2025-01-15')).toBe(-1);
      expect(compareDates(new Date(2025, 0, 10), new Date(2025, 0, 15))).toBe(-1);
    });

    it('should return 1 when date1 is after date2', () => {
      expect(compareDates('2025-01-20', '2025-01-15')).toBe(1);
      expect(compareDates(new Date(2025, 0, 20), new Date(2025, 0, 15))).toBe(1);
    });

    it('should return 0 when dates are equal', () => {
      expect(compareDates('2025-01-15', '2025-01-15')).toBe(0);
      expect(compareDates(new Date(2025, 0, 15), new Date(2025, 0, 15))).toBe(0);
    });

    it('should compare Date and string', () => {
      expect(compareDates(new Date(2025, 0, 10), '2025-01-15')).toBe(-1);
      expect(compareDates('2025-01-20', new Date(2025, 0, 15))).toBe(1);
    });

    it('should return 0 for invalid dates', () => {
      expect(compareDates('', '2025-01-15')).toBe(0);
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
      expect(isToday(getTodayLocalDate())).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = addDays(new Date(), -1);
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = addDays(new Date(), 1);
      expect(isToday(tomorrow)).toBe(false);
    });

    it('should work with string dates', () => {
      const today = getTodayLocalDate();
      expect(isToday(today)).toBe(true);
    });
  });

  describe('isBeforeToday', () => {
    it('should return true for past dates', () => {
      const yesterday = addDays(new Date(), -1);
      expect(isBeforeToday(yesterday)).toBe(true);
    });

    it('should return false for today', () => {
      expect(isBeforeToday(new Date())).toBe(false);
      expect(isBeforeToday(getTodayLocalDate())).toBe(false);
    });

    it('should return false for future dates', () => {
      const tomorrow = addDays(new Date(), 1);
      expect(isBeforeToday(tomorrow)).toBe(false);
    });

    it('should work with string dates', () => {
      expect(isBeforeToday('2020-01-01')).toBe(true);
    });
  });

  describe('isAfterToday', () => {
    it('should return true for future dates', () => {
      const tomorrow = addDays(new Date(), 1);
      expect(isAfterToday(tomorrow)).toBe(true);
    });

    it('should return false for today', () => {
      expect(isAfterToday(new Date())).toBe(false);
      expect(isAfterToday(getTodayLocalDate())).toBe(false);
    });

    it('should return false for past dates', () => {
      const yesterday = addDays(new Date(), -1);
      expect(isAfterToday(yesterday)).toBe(false);
    });

    it('should work with string dates', () => {
      expect(isAfterToday('2099-12-31')).toBe(true);
    });
  });

  describe('parseLocalDate', () => {
    it('should parse date string in local timezone', () => {
      const result = parseLocalDate('2025-01-15');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });

    it('should set time to midnight', () => {
      const result = parseLocalDate('2025-06-20');
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('should parse different dates correctly', () => {
      expect(parseLocalDate('2025-12-25').getMonth()).toBe(11); // December
      expect(parseLocalDate('2025-02-28').getDate()).toBe(28);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date(2025, 0, 15);
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(20);
    });

    it('should subtract negative days', () => {
      const date = new Date(2025, 0, 15);
      const result = addDays(date, -5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle month overflow', () => {
      const date = new Date(2025, 0, 30); // January 30
      const result = addDays(date, 5);
      expect(result.getMonth()).toBe(1); // February
    });

    it('should not mutate original date', () => {
      const date = new Date(2025, 0, 15);
      addDays(date, 5);
      expect(date.getDate()).toBe(15);
    });
  });

  describe('formatDateBR', () => {
    it('should format date in Brazilian format', () => {
      const date = new Date(2025, 0, 15);
      const result = formatDateBR(date);
      expect(result).toMatch(/15\/0?1\/2025/);
    });

    it('should accept string input', () => {
      // Use full ISO string with timezone to avoid parsing issues
      const result = formatDateBR('2025-01-15T12:00:00');
      expect(result).toMatch(/2025/);
    });
  });

  describe('formatDateTimeBR', () => {
    it('should format date and time in Brazilian format', () => {
      const date = new Date(2025, 0, 15, 14, 30);
      const result = formatDateTimeBR(date);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/14/);
      expect(result).toMatch(/30/);
    });

    it('should accept string input', () => {
      const result = formatDateTimeBR('2025-01-15T14:30:00');
      expect(result).toMatch(/15/);
    });
  });

  describe('formatTimeBR', () => {
    it('should format time as HH:mm', () => {
      const date = new Date(2025, 0, 15, 14, 30);
      const result = formatTimeBR(date);
      expect(result).toMatch(/14:30/);
    });

    it('should accept string input', () => {
      const result = formatTimeBR('2025-01-15T09:05:00');
      expect(result).toMatch(/09:05/);
    });

    it('should pad single digit hours and minutes', () => {
      const date = new Date(2025, 0, 15, 9, 5);
      const result = formatTimeBR(date);
      expect(result).toMatch(/0?9:05/);
    });
  });
});
