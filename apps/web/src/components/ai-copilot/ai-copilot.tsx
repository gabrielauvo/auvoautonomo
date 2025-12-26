'use client';

/**
 * AiCopilot Component
 * Main AI Copilot chat widget
 */

import { useState, useCallback } from 'react';
import { Bot, X, Minimize2, Maximize2, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiChat } from '@/hooks/use-ai-chat';
import { useAiContext } from '@/hooks/use-ai-context';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { PlanActions } from './plan-actions';
import { ChatError } from './chat-error';

interface AiCopilotProps {
  /** Override entity ID from props */
  entityId?: string;
  /** Override entity type from props */
  entityType?: 'customer' | 'workOrder' | 'quote' | 'charge';
  /** Default open state */
  defaultOpen?: boolean;
  /** Default minimized state */
  defaultMinimized?: boolean;
  /** Callback when entity is created */
  onEntityCreated?: (type: string, id: string) => void;
  /** Custom class name */
  className?: string;
}

export function AiCopilot({
  entityId,
  entityType,
  defaultOpen = false,
  defaultMinimized = false,
  onEntityCreated,
  className,
}: AiCopilotProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);

  // Get page context
  const { context, pageName } = useAiContext({ entityId, entityType });

  // Chat state
  const {
    messages,
    state,
    pendingPlan,
    isLoading,
    error,
    sendMessage,
    confirmPlan,
    cancelPlan,
    clearChat,
    retry,
    scrollRef,
  } = useAiChat({ onEntityCreated });

  // Is awaiting confirmation
  const isAwaitingConfirmation = state === 'AWAITING_CONFIRMATION' && pendingPlan;

  // Is billing action
  const isBillingAction = pendingPlan?.action.startsWith('billing.');

  // Handle send message
  const handleSend = useCallback(
    (message: string) => {
      sendMessage(message, context);
    },
    [sendMessage, context]
  );

  // Handle dismiss error
  const handleDismissError = useCallback(() => {
    // Error will be cleared on next message
  }, []);

  // Toggle open
  const toggleOpen = () => setIsOpen(!isOpen);

  // Toggle minimize
  const toggleMinimize = () => setIsMinimized(!isMinimized);

  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className={cn(
            'flex items-center justify-center',
            'w-14 h-14 rounded-full shadow-lg',
            'bg-primary text-white hover:bg-primary/90',
            'transition-all duration-200 hover:scale-105',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2'
          )}
          aria-label="Abrir AI Copilot"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat widget */}
      {isOpen && (
        <div
          className={cn(
            'flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200',
            'transition-all duration-200',
            isMinimized ? 'w-80 h-14' : 'w-96 h-[32rem]'
          )}
        >
          {/* Header */}
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-3 border-b border-gray-200',
              'bg-gradient-to-r from-primary to-primary/80 text-white rounded-t-xl'
            )}
          >
            <Bot className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">AI Copilot</h3>
              {!isMinimized && (
                <p className="text-xs text-white/80 truncate">{pageName}</p>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Clear button */}
              {!isMinimized && messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Limpar conversa"
                  title="Limpar conversa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Minimize button */}
              <button
                onClick={toggleMinimize}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>

              {/* Close button */}
              <button
                onClick={toggleOpen}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content (hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                role="log"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <EmptyState pageName={pageName} onSuggestionClick={handleSend} />
                ) : (
                  messages.map((message, index) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isLast={index === messages.length - 1}
                    />
                  ))
                )}

                {/* Loading indicator */}
                {isLoading && !isAwaitingConfirmation && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>Pensando...</span>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <ChatError
                    error={error}
                    onRetry={retry}
                    onDismiss={handleDismissError}
                  />
                )}
              </div>

              {/* Plan actions or input */}
              {isAwaitingConfirmation ? (
                <PlanActions
                  onConfirm={confirmPlan}
                  onCancel={cancelPlan}
                  isLoading={isLoading}
                  isBillingAction={isBillingAction}
                />
              ) : (
                <ChatInput
                  onSend={handleSend}
                  isLoading={isLoading}
                  placeholder="Como posso ajudar?"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState({
  pageName,
  onSuggestionClick
}: {
  pageName: string;
  onSuggestionClick: (suggestion: string) => void;
}) {
  const suggestions = getSuggestions(pageName);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <h4 className="text-sm font-medium text-gray-900 mb-1">
        Olá! Como posso ajudar?
      </h4>
      <p className="text-xs text-gray-500 mb-4">
        Sou o AI Copilot e posso ajudar você com tarefas no sistema.
      </p>

      {suggestions.length > 0 && (
        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2">Sugestões:</p>
          <div className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick(suggestion)}
                className="w-full text-xs text-left px-3 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer border border-transparent hover:border-primary/20"
              >
                &ldquo;{suggestion}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getSuggestions(pageName: string): string[] {
  const suggestions: Record<string, string[]> = {
    Clientes: [
      'Crie um cliente chamado João Silva',
      'Busque clientes com pagamentos atrasados',
      'Como adicionar um novo cliente?',
    ],
    'Ordens de Serviço': [
      'Crie uma ordem de serviço para o cliente João',
      'Quais ordens estão pendentes?',
      'Como funciona o status das ordens?',
    ],
    Orçamentos: [
      'Crie um orçamento para o cliente Maria',
      'Liste orçamentos aguardando aprovação',
      'Como enviar um orçamento para o cliente?',
    ],
    Cobranças: [
      'Crie uma cobrança de R$ 500 via PIX',
      'Quais cobranças estão atrasadas?',
      'Como funciona a cobrança por boleto?',
    ],
    Dashboard: [
      'Mostre meus clientes',
      'Quais ordens de serviço tenho hoje?',
      'Como funciona o sistema?',
    ],
  };

  return suggestions[pageName] || suggestions['Dashboard'];
}

export default AiCopilot;
