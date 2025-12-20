'use client';

/**
 * PlanUsageBar Component
 *
 * Barra de progresso de uso do plano
 */

import { cn } from '@/lib/utils';

interface PlanUsageBarProps {
  label: string;
  current: number;
  max: number;
  showPercentage?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function PlanUsageBar({
  label,
  current,
  max,
  showPercentage = true,
  size = 'default',
  className,
}: PlanUsageBarProps) {
  const isUnlimited = max === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / max) * 100));
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  const barColor = isAtLimit
    ? 'bg-error'
    : isNearLimit
      ? 'bg-warning'
      : 'bg-primary';

  const barHeight = {
    sm: 'h-1.5',
    default: 'h-2',
    lg: 'h-3',
  }[size];

  const textSize = {
    sm: 'text-xs',
    default: 'text-sm',
    lg: 'text-base',
  }[size];

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className={cn('font-medium text-gray-700', textSize)}>
          {label}
        </span>
        <span className={cn('text-gray-500', textSize)}>
          {isUnlimited ? (
            <span className="text-success">Ilimitado</span>
          ) : (
            <>
              <span className={cn(isAtLimit && 'text-error font-medium')}>
                {current}
              </span>
              <span className="text-gray-400"> / {max}</span>
              {showPercentage && (
                <span className="text-gray-400 ml-1">({percentage}%)</span>
              )}
            </>
          )}
        </span>
      </div>

      {!isUnlimited && (
        <div className={cn('w-full bg-gray-100 rounded-full overflow-hidden', barHeight)}>
          <div
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={`${label}: ${current} de ${max}`}
            className={cn('transition-all duration-300 rounded-full', barColor, barHeight)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {isAtLimit && !isUnlimited && (
        <p className="text-xs text-error">
          Limite atingido. Faça upgrade para continuar.
        </p>
      )}
    </div>
  );
}

export default PlanUsageBar;
