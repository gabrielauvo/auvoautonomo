/**
 * AiCopilot Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiCopilot } from '../ai-copilot';
import { aiChatService } from '@/services/ai-chat.service';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/clients',
  useParams: () => ({ id: undefined }),
}));

// Mock ai-chat service
jest.mock('@/services/ai-chat.service', () => ({
  aiChatService: {
    sendMessage: jest.fn(),
    confirmPlan: jest.fn(),
    cancelPlan: jest.fn(),
  },
  AiChatError: class extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  },
  AiChatErrorCode: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    SERVER_ERROR: 'SERVER_ERROR',
  },
  extractEntityLinks: jest.fn(() => []),
}));

// Create query client wrapper
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

describe('AiCopilot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('renders floating button when closed', () => {
      render(<AiCopilot />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: /abrir ai copilot/i })).toBeInTheDocument();
    });

    it('opens chat when clicking floating button', async () => {
      render(<AiCopilot />, { wrapper: createWrapper() });

      const openButton = screen.getByRole('button', { name: /abrir ai copilot/i });
      await userEvent.click(openButton);

      expect(screen.getByText('AI Copilot')).toBeInTheDocument();
      expect(screen.getByText('Clientes')).toBeInTheDocument(); // Page context
    });

    it('renders open when defaultOpen is true', () => {
      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      expect(screen.getByText('AI Copilot')).toBeInTheDocument();
    });

    it('shows empty state with suggestions', () => {
      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      expect(screen.getByText(/como posso ajudar/i)).toBeInTheDocument();
      expect(screen.getByText(/sugestões/i)).toBeInTheDocument();
    });
  });

  describe('Chat Interaction', () => {
    it('sends message on button click', async () => {
      (aiChatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Olá! Como posso ajudar?',
        state: 'IDLE',
      });

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Olá');

      const sendButton = screen.getByRole('button', { name: /enviar/i });
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(aiChatService.sendMessage).toHaveBeenCalledWith({
          message: 'Olá',
          conversationId: undefined,
          context: expect.objectContaining({
            currentPage: '/clients',
          }),
        });
      });
    });

    it('sends message on Enter key', async () => {
      (aiChatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Resposta',
        state: 'IDLE',
      });

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Teste{enter}');

      await waitFor(() => {
        expect(aiChatService.sendMessage).toHaveBeenCalled();
      });
    });

    it('displays user and assistant messages', async () => {
      (aiChatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Olá! Posso ajudar.',
        state: 'IDLE',
      });

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Olá{enter}');

      await waitFor(() => {
        expect(screen.getByText('Olá')).toBeInTheDocument();
        expect(screen.getByText('Olá! Posso ajudar.')).toBeInTheDocument();
      });
    });
  });

  describe('Plan Confirmation', () => {
    it('shows plan actions when awaiting confirmation', async () => {
      (aiChatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Criar cliente João?',
        state: 'AWAITING_CONFIRMATION',
        pendingPlan: {
          action: 'customers.create',
          params: { name: 'João' },
          missingFields: [],
        },
      });

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Crie cliente João{enter}');

      await waitFor(() => {
        expect(screen.getByText(/confirmar/i)).toBeInTheDocument();
        expect(screen.getByText(/cancelar/i)).toBeInTheDocument();
      });
    });

    it('confirms plan when clicking confirm button', async () => {
      (aiChatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Criar cliente?',
        state: 'AWAITING_CONFIRMATION',
        pendingPlan: {
          action: 'customers.create',
          params: { name: 'João' },
          missingFields: [],
        },
      });

      (aiChatService.confirmPlan as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Cliente criado!',
        state: 'IDLE',
        executedTools: [{ tool: 'customers.create', success: true }],
      });

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Crie cliente{enter}');

      await waitFor(() => {
        expect(screen.getByText(/confirmar/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(aiChatService.confirmPlan).toHaveBeenCalledWith('conv-123');
      });
    });

    it('cancels plan when clicking cancel button', async () => {
      (aiChatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Criar cliente?',
        state: 'AWAITING_CONFIRMATION',
        pendingPlan: {
          action: 'customers.create',
          params: { name: 'João' },
          missingFields: [],
        },
      });

      (aiChatService.cancelPlan as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Operação cancelada.',
        state: 'IDLE',
      });

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Crie cliente{enter}');

      await waitFor(() => {
        expect(screen.getByText(/cancelar/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancelar/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(aiChatService.cancelPlan).toHaveBeenCalledWith('conv-123');
      });
    });
  });

  describe('Widget Controls', () => {
    it('minimizes chat when clicking minimize button', async () => {
      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const minimizeButton = screen.getByRole('button', { name: /minimizar/i });
      await userEvent.click(minimizeButton);

      // Input should not be visible when minimized
      expect(screen.queryByPlaceholderText(/como posso ajudar/i)).not.toBeInTheDocument();
    });

    it('closes chat when clicking close button', async () => {
      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const closeButton = screen.getByRole('button', { name: /fechar/i });
      await userEvent.click(closeButton);

      // Widget should be closed, showing floating button
      expect(screen.getByRole('button', { name: /abrir ai copilot/i })).toBeInTheDocument();
    });

    it('clears chat when clicking clear button', async () => {
      (aiChatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        conversationId: 'conv-123',
        message: 'Resposta',
        state: 'IDLE',
      });

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      // Send a message first
      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Olá{enter}');

      await waitFor(() => {
        expect(screen.getByText('Olá')).toBeInTheDocument();
      });

      // Clear chat
      const clearButton = screen.getByRole('button', { name: /limpar/i });
      await userEvent.click(clearButton);

      // Should show empty state again
      expect(screen.getByText(/como posso ajudar/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator while sending message', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (aiChatService.sendMessage as jest.Mock).mockReturnValueOnce(promise);

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Olá{enter}');

      // Should show loading
      expect(screen.getByText(/pensando/i)).toBeInTheDocument();

      // Resolve promise
      resolvePromise!({
        conversationId: 'conv-123',
        message: 'Resposta',
        state: 'IDLE',
      });

      await waitFor(() => {
        expect(screen.queryByText(/pensando/i)).not.toBeInTheDocument();
      });
    });

    it('disables input while loading', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (aiChatService.sendMessage as jest.Mock).mockReturnValueOnce(promise);

      render(<AiCopilot defaultOpen />, { wrapper: createWrapper() });

      const input = screen.getByPlaceholderText(/como posso ajudar/i);
      await userEvent.type(input, 'Olá{enter}');

      // Input should be disabled
      expect(input).toBeDisabled();

      // Resolve
      resolvePromise!({
        conversationId: 'conv-123',
        message: 'Resposta',
        state: 'IDLE',
      });

      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });
  });
});
