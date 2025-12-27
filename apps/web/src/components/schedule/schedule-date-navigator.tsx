'use client';

/**
 * ScheduleDateNavigator Component
 *
 * Navegação entre datas com botões prev/next e exibição da data atual
 */

import { Button } from '@/components/ui';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatDateDisplay, isToday, addDays, getDateString } from '@/hooks/use-schedule';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';

interface ScheduleDateNavigatorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  className?: string;
}

export function ScheduleDateNavigator({
  selectedDate,
  onDateChange,
  className,
}: ScheduleDateNavigatorProps) {
  const { t } = useTranslations('schedule');

  const handlePrevDay = () => {
    onDateChange(addDays(selectedDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(addDays(selectedDate, 1));
  };

  const handleToday = () => {
    onDateChange(getDateString(new Date()));
  };

  const isTodaySelected = isToday(selectedDate);
  const formattedDate = formatDateDisplay(selectedDate);

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-lg border border-gray-200',
        className
      )}
    >
      {/* Botões de navegação */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevDay}
          leftIcon={<ChevronLeft className="h-4 w-4" />}
        >
          {t('previous')}
        </Button>

        <Button
          variant={isTodaySelected ? 'default' : 'outline'}
          size="sm"
          onClick={handleToday}
          leftIcon={<Calendar className="h-4 w-4" />}
        >
          {t('today')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNextDay}
          rightIcon={<ChevronRight className="h-4 w-4" />}
        >
          {t('next')}
        </Button>
      </div>

      {/* Data atual */}
      <div className="text-center sm:text-right">
        <p className="text-lg font-semibold text-gray-900 capitalize">
          {formattedDate}
        </p>
        {isTodaySelected && (
          <span className="text-sm text-primary font-medium">{t('today')}</span>
        )}
      </div>
    </div>
  );
}

export default ScheduleDateNavigator;
