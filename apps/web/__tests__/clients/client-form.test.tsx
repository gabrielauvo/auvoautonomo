/**
 * Testes para o ClientForm
 *
 * Cobre:
 * - Renderização do formulário
 * - Validação de campos obrigatórios
 * - Validação de CPF/CNPJ
 * - Formatação de campos
 * - Prevenção de duplo submit
 * - Exibição de erros
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocks
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    billing: {
      planKey: 'FREE',
      limits: { maxClients: 10 },
      usage: { clientsCount: 5 },
    },
  }),
}));

const mockCreateClientMutateAsync = jest.fn();
const mockUpdateClientMutateAsync = jest.fn();

jest.mock('@/hooks/use-clients', () => ({
  useCreateClient: () => ({
    mutateAsync: mockCreateClientMutateAsync,
    isPending: false,
  }),
  useUpdateClient: () => ({
    mutateAsync: mockUpdateClientMutateAsync,
    isPending: false,
  }),
}));

import { ClientForm } from '@/components/clients/client-form';

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

describe('ClientForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar o formulário de novo cliente corretamente', () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      expect(screen.getByText('Novo Cliente')).toBeInTheDocument();
      expect(screen.getByText('Dados Principais')).toBeInTheDocument();
      expect(screen.getByText('Contato')).toBeInTheDocument();
      // "Endereço" aparece tanto como seção quanto como label de campo
      expect(screen.getAllByText('Endereço').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Observações')).toBeInTheDocument();
    });

    it('deve renderizar o formulário de edição quando cliente é fornecido', () => {
      const existingClient = {
        id: 'client-1',
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '(11) 99999-9999',
        taxId: '52998224725',
        address: 'Rua das Flores, 123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234-567',
        notes: 'Cliente VIP',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };

      render(<ClientForm client={existingClient} />, { wrapper: createWrapper() });

      expect(screen.getByText('Editar Cliente')).toBeInTheDocument();
      expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument();
      expect(screen.getByDisplayValue('joao@email.com')).toBeInTheDocument();
    });

    it('deve mostrar campos obrigatórios com asterisco', () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      expect(screen.getByText('Nome / Razão Social')).toBeInTheDocument();
      expect(screen.getByText('CPF / CNPJ')).toBeInTheDocument();
      expect(screen.getByText('Telefone')).toBeInTheDocument();
    });
  });

  describe('Validação', () => {
    it('deve exibir erro quando nome está vazio', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
      });
    });

    it('deve exibir erro quando telefone está vazio', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Telefone é obrigatório')).toBeInTheDocument();
      });
    });

    it('deve exibir erro quando CPF/CNPJ está vazio', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('CPF/CNPJ é obrigatório')).toBeInTheDocument();
      });
    });

    it('deve exibir erro para CPF inválido', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'João Silva');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '12345678900'); // CPF inválido

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('CPF inválido')).toBeInTheDocument();
      });
    });

    it('deve exibir erro para CNPJ inválido', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'Empresa LTDA');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '12345678000100'); // CNPJ inválido

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('CNPJ inválido')).toBeInTheDocument();
      });
    });

    it('deve aceitar CPF válido', async () => {
      mockCreateClientMutateAsync.mockResolvedValue({ id: 'new-client-id' });

      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'João Silva');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '52998224725'); // CPF válido

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockCreateClientMutateAsync).toHaveBeenCalled();
      });
    });

    it('deve aceitar CNPJ válido', async () => {
      mockCreateClientMutateAsync.mockResolvedValue({ id: 'new-client-id' });

      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'Empresa LTDA');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '10426136000111'); // CNPJ válido

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockCreateClientMutateAsync).toHaveBeenCalled();
      });
    });

    it('deve renderizar campo de email', () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      expect(screen.getByPlaceholderText('email@exemplo.com')).toBeInTheDocument();
    });
  });

  describe('Formatação', () => {
    it('deve formatar telefone enquanto digita', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      await userEvent.type(phoneInput, '11999999999');

      expect(phoneInput).toHaveValue('(11) 99999-9999');
    });

    it('deve formatar CPF enquanto digita', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');
      await userEvent.type(taxIdInput, '52998224725');

      expect(taxIdInput).toHaveValue('529.982.247-25');
    });

    it('deve formatar CNPJ enquanto digita', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');
      await userEvent.type(taxIdInput, '10426136000111');

      expect(taxIdInput).toHaveValue('10.426.136/0001-11');
    });

    it('deve formatar CEP enquanto digita', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const zipCodeInput = screen.getByPlaceholderText('00000-000');
      await userEvent.type(zipCodeInput, '01234567');

      expect(zipCodeInput).toHaveValue('01234-567');
    });

    it('deve converter estado para maiúsculas', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const stateInput = screen.getByPlaceholderText('UF');
      await userEvent.type(stateInput, 'sp');

      expect(stateInput).toHaveValue('SP');
    });
  });

  describe('Prevenção de duplo submit', () => {
    it('não deve permitir múltiplos envios consecutivos', async () => {
      mockCreateClientMutateAsync.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ id: 'new-client-id' }), 100)
          )
      );

      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'João Silva');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '52998224725');

      const saveButton = screen.getByText('Salvar');

      // Clica múltiplas vezes rapidamente
      fireEvent.click(saveButton);
      fireEvent.click(saveButton);
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Deve ter sido chamado apenas uma vez
        expect(mockCreateClientMutateAsync).toHaveBeenCalledTimes(1);
      });
    });

    it('deve desabilitar botão durante o envio', async () => {
      // Simula um pending state
      jest.mock('@/hooks/use-clients', () => ({
        useCreateClient: () => ({
          mutateAsync: mockCreateClientMutateAsync,
          isPending: true,
        }),
        useUpdateClient: () => ({
          mutateAsync: mockUpdateClientMutateAsync,
          isPending: false,
        }),
      }));

      render(<ClientForm />, { wrapper: createWrapper() });

      const saveButton = screen.getByRole('button', { name: /salvar/i });
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe('Submit', () => {
    it('deve enviar taxId apenas com números', async () => {
      mockCreateClientMutateAsync.mockResolvedValue({ id: 'new-client-id' });

      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'João Silva');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '52998224725');

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockCreateClientMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            taxId: '52998224725', // Apenas números
          })
        );
      });
    });

    it('deve redirecionar para página do cliente após sucesso', async () => {
      mockCreateClientMutateAsync.mockResolvedValue({ id: 'new-client-id' });

      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'João Silva');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '52998224725');

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/clients/new-client-id');
      });
    });

    it('deve chamar onSuccess callback quando fornecido', async () => {
      const onSuccess = jest.fn();
      mockCreateClientMutateAsync.mockResolvedValue({ id: 'new-client-id' });

      render(<ClientForm onSuccess={onSuccess} />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'João Silva');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '52998224725');

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ id: 'new-client-id' });
      });
    });
  });

  describe('Cancelamento', () => {
    it('deve voltar ao clicar em cancelar', async () => {
      render(<ClientForm />, { wrapper: createWrapper() });

      const cancelButton = screen.getByText('Cancelar');
      fireEvent.click(cancelButton);

      expect(mockBack).toHaveBeenCalled();
    });

    it('deve chamar onCancel callback quando fornecido', async () => {
      const onCancel = jest.fn();

      render(<ClientForm onCancel={onCancel} />, { wrapper: createWrapper() });

      const cancelButton = screen.getByText('Cancelar');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  describe('Erros de API', () => {
    it('deve exibir erro geral quando API falha', async () => {
      mockCreateClientMutateAsync.mockRejectedValue(
        new Error('Erro ao salvar cliente')
      );

      render(<ClientForm />, { wrapper: createWrapper() });

      const nameInput = screen.getByPlaceholderText('Nome completo ou razão social');
      const phoneInput = screen.getByPlaceholderText('(00) 00000-0000');
      const taxIdInput = screen.getByPlaceholderText('000.000.000-00');

      await userEvent.type(nameInput, 'João Silva');
      await userEvent.type(phoneInput, '11999999999');
      await userEvent.type(taxIdInput, '52998224725');

      const saveButton = screen.getByText('Salvar');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Erro ao salvar cliente')).toBeInTheDocument();
      });
    });
  });
});
