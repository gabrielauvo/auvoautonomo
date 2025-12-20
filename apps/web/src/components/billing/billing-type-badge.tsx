'use client';

/**
 * BillingTypeBadge - Badge de tipo de cobrança
 *
 * Exibe o tipo de pagamento (PIX, Boleto, Cartão) com ícones.
 */

import { Badge } from '@/components/ui';
import { QrCode, FileText, CreditCard, HelpCircle } from 'lucide-react';
import { BillingType, billingTypeLabels } from '@/services/charges.service';

interface BillingTypeBadgeProps {
  type: BillingType;
  size?: 'xs' | 'sm' | 'default' | 'lg';
  showIcon?: boolean;
}

const typeConfig: Record<
  BillingType,
  {
    variant: 'soft-gray' | 'soft-info' | 'soft-success' | 'soft-warning';
    icon: React.ElementType;
  }
> = {
  PIX: {
    variant: 'soft-success',
    icon: QrCode,
  },
  BOLETO: {
    variant: 'soft-info',
    icon: FileText,
  },
  CREDIT_CARD: {
    variant: 'soft-warning',
    icon: CreditCard,
  },
  UNDEFINED: {
    variant: 'soft-gray',
    icon: HelpCircle,
  },
};

export function BillingTypeBadge({
  type,
  size = 'default',
  showIcon = true,
}: BillingTypeBadgeProps) {
  const config = typeConfig[type] || typeConfig.UNDEFINED;
  const Icon = config.icon;
  const label = billingTypeLabels[type] || type;

  return (
    <Badge variant={config.variant} size={size}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}

export default BillingTypeBadge;
