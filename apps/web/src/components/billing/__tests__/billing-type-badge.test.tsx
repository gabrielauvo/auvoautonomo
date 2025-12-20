/**
 * BillingTypeBadge Component Tests
 *
 * Testes do componente de badge de tipo de cobrança
 */

import { render, screen } from '@testing-library/react';
import { BillingTypeBadge } from '../billing-type-badge';
import { BillingType, billingTypeLabels } from '@/services/charges.service';

describe('BillingTypeBadge', () => {
  const allTypes: BillingType[] = ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'];

  it('should render badge with correct label for each type', () => {
    allTypes.forEach((type) => {
      const { unmount } = render(<BillingTypeBadge type={type} />);
      expect(screen.getByText(billingTypeLabels[type])).toBeInTheDocument();
      unmount();
    });
  });

  it('should render with default size', () => {
    const { container } = render(<BillingTypeBadge type="PIX" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render with small size', () => {
    const { container } = render(<BillingTypeBadge type="PIX" size="sm" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render with icon by default', () => {
    const { container } = render(<BillingTypeBadge type="PIX" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render without icon when showIcon is false', () => {
    const { container } = render(<BillingTypeBadge type="PIX" showIcon={false} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  describe('type variants', () => {
    it('should render PIX with success variant', () => {
      render(<BillingTypeBadge type="PIX" />);
      expect(screen.getByText('PIX')).toBeInTheDocument();
    });

    it('should render BOLETO with info variant', () => {
      render(<BillingTypeBadge type="BOLETO" />);
      expect(screen.getByText('Boleto')).toBeInTheDocument();
    });

    it('should render CREDIT_CARD with warning variant', () => {
      render(<BillingTypeBadge type="CREDIT_CARD" />);
      expect(screen.getByText('Cartão de Crédito')).toBeInTheDocument();
    });

    it('should render UNDEFINED with gray variant', () => {
      render(<BillingTypeBadge type="UNDEFINED" />);
      expect(screen.getByText('Não definido')).toBeInTheDocument();
    });
  });

  describe('icon display', () => {
    it('should display QR code icon for PIX', () => {
      const { container } = render(<BillingTypeBadge type="PIX" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should display file icon for BOLETO', () => {
      const { container } = render(<BillingTypeBadge type="BOLETO" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should display card icon for CREDIT_CARD', () => {
      const { container } = render(<BillingTypeBadge type="CREDIT_CARD" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should display help icon for UNDEFINED', () => {
      const { container } = render(<BillingTypeBadge type="UNDEFINED" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
