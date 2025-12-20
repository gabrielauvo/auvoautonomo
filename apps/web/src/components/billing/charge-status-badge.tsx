'use client';

/**
 * ChargeStatusBadge - Badge de status da cobrança
 *
 * Exibe o status da cobrança com cores e ícones apropriados.
 */

import { Badge } from '@/components/ui';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Banknote,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { ChargeStatus, chargeStatusLabels } from '@/services/charges.service';

interface ChargeStatusBadgeProps {
  status: ChargeStatus;
  size?: 'xs' | 'sm' | 'default' | 'lg';
  showIcon?: boolean;
}

const statusConfig: Record<
  ChargeStatus,
  {
    variant: 'soft-gray' | 'soft-warning' | 'soft-success' | 'soft-error' | 'soft-info';
    icon: React.ElementType;
  }
> = {
  PENDING: {
    variant: 'soft-gray',
    icon: Clock,
  },
  OVERDUE: {
    variant: 'soft-error',
    icon: AlertTriangle,
  },
  CONFIRMED: {
    variant: 'soft-success',
    icon: CheckCircle,
  },
  RECEIVED: {
    variant: 'soft-success',
    icon: DollarSign,
  },
  RECEIVED_IN_CASH: {
    variant: 'soft-success',
    icon: Banknote,
  },
  REFUNDED: {
    variant: 'soft-warning',
    icon: RefreshCw,
  },
  CANCELED: {
    variant: 'soft-error',
    icon: XCircle,
  },
};

export function ChargeStatusBadge({
  status,
  size = 'default',
  showIcon = true,
}: ChargeStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;
  const label = chargeStatusLabels[status] || status;

  return (
    <Badge variant={config.variant} size={size}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}

export default ChargeStatusBadge;
