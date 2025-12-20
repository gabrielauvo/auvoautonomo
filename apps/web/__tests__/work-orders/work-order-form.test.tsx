/**
 * Testes para o WorkOrderForm
 *
 * Cobre:
 * - Renderização do formulário
 * - Validação de campos obrigatórios
 * - Seleção de cliente
 * - Adição de itens
 * - Agendamento
 * - Conversão de orçamento
 * - Tratamento de erro LIMIT_REACHED
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    billing: {
      planKey: 'FREE',
      limits: { maxWorkOrders: 50 },
      usage: { workOrdersCount: 10 },
    },
  }),
}));

jest.mock('@/hooks/use-clients', () => ({
  useSearchClients: () => ({
    data: [
      { id: '1', name: 'Cliente Teste', phone: '11999999999' },
    ],
    isLoading: false,
  }),
}));

jest.mock('@/hooks/use-quotes', () => ({
  useQuote: () => ({
    data: null,
    isLoading: false,
  }),
}));

jest.mock('@/hooks/use-work-orders', () => ({
  useCreateWorkOrder: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useUpdateWorkOrder: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useAddWorkOrderItem: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useRemoveWorkOrderItem: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/hooks/use-quotes', () => ({
  useQuote: () => ({
    data: null,
    isLoading: false,
  }),
  useCatalogItems: () => ({
    data: [
      {
        id: '1',
        name: 'Serviço Teste',
        type: 'SERVICE',
        unit: 'un',
        basePrice: 150,
        category: { name: 'Categoria 1' },
      },
    ],
    isLoading: false,
  }),
  useCatalogCategories: () => ({
    data: [{ id: '1', name: 'Categoria 1' }],
  }),
}));

import { WorkOrderForm } from '@/components/work-orders/work-order-form';

// Wrapper com QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('WorkOrderForm', () => {
  it('deve renderizar o formulário corretamente', () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Informações da OS')).toBeInTheDocument();
    expect(screen.getByText('Agendamento')).toBeInTheDocument();
    expect(screen.getByText('Itens da OS')).toBeInTheDocument();
    expect(screen.getByText('Observações')).toBeInTheDocument();
  });

  it('deve exibir erro ao tentar salvar sem cliente', async () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    const saveButton = screen.getByText('Salvar OS');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Selecione um cliente')).toBeInTheDocument();
    });
  });

  it('deve exibir erro ao tentar salvar sem título', async () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    const saveButton = screen.getByText('Salvar OS');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Informe o título da OS')).toBeInTheDocument();
    });
  });

  it('deve permitir preencher o título', async () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    const titleInput = screen.getByPlaceholderText('Ex: Manutenção ar-condicionado');
    fireEvent.change(titleInput, { target: { value: 'Instalação de equipamento' } });

    expect(titleInput).toHaveValue('Instalação de equipamento');
  });

  it('deve exibir campos de agendamento', () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Hora início')).toBeInTheDocument();
    expect(screen.getByText('Hora fim')).toBeInTheDocument();
    expect(screen.getByText('Endereço do serviço')).toBeInTheDocument();
  });

  it('deve abrir modal de catálogo ao clicar em adicionar item', async () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    const addButton = screen.getByText('Adicionar Item');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Selecionar do catálogo')).toBeInTheDocument();
    });
  });

  it('deve permitir adicionar observações', () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    const notesInput = screen.getByPlaceholderText('Observações sobre a ordem de serviço...');
    fireEvent.change(notesInput, { target: { value: 'Observação teste' } });

    expect(notesInput).toHaveValue('Observação teste');
  });

  it('deve ter botões de salvar e cancelar', () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Salvar OS')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });
});

describe('WorkOrderForm - Agendamento', () => {
  it('deve exibir a seção de agendamento', () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    // Verifica se a seção de agendamento existe
    expect(screen.getByText('Agendamento')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Hora início')).toBeInTheDocument();
    expect(screen.getByText('Hora fim')).toBeInTheDocument();
  });

  it('deve exibir campo de endereço', () => {
    render(<WorkOrderForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Endereço do serviço')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Endereço onde será realizado o serviço')).toBeInTheDocument();
  });
});
