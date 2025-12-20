/**
 * ClientesScreen Smoke Tests
 *
 * Testes básicos para a tela de clientes.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../src/modules/clients/ClientService', () => ({
  ClientService: {
    configure: jest.fn(),
    listClients: jest.fn().mockResolvedValue({
      data: [
        { id: '1', name: 'João Silva', phone: '11999999999', email: 'joao@test.com' },
        { id: '2', name: 'Maria Santos', phone: '11888888888', email: 'maria@test.com' },
      ],
      total: 2,
      pages: 1,
    }),
    searchClients: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      isLocal: true,
    }),
  },
}));

jest.mock('../../src/sync', () => ({
  useSyncStatus: () => ({
    isSyncing: false,
    isOnline: true,
    sync: jest.fn(),
    pendingCount: 0,
  }),
}));

jest.mock('../../src/design-system/ThemeProvider', () => ({
  useColors: () => ({
    primary: { 500: '#3B82F6', 200: '#93C5FD' },
    background: { primary: '#FFFFFF', secondary: '#F9FAFB', tertiary: '#F3F4F6' },
    text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF' },
    border: { light: '#E5E7EB', default: '#D1D5DB' },
    success: { 50: '#F0FDF4', 500: '#10B981', 600: '#059669' },
    error: { 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626' },
    warning: { 50: '#FFFBEB', 500: '#F59E0B', 600: '#D97706' },
    info: { 50: '#EFF6FF', 500: '#3B82F6' },
    gray: { 100: '#F3F4F6', 200: '#E5E7EB', 400: '#9CA3AF', 600: '#4B5563' },
    white: '#FFFFFF',
    black: '#000000',
  }),
  useSpacing: () => ({
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    20: 80,
  }),
  useBorderRadius: () => ({
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  }),
  useTheme: () => ({
    theme: {
      colors: {
        primary: { 500: '#3B82F6', 200: '#93C5FD' },
        background: { primary: '#FFFFFF', secondary: '#F9FAFB' },
        text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF' },
        border: { light: '#E5E7EB', default: '#D1D5DB' },
        success: { 50: '#F0FDF4', 500: '#10B981', 600: '#059669' },
        error: { 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626' },
        warning: { 50: '#FFFBEB', 500: '#F59E0B', 600: '#D97706' },
        info: { 50: '#EFF6FF', 500: '#3B82F6' },
        gray: { 100: '#F3F4F6', 200: '#E5E7EB', 400: '#9CA3AF', 600: '#4B5563' },
        white: '#FFFFFF',
        black: '#000000',
      },
      spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 },
    },
    isDark: false,
  }),
}));

jest.mock('../../src/design-system', () => ({
  Text: ({ children }: any) => children,
  Card: ({ children }: any) => children,
  Badge: ({ children }: any) => children,
  Avatar: () => null,
}));

jest.mock('../../src/components', () => ({
  OptimizedList: ({ data, renderItem, emptyText }: any) => {
    if (data.length === 0) {
      return emptyText;
    }
    return data.map((item: any, index: number) =>
      renderItem({ item, index })
    );
  },
}));

// Mock ImportContactsModal - it has complex dependencies
jest.mock('../../src/modules/clients/components/ImportContactsModal', () => ({
  ImportContactsModal: ({ visible, onClose }: any) => {
    if (!visible) return null;
    return null; // Simplified mock - modal behavior tested separately
  },
}));

// Mock expo-contacts
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getContactsAsync: jest.fn().mockResolvedValue({ data: [] }),
}));

// Mock BillingService
jest.mock('../../src/services/BillingService', () => ({
  BillingService: {
    getClientQuota: jest.fn().mockResolvedValue({
      remaining: 10,
      max: 10,
      current: 0,
      unlimited: false,
    }),
  },
}));

// Import after mocks
import ClientesScreen from '../../app/(tabs)/clientes';
import { ClientService } from '../../src/modules/clients/ClientService';

describe('ClientesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const { getByPlaceholderText } = render(<ClientesScreen />);

    await waitFor(() => {
      expect(ClientService.listClients).toHaveBeenCalled();
    });
  });

  it('should display search input', async () => {
    const { getByPlaceholderText } = render(<ClientesScreen />);

    await waitFor(() => {
      expect(getByPlaceholderText('Buscar clientes...')).toBeTruthy();
    });
  });

  it('should call searchClients when typing in search', async () => {
    const { getByPlaceholderText } = render(<ClientesScreen />);

    await waitFor(() => {
      expect(ClientService.listClients).toHaveBeenCalled();
    });

    const searchInput = getByPlaceholderText('Buscar clientes...');
    fireEvent.changeText(searchInput, 'João');

    await waitFor(
      () => {
        expect(ClientService.searchClients).toHaveBeenCalledWith('João', 50);
      },
      { timeout: 500 }
    );
  });

  it('should load clients on mount', async () => {
    render(<ClientesScreen />);

    await waitFor(() => {
      expect(ClientService.listClients).toHaveBeenCalledWith(1, 50);
    });
  });
});
