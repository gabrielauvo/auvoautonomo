import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Auvo Design System - Card Component
 *
 * Baseado no MaterialPro DashboardCard
 */
const cardVariants = cva(
  'rounded-lg bg-white dark:bg-neutral-900 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'border border-gray-200 dark:border-neutral-800 shadow-card',
        elevated: 'shadow-lg border-0',
        outlined: 'border border-gray-200 dark:border-neutral-800 shadow-none',
        ghost: 'border-0 shadow-none bg-transparent',
      },
      hover: {
        true: 'hover:shadow-card-hover hover:border-gray-300 dark:hover:border-neutral-700',
        lift: 'hover:shadow-lg hover:-translate-y-1',
        glow: 'hover:shadow-auvo hover:border-primary-200 dark:hover:border-primary-700',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        default: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'default',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hover, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, hover, padding, className }))}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-500 dark:text-gray-400', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4 border-t border-gray-100 dark:border-neutral-800', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// Dashboard Card (como no MaterialPro)
export interface DashboardCardProps extends CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  ({ title, subtitle, action, footer, children, className, ...props }, ref) => (
    <Card ref={ref} className={className} {...props}>
      {(title || action) && (
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  )
);
DashboardCard.displayName = 'DashboardCard';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  DashboardCard,
  cardVariants,
};
