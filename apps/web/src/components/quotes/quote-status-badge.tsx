'use client';

/**
 * Quote Status Badge - Badge de status do orçamento
 *
 * Wrapper do StatusBadge específico para quotes
 * Mapeia QuoteStatus para StatusType
 */

import { StatusBadge, StatusType } from '@/components/ui';
import { QuoteStatus } from '@/services/quotes.service';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  size?: 'xs' | 'sm' | 'default' | 'lg';
  showDot?: boolean;
  className?: string;
}

// Mapeia QuoteStatus para StatusType do design system
const statusMap: Record<QuoteStatus, StatusType> = {
  DRAFT: 'draft',
  SENT: 'sent',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

export function QuoteStatusBadge({
  status,
  size = 'default',
  showDot = true,
  className,
}: QuoteStatusBadgeProps) {
  return (
    <StatusBadge
      status={statusMap[status]}
      size={size}
      showDot={showDot}
      className={className}
    />
  );
}

export default QuoteStatusBadge;
