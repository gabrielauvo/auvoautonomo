import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KpiCard } from '../kpi-card';
import { DollarSign } from 'lucide-react';

describe('KpiCard', () => {
  it('should render title and value', () => {
    render(<KpiCard title="Revenue" value={1000} />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    // Value formatted with pt-BR locale
    expect(screen.getByText(/1[.,]000/)).toBeInTheDocument();
  });

  it('should format currency values', () => {
    render(<KpiCard title="Total" value={1500.5} format="currency" />);

    expect(screen.getByText(/R\$/)).toBeInTheDocument();
  });

  it('should format percent values', () => {
    render(<KpiCard title="Rate" value={75.5} format="percent" />);

    // Accept both comma and period as decimal separator (locale dependent)
    expect(screen.getByText(/75[.,]5%/)).toBeInTheDocument();
  });

  it('should show positive change indicator', () => {
    render(<KpiCard title="Sales" value={100} change={12.5} />);

    expect(screen.getByText(/\+12[.,]5%/)).toBeInTheDocument();
  });

  it('should show negative change indicator', () => {
    render(<KpiCard title="Sales" value={100} change={-5.2} />);

    expect(screen.getByText(/-5[.,]2%/)).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    render(
      <KpiCard
        title="Revenue"
        value={1000}
        icon={<DollarSign data-testid="icon" />}
      />
    );

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('should render loading skeleton when loading', () => {
    const { container } = render(
      <KpiCard title="Revenue" value={1000} loading />
    );

    // Skeleton uses animate-pulse class from Tailwind
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
    // Actual title should not be rendered
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
  });

  it('should show custom change label', () => {
    render(
      <KpiCard
        title="Conversion"
        value={45}
        change={8.3}
        changeLabel="vs last month"
      />
    );

    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });
});
