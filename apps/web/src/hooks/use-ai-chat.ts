/**
 * useAiChat Hook
 * React hook for managing AI Copilot chat state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  aiChatService,
  ChatMessage,
  ChatResponse,
  ChatContext,
  PlanData,
  ConversationState,
  AiChatError,
  AiChatErrorCode,
  extractEntityLinks,
} from '../services/ai-chat.service';

export interface UseAiChatOptions {
  /** Auto-scroll to bottom on new messages */
  autoScroll?: boolean;
  /** Maximum messages to keep in memory */
  maxMessages?: number;
  /** Callback when a new entity is created */
  onEntityCreated?: (type: string, id: string) => void;
}

export interface UseAiChatReturn {
  /** Current messages */
  messages: ChatMessage[];
  /** Current conversation ID */
  conversationId: string | null;
  /** Current conversation state */
  state: ConversationState;
  /** Pending plan awaiting confirmation */
  pendingPlan: PlanData | null;
  /** Whether the chat is loading */
  isLoading: boolean;
  /** Current error */
  error: AiChatError | null;
  /** Send a message */
  sendMessage: (message: string, context?: ChatContext) => Promise<void>;
  /** Confirm a pending plan */
  confirmPlan: () => Promise<void>;
  /** Cancel a pending plan */
  cancelPlan: () => Promise<void>;
  /** Clear the chat */
  clearChat: () => void;
  /** Retry last failed message */
  retry: () => Promise<void>;
  /** Ref to scroll container */
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function useAiChat(options: UseAiChatOptions = {}): UseAiChatReturn {
  const { autoScroll = true, maxMessages = 100, onEntityCreated } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [state, setState] = useState<ConversationState>('IDLE');
  const [pendingPlan, setPendingPlan] = useState<PlanData | null>(null);
  const [error, setError] = useState<AiChatError | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastContext, setLastContext] = useState<ChatContext | undefined>(undefined);

  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({
      message,
      context,
    }: {
      message: string;
      context?: ChatContext;
    }) => {
      return aiChatService.sendMessage({
        message,
        conversationId: conversationId || undefined,
        context,
      });
    },
    onSuccess: (response: ChatResponse) => {
      // Update conversation ID
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId);
      }

      // Update state
      setState(response.state);
      setPendingPlan(response.pendingPlan || null);
      setError(null);

      // Add assistant message
      const entityLinks = extractEntityLinks(response.executedTools);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        plan: response.pendingPlan,
        executedTools: response.executedTools,
        entityLinks,
      };

      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage];
        return newMessages.slice(-maxMessages);
      });

      // Notify about created entities
      if (onEntityCreated && entityLinks.length > 0) {
        for (const link of entityLinks) {
          onEntityCreated(link.type, link.id);
        }
      }

      // Invalidate relevant queries based on executed tools
      if (response.executedTools?.some((t) => t.success)) {
        for (const tool of response.executedTools) {
          if (tool.success) {
            if (tool.tool.startsWith('customers.')) {
              queryClient.invalidateQueries({ queryKey: ['clients'] });
            }
            if (tool.tool.startsWith('workOrders.')) {
              queryClient.invalidateQueries({ queryKey: ['workOrders'] });
            }
            if (tool.tool.startsWith('quotes.')) {
              queryClient.invalidateQueries({ queryKey: ['quotes'] });
            }
            if (tool.tool.startsWith('billing.')) {
              queryClient.invalidateQueries({ queryKey: ['charges'] });
            }
          }
        }
      }
    },
    onError: (err: AiChatError) => {
      setError(err);
      setState('IDLE');
    },
  });

  // Send message
  const sendMessage = useCallback(
    async (message: string, context?: ChatContext) => {
      if (!message.trim()) return;

      // Store for retry
      setLastMessage(message);
      setLastContext(context);
      setError(null);

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const newMessages = [...prev, userMessage];
        return newMessages.slice(-maxMessages);
      });

      // Set loading state
      setState('EXECUTING');

      // Send to API
      await sendMutation.mutateAsync({ message, context });
    },
    [conversationId, maxMessages, sendMutation]
  );

  // Confirm plan
  const confirmPlan = useCallback(async () => {
    if (!conversationId) return;

    setError(null);
    setState('EXECUTING');

    // Add user confirmation message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: 'Sim, confirmo',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await aiChatService.confirmPlan(conversationId);

      setState(response.state);
      setPendingPlan(response.pendingPlan || null);

      const entityLinks = extractEntityLinks(response.executedTools);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        executedTools: response.executedTools,
        entityLinks,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Notify about created entities
      if (onEntityCreated && entityLinks.length > 0) {
        for (const link of entityLinks) {
          onEntityCreated(link.type, link.id);
        }
      }

      // Invalidate queries
      if (response.executedTools?.some((t) => t.success)) {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['workOrders'] });
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['charges'] });
      }
    } catch (err) {
      setError(err as AiChatError);
      setState('IDLE');
    }
  }, [conversationId, onEntityCreated, queryClient]);

  // Cancel plan
  const cancelPlan = useCallback(async () => {
    if (!conversationId) return;

    setError(null);

    // Add user cancel message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: 'Cancelar',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await aiChatService.cancelPlan(conversationId);

      setState(response.state);
      setPendingPlan(null);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err as AiChatError);
      setState('IDLE');
    }
  }, [conversationId]);

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setState('IDLE');
    setPendingPlan(null);
    setError(null);
    setLastMessage(null);
    setLastContext(undefined);
  }, []);

  // Retry last message
  const retry = useCallback(async () => {
    if (lastMessage) {
      setError(null);
      // Remove the last user message (will be re-added)
      setMessages((prev) => prev.slice(0, -1));
      await sendMessage(lastMessage, lastContext);
    }
  }, [lastMessage, lastContext, sendMessage]);

  return {
    messages,
    conversationId,
    state,
    pendingPlan,
    isLoading: sendMutation.isPending || state === 'EXECUTING',
    error,
    sendMessage,
    confirmPlan,
    cancelPlan,
    clearChat,
    retry,
    scrollRef,
  };
}

export default useAiChat;
