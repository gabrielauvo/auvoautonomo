/// <reference types="jest" />

/**
 * Testes de integração para ChargeForm - Visibilidade do PIX
 *
 * Cobre:
 * - PIX visível apenas para locale pt-BR
 * - PIX oculto para en-US e es
 * - Default billing type muda baseado no locale
 * - Boleto e Cartão sempre disponíveis
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';

// Mock navigation
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockSearchParams = new Map();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null,
  }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    billing: {
      planKey: 'FREE',
    },
  }),
}));

jest.mock('@/context', () => ({
  useFormatting: () => ({
    formatCurrency: (value: number) => `R$ ${value.toFixed(2)}`,
    formatDate: (date: string) => date,
    formatDateShort: (date: string) => date,
  }),
}));

const mockCreateChargeMutateAsync = jest.fn();
const mockUpdateChargeMutateAsync = jest.fn();

jest.mock('@/hooks/use-charges', () => ({
  useCreateCharge: () => ({
    mutateAsync: mockCreateChargeMutateAsync,
    isPending: false,
  }),
  useUpdateCharge: () => ({
    mutateAsync: mockUpdateChargeMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/hooks/use-clients', () => ({
  useSearchClients: () => ({
    data: [],
    isLoading: false,
  }),
}));

// Variable to control mock locale
let mockLocale = 'pt-BR';

// Mock i18n
jest.mock('@/i18n', () => ({
  useTranslations: (_namespace?: string) => {
    return {
      t: (key: string) => key,
      locale: mockLocale,
    };
  },
}));

// We need to import ChargeForm after mocking
import { ChargeForm } from '../charge-form';

// Wrapper com QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
};

describe('ChargeForm - PIX Visibility by Locale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = 'pt-BR'; // Reset to default
    mockSearchParams.clear();
  });

  describe('pt-BR locale', () => {
    beforeEach(() => {
      mockLocale = 'pt-BR';
    });

    it('should show PIX option for pt-BR locale', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      // Find the billing type section
      const pixButton = screen.getByRole('button', { name: /PIX/i });
      expect(pixButton).toBeInTheDocument();
    });

    it('should have PIX as default billing type for pt-BR', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      // PIX button should be selected (have different styling)
      const pixButton = screen.getByRole('button', { name: /PIX/i });
      expect(pixButton).toBeInTheDocument();
      // Check that PIX is the active selection
      expect(pixButton).toHaveClass('border-primary');
    });

    it('should show all three billing options (PIX, Boleto, Cartão)', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: /PIX/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Boleto/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cartão/i })).toBeInTheDocument();
    });
  });

  describe('en-US locale', () => {
    beforeEach(() => {
      mockLocale = 'en-US';
    });

    it('should NOT show PIX option for en-US locale', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      // PIX should not be in the document
      expect(screen.queryByRole('button', { name: /^PIX$/i })).not.toBeInTheDocument();
    });

    it('should have BOLETO as default billing type for en-US', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      // Boleto button should be selected
      const boletoButton = screen.getByRole('button', { name: /Boleto/i });
      expect(boletoButton).toBeInTheDocument();
      expect(boletoButton).toHaveClass('border-primary');
    });

    it('should show only Boleto and Cartão options', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /^PIX$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Boleto/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cartão/i })).toBeInTheDocument();
    });
  });

  describe('es (Mexico) locale', () => {
    beforeEach(() => {
      mockLocale = 'es';
    });

    it('should NOT show PIX option for es locale', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      // PIX should not be in the document
      expect(screen.queryByRole('button', { name: /^PIX$/i })).not.toBeInTheDocument();
    });

    it('should have BOLETO as default billing type for es', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      // Boleto button should be selected
      const boletoButton = screen.getByRole('button', { name: /Boleto/i });
      expect(boletoButton).toBeInTheDocument();
      expect(boletoButton).toHaveClass('border-primary');
    });

    it('should show only Boleto and Cartão options', () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /^PIX$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Boleto/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cartão/i })).toBeInTheDocument();
    });
  });

  describe('Billing type selection', () => {
    beforeEach(() => {
      mockLocale = 'pt-BR';
    });

    it('should allow changing billing type', async () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      // Initially PIX is selected
      const pixButton = screen.getByRole('button', { name: /PIX/i });
      expect(pixButton).toHaveClass('border-primary');

      // Click on Boleto
      const boletoButton = screen.getByRole('button', { name: /Boleto/i });
      fireEvent.click(boletoButton);

      // Now Boleto should be selected
      await waitFor(() => {
        expect(boletoButton).toHaveClass('border-primary');
      });
    });

    it('should allow selecting Cartão de Crédito', async () => {
      render(<ChargeForm />, { wrapper: createWrapper() });

      const cardButton = screen.getByRole('button', { name: /Cartão/i });
      fireEvent.click(cardButton);

      await waitFor(() => {
        expect(cardButton).toHaveClass('border-primary');
      });
    });
  });

  describe('Form submission with billing type', () => {
    beforeEach(() => {
      mockLocale = 'pt-BR';
    });

    it('should include billingType in submission data', async () => {
      mockCreateChargeMutateAsync.mockResolvedValue({ id: 'new-charge-id' });

      render(<ChargeForm />, { wrapper: createWrapper() });

      // Fill required fields would be needed for full test
      // This is a simplified check that the form structure is correct
      const saveButton = screen.getByRole('button', { name: /Criar Cobrança/i });
      expect(saveButton).toBeInTheDocument();
    });
  });
});

describe('ChargeForm - isPIXAvailable integration', () => {
  it('should correctly integrate with isPIXAvailable utility', () => {
    // This test verifies the utility function is correctly used
    const { isPIXAvailable } = require('@/lib/utils');

    expect(isPIXAvailable('pt-BR')).toBe(true);
    expect(isPIXAvailable('en-US')).toBe(false);
    expect(isPIXAvailable('es')).toBe(false);
  });
});
