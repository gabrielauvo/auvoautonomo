'use client';

/**
 * ChargeTimeline - Timeline de eventos da cobrança
 *
 * Exibe o histórico de eventos:
 * - Criação
 * - Envio
 * - Pagamento
 * - Cancelamento
 * - Webhooks do Asaas
 */

import { Skeleton } from '@/components/ui';
import {
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChargeEvent } from '@/services/charges.service';

interface ChargeTimelineProps {
  events: ChargeEvent[];
  isLoading?: boolean;
}

// Configuração de tipos de evento
const eventConfig: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    getLabel: (data?: Record<string, unknown>) => string;
  }
> = {
  CHARGE_CREATED: {
    icon: FileText,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    getLabel: () => 'Cobrança criada',
  },
  CHARGE_SENT: {
    icon: Send,
    color: 'text-info',
    bgColor: 'bg-info-100',
    getLabel: () => 'Cobrança enviada',
  },
  CHARGE_VIEWED: {
    icon: Clock,
    color: 'text-info',
    bgColor: 'bg-info-100',
    getLabel: () => 'Cobrança visualizada',
  },
  PAYMENT_RECEIVED: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success-100',
    getLabel: () => 'Pagamento recebido',
  },
  PAYMENT_CONFIRMED: {
    icon: DollarSign,
    color: 'text-success',
    bgColor: 'bg-success-100',
    getLabel: () => 'Pagamento confirmado',
  },
  PAYMENT_OVERDUE: {
    icon: AlertTriangle,
    color: 'text-error',
    bgColor: 'bg-error-100',
    getLabel: () => 'Cobrança vencida',
  },
  CHARGE_CANCELED: {
    icon: XCircle,
    color: 'text-error',
    bgColor: 'bg-error-100',
    getLabel: (data) => `Cobrança cancelada${data?.reason ? `: ${data.reason}` : ''}`,
  },
  CHARGE_REFUNDED: {
    icon: RefreshCw,
    color: 'text-warning',
    bgColor: 'bg-warning-100',
    getLabel: () => 'Cobrança estornada',
  },
  EMAIL_SENT: {
    icon: Mail,
    color: 'text-info',
    bgColor: 'bg-info-100',
    getLabel: (data) => `Email enviado para ${data?.email || 'cliente'}`,
  },
  WHATSAPP_SENT: {
    icon: MessageSquare,
    color: 'text-success',
    bgColor: 'bg-success-100',
    getLabel: (data) => `WhatsApp enviado para ${data?.phone || 'cliente'}`,
  },
  MANUAL_PAYMENT: {
    icon: DollarSign,
    color: 'text-success',
    bgColor: 'bg-success-100',
    getLabel: () => 'Pagamento registrado manualmente',
  },
  // Evento genérico
  DEFAULT: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    getLabel: () => 'Evento',
  },
};

// Formatar data
function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Skeleton loader
function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChargeTimeline({ events, isLoading }: ChargeTimelineProps) {
  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-10 w-10 text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Nenhum evento registrado</p>
      </div>
    );
  }

  // Ordenar eventos por data (mais recente primeiro)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative">
      {/* Linha vertical */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {sortedEvents.map((event, index) => {
          const config = eventConfig[event.type] || eventConfig.DEFAULT;
          const Icon = config.icon;

          return (
            <div key={event.id || index} className="relative flex items-start gap-3 pl-1">
              {/* Ícone */}
              <div
                className={cn(
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded-full',
                  config.bgColor
                )}
              >
                <Icon className={cn('h-4 w-4', config.color)} />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm text-gray-900">
                  {event.description || config.getLabel(event.data)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDateTime(event.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChargeTimeline;
