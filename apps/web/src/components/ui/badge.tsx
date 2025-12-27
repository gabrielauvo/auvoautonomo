'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';

/**
 * Auvo Design System - Badge/Chip Component
 *
 * Usado para status, labels, tags
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full font-medium transition-colors',
  {
    variants: {
      variant: {
        // Filled
        default: 'bg-primary text-white',
        secondary: 'bg-secondary text-white',
        success: 'bg-success text-white',
        warning: 'bg-warning text-white',
        error: 'bg-error text-white',
        info: 'bg-info text-white',

        // Soft/Light
        soft: 'bg-primary-100 text-primary-700',
        'soft-secondary': 'bg-secondary-100 text-secondary-700',
        'soft-success': 'bg-success-100 text-success-700',
        'soft-warning': 'bg-warning-100 text-warning-700',
        'soft-error': 'bg-error-100 text-error-700',
        'soft-info': 'bg-info-100 text-info-700',

        // Outlined
        outline: 'border border-primary text-primary bg-transparent',
        'outline-secondary': 'border border-secondary text-secondary bg-transparent',
        'outline-success': 'border border-success text-success bg-transparent',
        'outline-warning': 'border border-warning text-warning bg-transparent',
        'outline-error': 'border border-error text-error bg-transparent',
        'outline-info': 'border border-info text-info bg-transparent',

        // Neutral
        gray: 'bg-gray-100 text-gray-700',
        'soft-gray': 'bg-gray-100 text-gray-700',
        'gray-outline': 'border border-gray-300 text-gray-600 bg-transparent',

        // Primary alias (same as soft)
        primary: 'bg-primary-100 text-primary-700',
      },
      size: {
        xs: 'h-5 px-2 text-xs',
        sm: 'h-6 px-2.5 text-xs',
        default: 'h-7 px-3 text-sm',
        lg: 'h-8 px-4 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, removable, onRemove, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
        )}
        {children}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-1.5 -mr-1 h-4 w-4 rounded-full hover:bg-black/10 inline-flex items-center justify-center"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge - Pre-configured for business entities
export type StatusType =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'scheduled'
  | 'in_progress'
  | 'done'
  | 'canceled'
  | 'pending'
  | 'confirmed'
  | 'received'
  | 'overdue'
  | 'refunded';

const statusVariants: Record<StatusType, VariantProps<typeof badgeVariants>['variant']> = {
  // Quote
  draft: 'gray',
  sent: 'soft-info',
  approved: 'soft-success',
  rejected: 'soft-error',
  expired: 'soft-warning',
  // Work Order
  scheduled: 'soft-info',
  in_progress: 'soft-warning',
  done: 'soft-success',
  canceled: 'soft-error',
  // Payment
  pending: 'soft-warning',
  confirmed: 'soft-info',
  received: 'soft-success',
  overdue: 'soft-error',
  refunded: 'gray',
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType;
  showDot?: boolean;
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, showDot = true, children, ...props }, ref) => {
    const { t } = useTranslations('common');
    const variant = statusVariants[status];
    const label = t(`statusBadge.${status}`);

    return (
      <Badge ref={ref} variant={variant} dot={showDot} {...props}>
        {children || label}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export { Badge, StatusBadge, badgeVariants };
