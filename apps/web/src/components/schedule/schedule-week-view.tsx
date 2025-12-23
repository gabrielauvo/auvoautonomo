'use client';

/**
 * ScheduleWeekView Component
 *
 * Visualizacao de calendário semanal com atividades
 * - Similar ao calendario mensal, mas focado em uma semana
 * - Mostra horarios mais detalhados
 * - Navegacao entre semanas
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useScheduleRange } from '@/hooks/use-schedule';
import {
  ScheduleActivity,
  ScheduleActivityStatus,
} from '@/services/schedule.service';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ScheduleWeekViewProps {
  onDayClick?: (date: string) => void;
}

/**
 * Cores por status da atividade
 */
const statusColors: Record<ScheduleActivityStatus, { bg: string; text: string; dot: string }> = {
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  DONE: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  CANCELED: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  SENT: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
  EXPIRED: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
};

const weekDaysFull = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const weekDaysShort = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Formata hora para exibicao
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Obter o inicio da semana (domingo)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obter os 7 dias da semana a partir de uma data
 */
function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Formatar data para API (YYYY-MM-DD)
 */
function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Componente de item de atividade na semana
 */
function WeekActivityItem({ activity }: { activity: ScheduleActivity }) {
  const colors = statusColors[activity.status];
  const href = activity.type === 'WORK_ORDER'
    ? `/work-orders/${activity.id}`
    : `/quotes/${activity.id}`;

  return (
    <Link href={href}>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity mb-1',
          colors.bg,
          colors.text
        )}
        title={`${activity.title} - ${activity.client.name}`}
      >
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colors.dot)} />
        <span className="font-semibold">{formatTime(activity.scheduledStart)}</span>
        <span className="truncate flex-1">{activity.client.name}</span>
      </div>
    </Link>
  );
}

// Status de OS para filtro (os principais)
type FilterStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';

const filterOptions: { status: FilterStatus; label: string; dotColor: string }[] = [
  { status: 'SCHEDULED', label: 'Agendado', dotColor: 'bg-blue-500' },
  { status: 'IN_PROGRESS', label: 'Em Andamento', dotColor: 'bg-yellow-500' },
  { status: 'DONE', label: 'Concluído', dotColor: 'bg-green-500' },
  { status: 'CANCELED', label: 'Cancelado', dotColor: 'bg-red-500' },
];

export function ScheduleWeekView({ onDayClick }: ScheduleWeekViewProps) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));

  // Filtros de status (todos ativos por padrao)
  const [activeFilters, setActiveFilters] = useState<Set<FilterStatus>>(
    new Set(['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELED'])
  );

  // Filtro por cliente
  const [clientFilter, setClientFilter] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Toggle de filtro
  const toggleFilter = (status: FilterStatus) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        if (newSet.size > 1) {
          newSet.delete(status);
        }
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // Ativar/desativar todos os filtros
  const toggleAllFilters = () => {
    if (activeFilters.size === filterOptions.length) {
      setActiveFilters(new Set(['SCHEDULED']));
    } else {
      setActiveFilters(new Set(filterOptions.map((f) => f.status)));
    }
  };

  // Dias da semana atual
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Range de datas para API
  const { startDate, endDate } = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
      startDate: formatDateForApi(weekStart),
      endDate: formatDateForApi(weekEnd),
    };
  }, [weekStart]);

  // Fetch das atividades da semana
  const { data: scheduleData, isLoading } = useScheduleRange(startDate, endDate);

  // Lista de clientes unicos da semana
  const uniqueClients = useMemo(() => {
    if (!scheduleData) return [];
    const clientsMap = new Map<string, { id: string; name: string }>();
    Object.values(scheduleData).forEach((dayData) => {
      dayData.activities.forEach((activity) => {
        if (!clientsMap.has(activity.client.id)) {
          clientsMap.set(activity.client.id, {
            id: activity.client.id,
            name: activity.client.name,
          });
        }
      });
    });
    return Array.from(clientsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [scheduleData]);

  // Clientes filtrados pela busca
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return uniqueClients;
    const search = clientSearch.toLowerCase();
    return uniqueClients.filter((c) => c.name.toLowerCase().includes(search));
  }, [uniqueClients, clientSearch]);

  // Nome do cliente selecionado
  const selectedClientName = useMemo(() => {
    if (!clientFilter) return '';
    const client = uniqueClients.find((c) => c.id === clientFilter);
    return client?.name || '';
  }, [clientFilter, uniqueClients]);

  // Navegacao
  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  // Obter atividades de um dia (com filtros aplicados)
  const getActivitiesForDay = (date: Date): ScheduleActivity[] => {
    if (!scheduleData) return [];
    const dateStr = formatDateForApi(date);
    const activities = scheduleData[dateStr]?.activities || [];
    return activities.filter((activity) => {
      const statusMatch = activeFilters.has(activity.status as FilterStatus);
      const clientMatch = !clientFilter || activity.client.id === clientFilter;
      return statusMatch && clientMatch;
    });
  };

  // Verificar se e hoje
  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Titulo da semana (ex: "22 - 28 Dezembro 2025")
  const weekTitle = useMemo(() => {
    const weekEnd = weekDays[6];
    const startMonth = monthNames[weekStart.getMonth()];
    const endMonth = monthNames[weekEnd.getMonth()];

    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${weekStart.getDate()} - ${weekEnd.getDate()} ${startMonth} ${weekStart.getFullYear()}`;
    } else if (weekStart.getFullYear() === weekEnd.getFullYear()) {
      return `${weekStart.getDate()} ${startMonth} - ${weekEnd.getDate()} ${endMonth} ${weekStart.getFullYear()}`;
    } else {
      return `${weekStart.getDate()} ${startMonth} ${weekStart.getFullYear()} - ${weekEnd.getDate()} ${endMonth} ${weekEnd.getFullYear()}`;
    }
  }, [weekStart, weekDays]);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        {/* Linha 1: Navegacao e filtro por cliente */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-2">
              {weekTitle}
            </h2>
          </div>

          {/* Filtro por cliente */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrar por cliente..."
                  value={clientFilter ? selectedClientName : clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientFilter('');
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  className={cn(
                    'pl-8 pr-8 py-1.5 text-sm border rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                    clientFilter && 'bg-primary/5 border-primary/30'
                  )}
                />
                {(clientFilter || clientSearch) && (
                  <button
                    onClick={() => {
                      setClientFilter('');
                      setClientSearch('');
                      setShowClientDropdown(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown de clientes */}
              {showClientDropdown && !clientFilter && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setClientFilter(client.id);
                        setClientSearch('');
                        setShowClientDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 truncate"
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              )}

              {showClientDropdown && !clientFilter && clientSearch && filteredClients.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 p-3 text-sm text-gray-500">
                  Nenhum cliente encontrado
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
          </div>
        </div>

        {/* Linha 2: Filtros por Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 mr-1">Filtrar:</span>
          {filterOptions.map((filter) => {
            const isActive = activeFilters.has(filter.status);
            return (
              <button
                key={filter.status}
                onClick={() => toggleFilter(filter.status)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border',
                  isActive
                    ? 'bg-white border-gray-300 text-gray-700 shadow-sm'
                    : 'bg-gray-100 border-transparent text-gray-400 hover:bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full transition-opacity',
                    filter.dotColor,
                    !isActive && 'opacity-40'
                  )}
                />
                {filter.label}
              </button>
            );
          })}
          <button
            onClick={toggleAllFilters}
            className="ml-2 text-xs text-primary hover:underline font-medium"
          >
            {activeFilters.size === filterOptions.length ? 'Limpar' : 'Todos'}
          </button>
        </div>
      </div>

      {/* Overlay para fechar dropdown */}
      {showClientDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowClientDropdown(false)}
        />
      )}

      {/* Grid da semana */}
      <div className="grid grid-cols-7">
        {/* Header dos dias */}
        {weekDays.map((date, index) => (
          <div
            key={index}
            className={cn(
              'py-3 px-2 text-center border-r border-b last:border-r-0',
              isToday(date) ? 'bg-primary/5' : 'bg-gray-50'
            )}
          >
            <div className="text-xs font-medium text-gray-500">
              {weekDaysShort[date.getDay()]}
            </div>
            <div
              className={cn(
                'text-lg font-semibold mt-1',
                isToday(date)
                  ? 'bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto'
                  : 'text-gray-900'
              )}
            >
              {date.getDate()}
            </div>
          </div>
        ))}

        {/* Conteudo dos dias */}
        {weekDays.map((date, index) => {
          const activities = getActivitiesForDay(date);
          const dateStr = formatDateForApi(date);
          const hasMore = activities.length > 6;
          const displayActivities = activities.slice(0, 6);

          return (
            <div
              key={`content-${index}`}
              className={cn(
                'min-h-[200px] border-r last:border-r-0 p-2',
                isToday(date) && 'bg-primary/5',
                isLoading && 'animate-pulse'
              )}
              onClick={() => onDayClick?.(dateStr)}
            >
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                </div>
              ) : activities.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-gray-400">Sem atividades</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayActivities.map((activity) => (
                    <WeekActivityItem key={activity.id} activity={activity} />
                  ))}
                  {hasMore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDayClick?.(dateStr);
                      }}
                      className="text-xs text-primary hover:underline font-medium pl-2"
                    >
                      mais +{activities.length - 6}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ScheduleWeekView;
