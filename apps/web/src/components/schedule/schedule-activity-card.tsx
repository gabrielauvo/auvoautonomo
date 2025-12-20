'use client';

/**
 * ScheduleActivityCard Component
 *
 * Card de atividade individual (Work Order ou Visita de Orçamento)
 */

import Link from 'next/link';
import { Badge } from '@/components/ui';
import {
  ScheduleActivity,
  ScheduleActivityType,
  ScheduleActivityStatus,
} from '@/services/schedule.service';
import { formatTime } from '@/hooks/use-schedule';
import {
  Wrench,
  FileText,
  Clock,
  MapPin,
  Phone,
  User,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScheduleActivityCardProps {
  activity: ScheduleActivity;
  className?: string;
}

/**
 * Configuração de cores e labels por tipo
 */
const typeConfig: Record<
  ScheduleActivityType,
  { label: string; icon: React.ReactNode; bgColor: string; borderColor: string }
> = {
  WORK_ORDER: {
    label: 'Ordem de Serviço',
    icon: <Wrench className="h-4 w-4" />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-l-blue-500',
  },
  QUOTE_VISIT: {
    label: 'Visita de Orçamento',
    icon: <FileText className="h-4 w-4" />,
    bgColor: 'bg-amber-50',
    borderColor: 'border-l-amber-500',
  },
};

/**
 * Configuração de badges por status
 */
const statusConfig: Record<
  ScheduleActivityStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'error' }
> = {
  SCHEDULED: { label: 'Agendado', variant: 'default' },
  IN_PROGRESS: { label: 'Em Andamento', variant: 'warning' },
  DONE: { label: 'Concluído', variant: 'success' },
  CANCELED: { label: 'Cancelado', variant: 'error' },
  DRAFT: { label: 'Rascunho', variant: 'secondary' },
  SENT: { label: 'Enviado', variant: 'default' },
  APPROVED: { label: 'Aprovado', variant: 'success' },
  REJECTED: { label: 'Rejeitado', variant: 'error' },
  EXPIRED: { label: 'Expirado', variant: 'error' },
};

/**
 * Formata valor em moeda
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata duração em minutos para exibição
 */
function formatDuration(minutes?: number): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function ScheduleActivityCard({
  activity,
  className,
}: ScheduleActivityCardProps) {
  const config = typeConfig[activity.type];
  const status = statusConfig[activity.status];
  const duration = formatDuration(activity.durationMinutes);

  // Link para detalhe
  const detailHref =
    activity.type === 'WORK_ORDER'
      ? `/work-orders/${activity.id}`
      : `/quotes/${activity.id}`;

  return (
    <Link href={detailHref}>
      <div
        className={cn(
          'relative p-4 rounded-lg border border-l-4 transition-all hover:shadow-md cursor-pointer',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{config.icon}</span>
            <span className="text-xs font-medium text-gray-500">
              {config.label}
            </span>
          </div>
          <Badge variant={status.variant} size="sm">
            {status.label}
          </Badge>
        </div>

        {/* Título */}
        <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
          {activity.title}
        </h3>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {/* Horário */}
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>
              {formatTime(activity.scheduledStart)}
              {activity.scheduledEnd && ` - ${formatTime(activity.scheduledEnd)}`}
              {duration && ` (${duration})`}
            </span>
          </div>

          {/* Cliente */}
          <div className="flex items-center gap-2 text-gray-600">
            <User className="h-4 w-4 text-gray-400" />
            <span className="truncate">{activity.client.name}</span>
          </div>

          {/* Endereço */}
          {activity.address && (
            <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{activity.address}</span>
            </div>
          )}

          {/* Telefone */}
          {activity.client.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>{activity.client.phone}</span>
            </div>
          )}

          {/* Valor */}
          {activity.totalValue !== undefined && activity.totalValue > 0 && (
            <div className="flex items-center gap-2 text-gray-600">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-success">
                {formatCurrency(activity.totalValue)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default ScheduleActivityCard;
