'use client';

/**
 * Client Timeline - Timeline de eventos do cliente
 *
 * Exibe histórico de:
 * - Orçamentos
 * - Ordens de serviço
 * - Pagamentos
 * - Checklists
 */

import { Skeleton, Badge } from '@/components/ui';
import { useFormatting } from '@/context';
import { TimelineEvent, TimelineEventType } from '@/services/clients.service';
import {
  FileText,
  Wrench,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ClipboardList,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
}

// Configuração de cada tipo de evento
const eventConfig: Record<
  TimelineEventType,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  QUOTE_CREATED: {
    icon: FileText,
    color: 'text-info',
    bgColor: 'bg-info-100',
    label: 'Orçamento criado',
  },
  QUOTE_APPROVED: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success-100',
    label: 'Orçamento aprovado',
  },
  QUOTE_REJECTED: {
    icon: XCircle,
    color: 'text-error',
    bgColor: 'bg-error-100',
    label: 'Orçamento rejeitado',
  },
  WORK_ORDER_CREATED: {
    icon: Wrench,
    color: 'text-info',
    bgColor: 'bg-info-100',
    label: 'OS criada',
  },
  WORK_ORDER_STARTED: {
    icon: Play,
    color: 'text-warning',
    bgColor: 'bg-warning-100',
    label: 'OS iniciada',
  },
  WORK_ORDER_COMPLETED: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success-100',
    label: 'OS concluída',
  },
  CHECKLIST_CREATED: {
    icon: ClipboardList,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    label: 'Checklist criado',
  },
  PAYMENT_CREATED: {
    icon: CreditCard,
    color: 'text-info',
    bgColor: 'bg-info-100',
    label: 'Pagamento registrado',
  },
  PAYMENT_CONFIRMED: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success-100',
    label: 'Pagamento confirmado',
  },
  PAYMENT_OVERDUE: {
    icon: AlertCircle,
    color: 'text-error',
    bgColor: 'bg-error-100',
    label: 'Pagamento vencido',
  },
};

// Formatar data
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Componente de item da timeline
function TimelineItem({
  event,
  formatCurrency,
}: {
  event: TimelineEvent;
  formatCurrency: (value: number, recordCurrency?: string) => string;
}) {
  const config = eventConfig[event.type];
  const Icon = config.icon;

  // Gera descrição baseada no tipo
  const getDescription = () => {
    switch (event.type) {
      case 'QUOTE_CREATED':
        return (
          <>
            Orçamento criado
            {event.data.totalValue && (
              <span className="font-medium"> - {formatCurrency(event.data.totalValue)}</span>
            )}
            {event.data.itemsCount && (
              <span className="text-gray-500"> ({event.data.itemsCount} itens)</span>
            )}
          </>
        );
      case 'QUOTE_APPROVED':
        return (
          <>
            Orçamento aprovado
            {event.data.totalValue && (
              <span className="font-medium"> - {formatCurrency(event.data.totalValue)}</span>
            )}
          </>
        );
      case 'QUOTE_REJECTED':
        return 'Orçamento rejeitado pelo cliente';
      case 'WORK_ORDER_CREATED':
        return (
          <>
            OS criada: <span className="font-medium">{event.data.title}</span>
            {event.data.equipmentsCount && (
              <span className="text-gray-500"> ({event.data.equipmentsCount} equipamentos)</span>
            )}
          </>
        );
      case 'WORK_ORDER_STARTED':
        return (
          <>
            OS iniciada: <span className="font-medium">{event.data.title}</span>
          </>
        );
      case 'WORK_ORDER_COMPLETED':
        return (
          <>
            OS concluída: <span className="font-medium">{event.data.title}</span>
          </>
        );
      case 'CHECKLIST_CREATED':
        return (
          <>
            Checklist criado: <span className="font-medium">{event.data.title}</span>
            {event.data.workOrderTitle && (
              <span className="text-gray-500"> (OS: {event.data.workOrderTitle})</span>
            )}
          </>
        );
      case 'PAYMENT_CREATED':
        return (
          <>
            Pagamento registrado
            {event.data.value && (
              <span className="font-medium"> - {formatCurrency(event.data.value)}</span>
            )}
            {event.data.billingType && (
              <Badge variant="gray" size="xs" className="ml-2">
                {event.data.billingType}
              </Badge>
            )}
          </>
        );
      case 'PAYMENT_CONFIRMED':
        return (
          <>
            Pagamento confirmado
            {event.data.value && (
              <span className="font-medium text-success"> - {formatCurrency(event.data.value)}</span>
            )}
          </>
        );
      case 'PAYMENT_OVERDUE':
        return (
          <>
            Pagamento vencido
            {event.data.value && (
              <span className="font-medium text-error"> - {formatCurrency(event.data.value)}</span>
            )}
          </>
        );
      default:
        return config.label;
    }
  };

  return (
    <div className="flex gap-4">
      {/* Ícone */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full',
            config.bgColor
          )}
        >
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        {/* Linha vertical */}
        <div className="flex-1 w-px bg-gray-200 mt-2" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-900">{getDescription()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(event.date)} às {formatTime(event.date)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClientTimeline({ events, isLoading }: ClientTimelineProps) {
  const { formatCurrency } = useFormatting();

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
          <Clock className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">Nenhum evento registrado</p>
        <p className="text-xs text-gray-400 mt-1">
          O histórico aparecerá quando houver orçamentos, OS ou pagamentos
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {events.map((event, index) => (
        <TimelineItem
          key={`${event.type}-${event.date}-${index}`}
          event={event}
          formatCurrency={formatCurrency}
        />
      ))}
    </div>
  );
}

export default ClientTimeline;
