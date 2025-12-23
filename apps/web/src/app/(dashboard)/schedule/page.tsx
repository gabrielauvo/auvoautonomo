'use client';

/**
 * Schedule Page - Agenda / Calendário de Atividades
 *
 * Visualização das atividades:
 * - Work Orders agendadas
 * - Visitas de orçamento (Quote visits)
 *
 * Features:
 * - Toggle entre visualização de Lista (diária) e Calendário (mensal)
 * - Navegação entre dias/meses
 * - Contadores por tipo de atividade
 * - Cores por status da OS
 * - Clique para abrir detalhes
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { useScheduleDay, getDateString } from '@/hooks/use-schedule';
import {
  ScheduleDateNavigator,
  ScheduleDayView,
  ScheduleCalendarView,
  ScheduleWeekView,
} from '@/components/schedule';
import { Alert } from '@/components/ui';
import { AlertCircle, RefreshCw, List, CalendarDays, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';

type ViewMode = 'list' | 'week' | 'calendar';

export default function SchedulePage() {
  const { t } = useTranslations('schedule');

  // Estado da visualização
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // Estado da data selecionada (hoje por padrão)
  const [selectedDate, setSelectedDate] = useState(() =>
    getDateString(new Date())
  );

  // Fetch das atividades do dia (apenas para modo lista)
  const { data, isLoading, error, refetch } = useScheduleDay(selectedDate);

  // Handler para quando clicar em um dia no calendário
  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setViewMode('list');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('subtitle')}
            </p>
          </div>

          {/* Toggle de visualização */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <List className="h-4 w-4" />
              {t('list')}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Calendar className="h-4 w-4" />
              {t('week')}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <CalendarDays className="h-4 w-4" />
              {t('calendar')}
            </button>
          </div>
        </div>

        {/* Visualização de Lista (Diária) */}
        {viewMode === 'list' && (
          <>
            {/* Navegação de data */}
            <ScheduleDateNavigator
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />

            {/* Erro */}
            {error && (
              <Alert variant="error">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t('errorLoading')}</span>
                  </div>
                  <button
                    onClick={() => refetch()}
                    className="flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t('reload')}
                  </button>
                </div>
              </Alert>
            )}

            {/* Visualização do dia */}
            <ScheduleDayView data={data} isLoading={isLoading} />
          </>
        )}

        {/* Visualização de Semana */}
        {viewMode === 'week' && (
          <ScheduleWeekView onDayClick={handleDayClick} />
        )}

        {/* Visualização de Calendário (Mensal) */}
        {viewMode === 'calendar' && (
          <ScheduleCalendarView onDayClick={handleDayClick} />
        )}
      </div>
    </AppLayout>
  );
}
