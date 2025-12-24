/**
 * ReviewsTab Component Tests
 *
 * Testes do componente de gerenciamento de avaliações
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewsTab } from '../reviews-tab';

// Mock the hooks
const mockListReviews = jest.fn();
const mockReplyToReview = jest.fn();
const mockDeleteReviewReply = jest.fn();

jest.mock('@/hooks/use-google-management', () => ({
  useReviews: () => ({
    data: {
      pages: [
        {
          reviews: [
            {
              name: 'review-1',
              reviewId: 'review-1',
              reviewer: { displayName: 'João Silva' },
              starRating: 'FIVE',
              comment: 'Ótimo serviço!',
              createTime: '2024-01-15T10:00:00Z',
              updateTime: '2024-01-15T10:00:00Z',
            },
            {
              name: 'review-2',
              reviewId: 'review-2',
              reviewer: { displayName: 'Maria Santos' },
              starRating: 'THREE',
              comment: 'Bom, mas pode melhorar',
              createTime: '2024-01-14T15:00:00Z',
              updateTime: '2024-01-14T15:00:00Z',
              reviewReply: {
                comment: 'Obrigado pelo feedback!',
                updateTime: '2024-01-14T16:00:00Z',
              },
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
  useReplyToReview: () => ({
    mutateAsync: mockReplyToReview,
    isPending: false,
  }),
  useDeleteReviewReply: () => ({
    mutateAsync: mockDeleteReviewReply,
    isPending: false,
  }),
}));

// Mock translations
jest.mock('@/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'reviews.total': 'avaliações',
        'reviews.empty': 'Nenhuma avaliação',
        'reviews.emptyDescription': 'Ainda não há avaliações para exibir.',
        'reviews.yourReply': 'Sua resposta',
        'reviews.reply': 'Responder',
        'reviews.replyPlaceholder': 'Escreva sua resposta...',
        'reviews.sendReply': 'Enviar Resposta',
        'reviews.confirmDeleteReply': 'Tem certeza que deseja excluir?',
        'reviews.loadMore': 'Carregar mais',
        'common.cancel': 'Cancelar',
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

describe('ReviewsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render reviews list', () => {
    renderWithProviders(<ReviewsTab />);

    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Ótimo serviço!')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Bom, mas pode melhorar')).toBeInTheDocument();
  });

  it('should display star ratings', () => {
    const { container } = renderWithProviders(<ReviewsTab />);

    // Check for star icons (filled or not)
    const stars = container.querySelectorAll('svg');
    expect(stars.length).toBeGreaterThan(0);
  });

  it('should display existing reply for a review', () => {
    renderWithProviders(<ReviewsTab />);

    expect(screen.getByText('Obrigado pelo feedback!')).toBeInTheDocument();
    expect(screen.getByText('Sua resposta')).toBeInTheDocument();
  });

  it('should show reply button for reviews without reply', () => {
    renderWithProviders(<ReviewsTab />);

    const replyButtons = screen.getAllByText('Responder');
    expect(replyButtons.length).toBeGreaterThan(0);
  });

  it('should show reply form when reply button is clicked', async () => {
    renderWithProviders(<ReviewsTab />);

    const replyButton = screen.getAllByText('Responder')[0];
    fireEvent.click(replyButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escreva sua resposta...')).toBeInTheDocument();
    });
  });

  it('should show cancel button in reply form', async () => {
    renderWithProviders(<ReviewsTab />);

    const replyButton = screen.getAllByText('Responder')[0];
    fireEvent.click(replyButton);

    await waitFor(() => {
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });
  });

  it('should hide reply form when cancel is clicked', async () => {
    renderWithProviders(<ReviewsTab />);

    const replyButton = screen.getAllByText('Responder')[0];
    fireEvent.click(replyButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escreva sua resposta...')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Escreva sua resposta...')).not.toBeInTheDocument();
    });
  });

  it('should display review count', () => {
    renderWithProviders(<ReviewsTab />);

    expect(screen.getByText(/2.*avaliações/)).toBeInTheDocument();
  });

  it('should display review dates', () => {
    renderWithProviders(<ReviewsTab />);

    // Check for formatted dates (pt-BR format)
    expect(screen.getByText('15/01/2024')).toBeInTheDocument();
    // 14/01/2024 appears multiple times (review date + reply date)
    const dates14 = screen.getAllByText('14/01/2024');
    expect(dates14.length).toBeGreaterThan(0);
  });
});

// Note: Empty state and loading state tests would require jest.isolateModules
// or jest.resetModules to work correctly with dynamic mock modification.
// These are placeholders for future test additions.
