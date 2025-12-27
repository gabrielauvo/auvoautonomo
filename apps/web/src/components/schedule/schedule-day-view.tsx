'use client';

/**
 * ScheduleDayView Component
 *
 * Visualização das atividades do dia com contadores e lista
 */

import { ScheduleDayResponse } from '@/services/schedule.service';
import { ScheduleActivityCard } from './schedule-activity-card';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { Wrench, FileText, Calendar, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';

interface ScheduleDayViewProps {
  data?: ScheduleDayResponse;
  isLoading?: boolean;
  className?: string;
}

interface CounterCardProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}

function CounterCard({ label, count, icon, bgColor, textColor }: CounterCardProps) {
  return (
    <div className={cn('flex items-center gap-3 p-4 rounded-lg', bgColor)}>
      <div className={cn('p-2 rounded-full bg-white/50', textColor)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{count}</p>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </div>
  );
}

export function ScheduleDayView({
  data,
  isLoading,
  className,
}: ScheduleDayViewProps) {
  const { t } = useTranslations('schedule');

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Counter skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        {/* Activity skeletons */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.activities.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CounterCard
            label={t('counters.totalActivities')}
            count={0}
            icon={<ClipboardList className="h-5 w-5" />}
            bgColor="bg-gray-50"
            textColor="text-gray-500"
          />
          <CounterCard
            label={t('counters.workOrders')}
            count={0}
            icon={<Wrench className="h-5 w-5" />}
            bgColor="bg-blue-50"
            textColor="text-blue-500"
          />
          <CounterCard
            label={t('counters.quoteVisits')}
            count={0}
            icon={<FileText className="h-5 w-5" />}
            bgColor="bg-amber-50"
            textColor="text-amber-500"
          />
        </div>

        {/* Empty message */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('emptyState.title')}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              {t('emptyState.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CounterCard
          label={t('counters.totalActivities')}
          count={data.totalCount}
          icon={<ClipboardList className="h-5 w-5" />}
          bgColor="bg-primary-50"
          textColor="text-primary"
        />
        <CounterCard
          label={t('counters.workOrders')}
          count={data.workOrdersCount}
          icon={<Wrench className="h-5 w-5" />}
          bgColor="bg-blue-50"
          textColor="text-blue-500"
        />
        <CounterCard
          label={t('counters.quoteVisits')}
          count={data.quoteVisitsCount}
          icon={<FileText className="h-5 w-5" />}
          bgColor="bg-amber-50"
          textColor="text-amber-500"
        />
      </div>

      {/* Activities list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('activitiesOfTheDay')}
        </h2>
        <div className="space-y-3">
          {data.activities.map((activity) => (
            <ScheduleActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScheduleDayView;
