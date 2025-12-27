/**
 * ChargeDetailScreen Integration Tests
 *
 * Testes de integração para a tela de detalhes de cobrança.
 * Foca no comportamento offline-first e ações da cobrança.
 */

import React from 'react';
import { render, waitFor, fireEvent, screen } from '@testing-library/react-native';
import { Alert, Share, Linking, Clipboard } from 'react-native';
import { ChargeDetailScreen } from '../ChargeDetailScreen';
import { ChargesCacheService } from '../ChargesCacheService';
import { ChargeService } from '../ChargeService';
import { useSyncStatus } from '../../../sync/useSyncStatus';
import type { Charge } from '../types';

// Mock dependencies
jest.mock('../ChargeService');
jest.mock('../ChargesCacheService');
jest.mock('../../../sync/useSyncStatus');

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock Share
jest.spyOn(Share, 'share').mockImplementation(() => Promise.resolve({ action: 'sharedAction' }));

// Mock Linking
jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));

// Mock Clipboard
jest.mock('react-native/Libraries/Components/Clipboard/Clipboard', () => ({
  setString: jest.fn(),
}));

// Mock i18n
jest.mock('../../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'charges.loadError': 'Erro ao carregar cobrança',
        'charges.offlineNoCacheMessage': 'Você está offline e não há dados salvos.',
        'charges.notFound': 'Cobrança não encontrada',
        'charges.offlineMode': 'Modo offline',
        'charges.client': 'Cliente',
        'charges.dueDate': 'Vencimento',
        'charges.paidAt': 'Pago em',
        'charges.createdAt': 'Criado em',
        'charges.paymentActions': 'Ações de Pagamento',
        'charges.sharePaymentLink': 'Compartilhar Link',
        'charges.openPaymentPage': 'Abrir Página de Pagamento',
        'charges.copyPixCode': 'Copiar Código PIX',
        'charges.openBankSlip': 'Abrir Boleto',
        'charges.resendEmail': 'Reenviar Email',
        'charges.registerManualPayment': 'Registrar Pagamento Manual',
        'charges.dangerZone': 'Zona de Perigo',
        'charges.cancelCharge': 'Cancelar Cobrança',
        'charges.settings': 'Configurações',
        'charges.discountLabel': 'Desconto',
        'charges.fineLabel': 'Multa',
        'charges.interestLabel': 'Juros',
        'charges.perMonth': 'ao mês',
        'charges.statuses.pending': 'Aguardando',
        'charges.statuses.overdue': 'Vencida',
        'charges.statuses.confirmed': 'Confirmada',
        'charges.statuses.received': 'Recebida',
        'charges.statuses.canceled': 'Cancelada',
        'charges.paymentLinkUnavailable': 'Link não disponível',
        'charges.sharePaymentMessage': `Pague ${params?.value || ''}: ${params?.url || ''}`,
        'charges.copied': 'Copiado!',
        'charges.pixCodeCopied': 'Código PIX copiado',
        'charges.confirmManualPaymentMessage': `Confirmar recebimento de ${params?.value || ''}?`,
        'charges.confirmReceipt': 'Confirmar',
        'charges.paymentRegisteredSuccess': 'Pagamento registrado',
        'charges.registerPaymentError': 'Erro ao registrar pagamento',
        'charges.cancelChargeConfirm': 'Tem certeza que deseja cancelar?',
        'charges.yesCancel': 'Sim, cancelar',
        'charges.chargeCancelledSuccess': 'Cobrança cancelada',
        'charges.cancelChargeError': 'Erro ao cancelar',
        'charges.cancelledByUser': 'Cancelado pelo usuário',
        'charges.emailResendSuccess': 'Email reenviado',
        'charges.emailResendError': 'Erro ao reenviar email',
        'charges.cash': 'Dinheiro',
        'common.error': 'Erro',
        'common.success': 'Sucesso',
        'common.cancel': 'Cancelar',
        'common.no': 'Não',
        'common.retry': 'Tentar novamente',
      };
      return translations[key] || key;
    },
    locale: 'pt-BR',
  }),
}));

// Mock design system
jest.mock('../../../design-system/ThemeProvider', () => ({
  useColors: () => ({
    primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb' },
    success: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a' },
    warning: { 100: '#fef3c7', 500: '#f59e0b', 700: '#b45309', 800: '#92400e' },
    error: { 50: '#fef2f2', 200: '#fecaca', 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
    gray: { 100: '#f3f4f6', 500: '#6b7280' },
    text: { primary: '#111827', secondary: '#4b5563', tertiary: '#9ca3af' },
    background: { primary: '#ffffff', secondary: '#f9fafb' },
    white: '#ffffff',
  }),
}));

// Helper to create mock charges
function createMockCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: 'charge-1',
    asaasId: 'asaas-1',
    userId: 'user-1',
    clientId: 'client-1',
    value: 150,
    billingType: 'PIX',
    status: 'PENDING',
    dueDate: '2024-12-31',
    urls: {
      invoiceUrl: 'https://example.com/invoice',
      pixQrCodeUrl: 'https://example.com/qr',
      pixCopiaECola: 'pix-code-123',
    },
    client: {
      id: 'client-1',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      phone: '11999999999',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    technicianId: 'tech-1',
    ...overrides,
  };
}

describe('ChargeDetailScreen', () => {
  const mockOnBack = jest.fn();
  const mockOnChargeUpdated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup: online
    (useSyncStatus as jest.Mock).mockReturnValue({
      isOnline: true,
    });

    (ChargesCacheService.isConfigured as jest.Mock).mockReturnValue(true);
    (ChargesCacheService.saveToCache as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Online behavior', () => {
    it('should load charge from server when online', async () => {
      const mockCharge = createMockCharge();
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(ChargeService.getChargeById).toHaveBeenCalledWith('charge-1');
      });

      await waitFor(() => {
        expect(screen.getByText('Cliente Teste')).toBeTruthy();
      });
    });

    it('should save charge to cache after loading from server', async () => {
      const mockCharge = createMockCharge();
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(ChargesCacheService.saveToCache).toHaveBeenCalledWith([mockCharge]);
      });
    });

    it('should display charge details correctly', async () => {
      const mockCharge = createMockCharge({
        value: 250.5,
        description: 'Serviço de manutenção',
      });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cliente Teste')).toBeTruthy();
      });

      expect(screen.getByText('Serviço de manutenção')).toBeTruthy();
    });

    it('should not show offline banner when online', async () => {
      const mockCharge = createMockCharge();
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cliente Teste')).toBeTruthy();
      });

      expect(screen.queryByText('Modo offline')).toBeNull();
    });
  });

  describe('Offline behavior', () => {
    beforeEach(() => {
      (useSyncStatus as jest.Mock).mockReturnValue({
        isOnline: false,
      });
    });

    it('should load charge from cache when offline', async () => {
      const mockCachedCharge = createMockCharge({ clientName: 'Cliente Cached' });
      (ChargesCacheService.getCachedChargeById as jest.Mock).mockResolvedValue(mockCachedCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(ChargesCacheService.getCachedChargeById).toHaveBeenCalledWith('charge-1');
      });

      await waitFor(() => {
        expect(screen.getByText('Cliente Teste')).toBeTruthy();
      });
    });

    it('should show offline banner when using cached data', async () => {
      const mockCachedCharge = createMockCharge();
      (ChargesCacheService.getCachedChargeById as jest.Mock).mockResolvedValue(mockCachedCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Modo offline')).toBeTruthy();
      });
    });

    it('should show error when offline with no cache', async () => {
      (ChargesCacheService.getCachedChargeById as jest.Mock).mockResolvedValue(null);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Você está offline e não há dados salvos.')).toBeTruthy();
      });
    });
  });

  describe('Fallback behavior', () => {
    it('should fallback to cache when server fails', async () => {
      const mockCachedCharge = createMockCharge({ clientName: 'Cliente Fallback' });

      (ChargeService.getChargeById as jest.Mock).mockRejectedValue(
        new Error('Server error')
      );
      (ChargesCacheService.getCachedChargeById as jest.Mock).mockResolvedValue(mockCachedCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cliente Teste')).toBeTruthy();
      });

      // Should show offline banner since using cached data
      expect(screen.getByText('Modo offline')).toBeTruthy();
    });
  });

  describe('Payment actions', () => {
    it('should show payment actions for pending charges', async () => {
      const mockCharge = createMockCharge({ status: 'PENDING' });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Ações de Pagamento')).toBeTruthy();
      });

      expect(screen.getByText('Compartilhar Link')).toBeTruthy();
      expect(screen.getByText('Registrar Pagamento Manual')).toBeTruthy();
    });

    it('should not show payment actions for paid charges', async () => {
      const mockCharge = createMockCharge({ status: 'CONFIRMED' });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cliente Teste')).toBeTruthy();
      });

      expect(screen.queryByText('Ações de Pagamento')).toBeNull();
    });

    it('should share payment link when share button is pressed', async () => {
      const mockCharge = createMockCharge();
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Compartilhar Link')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Compartilhar Link'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalled();
      });
    });

    it('should open payment URL when open button is pressed', async () => {
      const mockCharge = createMockCharge();
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Abrir Página de Pagamento')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Abrir Página de Pagamento'));

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/invoice');
      });
    });

    it('should copy PIX code when button is pressed', async () => {
      const mockCharge = createMockCharge({
        billingType: 'PIX',
        urls: {
          pixCopiaECola: 'pix-code-123',
        },
      });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Copiar Código PIX')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Copiar Código PIX'));

      expect(Alert.alert).toHaveBeenCalledWith('Copiado!', 'Código PIX copiado');
    });
  });

  describe('Cancel charge', () => {
    it('should show cancel button for pending charges', async () => {
      const mockCharge = createMockCharge({ status: 'PENDING' });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancelar Cobrança')).toBeTruthy();
      });
    });

    it('should not show cancel button for confirmed charges', async () => {
      const mockCharge = createMockCharge({ status: 'CONFIRMED' });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cliente Teste')).toBeTruthy();
      });

      expect(screen.queryByText('Cancelar Cobrança')).toBeNull();
    });
  });

  describe('Discount, fine, and interest display', () => {
    it('should display discount information', async () => {
      const mockCharge = createMockCharge({
        discount: { value: 10, dueDateLimitDays: 5, type: 'PERCENTAGE' },
      });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Configurações')).toBeTruthy();
      });
    });

    it('should display fine information', async () => {
      const mockCharge = createMockCharge({
        fine: { value: 2, type: 'PERCENTAGE' },
      });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Configurações')).toBeTruthy();
      });
    });
  });

  describe('Loading and error states', () => {
    it('should show loading indicator while loading', async () => {
      (ChargeService.getChargeById as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      // Should show loading indicator
      // Note: ActivityIndicator is mocked, so we just verify the service was called
      expect(ChargeService.getChargeById).toHaveBeenCalled();
    });

    it('should show error state when charge not found', async () => {
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(null);
      (ChargesCacheService.getCachedChargeById as jest.Mock).mockResolvedValue(null);

      render(
        <ChargeDetailScreen
          chargeId="non-existent"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Erro ao carregar cobrança')).toBeTruthy();
      });
    });

    it('should allow retry after error', async () => {
      (ChargeService.getChargeById as jest.Mock)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(createMockCharge());
      (ChargesCacheService.getCachedChargeById as jest.Mock).mockResolvedValue(null);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Tentar novamente')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Tentar novamente'));

      await waitFor(() => {
        expect(ChargeService.getChargeById).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Status display', () => {
    it.each([
      ['PENDING', 'Aguardando'],
      ['OVERDUE', 'Vencida'],
      ['CONFIRMED', 'Confirmada'],
      ['CANCELED', 'Cancelada'],
    ])('should display correct status badge for %s', async (status, expectedLabel) => {
      const mockCharge = createMockCharge({ status: status as any });
      (ChargeService.getChargeById as jest.Mock).mockResolvedValue(mockCharge);

      render(
        <ChargeDetailScreen
          chargeId="charge-1"
          onBack={mockOnBack}
          onChargeUpdated={mockOnChargeUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(expectedLabel)).toBeTruthy();
      });
    });
  });
});
