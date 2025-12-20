import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

/**
 * Auvo Design System - Alert Component
 *
 * Baseado no MaterialPro MuiAlert
 */
const alertVariants = cva(
  'relative w-full rounded-lg p-4 flex gap-3',
  {
    variants: {
      variant: {
        // Filled
        default: 'bg-primary text-white',
        success: 'bg-success text-white',
        warning: 'bg-warning text-white',
        error: 'bg-error text-white',
        info: 'bg-info text-white',

        // Standard (light background)
        'standard-success': 'bg-success-100 text-success-800',
        'standard-warning': 'bg-warning-100 text-warning-800',
        'standard-error': 'bg-error-100 text-error-800',
        'standard-info': 'bg-info-100 text-info-800',

        // Outlined
        'outline-success': 'border border-success text-success bg-transparent',
        'outline-warning': 'border border-warning text-warning bg-transparent',
        'outline-error': 'border border-error text-error bg-transparent',
        'outline-info': 'border border-info text-info bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconMap = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
  default: Info,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = 'default',
      title,
      icon,
      dismissible,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    // Determine icon based on variant
    const getIcon = () => {
      if (icon) return icon;

      const variantKey = variant?.toString().replace('standard-', '').replace('outline-', '') as keyof typeof iconMap;
      const IconComponent = iconMap[variantKey] || iconMap.default;

      return <IconComponent className="h-5 w-5 shrink-0" />;
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {getIcon()}
        <div className="flex-1">
          {title && (
            <h5 className="mb-1 font-medium leading-none">{title}</h5>
          )}
          <div className="text-sm opacity-90">{children}</div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-full p-1 hover:bg-black/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert, alertVariants };
