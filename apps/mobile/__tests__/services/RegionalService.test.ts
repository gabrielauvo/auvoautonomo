/**
 * Tests for RegionalService
 *
 * Cobre:
 * - Formatação de moeda
 * - Formatação de datas com timezone
 * - Obtenção de configurações
 * - Mapeamento de locale
 */

import { RegionalService, RegionalSettings, CountryInfo, CurrencyInfo, TimezoneInfo } from '../../src/services/RegionalService';
import { AuthService } from '../../src/services/AuthService';

// Mock AuthService
jest.mock('../../src/services/AuthService', () => ({
  AuthService: {
    getAccessToken: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://test-api.com',
    },
  },
}));

describe('RegionalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('getSettings', () => {
    it('should return default settings when not authenticated', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue(null);

      const settings = await RegionalService.getSettings();

      expect(settings).toEqual({
        country: 'BR',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      });
    });

    it('should fetch settings from API when authenticated', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            country: 'US',
            currency: 'USD',
            timezone: 'America/New_York',
          }),
      });

      const settings = await RegionalService.getSettings();

      expect(settings).toEqual({
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/settings/regional',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-token',
          },
        })
      );
    });

    it('should return default settings on API error', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
      });

      const settings = await RegionalService.getSettings();

      expect(settings.country).toBe('BR');
      expect(settings.currency).toBe('BRL');
    });

    it('should return default settings on network error', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('test-token');
      mockFetch.mockRejectedValue(new Error('Network error'));

      const settings = await RegionalService.getSettings();

      expect(settings.country).toBe('BR');
      expect(settings.currency).toBe('BRL');
    });
  });

  describe('updateSettings', () => {
    it('should throw error when not authenticated', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue(null);

      await expect(RegionalService.updateSettings({ country: 'US' })).rejects.toThrow(
        'Not authenticated'
      );
    });

    it('should update settings via API', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            country: 'US',
            currency: 'USD',
            timezone: 'America/New_York',
          }),
      });

      const settings = await RegionalService.updateSettings({ country: 'US' });

      expect(settings.country).toBe('US');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/settings/regional',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({ country: 'US' }),
        })
      );
    });

    it('should throw error on API failure', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('test-token');
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid country' }),
      });

      await expect(RegionalService.updateSettings({ country: 'XX' })).rejects.toThrow();
    });
  });

  describe('getCountries', () => {
    it('should return countries list from API', async () => {
      const mockCountries: CountryInfo[] = [
        {
          code: 'BR',
          name: 'Brazil',
          localName: 'Brasil',
          currency: 'BRL',
          currencySymbol: 'R$',
          timezone: 'America/Sao_Paulo',
          flag: 'BR',
          region: 'south_america',
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCountries),
      });

      const countries = await RegionalService.getCountries();

      expect(countries).toEqual(mockCountries);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const countries = await RegionalService.getCountries();

      expect(countries).toEqual([]);
    });
  });

  describe('getTimezones', () => {
    it('should return timezones for a country', async () => {
      const mockTimezones: TimezoneInfo[] = [
        { id: 'America/Sao_Paulo', name: 'São Paulo', offset: '-03:00' },
        { id: 'America/Manaus', name: 'Manaus', offset: '-04:00' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ timezones: mockTimezones }),
      });

      const timezones = await RegionalService.getTimezones('BR');

      expect(timezones).toEqual(mockTimezones);
      // Check that fetch was called with the correct URL (ignore signal option)
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('http://test-api.com/settings/regional/timezones/BR');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const timezones = await RegionalService.getTimezones('BR');

      expect(timezones).toEqual([]);
    });
  });

  describe('getCurrencies', () => {
    it('should return currencies list from API', async () => {
      const mockCurrencies: CurrencyInfo[] = [
        { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
        { code: 'USD', name: 'US Dollar', symbol: '$' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCurrencies),
      });

      const currencies = await RegionalService.getCurrencies();

      expect(currencies).toEqual(mockCurrencies);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const currencies = await RegionalService.getCurrencies();

      expect(currencies).toEqual([]);
    });
  });

  describe('getLocaleForCountry', () => {
    it('should return pt-BR for Brazil', () => {
      expect(RegionalService.getLocaleForCountry('BR')).toBe('pt-BR');
    });

    it('should return en-US for United States', () => {
      expect(RegionalService.getLocaleForCountry('US')).toBe('en-US');
    });

    it('should return es-MX for Mexico', () => {
      expect(RegionalService.getLocaleForCountry('MX')).toBe('es-MX');
    });

    it('should return es-AR for Argentina', () => {
      expect(RegionalService.getLocaleForCountry('AR')).toBe('es-AR');
    });

    it('should return en-US for unknown country', () => {
      expect(RegionalService.getLocaleForCountry('XX')).toBe('en-US');
    });

    it('should be case-insensitive', () => {
      expect(RegionalService.getLocaleForCountry('br')).toBe('pt-BR');
      expect(RegionalService.getLocaleForCountry('Br')).toBe('pt-BR');
    });
  });

  describe('formatCurrency', () => {
    it('should format BRL correctly', () => {
      const formatted = RegionalService.formatCurrency(1234.56, 'BRL', 'BR');

      expect(formatted).toContain('1.234');
      expect(formatted).toContain('56');
      expect(formatted).toContain('R$');
    });

    it('should format USD correctly', () => {
      const formatted = RegionalService.formatCurrency(1234.56, 'USD', 'US');

      expect(formatted).toContain('1,234');
      expect(formatted).toContain('56');
      expect(formatted).toContain('$');
    });

    it('should return empty string for NaN', () => {
      expect(RegionalService.formatCurrency(NaN, 'BRL', 'BR')).toBe('');
    });

    it('should return empty string for Infinity', () => {
      expect(RegionalService.formatCurrency(Infinity, 'BRL', 'BR')).toBe('');
    });

    it('should handle negative values', () => {
      const formatted = RegionalService.formatCurrency(-1234.56, 'BRL', 'BR');

      expect(formatted).toContain('-');
      expect(formatted).toContain('1.234');
    });

    it('should handle zero', () => {
      const formatted = RegionalService.formatCurrency(0, 'BRL', 'BR');

      expect(formatted).toContain('0');
    });
  });

  describe('formatDate', () => {
    it('should format date in Brazil timezone', () => {
      const date = new Date('2024-12-25T12:00:00Z');
      const formatted = RegionalService.formatDate(date, 'America/Sao_Paulo', 'BR');

      expect(formatted).toMatch(/\d+/);
    });

    it('should format date from ISO string', () => {
      const formatted = RegionalService.formatDate(
        '2024-12-25T12:00:00Z',
        'America/Sao_Paulo',
        'BR'
      );

      expect(formatted).toMatch(/\d+/);
    });

    it('should return empty string for invalid date', () => {
      expect(RegionalService.formatDate('invalid', 'America/Sao_Paulo', 'BR')).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time in Brazil timezone', () => {
      const date = new Date('2024-12-25T15:30:00Z');
      const formatted = RegionalService.formatDateTime(date, 'America/Sao_Paulo', 'BR');

      expect(formatted).toMatch(/\d+:\d+/);
    });

    it('should return empty string for invalid date', () => {
      expect(RegionalService.formatDateTime('invalid', 'America/Sao_Paulo', 'BR')).toBe('');
    });
  });

  describe('formatTime', () => {
    it('should format time only', () => {
      const date = new Date('2024-12-25T15:30:00Z');
      const formatted = RegionalService.formatTime(date, 'America/Sao_Paulo', 'BR');

      expect(formatted).toMatch(/\d+:\d+/);
    });

    it('should return empty string for invalid date', () => {
      expect(RegionalService.formatTime('invalid', 'America/Sao_Paulo', 'BR')).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large currency values', () => {
      const formatted = RegionalService.formatCurrency(1000000000.99, 'BRL', 'BR');

      expect(formatted).toContain('1.000.000.000');
    });

    it('should handle small currency values', () => {
      const formatted = RegionalService.formatCurrency(0.01, 'BRL', 'BR');

      expect(formatted).toContain('0,01');
    });
  });
});
