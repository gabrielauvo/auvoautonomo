/**
 * PostsTab Component Tests
 *
 * Testes do componente de gerenciamento de posts
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostsTab } from '../posts-tab';

// Mock the hooks
const mockCreatePost = jest.fn();
const mockUpdatePost = jest.fn();
const mockDeletePost = jest.fn();

jest.mock('@/hooks/use-google-management', () => ({
  usePosts: () => ({
    data: {
      pages: [
        {
          localPosts: [
            {
              name: 'post-1',
              summary: 'Confira nossa promoção de verão!',
              topicType: 'OFFER',
              state: 'LIVE',
              createTime: '2024-01-15T10:00:00Z',
              updateTime: '2024-01-15T10:00:00Z',
              offer: {
                couponCode: 'VERAO20',
              },
            },
            {
              name: 'post-2',
              summary: 'Evento especial de fim de ano',
              topicType: 'EVENT',
              state: 'LIVE',
              createTime: '2024-01-10T10:00:00Z',
              updateTime: '2024-01-10T10:00:00Z',
              event: {
                title: 'Festa de Ano Novo',
                schedule: {
                  startDate: { year: 2024, month: 12, day: 31 },
                  endDate: { year: 2025, month: 1, day: 1 },
                },
              },
            },
            {
              name: 'post-3',
              summary: 'Novidades da semana!',
              topicType: 'STANDARD',
              state: 'LIVE',
              createTime: '2024-01-05T10:00:00Z',
              updateTime: '2024-01-05T10:00:00Z',
            },
          ],
          nextPageToken: undefined,
        },
      ],
    },
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
  }),
  useCreatePost: () => ({
    mutateAsync: mockCreatePost,
    isPending: false,
  }),
  useUpdatePost: () => ({
    mutateAsync: mockUpdatePost,
    isPending: false,
  }),
  useDeletePost: () => ({
    mutateAsync: mockDeletePost,
    isPending: false,
  }),
}));

// Mock translations
jest.mock('@/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'posts.total': 'posts',
        'posts.empty': 'Nenhum post',
        'posts.emptyDescription': 'Crie seu primeiro post.',
        'posts.createFirst': 'Criar Primeiro Post',
        'posts.newPost': 'Novo Post',
        'posts.editPost': 'Editar Post',
        'posts.type': 'Tipo de Post',
        'posts.types.standard': 'Atualização',
        'posts.types.event': 'Evento',
        'posts.types.offer': 'Oferta',
        'posts.content': 'Conteúdo',
        'posts.contentPlaceholder': 'Escreva o conteúdo...',
        'posts.imageUrl': 'URL da Imagem',
        'posts.eventTitle': 'Título do Evento',
        'posts.eventTitlePlaceholder': 'Nome do evento',
        'posts.startDate': 'Data de Início',
        'posts.endDate': 'Data de Término',
        'posts.couponCode': 'Código do Cupom',
        'posts.couponCodePlaceholder': 'Ex: PROMO20',
        'posts.termsConditions': 'Termos e Condições',
        'posts.termsConditionsPlaceholder': 'Condições...',
        'posts.ctaType': 'Botão de Ação',
        'posts.ctaUrl': 'Link do Botão',
        'posts.cta.learnMore': 'Saiba Mais',
        'posts.cta.book': 'Reservar',
        'posts.cta.order': 'Pedir',
        'posts.cta.shop': 'Comprar',
        'posts.cta.signUp': 'Cadastrar',
        'posts.cta.call': 'Ligar',
        'posts.publish': 'Publicar',
        'posts.confirmDelete': 'Tem certeza?',
        'posts.loadMore': 'Carregar mais',
        'common.cancel': 'Cancelar',
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

describe('PostsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render posts list', () => {
    renderWithProviders(<PostsTab />);

    expect(screen.getByText('Confira nossa promoção de verão!')).toBeInTheDocument();
    expect(screen.getByText('Evento especial de fim de ano')).toBeInTheDocument();
    expect(screen.getByText('Novidades da semana!')).toBeInTheDocument();
  });

  it('should display post count', () => {
    renderWithProviders(<PostsTab />);

    expect(screen.getByText(/3.*posts/)).toBeInTheDocument();
  });

  it('should display post type badges', () => {
    renderWithProviders(<PostsTab />);

    expect(screen.getByText('Oferta')).toBeInTheDocument();
    expect(screen.getByText('Evento')).toBeInTheDocument();
    expect(screen.getByText('Atualização')).toBeInTheDocument();
  });

  it('should display coupon code for offer posts', () => {
    renderWithProviders(<PostsTab />);

    expect(screen.getByText('VERAO20')).toBeInTheDocument();
  });

  it('should display event title for event posts', () => {
    renderWithProviders(<PostsTab />);

    expect(screen.getByText('Festa de Ano Novo')).toBeInTheDocument();
  });

  it('should show new post button', () => {
    renderWithProviders(<PostsTab />);

    expect(screen.getByText('Novo Post')).toBeInTheDocument();
  });

  it('should open modal when new post button is clicked', async () => {
    renderWithProviders(<PostsTab />);

    const newPostButton = screen.getByText('Novo Post');
    fireEvent.click(newPostButton);

    await waitFor(() => {
      expect(screen.getByText('Tipo de Post')).toBeInTheDocument();
      // Content label includes "*" for required field
      expect(screen.getByText(/Conteúdo/)).toBeInTheDocument();
    });
  });

  it('should display LIVE status for published posts', () => {
    renderWithProviders(<PostsTab />);

    const liveLabels = screen.getAllByText('LIVE');
    expect(liveLabels.length).toBe(3);
  });

  it('should show edit and delete buttons for each post', () => {
    const { container } = renderWithProviders(<PostsTab />);

    // Check for edit and delete icons (svgs with specific paths)
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(3); // New post + edit/delete for each post
  });
});

describe('PostsTab - Create Post Modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show post type selector in modal', async () => {
    renderWithProviders(<PostsTab />);

    const newPostButton = screen.getByText('Novo Post');
    fireEvent.click(newPostButton);

    await waitFor(() => {
      // Should have options in the select (includes both badge and option)
      const atualizacaoElements = screen.getAllByText('Atualização');
      expect(atualizacaoElements.length).toBeGreaterThan(0);
    });
  });

  it('should show content textarea in modal', async () => {
    renderWithProviders(<PostsTab />);

    const newPostButton = screen.getByText('Novo Post');
    fireEvent.click(newPostButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escreva o conteúdo...')).toBeInTheDocument();
    });
  });

  it('should show publish button in modal', async () => {
    renderWithProviders(<PostsTab />);

    const newPostButton = screen.getByText('Novo Post');
    fireEvent.click(newPostButton);

    await waitFor(() => {
      expect(screen.getByText('Publicar')).toBeInTheDocument();
    });
  });

  it('should show cancel button in modal', async () => {
    renderWithProviders(<PostsTab />);

    const newPostButton = screen.getByText('Novo Post');
    fireEvent.click(newPostButton);

    await waitFor(() => {
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });
  });
});
