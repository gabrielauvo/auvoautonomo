import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportFilterBar } from '../report-filter-bar';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/reports',
  useSearchParams: () => new URLSearchParams('period=last30days'),
}));

describe('ReportFilterBar', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('should render period options', () => {
    render(<ReportFilterBar />);

    expect(screen.getByText('Hoje')).toBeInTheDocument();
    expect(screen.getByText('7 dias')).toBeInTheDocument();
    expect(screen.getByText('30 dias')).toBeInTheDocument();
    expect(screen.getByText('Este mês')).toBeInTheDocument();
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
  });

  it('should highlight active period', () => {
    render(<ReportFilterBar />);

    const activeButton = screen.getByText('30 dias');
    expect(activeButton).toHaveClass('bg-primary');
  });

  it('should call router.push when period changes', () => {
    render(<ReportFilterBar />);

    fireEvent.click(screen.getByText('7 dias'));

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('period=last7days'));
  });

  it('should show export buttons when showExport is true', () => {
    const mockExport = jest.fn();
    render(<ReportFilterBar showExport onExport={mockExport} />);

    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('should hide export buttons when showExport is false', () => {
    render(<ReportFilterBar showExport={false} />);

    expect(screen.queryByText('CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
  });

  it('should call onExport with format when export button clicked', () => {
    const mockExport = jest.fn();
    render(<ReportFilterBar showExport onExport={mockExport} />);

    fireEvent.click(screen.getByText('CSV'));
    expect(mockExport).toHaveBeenCalledWith('csv');

    fireEvent.click(screen.getByText('PDF'));
    expect(mockExport).toHaveBeenCalledWith('pdf');
  });

  it('should call onRefresh when refresh button clicked', () => {
    const mockRefresh = jest.fn();
    render(<ReportFilterBar onRefresh={mockRefresh} />);

    fireEvent.click(screen.getByText('Atualizar'));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should disable buttons when loading', () => {
    const mockRefresh = jest.fn();
    render(<ReportFilterBar onRefresh={mockRefresh} isLoading />);

    const refreshButton = screen.getByText('Atualizar').closest('button');
    expect(refreshButton).toBeDisabled();
  });
});
