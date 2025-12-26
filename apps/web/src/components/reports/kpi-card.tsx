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
import { useTranslations } from '@/i18n';
import { useFormatting } from '@/context/company-settings-context';

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

export const KpiCard = memo(function KpiCard({
  title,
  value,
  change,
  changeLabel,
  format,
  icon,
  iconBgColor = 'bg-primary-50',
  loading = false,
  className,
}: KpiCardProps) {
  const { t } = useTranslations('reports');
  const { formatCurrency } = useFormatting();

  // Formata valor baseado no tipo
  const formatValue = (val: number | string, fmt?: KpiCardProps['format']): string => {
    if (typeof val === 'string') return val;

    switch (fmt) {
      case 'currency':
        return formatCurrency(val);
      case 'percent':
        return `${val.toFixed(1)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat().format(val);
    }
  };

  // Memoiza formatação do valor para evitar cálculos desnecessários
  const formattedValue = useMemo(() => formatValue(value, format), [value, format, formatCurrency]);

  // Default changeLabel
  const displayChangeLabel = changeLabel ?? t('vsPrevious');

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
                <span className="text-xs text-gray-400">{displayChangeLabel}</span>
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
