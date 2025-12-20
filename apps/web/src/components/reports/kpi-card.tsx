'use client';

/**
 * KpiCard Component
 *
 * Card para exibir KPIs com valor, variação e ícone
 * Otimizado com React.memo para evitar re-renders desnecessários
 */

import { ReactNode, memo, useMemo } from 'react';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  change?: number;
  changeLabel?: string;
  format?: 'number' | 'currency' | 'percent';
  icon?: ReactNode;
  iconBgColor?: string;
  loading?: boolean;
  className?: string;
}

/**
 * Formata valor baseado no tipo
 */
function formatValue(value: number | string, format?: KpiCardProps['format']): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('pt-BR').format(value);
  }
}

export const KpiCard = memo(function KpiCard({
  title,
  value,
  change,
  changeLabel = 'vs. anterior',
  format,
  icon,
  iconBgColor = 'bg-primary-50',
  loading = false,
  className,
}: KpiCardProps) {
  // Memoiza formatação do valor para evitar cálculos desnecessários
  const formattedValue = useMemo(() => formatValue(value, format), [value, format]);

  // Memoiza estados derivados
  const changeStatus = useMemo(() => ({
    isPositive: change !== undefined && change > 0,
    isNegative: change !== undefined && change < 0,
    isNeutral: change === undefined || change === 0,
  }), [change]);

  const { isPositive, isNegative, isNeutral } = changeStatus;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card hover="lift" className={className}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formattedValue}
            </p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {isPositive && <TrendingUp className="h-3 w-3 text-success" />}
                {isNegative && <TrendingDown className="h-3 w-3 text-error" />}
                {isNeutral && <Minus className="h-3 w-3 text-gray-400" />}
                <span
                  className={cn(
                    'text-xs font-medium',
                    isPositive && 'text-success',
                    isNegative && 'text-error',
                    isNeutral && 'text-gray-400'
                  )}
                >
                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400">{changeLabel}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('p-3 rounded-lg text-primary', iconBgColor)}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default KpiCard;
