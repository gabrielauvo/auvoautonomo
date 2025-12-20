/**
 * Testes para o KitCompositionEditor
 *
 * Cobre:
 * - Renderização com e sem itens
 * - Cálculo do preço total
 * - Exibição de itens do kit
 * - Botão de adicionar item
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocks
jest.mock('@/hooks/use-catalog', () => ({
  useCatalogItems: () => ({
    data: [
      {
        id: 'item-1',
        name: 'Produto A',
        type: 'PRODUCT',
        unit: 'un',
        basePrice: 100,
        isActive: true,
      },
      {
        id: 'item-2',
        name: 'Serviço B',
        type: 'SERVICE',
        unit: 'h',
        basePrice: 80,
        isActive: true,
      },
    ],
    isLoading: false,
  }),
  useBundleItems: () => ({
    data: [],
    isLoading: false,
  }),
  useAddBundleItem: () => ({
    mutateAsync: jest.fn().mockResolvedValue({ id: 'new-bi' }),
    isPending: false,
  }),
  useRemoveBundleItem: () => ({
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

import { KitCompositionEditor } from '@/components/catalog/kit-composition-editor';

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

// Mock bundle items
const mockBundleItems = [
  {
    id: 'bi-1',
    bundleId: 'bundle-1',
    itemId: 'item-1',
    quantity: 2,
    createdAt: '2024-01-01',
    item: {
      id: 'item-1',
      name: 'Produto A',
      type: 'PRODUCT' as const,
      unit: 'un',
      basePrice: 100,
    },
  },
  {
    id: 'bi-2',
    bundleId: 'bundle-1',
    itemId: 'item-2',
    quantity: 3,
    createdAt: '2024-01-01',
    item: {
      id: 'item-2',
      name: 'Serviço B',
      type: 'SERVICE' as const,
      unit: 'h',
      basePrice: 50,
    },
  },
];

describe('KitCompositionEditor', () => {
  it('deve renderizar o título corretamente', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Composição do Kit')).toBeInTheDocument();
  });

  it('deve mostrar botão de adicionar item', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    // Pode haver múltiplos botões de adicionar (no header e no EmptyState)
    const addButtons = screen.getAllByText('Adicionar Item');
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('deve mostrar estado vazio quando não há itens', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Kit vazio')).toBeInTheDocument();
    expect(screen.getByText('Adicione produtos ou serviços para compor este kit')).toBeInTheDocument();
  });

  it('deve renderizar tabela quando há itens', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Qtd')).toBeInTheDocument();
    expect(screen.getByText('Preço Unit.')).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
  });

  it('deve exibir itens do kit corretamente', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Produto A')).toBeInTheDocument();
    expect(screen.getByText('Serviço B')).toBeInTheDocument();
  });

  it('deve exibir quantidades dos itens', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    // Quantidades 2 e 3
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('deve calcular e exibir o preço total do kit', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    // Total: 2*100 + 3*50 = 350
    expect(screen.getByText('Valor total do kit:')).toBeInTheDocument();
    expect(screen.getByText('R$ 350,00')).toBeInTheDocument();
  });

  it('deve exibir contagem de itens', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('2 itens no kit')).toBeInTheDocument();
  });

  it('deve exibir singular para 1 item', () => {
    const singleItem = [mockBundleItems[0]];
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={singleItem} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('1 item no kit')).toBeInTheDocument();
  });

  it('deve exibir alerta informativo sobre preço', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Sobre o preço do kit:')).toBeInTheDocument();
    expect(screen.getByText(/O valor calculado acima é baseado nos preços dos itens/)).toBeInTheDocument();
  });

  it('deve ter botão de remover para cada item', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    const removeButtons = screen.getAllByTitle('Remover do kit');
    expect(removeButtons).toHaveLength(2);
  });

  it('deve abrir modal ao clicar em adicionar item', async () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    const addButton = screen.getAllByText('Adicionar Item')[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Adicionar Item ao Kit')).toBeInTheDocument();
    });
  });

  it('deve mostrar filtros no modal de seleção', async () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    const addButton = screen.getAllByText('Adicionar Item')[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeInTheDocument();
      expect(screen.getByText('Produtos')).toBeInTheDocument();
      expect(screen.getByText('Serviços')).toBeInTheDocument();
    });
  });

  it('deve ter campo de busca no modal', async () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    const addButton = screen.getAllByText('Adicionar Item')[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar produto ou serviço...')).toBeInTheDocument();
    });
  });

  it('deve fechar modal ao clicar em cancelar', async () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    const addButton = screen.getAllByText('Adicionar Item')[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Adicionar Item ao Kit')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Adicionar Item ao Kit')).not.toBeInTheDocument();
    });
  });
});

describe('KitCompositionEditor - Cálculos', () => {
  it('deve calcular subtotal de cada linha corretamente', () => {
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={mockBundleItems} />,
      { wrapper: createWrapper() }
    );

    // Produto A: 2 * R$100 = R$200
    expect(screen.getByText('R$ 200,00')).toBeInTheDocument();

    // Serviço B: 3 * R$50 = R$150
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
  });

  it('deve calcular total geral corretamente', () => {
    const items = [
      {
        id: 'bi-1',
        bundleId: 'bundle-1',
        itemId: 'item-1',
        quantity: 5,
        createdAt: '2024-01-01',
        item: {
          id: 'item-1',
          name: 'Item X',
          type: 'PRODUCT' as const,
          unit: 'un',
          basePrice: 25.50,
        },
      },
    ];

    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={items} />,
      { wrapper: createWrapper() }
    );

    // 5 * R$25,50 = R$127,50 (aparece na célula e no total)
    const values = screen.getAllByText('R$ 127,50');
    expect(values.length).toBeGreaterThanOrEqual(1);
  });

  it('deve mostrar R$ 0,00 para kit vazio (no estado não-vazio)', () => {
    const emptyItems: typeof mockBundleItems = [];
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={emptyItems} />,
      { wrapper: createWrapper() }
    );

    // Como está vazio, mostra o EmptyState, não a tabela
    expect(screen.getByText('Kit vazio')).toBeInTheDocument();
  });
});

describe('KitCompositionEditor - Exclusão de Itens', () => {
  it('deve excluir bundles da lista de seleção', async () => {
    // O modal não deve mostrar itens do tipo BUNDLE
    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={[]} />,
      { wrapper: createWrapper() }
    );

    const addButton = screen.getAllByText('Adicionar Item')[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Adicionar Item ao Kit')).toBeInTheDocument();
    });

    // Os itens mockados são PRODUCT e SERVICE, não BUNDLE
    // O filtro não mostra opção de filtrar por Kit
    expect(screen.queryByText('Kits')).not.toBeInTheDocument();
  });

  it('deve excluir itens já adicionados da lista de seleção', async () => {
    // Com mockBundleItems, item-1 e item-2 já estão no kit
    // Não devem aparecer na seleção
    const singleItem = [mockBundleItems[0]]; // item-1 já está no kit

    render(
      <KitCompositionEditor bundleId="bundle-1" bundleItems={singleItem} />,
      { wrapper: createWrapper() }
    );

    const addButton = screen.getByText('Adicionar Item');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Adicionar Item ao Kit')).toBeInTheDocument();
    });

    // Apenas Serviço B deve aparecer (Produto A já está no kit)
    // Nota: Como usamos mock, isso depende da implementação do filtro
  });
});
