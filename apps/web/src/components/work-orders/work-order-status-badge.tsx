'use client';

/**
 * WorkOrderStatusBadge - Badge de status da OS
 *
 * Exibe o status da ordem de serviço com cores e ícones apropriados.
 */

import { Badge } from '@/components/ui';
import { Clock, Play, CheckCircle, XCircle } from 'lucide-react';
import { WorkOrderStatus } from '@/services/work-orders.service';

interface WorkOrderStatusBadgeProps {
  status: WorkOrderStatus;
  size?: 'xs' | 'sm' | 'default' | 'lg';
  showIcon?: boolean;
}

const statusConfig: Record<
  WorkOrderStatus,
  {
    label: string;
    variant: 'soft-gray' | 'soft-info' | 'soft-success' | 'soft-error';
    icon: React.ElementType;
  }
> = {
  SCHEDULED: {
    label: 'Agendada',
    variant: 'soft-gray',
    icon: Clock,
  },
  IN_PROGRESS: {
    label: 'Em Execução',
    variant: 'soft-info',
    icon: Play,
  },
  DONE: {
    label: 'Concluída',
    variant: 'soft-success',
    icon: CheckCircle,
  },
  CANCELED: {
    label: 'Cancelada',
    variant: 'soft-error',
    icon: XCircle,
  },
};

export function WorkOrderStatusBadge({
  status,
  size = 'default',
  showIcon = true,
}: WorkOrderStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.SCHEDULED;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} size={size}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

export default WorkOrderStatusBadge;
