import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Auvo Design System - Button Component
 *
 * Baseado no MaterialPro com identidade visual Auvo
 */
const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Filled variants
        default:
          'bg-primary text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm hover:shadow-auvo',
        secondary:
          'bg-secondary text-white hover:bg-secondary-600 active:bg-secondary-700 shadow-sm',
        success:
          'bg-success text-white hover:bg-success-600 active:bg-success-700 shadow-sm',
        warning:
          'bg-warning text-white hover:bg-warning-600 active:bg-warning-700 shadow-sm',
        error:
          'bg-error text-white hover:bg-error-600 active:bg-error-700 shadow-sm',
        info:
          'bg-info text-white hover:bg-info-600 active:bg-info-700 shadow-sm',

        // Outlined variants
        outline:
          'border border-primary text-primary bg-transparent hover:bg-primary hover:text-white',
        'outline-secondary':
          'border border-secondary text-secondary bg-transparent hover:bg-secondary hover:text-white',
        'outline-success':
          'border border-success text-success bg-transparent hover:bg-success hover:text-white',
        'outline-warning':
          'border border-warning text-warning bg-transparent hover:bg-warning hover:text-white',
        'outline-error':
          'border border-error text-error bg-transparent hover:bg-error hover:text-white',

        // Text/Soft variants (light background)
        soft:
          'bg-primary-100 text-primary-700 hover:bg-primary hover:text-white',
        'soft-secondary':
          'bg-secondary-100 text-secondary-700 hover:bg-secondary hover:text-white',
        'soft-success':
          'bg-success-100 text-success-700 hover:bg-success hover:text-white',
        'soft-warning':
          'bg-warning-100 text-warning-700 hover:bg-warning hover:text-white',
        'soft-error':
          'bg-error-100 text-error-700 hover:bg-error hover:text-white',

        // Ghost variant
        ghost:
          'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',

        // Link variant
        link:
          'bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs',
        sm: 'h-8 px-3 text-sm',
        default: 'h-10 px-5 text-sm',
        lg: 'h-11 px-6 text-base',
        xl: 'h-12 px-8 text-base',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-lg': 'h-12 w-12 p-0',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ariaLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    // Detectar se é um botão só com ícone (sem texto)
    const isIconOnly = !children && (leftIcon || rightIcon);

    // Atributos ARIA para acessibilidade
    const ariaProps = {
      'aria-busy': loading ? 'true' as const : undefined,
      'aria-disabled': disabled ? 'true' as const : undefined,
      'aria-label': ariaLabel || (isIconOnly ? 'Botão' : undefined),
    };

    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...ariaProps}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
