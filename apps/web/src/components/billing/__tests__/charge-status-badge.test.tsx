/**
 * ChargeStatusBadge Component Tests
 *
 * Testes do componente de badge de status de cobrança
 */

import { render, screen } from '@testing-library/react';
import { ChargeStatusBadge } from '../charge-status-badge';
import { ChargeStatus, chargeStatusLabels } from '@/services/charges.service';

describe('ChargeStatusBadge', () => {
  const allStatuses: ChargeStatus[] = [
    'PENDING',
    'OVERDUE',
    'CONFIRMED',
    'RECEIVED',
    'RECEIVED_IN_CASH',
    'REFUNDED',
    'CANCELED',
  ];

  it('should render badge with correct label for each status', () => {
    allStatuses.forEach((status) => {
      const { unmount } = render(<ChargeStatusBadge status={status} />);
      expect(screen.getByText(chargeStatusLabels[status])).toBeInTheDocument();
      unmount();
    });
  });

  it('should render with default size', () => {
    const { container } = render(<ChargeStatusBadge status="PENDING" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render with small size', () => {
    const { container } = render(<ChargeStatusBadge status="PENDING" size="sm" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render with icon by default', () => {
    const { container } = render(<ChargeStatusBadge status="PENDING" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render without icon when showIcon is false', () => {
    const { container } = render(<ChargeStatusBadge status="PENDING" showIcon={false} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  describe('status variants', () => {
    it('should render PENDING with gray variant', () => {
      render(<ChargeStatusBadge status="PENDING" />);
      expect(screen.getByText('Aguardando')).toBeInTheDocument();
    });

    it('should render OVERDUE with error variant', () => {
      render(<ChargeStatusBadge status="OVERDUE" />);
      expect(screen.getByText('Vencida')).toBeInTheDocument();
    });

    it('should render CONFIRMED with success variant', () => {
      render(<ChargeStatusBadge status="CONFIRMED" />);
      expect(screen.getByText('Confirmada')).toBeInTheDocument();
    });

    it('should render RECEIVED with success variant', () => {
      render(<ChargeStatusBadge status="RECEIVED" />);
      expect(screen.getByText('Recebida')).toBeInTheDocument();
    });

    it('should render RECEIVED_IN_CASH with success variant', () => {
      render(<ChargeStatusBadge status="RECEIVED_IN_CASH" />);
      expect(screen.getByText('Recebida em Dinheiro')).toBeInTheDocument();
    });

    it('should render REFUNDED with warning variant', () => {
      render(<ChargeStatusBadge status="REFUNDED" />);
      expect(screen.getByText('Estornada')).toBeInTheDocument();
    });

    it('should render CANCELED with error variant', () => {
      render(<ChargeStatusBadge status="CANCELED" />);
      expect(screen.getByText('Cancelada')).toBeInTheDocument();
    });
  });
});
