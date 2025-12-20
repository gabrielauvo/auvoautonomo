/**
 * Testes para o CatalogItemForm
 *
 * Cobre:
 * - Renderização correta do formulário
 * - Validação de campos obrigatórios
 * - Seleção de tipo (PRODUCT, SERVICE, BUNDLE)
 * - Mensagens de erro
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-catalog', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-1', name: 'Categoria 1' },
      { id: 'cat-2', name: 'Categoria 2' },
    ],
    isLoading: false,
  }),
  useCreateItem: () => ({
    mutateAsync: jest.fn().mockResolvedValue({ id: 'new-item-1' }),
    isPending: false,
  }),
  useUpdateItem: () => ({
    mutateAsync: jest.fn().mockResolvedValue({ id: 'updated-item-1' }),
    isPending: false,
  }),
  useCreateCategory: () => ({
    mutateAsync: jest.fn().mockResolvedValue({ id: 'new-cat-id', name: 'Nova Categoria' }),
    isPending: false,
  }),
}));

import { CatalogItemForm } from '@/components/catalog/catalog-item-form';

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

describe('CatalogItemForm', () => {
  it('deve renderizar o formulário corretamente', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Tipo do Item')).toBeInTheDocument();
    expect(screen.getByText('Dados Principais')).toBeInTheDocument();
    expect(screen.getByText('Preços')).toBeInTheDocument();
  });

  it('deve renderizar os três tipos de item', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Produto')).toBeInTheDocument();
    expect(screen.getByText('Serviço')).toBeInTheDocument();
    expect(screen.getByText('Kit')).toBeInTheDocument();
  });

  it('deve renderizar descrições de tipos', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Item físico ou material')).toBeInTheDocument();
    expect(screen.getByText('Mão de obra ou prestação de serviço')).toBeInTheDocument();
    expect(screen.getByText('Combinação de produtos e/ou serviços')).toBeInTheDocument();
  });

  it('deve exibir erro ao tentar salvar sem nome', async () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    // Preenche apenas o preço
    const priceInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(priceInput, { target: { value: '100' } });

    // Tenta salvar
    const saveButton = screen.getByText('Criar Item');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
    });
  });

  it('deve exibir erro ao tentar salvar sem preço', async () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    // Preenche apenas o nome
    const nameInput = screen.getByPlaceholderText('Nome do item');
    fireEvent.change(nameInput, { target: { value: 'Meu Item' } });

    // Tenta salvar
    const saveButton = screen.getByText('Criar Item');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Preço base é obrigatório e deve ser maior ou igual a 0')).toBeInTheDocument();
    });
  });

  it('deve permitir selecionar categoria', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    const categorySelect = screen.getByDisplayValue('Sem categoria');
    expect(categorySelect).toBeInTheDocument();

    // Verifica opções disponíveis
    expect(screen.getByText('Categoria 1')).toBeInTheDocument();
    expect(screen.getByText('Categoria 2')).toBeInTheDocument();
  });

  it('deve mostrar campo de duração apenas para serviços', async () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    // Inicialmente tipo é PRODUCT, não deve mostrar duração
    expect(screen.queryByText('Duração Padrão')).not.toBeInTheDocument();

    // Clica em Serviço
    const serviceButton = screen.getByText('Serviço');
    fireEvent.click(serviceButton);

    await waitFor(() => {
      expect(screen.getByText('Duração Padrão')).toBeInTheDocument();
    });
  });

  it('deve mostrar mensagem sobre composição de kit ao criar', async () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    // Clica em Kit
    const bundleButton = screen.getByText('Kit');
    fireEvent.click(bundleButton);

    await waitFor(() => {
      expect(screen.getByText('Composição do Kit')).toBeInTheDocument();
      expect(screen.getByText(/Após criar o kit, você poderá adicionar os itens/)).toBeInTheDocument();
    });
  });

  it('deve ter botão de cancelar', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('deve ter botão de criar item', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Criar Item')).toBeInTheDocument();
  });

  it('deve mostrar botão de salvar alterações quando editando', () => {
    const mockItem = {
      id: 'item-1',
      userId: 'user-1',
      name: 'Item Existente',
      type: 'PRODUCT' as const,
      unit: 'un',
      basePrice: 150,
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    render(<CatalogItemForm item={mockItem} />, { wrapper: createWrapper() });

    expect(screen.getByText('Salvar Alterações')).toBeInTheDocument();
  });

  it('deve preencher campos com dados do item ao editar', () => {
    const mockItem = {
      id: 'item-1',
      userId: 'user-1',
      name: 'Item Existente',
      description: 'Descrição do item',
      type: 'SERVICE' as const,
      sku: 'SKU-001',
      unit: 'h',
      basePrice: 150,
      costPrice: 80,
      defaultDurationMinutes: 60,
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    render(<CatalogItemForm item={mockItem} />, { wrapper: createWrapper() });

    expect(screen.getByDisplayValue('Item Existente')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Descrição do item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SKU-001')).toBeInTheDocument();
  });

  it('deve desabilitar seleção de tipo ao editar', () => {
    const mockItem = {
      id: 'item-1',
      userId: 'user-1',
      name: 'Item Existente',
      type: 'PRODUCT' as const,
      unit: 'un',
      basePrice: 150,
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    render(<CatalogItemForm item={mockItem} />, { wrapper: createWrapper() });

    // Botões de tipo devem estar desabilitados
    const productButton = screen.getByText('Produto').closest('button');
    expect(productButton).toBeDisabled();
  });

  it('deve mostrar checkbox de status ao editar', () => {
    const mockItem = {
      id: 'item-1',
      userId: 'user-1',
      name: 'Item Existente',
      type: 'PRODUCT' as const,
      unit: 'un',
      basePrice: 150,
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    render(<CatalogItemForm item={mockItem} />, { wrapper: createWrapper() });

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Item ativo')).toBeInTheDocument();
  });
});

describe('CatalogItemForm - Validação', () => {
  it('deve validar campos obrigatórios ao submeter', async () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    const saveButton = screen.getByText('Criar Item');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Preço base é obrigatório e deve ser maior ou igual a 0')).toBeInTheDocument();
    });
  });

  it('deve validar preço vazio', async () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    const nameInput = screen.getByPlaceholderText('Nome do item');
    fireEvent.change(nameInput, { target: { value: 'Meu Item' } });

    // Deixa preço vazio (não preenche)
    const saveButton = screen.getByText('Criar Item');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Preço base é obrigatório e deve ser maior ou igual a 0')).toBeInTheDocument();
    });
  });

  it('deve aceitar preço zero', async () => {
    const mockCreateItem = jest.fn().mockResolvedValue({ id: 'new-item' });
    jest.spyOn(require('@/hooks/use-catalog'), 'useCreateItem').mockReturnValue({
      mutateAsync: mockCreateItem,
      isPending: false,
    });

    render(<CatalogItemForm />, { wrapper: createWrapper() });

    const nameInput = screen.getByPlaceholderText('Nome do item');
    fireEvent.change(nameInput, { target: { value: 'Item Grátis' } });

    const priceInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(priceInput, { target: { value: '0' } });

    const saveButton = screen.getByText('Criar Item');
    fireEvent.click(saveButton);

    // Não deve mostrar erro de validação
    await waitFor(() => {
      expect(screen.queryByText('Preço base é obrigatório e deve ser maior ou igual a 0')).not.toBeInTheDocument();
    });
  });
});

describe('CatalogItemForm - Unidades', () => {
  it('deve renderizar unidades comuns', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Unidade (un)')).toBeInTheDocument();
    expect(screen.getByText('Hora (h)')).toBeInTheDocument();
    expect(screen.getByText('Metro (m)')).toBeInTheDocument();
    expect(screen.getByText('Metro quadrado (m²)')).toBeInTheDocument();
  });

  it('deve ter opção de unidade personalizada', () => {
    render(<CatalogItemForm />, { wrapper: createWrapper() });

    expect(screen.getByText('Outra...')).toBeInTheDocument();
  });
});
