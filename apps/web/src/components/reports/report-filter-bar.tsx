'use client';

/**
 * ReportFilterBar Component
 *
 * Barra de filtros para relatórios com seleção de período
 * Sincroniza com URL query params
 */

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { Calendar, RefreshCw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportPeriod } from '@/types/reports';

interface ReportFilterBarProps {
  onExport?: (format: 'csv' | 'pdf') => void;
  onRefresh?: () => void;
  showExport?: boolean;
  isLoading?: boolean;
  className?: string;
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last7days', label: '7 dias' },
  { value: 'last30days', label: '30 dias' },
  { value: 'thisMonth', label: 'Este mês' },
  { value: 'lastMonth', label: 'Mês anterior' },
  { value: 'thisYear', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

export function ReportFilterBar({
  onExport,
  onRefresh,
  showExport = true,
  isLoading = false,
  className,
}: ReportFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPeriod = (searchParams.get('period') as ReportPeriod) || 'last30days';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  const isCustomPeriod = currentPeriod === 'custom';

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const handlePeriodChange = (period: ReportPeriod) => {
    if (period === 'custom') {
      updateParams({ period });
    } else {
      updateParams({ period, startDate: null, endDate: null });
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParams({ startDate: e.target.value || null });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParams({ endDate: e.target.value || null });
  };

  return (
    <div className={cn('bg-white border rounded-lg p-4', className)}>
      <div className="flex flex-wrap items-center gap-4">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Período:</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePeriodChange(option.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                currentPeriod === option.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {isCustomPeriod && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="w-36 h-8 text-sm"
            />
            <span className="text-gray-400">até</span>
            <Input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="w-36 h-8 text-sm"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              leftIcon={<RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />}
            >
              Atualizar
            </Button>
          )}

          {showExport && onExport && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport('csv')}
                disabled={isLoading}
                leftIcon={<Download className="h-4 w-4" />}
              >
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport('pdf')}
                disabled={isLoading}
                leftIcon={<Download className="h-4 w-4" />}
              >
                PDF
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportFilterBar;
