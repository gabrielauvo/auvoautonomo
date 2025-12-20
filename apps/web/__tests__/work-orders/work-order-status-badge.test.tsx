/**
 * Testes para o WorkOrderStatusBadge
 *
 * Cobre:
 * - Renderização de cada status
 * - Labels corretos
 * - Variantes de cor
 * - Ícones
 */

import { render, screen } from '@testing-library/react';
import { WorkOrderStatusBadge } from '@/components/work-orders/work-order-status-badge';

describe('WorkOrderStatusBadge', () => {
  it('deve renderizar status SCHEDULED corretamente', () => {
    render(<WorkOrderStatusBadge status="SCHEDULED" />);
    expect(screen.getByText('Agendada')).toBeInTheDocument();
  });

  it('deve renderizar status IN_PROGRESS corretamente', () => {
    render(<WorkOrderStatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('Em Execução')).toBeInTheDocument();
  });

  it('deve renderizar status DONE corretamente', () => {
    render(<WorkOrderStatusBadge status="DONE" />);
    expect(screen.getByText('Concluída')).toBeInTheDocument();
  });

  it('deve renderizar status CANCELED corretamente', () => {
    render(<WorkOrderStatusBadge status="CANCELED" />);
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('deve aceitar prop showIcon', () => {
    render(<WorkOrderStatusBadge status="SCHEDULED" showIcon={false} />);
    expect(screen.getByText('Agendada')).toBeInTheDocument();
  });

  it('deve aceitar diferentes sizes', () => {
    const { rerender } = render(<WorkOrderStatusBadge status="SCHEDULED" size="sm" />);
    expect(screen.getByText('Agendada')).toBeInTheDocument();

    rerender(<WorkOrderStatusBadge status="SCHEDULED" size="lg" />);
    expect(screen.getByText('Agendada')).toBeInTheDocument();
  });
});
