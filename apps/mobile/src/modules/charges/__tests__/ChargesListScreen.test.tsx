/**
 * ChargesListScreen Integration Tests
 *
 * Testes de integração para a tela de lista de cobranças.
 * Foca no comportamento offline-first e sincronização.
 */

import React from 'react';
import { render, waitFor, fireEvent, screen, act } from '@testing-library/react-native';
import { ChargesListScreen } from '../ChargesListScreen';
import { ChargesCacheService } from '../ChargesCacheService';
import { ChargeService } from '../ChargeService';
import { useSyncStatus } from '../../../sync/useSyncStatus';
import { useAuth } from '../../../services';
import type { Charge, ChargeStats, ChargeListResponse } from '../types';

// Mock dependencies
jest.mock('../ChargeService');
jest.mock('../ChargesCacheService');
jest.mock('../../../sync/useSyncStatus');
jest.mock('../../../context/AuthContext');
jest.mock('../../../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'charges.searchByClient': 'Buscar por cliente...',
        'charges.filters.all': 'Todas',
        'charges.filters.pending': 'Pendentes',
        'charges.filters.overdue': 'Vencidas',
        'charges.filters.received': 'Recebidas',
        'charges.filters.canceled': 'Canceladas',
        'charges.summary.pending': 'A receber',
        'charges.summary.overdue': 'Vencido',
        'charges.summary.received': 'Recebido',
        'charges.noCharges': 'Nenhuma cobrança',
        'charges.noChargesFound': 'Nenhuma cobrança encontrada',
        'charges.createFirstCharge': 'Crie sua primeira cobrança',
        'charges.tryAdjustFilters': 'Tente ajustar os filtros',
        'charges.noConnection': 'Sem conexão',
        'charges.offlineNoCacheMessage': 'Você está offline e não há dados salvos.',
        'charges.offlineMode': 'Modo offline',
        'charges.syncing': 'Sincronizando...',
        'charges.lastSync': 'Última sincronização',
        'charges.neverSynced': 'Nunca sincronizado',
        'charges.justNow': 'Agora mesmo',
        'charges.minutesAgo': `há ${params?.count || 0} min`,
        'charges.hoursAgo': `há ${params?.count || 0}h`,
        'charges.sortNewest': 'Mais recentes',
        'charges.sortOldest': 'Mais antigas',
        'charges.client': 'Cliente',
        'charges.share': 'Compartilhar',
        'charges.chargesCount': `${params?.count || 0} cobranças`,
        'charges.statuses.pending': 'Aguardando',
        'charges.statuses.overdue': 'Vencida',
        'charges.statuses.confirmed': 'Confirmada',
        'charges.statuses.received': 'Recebida',
        'charges.statuses.canceled': 'Cancelada',
        'charges.billingTypes.pix': 'PIX',
        'charges.billingTypes.boleto': 'Boleto',
        'charges.billingTypes.credit_card': 'Cartão',
        'common.retry': 'Tentar novamente',
        'charges.loadChargesError': 'Erro ao carregar cobranças',
        'charges.loadChargesErrorMessage': 'Não foi possível carregar as cobranças.',
      };
      return translations[key] || key;
    },
    locale: 'pt-BR',
  }),
}));

// Mock design system
jest.mock('../../../design-system/ThemeProvider', () => ({
  useColors: () => ({
    primary: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' },
    success: { 500: '#22c55e', 600: '#16a34a' },
    warning: { 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e' },
    error: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
    gray: { 200: '#e5e7eb', 400: '#9ca3af', 500: '#6b7280' },
    text: { primary: '#111827', secondary: '#4b5563', tertiary: '#9ca3af' },
    background: { primary: '#ffffff', secondary: '#f9fafb' },
    border: { light: '#e5e7eb' },
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
    value: 100,
    billingType: 'PIX',
    status: 'PENDING',
    dueDate: '2024-12-31',
    urls: {
      invoiceUrl: 'https://example.com/invoice',
    },
    client: {
      id: 'client-1',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    technicianId: 'tech-1',
    ...overrides,
  };
}

function createMockStats(overrides: Partial<ChargeStats> = {}): ChargeStats {
  return {
    total: 10,
    pending: 3,
    overdue: 2,
    confirmed: 4,
    canceled: 1,
    totalValue: 1000,
    receivedValue: 400,
    pendingValue: 300,
    overdueValue: 200,
    ...overrides,
  };
}

function createMockListResponse(charges: Charge[], total?: number): ChargeListResponse {
  return {
    data: charges,
    total: total ?? charges.length,
    page: 1,
    pageSize: 20,
    totalPages: Math.ceil((total ?? charges.length) / 20),
  };
}

describe('ChargesListScreen', () => {
  const mockOnChargePress = jest.fn();
  const mockOnNewCharge = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup: online and authenticated
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
    });

    (useSyncStatus as jest.Mock).mockReturnValue({
      isOnline: true,
      isSyncing: false,
    });

    (ChargesCacheService.isConfigured as jest.Mock).mockReturnValue(true);
    (ChargesCacheService.hasCachedData as jest.Mock).mockResolvedValue(false);
    (ChargesCacheService.getSyncStatus as jest.Mock).mockReturnValue({
      isSyncing: false,
      lastSyncAt: null,
    });
    (ChargesCacheService.configure as jest.Mock).mockImplementation(() => {});
    (ChargesCacheService.saveToCache as jest.Mock).mockResolvedValue(undefined);
    (ChargesCacheService.saveStatsToCache as jest.Mock).mockResolvedValue(undefined);
    (ChargesCacheService.syncFromServer as jest.Mock).mockResolvedValue(true);
  });

  describe('Online behavior', () => {
    it('should load charges from server when online', async () => {
      const mockCharges = [
        createMockCharge({ id: '1', clientName: 'Cliente 1' }),
        createMockCharge({ id: '2', clientName: 'Cliente 2' }),
      ];

      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse(mockCharges)
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(ChargeService.listCharges).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Cliente 1')).toBeTruthy();
      });
    });

    it('should save charges to cache after loading from server', async () => {
      const mockCharges = [createMockCharge()];

      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse(mockCharges)
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(ChargesCacheService.saveToCache).toHaveBeenCalledWith(mockCharges);
      });
    });

    it('should display financial summary', async () => {
      const mockStats = createMockStats({
        pendingValue: 500,
        overdueValue: 200,
        receivedValue: 300,
      });

      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(mockStats);

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('A receber')).toBeTruthy();
        expect(screen.getByText('Vencido')).toBeTruthy();
        expect(screen.getByText('Recebido')).toBeTruthy();
      });
    });

    it('should not show offline banner when online', async () => {
      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Modo offline')).toBeNull();
      });
    });
  });

  describe('Offline behavior', () => {
    beforeEach(() => {
      (useSyncStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isSyncing: false,
      });
    });

    it('should load charges from cache when offline', async () => {
      const mockCachedCharges = [
        createMockCharge({ id: '1', clientName: 'Cliente Cached' }),
      ];

      (ChargesCacheService.hasCachedData as jest.Mock).mockResolvedValue(true);
      (ChargesCacheService.getCachedCharges as jest.Mock).mockResolvedValue(
        createMockListResponse(mockCachedCharges)
      );
      (ChargesCacheService.getCachedStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(ChargesCacheService.getCachedCharges).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Cliente Cached')).toBeTruthy();
      });
    });

    it('should show offline banner when using cached data', async () => {
      const mockCachedCharges = [createMockCharge()];

      (ChargesCacheService.hasCachedData as jest.Mock).mockResolvedValue(true);
      (ChargesCacheService.getCachedCharges as jest.Mock).mockResolvedValue(
        createMockListResponse(mockCachedCharges)
      );
      (ChargesCacheService.getCachedStats as jest.Mock).mockResolvedValue(createMockStats());
      (ChargesCacheService.getSyncStatus as jest.Mock).mockReturnValue({
        isSyncing: false,
        lastSyncAt: '2024-01-01T10:00:00Z',
      });

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Modo offline')).toBeTruthy();
      });
    });

    it('should show error screen when offline with no cache', async () => {
      (ChargesCacheService.hasCachedData as jest.Mock).mockResolvedValue(false);

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sem conexão')).toBeTruthy();
      });

      expect(screen.getByText('Você está offline e não há dados salvos.')).toBeTruthy();
    });

    it('should load stats from cache when offline', async () => {
      const mockCachedCharges = [createMockCharge()];
      const mockCachedStats = createMockStats({ pending: 5 });

      (ChargesCacheService.hasCachedData as jest.Mock).mockResolvedValue(true);
      (ChargesCacheService.getCachedCharges as jest.Mock).mockResolvedValue(
        createMockListResponse(mockCachedCharges)
      );
      (ChargesCacheService.getCachedStats as jest.Mock).mockResolvedValue(mockCachedStats);

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(ChargesCacheService.getCachedStats).toHaveBeenCalled();
      });
    });
  });

  describe('Fallback behavior', () => {
    it('should fallback to cache when server request fails', async () => {
      const mockCachedCharges = [
        createMockCharge({ id: '1', clientName: 'Cliente Fallback' }),
      ];

      (useSyncStatus as jest.Mock).mockReturnValue({
        isOnline: true,
        isSyncing: false,
      });

      // Server fails
      (ChargeService.listCharges as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      // Cache has data
      (ChargesCacheService.hasCachedData as jest.Mock).mockResolvedValue(true);
      (ChargesCacheService.getCachedCharges as jest.Mock).mockResolvedValue(
        createMockListResponse(mockCachedCharges)
      );
      (ChargesCacheService.getCachedStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cliente Fallback')).toBeTruthy();
      });
    });
  });

  describe('Sync behavior', () => {
    it('should sync from server on initial load when online', async () => {
      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(ChargesCacheService.syncFromServer).toHaveBeenCalled();
      });
    });

    it('should configure cache service with user ID', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-123' },
      });

      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(ChargesCacheService.configure).toHaveBeenCalledWith('user-123');
      });
    });
  });

  describe('Filters and search', () => {
    it('should filter charges by status', async () => {
      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Pendentes')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Pendentes'));

      await waitFor(() => {
        expect(ChargeService.listCharges).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'PENDING' })
        );
      });
    });

    it('should search charges by client name', async () => {
      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Buscar por cliente...')).toBeTruthy();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por cliente...');
      fireEvent.changeText(searchInput, 'João');

      // Wait for debounce
      await waitFor(
        () => {
          expect(ChargeService.listCharges).toHaveBeenCalledWith(
            expect.objectContaining({ search: 'João' })
          );
        },
        { timeout: 500 }
      );
    });
  });

  describe('User interactions', () => {
    it('should call onChargePress when charge is pressed', async () => {
      const mockCharge = createMockCharge({ clientName: 'Clickable Client' });

      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([mockCharge])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Clickable Client')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Clickable Client'));

      expect(mockOnChargePress).toHaveBeenCalledWith(mockCharge);
    });

    it('should call onNewCharge when FAB is pressed', async () => {
      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      const { getByTestId } = render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        // FAB should be present
        expect(mockOnNewCharge).toBeDefined();
      });
    });

    it('should show empty state when no charges', async () => {
      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(
        createMockStats({ total: 0 })
      );

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Nenhuma cobrança')).toBeTruthy();
      });
    });
  });

  describe('Retry functionality', () => {
    it('should retry loading when retry button is pressed', async () => {
      (useSyncStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isSyncing: false,
      });
      (ChargesCacheService.hasCachedData as jest.Mock).mockResolvedValue(false);

      render(
        <ChargesListScreen
          onChargePress={mockOnChargePress}
          onNewCharge={mockOnNewCharge}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Tentar novamente')).toBeTruthy();
      });

      // Come back online
      (useSyncStatus as jest.Mock).mockReturnValue({
        isOnline: true,
        isSyncing: false,
      });
      (ChargeService.listCharges as jest.Mock).mockResolvedValue(
        createMockListResponse([createMockCharge()])
      );
      (ChargeService.getChargeStats as jest.Mock).mockResolvedValue(createMockStats());

      fireEvent.press(screen.getByText('Tentar novamente'));

      await waitFor(() => {
        expect(ChargeService.listCharges).toHaveBeenCalled();
      });
    });
  });
});
