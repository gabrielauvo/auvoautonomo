'use client';

/**
 * ChatError Component
 * Error display with retry option
 */

import { AlertCircle, RefreshCw, WifiOff, Clock, Ban } from 'lucide-react';
import { AiChatError, AiChatErrorCode } from '@/services/ai-chat.service';
import { cn } from '@/lib/utils';

interface ChatErrorProps {
  error: AiChatError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ChatError({ error, onRetry, onDismiss }: ChatErrorProps) {
  const { icon: Icon, title, canRetry } = getErrorConfig(error.code);

  return (
    <div className="mx-3 my-2 p-3 rounded-lg bg-red-50 border border-red-200">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-red-800">{title}</h4>
          <p className="text-sm text-red-600 mt-0.5">{error.message}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md',
                  'bg-red-600 text-white hover:bg-red-700',
                  'transition-colors'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
            )}

            {onDismiss && (
              <button
                onClick={onDismiss}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md',
                  'text-red-700 hover:bg-red-100',
                  'transition-colors'
                )}
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getErrorConfig(code: AiChatErrorCode): {
  icon: typeof AlertCircle;
  title: string;
  canRetry: boolean;
} {
  switch (code) {
    case AiChatErrorCode.NETWORK_ERROR:
      return {
        icon: WifiOff,
        title: 'Erro de conexão',
        canRetry: true,
      };

    case AiChatErrorCode.TIMEOUT:
      return {
        icon: Clock,
        title: 'Tempo esgotado',
        canRetry: true,
      };

    case AiChatErrorCode.PERMISSION_DENIED:
      return {
        icon: Ban,
        title: 'Acesso negado',
        canRetry: false,
      };

    case AiChatErrorCode.RATE_LIMITED:
      return {
        icon: Clock,
        title: 'Muitas requisições',
        canRetry: true,
      };

    case AiChatErrorCode.SERVER_ERROR:
      return {
        icon: AlertCircle,
        title: 'Erro no servidor',
        canRetry: true,
      };

    case AiChatErrorCode.VALIDATION_ERROR:
      return {
        icon: AlertCircle,
        title: 'Dados inválidos',
        canRetry: false,
      };

    default:
      return {
        icon: AlertCircle,
        title: 'Erro',
        canRetry: true,
      };
  }
}

export default ChatError;
