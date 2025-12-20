import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { LucideIcon } from 'lucide-react';

/**
 * Auvo Design System - Empty State Component
 *
 * Usado quando não há dados para exibir
 */

interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: IconProp,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  // Render icon - handle both Lucide components and React nodes
  const renderIcon = () => {
    if (!IconProp) return null;

    // Check if it's a valid React element already (like <Users /> or React.createElement result)
    if (React.isValidElement(IconProp)) {
      return IconProp;
    }

    // Check if it's a component function (Lucide icons are functions)
    if (typeof IconProp === 'function') {
      return React.createElement(IconProp, { className: 'h-8 w-8 text-gray-400' });
    }

    // Fallback - shouldn't happen normally
    return null;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {IconProp && (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          {renderIcon()}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}

export default EmptyState;
