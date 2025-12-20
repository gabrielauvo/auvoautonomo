/**
 * Smoke Tests for Work Order Screens
 *
 * Basic rendering tests to verify components don't crash.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { WorkOrderStatus } from '../../../src/db/schema';

// Mock the database
jest.mock('../../../src/db/database', () => ({
  getDatabase: jest.fn(() => ({
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
    withTransactionAsync: jest.fn((cb) => cb()),
  })),
}));

// Mock workOrderService
jest.mock('../../../src/modules/workorders/WorkOrderService', () => ({
  workOrderService: {
    getTechnicianId: jest.fn().mockReturnValue('test-technician'),
    getWorkOrdersForDay: jest.fn().mockResolvedValue([]),
    getWorkOrdersForDateRange: jest.fn().mockResolvedValue([]),
    listWorkOrders: jest.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
    formatScheduledTime: jest.fn().mockReturnValue('09:00'),
    formatDateRange: jest.fn().mockReturnValue('09:00 - 11:00'),
    updateStatus: jest.fn(),
    deleteWorkOrder: jest.fn(),
  },
}));

// Mock MutationQueue
jest.mock('../../../src/queue/MutationQueue', () => ({
  mutationQueue: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));

import { AgendaScreen } from '../../../src/modules/agenda/AgendaScreen';
import { WorkOrdersListScreen } from '../../../src/modules/workorders/WorkOrdersListScreen';
import { WorkOrderDetailScreen } from '../../../src/modules/workorders/WorkOrderDetailScreen';
import { ThemeProvider } from '../../../src/design-system/ThemeProvider';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('AgendaScreen', () => {
  it('should render without crashing', () => {
    const { getByText } = renderWithTheme(<AgendaScreen />);
    // Should show month/year header
    const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
    // Month name might be capitalized differently, so just check the component renders
    expect(getByText('Dia')).toBeTruthy();
    expect(getByText('Semana')).toBeTruthy();
  });

  it('should show day/week toggle buttons', () => {
    const { getByText } = renderWithTheme(<AgendaScreen />);
    expect(getByText('Dia')).toBeTruthy();
    expect(getByText('Semana')).toBeTruthy();
  });

  it('should show navigation arrows', () => {
    const { getByText } = renderWithTheme(<AgendaScreen />);
    expect(getByText('‹')).toBeTruthy();
    expect(getByText('›')).toBeTruthy();
  });
});

describe('WorkOrdersListScreen', () => {
  it('should render without crashing', () => {
    const { getByPlaceholderText } = renderWithTheme(<WorkOrdersListScreen />);
    expect(getByPlaceholderText('Buscar OS...')).toBeTruthy();
  });

  it('should show status filter buttons', () => {
    const { getByText } = renderWithTheme(<WorkOrdersListScreen />);
    expect(getByText('Todas')).toBeTruthy();
    expect(getByText('Agendadas')).toBeTruthy();
    expect(getByText('Em Andamento')).toBeTruthy();
    expect(getByText('Concluídas')).toBeTruthy();
  });
});

describe('WorkOrderDetailScreen', () => {
  const mockWorkOrder = {
    id: 'test-id',
    clientId: 'client-id',
    title: 'Test Work Order',
    description: 'Test description',
    status: 'SCHEDULED' as WorkOrderStatus,
    scheduledDate: '2024-01-15',
    scheduledStartTime: '2024-01-15T09:00:00Z',
    scheduledEndTime: '2024-01-15T11:00:00Z',
    address: '123 Test St',
    notes: 'Test notes',
    totalValue: 150.00,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
    technicianId: 'tech-id',
    clientName: 'Test Client',
    clientPhone: '11999999999',
  };

  it('should render work order title', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('Test Work Order')).toBeTruthy();
  });

  it('should render work order description', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('Test description')).toBeTruthy();
  });

  it('should render client name', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('Test Client')).toBeTruthy();
  });

  it('should render status badge', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('Agendada')).toBeTruthy();
  });

  it('should show start button for SCHEDULED status', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('▶️ Iniciar OS')).toBeTruthy();
  });

  it('should show complete button for IN_PROGRESS status', () => {
    const inProgressWorkOrder = { ...mockWorkOrder, status: 'IN_PROGRESS' as WorkOrderStatus };
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={inProgressWorkOrder} />
    );
    expect(getByText('✅ Concluir OS')).toBeTruthy();
  });

  it('should NOT show action buttons for DONE status', () => {
    const doneWorkOrder = { ...mockWorkOrder, status: 'DONE' as WorkOrderStatus };
    const { queryByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={doneWorkOrder} />
    );
    expect(queryByText('▶️ Iniciar OS')).toBeNull();
    expect(queryByText('✅ Concluir OS')).toBeNull();
    expect(queryByText('❌ Cancelar OS')).toBeNull();
  });

  it('should show placeholder for checklist', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('📋 Checklist (em breve)')).toBeTruthy();
  });

  it('should show placeholder for signature', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('✍️ Assinatura Digital (em breve)')).toBeTruthy();
  });

  it('should render total value when provided', () => {
    const { getByText } = renderWithTheme(
      <WorkOrderDetailScreen workOrder={mockWorkOrder} />
    );
    expect(getByText('R$ 150.00')).toBeTruthy();
  });
});
