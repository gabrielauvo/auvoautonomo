'use client';

/**
 * WorkOrderTimeline - Timeline de eventos da OS
 *
 * Exibe o histórico de eventos:
 * - Criação, início, pausas, conclusão
 * - Checklists, pagamentos
 * - Anexos adicionados
 */

import { Skeleton } from '@/components/ui';
import { useFormatting } from '@/context';
import {
  FileText,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  ClipboardCheck,
  DollarSign,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  type: string;
  date: string;
  data: Record<string, unknown>;
}

interface WorkOrderTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
}

// Configuração de tipos de evento
type EventConfigItem = {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  getLabel: (
    data: Record<string, unknown>,
    formatCurrency?: (value: number, recordCurrency?: string) => string
  ) => string;
};

const eventConfig: Record<string, EventConfigItem> = {
  WORK_ORDER_CREATED: {
    icon: FileText,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    getLabel: () => 'OS criada',
  },
  WORK_ORDER_STARTED: {
    icon: Play,
    color: 'text-info',
    bgColor: 'bg-info-100',
    getLabel: () => 'OS iniciada',
  },
  WORK_ORDER_PAUSED: {
    icon: Pause,
    color: 'text-warning',
    bgColor: 'bg-warning-100',
    getLabel: (data) => `OS pausada${data.reason ? `: ${data.reason}` : ''}`,
  },
  WORK_ORDER_RESUMED: {
    icon: RefreshCw,
    color: 'text-info',
    bgColor: 'bg-info-100',
    getLabel: () => 'OS retomada',
  },
  WORK_ORDER_COMPLETED: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success-100',
    getLabel: () => 'OS concluída',
  },
  WORK_ORDER_CANCELED: {
    icon: XCircle,
    color: 'text-error',
    bgColor: 'bg-error-100',
    getLabel: (data) => `OS cancelada${data.reason ? `: ${data.reason}` : ''}`,
  },
  CHECKLIST_CREATED: {
    icon: ClipboardCheck,
    color: 'text-primary',
    bgColor: 'bg-primary-100',
    getLabel: (data) => `Checklist "${data.title || 'Novo'}" criado`,
  },
  CHECKLIST_ANSWERED: {
    icon: ClipboardCheck,
    color: 'text-success',
    bgColor: 'bg-success-100',
    getLabel: (data) => `Checklist "${data.title || ''}" preenchido`,
  },
  ATTACHMENT_ADDED: {
    icon: Upload,
    color: 'text-primary',
    bgColor: 'bg-primary-100',
    getLabel: (data) => `Anexo adicionado: ${data.fileName || 'arquivo'}`,
  },
  PAYMENT_CREATED: {
    icon: DollarSign,
    color: 'text-warning',
    bgColor: 'bg-warning-100',
    getLabel: (data, formatCurrency) =>
      `Cobrança criada: ${formatCurrency ? formatCurrency(Number(data.value) || 0) : Number(data.value) || 0}`,
  },
  PAYMENT_CONFIRMED: {
    icon: DollarSign,
    color: 'text-success',
    bgColor: 'bg-success-100',
    getLabel: (data, formatCurrency) =>
      `Pagamento confirmado: ${formatCurrency ? formatCurrency(Number(data.value) || 0) : Number(data.value) || 0}`,
  },
  PAYMENT_OVERDUE: {
    icon: AlertCircle,
    color: 'text-error',
    bgColor: 'bg-error-100',
    getLabel: (data, formatCurrency) =>
      `Pagamento em atraso: ${formatCurrency ? formatCurrency(Number(data.value) || 0) : Number(data.value) || 0}`,
  },
  // Eventos genéricos
  STATUS_CHANGED: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    getLabel: (data) => `Status alterado para ${data.newStatus || 'novo status'}`,
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

export function WorkOrderTimeline({ events, isLoading }: WorkOrderTimelineProps) {
  const { formatCurrency } = useFormatting();

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
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="relative">
      {/* Linha vertical */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {sortedEvents.map((event, index) => {
          const config = eventConfig[event.type] || {
            icon: Clock,
            color: 'text-gray-500',
            bgColor: 'bg-gray-100',
            getLabel: () => event.type,
          };
          const Icon = config.icon;

          return (
            <div key={index} className="relative flex items-start gap-3 pl-1">
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
                  {config.getLabel(event.data, formatCurrency)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDateTime(event.date)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WorkOrderTimeline;
