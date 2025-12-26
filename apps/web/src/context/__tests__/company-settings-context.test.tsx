/**
 * Testes para o CompanySettingsContext
 *
 * Cobre:
 * - Formatação de moeda
 * - Formatação de datas com timezone
 * - Fallback para valores padrão
 * - Hook useFormatting
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  CompanySettingsProvider,
  useCompanySettings,
  useFormatting,
} from '../company-settings-context';

// Mock do AuthContext
jest.mock('../auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Wrapper component
function Wrapper({ children }: { children: React.ReactNode }) {
  return <CompanySettingsProvider>{children}</CompanySettingsProvider>;
}

describe('CompanySettingsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/settings/regional/countries')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { code: 'BR', name: 'Brazil', currency: 'BRL', timezone: 'America/Sao_Paulo' },
              { code: 'US', name: 'United States', currency: 'USD', timezone: 'America/New_York' },
            ]),
        });
      }
      if (url.includes('/settings/regional/currencies')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
              { code: 'USD', symbol: '$', name: 'US Dollar' },
            ]),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  describe('useCompanySettings', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useCompanySettings());
      }).toThrow('useCompanySettings must be used within a CompanySettingsProvider');

      consoleSpy.mockRestore();
    });

    it('should return default settings when not authenticated', async () => {
      const { result } = renderHook(() => useCompanySettings(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings?.country).toBe('BR');
      expect(result.current.settings?.currency).toBe('BRL');
      expect(result.current.settings?.timezone).toBe('America/Sao_Paulo');
    });
  });

  describe('useFormatting', () => {
    it('should return formatting functions', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatCurrency).toBeDefined();
      });

      expect(typeof result.current.formatCurrency).toBe('function');
      expect(typeof result.current.formatDate).toBe('function');
      expect(typeof result.current.formatDateTime).toBe('function');
      expect(typeof result.current.formatTime).toBe('function');
    });

    it('should format currency in BRL by default', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.currency).toBe('BRL');
      });

      const formatted = result.current.formatCurrency(1234.56);
      expect(formatted).toContain('1.234,56');
      expect(formatted).toContain('R$');
    });

    it('should format currency with record currency override', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatCurrency).toBeDefined();
      });

      const formatted = result.current.formatCurrency(1234.56, 'USD');
      expect(formatted).toContain('$');
    });

    it('should return empty string for invalid number', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatCurrency).toBeDefined();
      });

      expect(result.current.formatCurrency(NaN)).toBe('');
      expect(result.current.formatCurrency(Infinity)).toBe('');
    });

    it('should format date correctly', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatDate).toBeDefined();
      });

      const date = new Date('2024-12-25T10:30:00Z');
      const formatted = result.current.formatDate(date);

      // Should contain day/month/year in some format
      expect(formatted).toMatch(/\d+/);
    });

    it('should format date from ISO string', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatDate).toBeDefined();
      });

      const formatted = result.current.formatDate('2024-12-25T10:30:00Z');
      expect(formatted).toMatch(/\d+/);
    });

    it('should return empty string for invalid date', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatDate).toBeDefined();
      });

      expect(result.current.formatDate('invalid-date')).toBe('');
    });

    it('should format time correctly', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatTime).toBeDefined();
      });

      const date = new Date('2024-12-25T15:30:00Z');
      const formatted = result.current.formatTime(date);

      // Should contain hour and minute
      expect(formatted).toMatch(/\d+:\d+/);
    });

    it('should have default timezone', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.timezone).toBe('America/Sao_Paulo');
      });
    });
  });

  describe('Locale Mapping', () => {
    it('should use pt-BR locale for Brazil', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatCurrency).toBeDefined();
      });

      // BRL formatting should use comma as decimal separator (pt-BR)
      const formatted = result.current.formatCurrency(1234.56);
      expect(formatted).toContain(',');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero value', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatCurrency).toBeDefined();
      });

      const formatted = result.current.formatCurrency(0);
      expect(formatted).toContain('0');
    });

    it('should handle negative values', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatCurrency).toBeDefined();
      });

      const formatted = result.current.formatCurrency(-1234.56);
      expect(formatted).toContain('-');
      expect(formatted).toContain('1.234');
    });

    it('should handle large values', async () => {
      const { result } = renderHook(() => useFormatting(), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.formatCurrency).toBeDefined();
      });

      const formatted = result.current.formatCurrency(1000000.99);
      expect(formatted).toContain('1.000.000');
    });
  });
});

describe('Currency Formatting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );
  });

  it('should format BRL correctly', async () => {
    const { result } = renderHook(() => useFormatting(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.formatCurrency).toBeDefined();
    });

    const formatted = result.current.formatCurrency(1234.56, 'BRL');
    // BRL should contain the value with thousand separator and cents
    expect(formatted).toMatch(/1[.,]234/);
    expect(formatted).toContain('56');
  });

  it('should format USD correctly', async () => {
    const { result } = renderHook(() => useFormatting(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.formatCurrency).toBeDefined();
    });

    const formatted = result.current.formatCurrency(1234.56, 'USD');
    // Should contain the value (format may vary by locale)
    expect(formatted).toMatch(/1[.,]234/);
    expect(formatted).toContain('56');
  });

  it('should format other currencies', async () => {
    const { result } = renderHook(() => useFormatting(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.formatCurrency).toBeDefined();
    });

    const formattedMXN = result.current.formatCurrency(1234.56, 'MXN');
    expect(formattedMXN).toMatch(/1[.,]234/);

    const formattedARS = result.current.formatCurrency(1234.56, 'ARS');
    expect(formattedARS).toMatch(/1[.,]234/);
  });
});
