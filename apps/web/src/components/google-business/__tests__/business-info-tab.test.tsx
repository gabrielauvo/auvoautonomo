/**
 * BusinessInfoTab Component Tests
 *
 * Testes do componente de informações do negócio
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessInfoTab } from '../business-info-tab';

// Mock the hooks
const mockUpdateHours = jest.fn();
const mockUpdateDescription = jest.fn();
const mockUpdatePhone = jest.fn();
const mockUpdateWebsite = jest.fn();

jest.mock('@/hooks/use-google-management', () => ({
  useBusinessInfo: () => ({
    data: {
      name: 'locations/123456',
      title: 'Oficina do João',
      phoneNumbers: { primaryPhone: '+5511999999999' },
      websiteUri: 'https://oficinajoa.com.br',
      profile: { description: 'A melhor oficina da cidade!' },
      regularHours: {
        periods: [
          { openDay: 'MONDAY', openTime: { hours: 8, minutes: 0 }, closeDay: 'MONDAY', closeTime: { hours: 18, minutes: 0 } },
          { openDay: 'TUESDAY', openTime: { hours: 8, minutes: 0 }, closeDay: 'TUESDAY', closeTime: { hours: 18, minutes: 0 } },
        ],
      },
      storefrontAddress: {
        addressLines: ['Rua das Flores, 123'],
        locality: 'São Paulo',
        administrativeArea: 'SP',
        postalCode: '01234-567',
      },
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
  useUpdateBusinessHours: () => ({
    mutateAsync: mockUpdateHours,
    isPending: false,
  }),
  useUpdateBusinessDescription: () => ({
    mutateAsync: mockUpdateDescription,
    isPending: false,
  }),
  useUpdateBusinessPhone: () => ({
    mutateAsync: mockUpdatePhone,
    isPending: false,
  }),
  useUpdateBusinessWebsite: () => ({
    mutateAsync: mockUpdateWebsite,
    isPending: false,
  }),
}));

// Mock translations
jest.mock('@/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'businessInfo.basicInfo': 'Informações Básicas',
        'businessInfo.name': 'Nome do Negócio',
        'businessInfo.address': 'Endereço',
        'businessInfo.editInGoogle': 'Para alterar, acesse o Google.',
        'businessInfo.saved': 'Salvo com sucesso!',
        'businessInfo.description': 'Descrição',
        'businessInfo.descriptionPlaceholder': 'Descreva seu negócio...',
        'businessInfo.phone': 'Telefone',
        'businessInfo.phonePlaceholder': '(00) 00000-0000',
        'businessInfo.website': 'Website',
        'businessInfo.websitePlaceholder': 'https://seusite.com.br',
        'businessInfo.hours': 'Horário de Funcionamento',
        'businessInfo.saveHours': 'Salvar Horários',
        'businessInfo.open': 'Aberto',
        'businessInfo.closed': 'Fechado',
        'businessInfo.days.monday': 'Segunda',
        'businessInfo.days.tuesday': 'Terça',
        'businessInfo.days.wednesday': 'Quarta',
        'businessInfo.days.thursday': 'Quinta',
        'businessInfo.days.friday': 'Sexta',
        'businessInfo.days.saturday': 'Sábado',
        'businessInfo.days.sunday': 'Domingo',
        'common.save': 'Salvar',
      };
      return translations[key] || key;
    },
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
};

describe('BusinessInfoTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display business name', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText('Oficina do João')).toBeInTheDocument();
  });

  it('should display business address', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText(/Rua das Flores, 123/)).toBeInTheDocument();
    expect(screen.getByText(/São Paulo/)).toBeInTheDocument();
  });

  it('should display description section', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText('Descrição')).toBeInTheDocument();
  });

  it('should display current description', () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const textarea = container.querySelector('textarea');
    expect(textarea).toHaveValue('A melhor oficina da cidade!');
  });

  it('should display phone section', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText('Telefone')).toBeInTheDocument();
  });

  it('should display current phone', () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const phoneInput = container.querySelector('input[type="tel"]');
    expect(phoneInput).toHaveValue('+5511999999999');
  });

  it('should display website section', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText('Website')).toBeInTheDocument();
  });

  it('should display current website', () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const urlInput = container.querySelector('input[type="url"]');
    expect(urlInput).toHaveValue('https://oficinajoa.com.br');
  });

  it('should display business hours section', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText('Horário de Funcionamento')).toBeInTheDocument();
  });

  it('should display days of week', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText('Segunda')).toBeInTheDocument();
    expect(screen.getByText('Terça')).toBeInTheDocument();
    expect(screen.getByText('Quarta')).toBeInTheDocument();
    expect(screen.getByText('Quinta')).toBeInTheDocument();
    expect(screen.getByText('Sexta')).toBeInTheDocument();
    expect(screen.getByText('Sábado')).toBeInTheDocument();
    expect(screen.getByText('Domingo')).toBeInTheDocument();
  });

  it('should display info message about editing in Google', () => {
    renderWithProviders(<BusinessInfoTab />);

    expect(screen.getByText('Para alterar, acesse o Google.')).toBeInTheDocument();
  });

  it('should show save button when description is changed', async () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const textarea = container.querySelector('textarea');
    fireEvent.change(textarea!, { target: { value: 'Nova descrição' } });

    await waitFor(() => {
      const saveButtons = screen.getAllByText('Salvar');
      expect(saveButtons.length).toBeGreaterThan(0);
    });
  });

  it('should show save button when phone is changed', async () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const phoneInput = container.querySelector('input[type="tel"]');
    fireEvent.change(phoneInput!, { target: { value: '+5511888888888' } });

    await waitFor(() => {
      const saveButtons = screen.getAllByText('Salvar');
      expect(saveButtons.length).toBeGreaterThan(0);
    });
  });

  it('should show save button when website is changed', async () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const urlInput = container.querySelector('input[type="url"]');
    fireEvent.change(urlInput!, { target: { value: 'https://novosite.com.br' } });

    await waitFor(() => {
      const saveButtons = screen.getAllByText('Salvar');
      expect(saveButtons.length).toBeGreaterThan(0);
    });
  });
});

describe('BusinessInfoTab - Hours Editor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show checkboxes for each day', () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(7); // 7 days
  });

  it('should show time inputs for open days', () => {
    const { container } = renderWithProviders(<BusinessInfoTab />);

    const timeInputs = container.querySelectorAll('input[type="time"]');
    expect(timeInputs.length).toBeGreaterThan(0);
  });

  it('should show "Closed" text for closed days', () => {
    renderWithProviders(<BusinessInfoTab />);

    // Days without hours should show "Fechado"
    const closedLabels = screen.getAllByText('Fechado');
    expect(closedLabels.length).toBeGreaterThan(0);
  });
});
